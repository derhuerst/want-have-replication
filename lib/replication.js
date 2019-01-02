'use strict'

const HAVE = 10 // peer has an item
const ITEM = 11 // peer sends an item

const replicate = (items, addItem, sendToPeer, emitOnReplication, debug) => {
	const peerHas = []
	let idOfItemBeingSent = null
	let isPeerSynced = true

	const findItemToSend = () => {
		const id = Object.keys(items).find(id => !peerHas.includes(id))
		return id === undefined ? null : id
	}

	const onMsg = (msg) => { // [command, optional payload]
		if (!Array.isArray(msg)) return debug('invalid msg')
		const [cmd, id] = msg
		if ('string' !== typeof id) return debug('invalid msg')

		if (cmd === HAVE) {
			if (idOfItemBeingSent === id) idOfItemBeingSent = null
			if (!peerHas.includes(id)) {
				peerHas.push(id)
				emitOnReplication('have', id)

				if (findItemToSend() === null) {
					debug('peer is synced')
					isPeerSynced = true
					emitOnReplication('synced')
				}
			}
		} else if (cmd === ITEM) {
			if (id in items) return debug('peer already has the item', id)

			if (msg.length !== 3) return debug('invalid msg')
			const item = msg[2]

			sendToPeer([HAVE, id])
			addItem(id, item)
		} else debug('invalid cmd')

		setImmediate(tick)
	}

	const tick = () => {
		debug('tick')

		if (idOfItemBeingSent !== null) return; // already sending
		const id = findItemToSend()
		if (id === null) return; // nothing to send

		debug('sending', id)
		idOfItemBeingSent = id
		sendToPeer([ITEM, id, items[id]])
	}

	const onSelfAdd = (id) => {
		if (peerHas.includes(id)) return;
		sendToPeer([HAVE, id])
		if (isPeerSynced) {
			debug('peer is not synced')
			isPeerSynced = false
			emitOnReplication('not-synced')
		}

		setImmediate(tick)
	}

	setImmediate(() => {
		for (let id in items) onSelfAdd(id)
	})

	return {onMsg, onSelfAdd}
}

// replicate.HANDSHAKE = HANDSHAKE
replicate.HAVE = HAVE
replicate.ITEM = ITEM
module.exports = replicate
