'use strict'

const cryptoRandomString = require('crypto-random-string')
const ndjson = require('ndjson')
const duplexer = require('duplexer3')
const {EventEmitter} = require('events')

const HANDSHAKE = 0 // to find the leader
const HAVE = 1 // peer has an item
const WANT = 2 // peer wants an item
const RECEIVE = 3 // leader is going to send an item
const SEND = 4 // leader is going to wait for an item

const createPeer = (onItem) => {
	const have = Object.create(null)
	const want = []

	const add = (item) => {
		const id = cryptoRandomString(12)
		have[id] = item
		peer.emit('_have', id)
	}

	const all = () => Object.values(have)

	const replicate = () => {
		let handshakeDone = false, isLeader, x

		const peerHas = []
		const peerWants = []
		let receivingId = null

		const onPkt = (pkt) => { // [command, optional payload]
			if (receivingId) {
				have[receivingId] = pkt
				peer.emit('_have', receivingId)
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
					const i = peerWants.indexOf(id)
					if (i >= 0) peerWants.splice(i, 1)

					if (!(id in have) && !want.includes(id)) {
						want.push(id)
						peer.emit('_want', id)
					}
				} else if (cmd === WANT) {
					if (!peerWants.includes(id)) peerWants.push(id)
				} else if (cmd === RECEIVE) {
					if (isLeader) return // invalid command
					receivingId = id
				} else if (cmd === SEND) {
					if (isLeader) return // invalid command
					outgoing.write(have[id])
				} else return
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

		const tick = () => {
			let i = want.findIndex(id => peerHas.includes(id))
			if (i >= 0) {
				receivingId = want[i]
				want.splice(i, 1)
				outgoing.write([SEND, receivingId])
				return
			}

			i = peerWants.findIndex(id => have[id])
			if (i >= 0) {
				const id = peerWants[i]
				peerWants.splice(i, 1)
				outgoing.write([RECEIVE, id])
				outgoing.write(have[id])

				setTimeout(tick)
			}
		}

		for (let id in have) {
			peerWants.push(id)
			outgoing.write([HAVE, id])
		}
		for (let id of want) outgoing.write([WANT, id])
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
