'use strict'

const randomId = require('alphanumeric-id')
const ndjson = require('ndjson')
const duplexer = require('duplexer3')
const {EventEmitter} = require('events')

const HANDSHAKE = 0 // to find the leader
const HAVE = 1 // peer has an item
const RECEIVE = 2 // leader is going to send an item
const SEND = 3 // leader is going to wait for an item
const SYNCED = 4 // all items have been synced (for now)

const createPeer = (onItem) => {
	const have = Object.create(null)
	const want = []

	const add = (item) => {
		const id = randomId(12)
		have[id] = item
		peer.emit('_have', id)
	}

	const all = () => {
		const all = []
		for (let id in have) all.push(have[id])
		return all
	}

	const replicate = () => {
		let handshakeDone = false, isLeader, x
		const peerHas = []
		let idOfItemToBeReceived = null

		const incoming = ndjson.parse() // todo: multiplex?
		const outgoing = ndjson.stringify() // todo: multiplex?

		const sendPkt = (pkt) => {
			outgoing.write(pkt)
		}
		const sendCmd = (cmd, ...args) => {
			sendPkt([cmd, ...args])
		}

		const onPkt = (pkt) => { // [command, optional payload]
			if (idOfItemToBeReceived) {
				if (!(idOfItemToBeReceived in have)) {
					have[idOfItemToBeReceived] = pkt
					peer.emit('_have', idOfItemToBeReceived)
					peer.emit('add', pkt)
				}
				idOfItemToBeReceived = null

				setImmediate(onItem, pkt)
				if (isLeader) setTimeout(tick)
				return
			}

			if (!Array.isArray(pkt) || pkt.length === 0) {
				return cb(new Error('invalid packet format'))
			}
			const cmd = pkt[0]

			if (cmd === HANDSHAKE) {
				if (handshakeDone) return // invalid command
				const peerX = pkt[1]
				if ('number' !== typeof peerX) return // invalid data

				if (peerX === x) return sendHandshake()
				isLeader = peerX < x
				handshakeDone = true
			} else if (cmd === SYNCED) {
				replicationStream.emit('synced')
			} else {
				const id = pkt[1]
				if ('string' !== typeof id) return // invalid data

				if (cmd === HAVE) {
					if (!peerHas.includes(id)) peerHas.push(id)
					if (!(id in have) && !want.includes(id)) {
						want.push(id)
						peer.emit('_want', id)
					}
				} else if (cmd === RECEIVE && !isLeader) {
					idOfItemToBeReceived = id
				} else if (cmd === SEND && !isLeader) {
					sendPkt(have[id])
				} else return // invalid command
			}

			if (isLeader && handshakeDone) setTimeout(tick)
		}

		const sendHandshake = () => {
			x = Math.random()
			sendCmd(HANDSHAKE, x)
		}

		const tick = () => {
			let i = want.findIndex(id => peerHas.includes(id))
			if (i >= 0) {
				idOfItemToBeReceived = want[i]
				want.splice(i, 1)
				sendCmd(SEND, idOfItemToBeReceived)
				return
			}

			const id = Object.keys(have).find(id => !peerHas.includes(id))
			if (id) {
				peerHas.push(id)
				sendCmd(RECEIVE, id)
				outgoing.write(have[id])

				setTimeout(tick)
				return
			}

			sendCmd(SYNCED)
			replicationStream.emit('synced')
		}

		incoming.on('data', onPkt)
		for (let id in have) sendCmd(HAVE, id)
		sendHandshake()
		peer.on('_have', (id) => {
			if (!peerHas.includes(id)) sendCmd(HAVE, id)
		})

		const replicationStream = duplexer({objectMode: true}, incoming, outgoing)
		return replicationStream
	}

	const peer = new EventEmitter()
	peer.name = name
	peer.add = add
	peer.all = all
	peer.replicate = replicate
	return peer
}

module.exports = createPeer
