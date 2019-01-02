'use strict'

const test = require('tape')
const sortBy = require('lodash.sortby')

const createPeer = require('./dist')

const noop = () => {}

test('A <-> B replication', (t) => {
	t.plan(2 + 2 + 2)

	const i1 = ['bar', 'baz']
	const onI2 = item => t.deepEqual(item, i2)
	const i2 = ['foo', 'bar']
	const onI1 = item => t.deepEqual(item, i1)

	const p1 = createPeer('p1', onI2)
	p1.add(i1)
	p1.on('add', onI2)

	const p2 = createPeer(onI1)
	p2.add(i2)
	p2.on('add', onI1)

	const r1 = p1.replicate()
	const r2 = p2.replicate()
	r1.pipe(r2).pipe(r1)

	r1.on('synced', () => {
		t.deepEqual(sortBy(p1.all(), 0), [i1, i2])
	})
	r2.on('synced', () => {
		t.deepEqual(sortBy(p2.all(), 0), [i1, i2])
	})
})

test('A <-> B <-> C replication', (t) => {
	t.plan(4)

	const first = ['first item']
	const A = createPeer('A', noop)
	A.add(first)

	const second = ['second item']
	const B = createPeer('B', noop)
	B.add(second)

	const third = ['third item']
	const C = createPeer('C', noop)
	C.add(third)

	const rA = A.replicate()
	rA.pipe(B.replicate()).pipe(rA)
	const rC = C.replicate()
	rC.pipe(B.replicate()).pipe(rC)

	rA.on('synced', () => {
		t.deepEqual(sortBy(A.all(), 0), [first, second, third])
	})
	rC.on('synced', () => {
		t.deepEqual(sortBy(C.all(), 0), [first, second, third])
	})
})
