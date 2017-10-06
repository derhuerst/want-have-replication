'use strict'

const test = require('tape')

const createPeer = require('.')

test('basic replication', (t) => {
	t.plan(4)

	const i1 = {foo: 'bar'}
	const onI2 = item => t.deepEqual(item, i2)
	const i2 = {bar: 'baz'}
	const onI1 = item => t.deepEqual(item, i1)

	const p1 = createPeer(onI2)
	p1.add(i1)
	p1.on('add', onI2)

	const p2 = createPeer(onI1)
	p2.add(i2)
	p2.on('add', onI1)

	const r1 = p1.replicate()
	const r2 = p2.replicate()
	r1.pipe(r2).pipe(r1)
})
