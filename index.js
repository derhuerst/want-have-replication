'use strict'

const cryptoRandomString = require('crypto-random-string')
const {EventEmitter} = require('events')
const {Readable, Writable} = require('stream')
const duplexer = require('duplexer3')

const HANDSHAKE = 0 // to find the leader
const HAVE = 1 // has an item
const WANT = 2 // wants an item
const SEND = 3 // is going to send an item

const createPeer = (name, onItem) => { // todo: remove name
	const have = Object.create(null)
	const want = []

	const add = (item) => {
		const id = cryptoRandomString(12)
		have[id] = item
		peer.emit('_have', id)
	}

	const replicate = () => {
		const peerWants = []
		let handshakeDone = false, isLeader, x

		const onPkt = (pkt, _, cb) => { // [command, optional payload]
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
				console.error(name, 'leader?', isLeader)
			} else {
				const id = pkg[1]
				if ('string' !== typeof id) return cb() // invalid data

				if (cmd === HAVE) {
					if (!(id in have) && !want.includes(id)) {
						want.push(id)
						peer.emit('_want', id)
					}
				} else if (cmd === WANT) {
					if (!peerWants.includes(id)) peerWants.push(id)
				} else if (cmd === SEND) {
					if (isLeader) return cb() // invalid command
					// todo
				} else {
					console.error(name, 'unknown packet', pkt)
					return cb()
				}
			}
			if (isLeader) setTimeout(tick)
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
		sendHandshake()

		const tick = () => {
			// todo
		}

		return duplexer({objectMode: true}, incoming, outgoing)
	}

	const peer = new EventEmitter()
	peer.add = add
	peer.replicate = replicate
	return peer
}

module.exports = createPeer
