'use strict'

const test = require('tape')
const sortBy = require('lodash.sortby')

const createPeer = require('./dist')

const noop = () => {}

test('A <-> B replication', (t) => {
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

test('A <-> B <-> C replication', (t) => {
	t.plan(3)

	const first = ['first item']
	const A = createPeer(noop)
	A.add(first)

	const second = ['second item']
	const B = createPeer(noop)
	B.add(second)

	const third = ['third item']
	const C = createPeer(noop)
	C.add(third)

	const rA = A.replicate()
	rA.pipe(B.replicate()).pipe(rA)
	const rC = C.replicate()
	rC.pipe(B.replicate()).pipe(rC)

	setTimeout(() => {
		const allThree = [first, second, third]
		t.deepEqual(sortBy(A.all(), 0), allThree)
		t.deepEqual(sortBy(B.all(), 0), allThree)
		t.deepEqual(sortBy(C.all(), 0), allThree)
	}, 100)
})
