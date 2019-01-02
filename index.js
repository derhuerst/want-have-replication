'use strict'

const randomId = require('alphanumeric-id')
const debugReplication = require('debug')('want-have-replication:replication')
const debugState = require('debug')('want-have-replication:state')
const ndjson = require('ndjson')
const duplexer = require('duplexer3')
const {EventEmitter} = require('events')

const HANDSHAKE = 0 // to find the leader
const HAVE = 1 // peer has an item
const RECEIVE = 2 // leader is going to send an item
const SEND = 3 // leader is going to wait for an item
const SYNCED = 4 // all items have been synced (for now)

const createPeer = (name, onItem) => {
	if ('function' === typeof name) {
		onItem = name
		name = randomId(3)
	}
	if ('function' !== typeof onItem) throw new Error('onItem must be a function')
	const selfHas = Object.create(null)
	const selfWants = []

	const add = (item) => {
		const id = randomId(12)
		selfHas[id] = item
		self.emit('_have', id)
	}

	const all = () => {
		const all = []
		for (let id in selfHas) all.push(selfHas[id])
		return all
	}

	const replicate = () => {
		let handshakeDone = false, isLeader, ownX
		const peerHas = []
		let idOfItemToBeReceived = null

		const incoming = ndjson.parse() // todo: multiplex?
		const outgoing = ndjson.stringify() // todo: multiplex?

		const sendPkt = (pkt) => {
			debugReplication(name, '->', pkt)
			outgoing.write(pkt)
		}
		const sendCmd = (cmd, ...args) => {
			sendPkt([cmd, ...args])
		}

		const onHandshakeCmd = (peerX) => { // [command, optional payload]
			if (handshakeDone) {
				return debugReplication(name, 'invalid packet', pkt)
			}
			if ('number' !== typeof peerX) {
				return debugReplication(name, 'invalid packet', pkt)
			}
			if (peerX === ownX) {
				debugReplication(name, 'equal handshake value, restarting')
				return sendHandshake()
			}
			isLeader = peerX < ownX
			handshakeDone = true
		}

		const onHaveCmd = (id) => {
			if (!peerHas.includes(id)) {
				peerHas.push(id)
				debugState(name, 'has', peerHas)
			}
			if (!(id in selfHas) && !selfWants.includes(id)) {
				selfWants.push(id)
				self.emit('_want', id)
			}
		}

		const onPkt = (pkt) => { // [command, optional payload]
			debugReplication(name, '<-', pkt)

			if (idOfItemToBeReceived) {
				if (!(idOfItemToBeReceived in selfHas)) {
					selfHas[idOfItemToBeReceived] = pkt
					self.emit('_have', idOfItemToBeReceived)
					self.emit('add', pkt)
				}
				idOfItemToBeReceived = null

				setImmediate(onItem, pkt)
				if (isLeader) setTimeout(tick)
				return
			}

			if (!Array.isArray(pkt) || pkt.length === 0) {
				debugReplication(name, 'invalid packet', pkt)
				return
			}
			const cmd = pkt[0]

			if (cmd === HANDSHAKE) {
				onHandshakeCmd(...pkt.slice(1))
			} else if (cmd === SYNCED) {
				debugReplication(name, 'peer is synced')
				replicationStream.emit('synced')
			} else {
				const id = pkt[1]
				if ('string' !== typeof id) {
					debugReplication(name, 'invalid ID', pkt)
					return
				}

				if (cmd === HAVE) {
					onHaveCmd(id)
				} else if (cmd === RECEIVE && !isLeader) {
					idOfItemToBeReceived = id
				} else if (cmd === SEND && !isLeader) {
					sendPkt(selfHas[id])
				} else {
					debugReplication(name, 'invalid command', pkt)
					return
				}
			}

			if (isLeader && handshakeDone) setTimeout(tick)
		}

		const sendHandshake = () => {
			ownX = Math.random()
			sendCmd(HANDSHAKE, ownX)
		}

		const tick = () => {
			debugReplication(name, 'tick')

			let i = selfWants.findIndex(id => peerHas.includes(id))
			if (i >= 0) {
				idOfItemToBeReceived = selfWants[i]
				selfWants.splice(i, 1)
				sendCmd(SEND, idOfItemToBeReceived)
				return
			}

			const id = Object.keys(selfHas).find(id => !peerHas.includes(id))
			if (id) {
				peerHas.push(id)
				debugState(name, 'has', peerHas)

				sendCmd(RECEIVE, id)
				outgoing.write(selfHas[id])

				setTimeout(tick)
				return
			}

			sendCmd(SYNCED)
			replicationStream.emit('synced')
		}

		incoming.on('data', onPkt)
		for (let id in selfHas) sendCmd(HAVE, id)
		sendHandshake()
		self.on('_have', (id) => {
			if (!peerHas.includes(id)) sendCmd(HAVE, id)
		})

		const replicationStream = duplexer({objectMode: true}, incoming, outgoing)
		return replicationStream
	}

	const self = new EventEmitter()
	self.name = name
	self.add = add
	self.all = all
	self.replicate = replicate

	self.on('_have', () => {
		debugState(name, 'has', Object.keys(selfHas))
	})

	return self
}

module.exports = createPeer
