'use strict'

const createPeer = require('.')

const p1 = createPeer('p1', item => console.log('p1 received', item))
p1.add({foo: 'bar'})
p1.add([1, 2])

const p2 = createPeer('p2', item => console.log('p2 received', item))
p2.add({bar: 'baz'})

const r1 = p1.replicate()
const r2 = p2.replicate()
r1.pipe(r2).pipe(r1)
