'use strict'

const randomId = require('alphanumeric-id')
const ndjson = require('ndjson')
const duplexer = require('duplexer3')
const {EventEmitter} = require('events')

const HANDSHAKE = 0 // to find the leader
const HAVE = 1 // peer has an item
const RECEIVE = 2 // leader is going to send an item
const SEND = 3 // leader is going to wait for an item

const createPeer = (onItem) => {
	const have = Object.create(null)
	const want = []

	const add = (item) => {
		const id = randomId(12)
		have[id] = item
		peer.emit('_have', id)
	}

	const all = () => Object.values(have)

	const replicate = () => {
		let handshakeDone = false, isLeader, x

		const peerHas = []
		let receivingId = null

		const onPkt = (pkt) => { // [command, optional payload]
			if (receivingId) {
				if (!(receivingId in have)) {
					have[receivingId] = pkt
					peer.emit('_have', receivingId)
					peer.emit('add', pkt)
				}
				receivingId = null

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
					receivingId = id
				} else if (cmd === SEND && !isLeader) {
					outgoing.write(have[id])
				} else return // invalid command
			}

			if (isLeader && handshakeDone) setTimeout(tick)
		}

		const incoming = ndjson.parse() // todo: multiplex?
		incoming.on('data', onPkt)
		const outgoing = ndjson.stringify() // todo: multiplex?

		const sendHandshake = () => {
			x = Math.random()
			outgoing.write([HANDSHAKE, x])
		}

		for (let id in have) outgoing.write([HAVE, id])
		sendHandshake()
		peer.on('_have', (id) => {
			if (!peerHas.includes(id)) outgoing.write([HAVE, id])
		})

		const tick = () => {
			let i = want.findIndex(id => peerHas.includes(id))
			if (i >= 0) {
				receivingId = want[i]
				want.splice(i, 1)
				outgoing.write([SEND, receivingId])
				return
			}

			const id = Object.keys(have).find(id => !peerHas.includes(id))
			if (id) {
				peerHas.push(id)
				outgoing.write([RECEIVE, id])
				outgoing.write(have[id])

				setTimeout(tick)
			}
		}

		return duplexer({objectMode: true}, incoming, outgoing)
	}

	const peer = new EventEmitter()
	peer.add = add
	peer.all = all
	peer.replicate = replicate
	return peer
}

module.exports = createPeer
