'use strict'

const cryptoRandomString = require('crypto-random-string')
const {EventEmitter} = require('events')
const {Readable, Writable} = require('stream')
const duplexer = require('duplexer3')

const HANDSHAKE = 0 // to find the leader
const HAVE = 1 // peer has an item
const WANT = 2 // peer wants an item
const RECEIVE = 3 // leader is going to send an item
const SEND = 4 // leader is going to wait for an item

const createPeer = (name, onItem) => { // todo: remove name
	const have = Object.create(null)
	const want = []

	const add = (item) => {
		const id = cryptoRandomString(12)
		have[id] = item
		peer.emit('_have', id)
	}

	const all = () => {
		return Object.values(have)
	}

	const replicate = () => {
		let handshakeDone = false, isLeader, x

		const peerHas = []
		const peerWants = []
		let receivingId = null

		const onPkt = (pkt, _, cb) => { // [command, optional payload]
			if (receivingId) {
				have[receivingId] = pkt
				peer.emit('_have', receivingId)
				receivingId = null

				setImmediate(onItem, pkt)
				if (isLeader) setTimeout(tick)
				return cb()
			}

			if (!Array.isArray(pkt) || pkt.length === 0) {
				return cb(new Error('invalid packet format'))
			}
			const cmd = pkt[0]

			if (cmd === HANDSHAKE) {
				if (handshakeDone) return cb() // invalid command
				const peerX = pkt[1]
				if ('number' !== typeof peerX) return cb() // invalid data

				if (peerX === x) {
					sendHandshake()
					return cb()
				}
				isLeader = peerX < x
				handshakeDone = true
			} else {
				const id = pkt[1]
				if ('string' !== typeof id) return cb() // invalid data

				if (cmd === HAVE) {
					if (!peerHas.includes(id)) peerHas.push(id)
					const i = peerWants.indexOf(id)
					if (i >= 0) peerWants.splice(i, 1)

					if (!(id in have) && !want.includes(id)) {
						want.push(id)
						peer.emit('_want', id)
					}
				} else if (cmd === WANT) {
					if (!peerWants.includes(id)) peerWants.push(id)
				} else if (cmd === RECEIVE) {
					if (isLeader) return cb() // invalid command
					receivingId = id
				} else if (cmd === SEND) {
					if (isLeader) return cb() // invalid command
					outgoing.push(have[id])
				} else {
					return cb()
				}
			}

			if (isLeader && handshakeDone) setTimeout(tick)
			return cb()
		}

		const incoming = new Writable({
			objectMode: true, // todo: serialize, multiplex?
			write: onPkt
		})
		const outgoing = new Readable({
			objectMode: true, // todo: serialize, multiplex?
			read: () => {}
		})

		const sendHandshake = () => {
			x = Math.random()
			outgoing.push([HANDSHAKE, x])
		}

		const tick = () => {

			let i = want.findIndex(id => peerHas.includes(id))
			if (i >= 0) {
				receivingId = want[i]
				want.splice(i, 1)
				outgoing.push([SEND, receivingId])
				return
			}

			i = peerWants.findIndex(id => have[id])
			if (i >= 0) {
				const id = peerWants[i]
				peerWants.splice(i, 1)
				outgoing.push([RECEIVE, id])
				outgoing.push(have[id])

				setTimeout(tick)
			}
		}

		for (let id in have) {
			peerWants.push(id)
			outgoing.push([HAVE, id])
		}
		for (let id of want) outgoing.push([WANT, id])
		peer.on('_have', (id) => {
			if (!peerHas.includes(id) && !peerWants.includes(id)) {
				peerWants.push(id)
			}
		})
		sendHandshake()

		return duplexer({objectMode: true}, incoming, outgoing)
	}

	const peer = new EventEmitter()
	peer.add = add
	peer.all = all
	peer.replicate = replicate
	return peer
}

module.exports = createPeer
