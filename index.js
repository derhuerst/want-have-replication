'use strict'

const randomId = require('alphanumeric-id')
const createDebug = require('debug')
const ndjson = require('ndjson')
const duplexer = require('duplexer3')
const {EventEmitter} = require('events')

const createReplication = require('./lib/replication')

const debug = createDebug('want-have-replication:state')

const createPeer = (name, onItem) => {
	if ('function' === typeof name) {
		onItem = name
		name = randomId(3)
	}
	if ('function' !== typeof onItem) throw new Error('onItem must be a function')

	const items = Object.create(null)

	const addItem = (id, item) => {
		items[id] = item
		self.emit('have', id)
		self.emit('add', id, item)
	}
	const add = item => addItem(randomId(12), item)

	const all = () => {
		const all = []
		for (let id in items) all.push(items[id]) // Object.values(items)
		return all
	}

	const replicate = () => {
		const incoming = ndjson.parse()
		const outgoing = ndjson.stringify()
		const replication = duplexer({objectMode: true}, incoming, outgoing)

		const sendToPeer = (msg) => {
			debug(name, '->', msg)
			outgoing.write(msg)
		}
		const emitOnReplication = (ev, ...args) => {
			replication.emit(ev, ...args)
		}
		const debug = createDebug('want-have-replication:replication')
		const {
			onMsg: handlePeerMsg,
			onSelfAdd
		} = createReplication(items, addItem, sendToPeer, emitOnReplication, debug)

		incoming.on('data', (msg) => {
			debug(name, '<-', msg)
			handlePeerMsg(msg)
		})
		self.on('add', onSelfAdd)
		replication.once('close', () => {
			self.removeListener('add', onSelfAdd)
		})

		return replication
	}

	const self = new EventEmitter()
	self.name = name
	self.add = add
	self.all = all
	self.replicate = replicate

	self.on('have', () => {
		debug(name, 'has', Object.keys(items))
	})

	return self
}

module.exports = createPeer
