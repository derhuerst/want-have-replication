'use strict'

const test = require('tape')

const createPeer = require('.')

test('basic replication', (t) => {
	t.plan(2)

	const i1 = {foo: 'bar'}
	const i2 = {bar: 'baz'}

	const p1 = createPeer('p1', item => t.deepEqual(item, i2))
	p1.add(i1)

	const p2 = createPeer('p2', item => t.deepEqual(item, i1))
	p2.add(i2)

	const r1 = p1.replicate()
	const r2 = p2.replicate()
	r1.pipe(r2).pipe(r1)
})
