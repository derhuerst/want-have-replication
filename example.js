'use strict'

const createPeer = require('.')

const A = createPeer(item => console.log('A received', item))
A.add(['first item'])

const B = createPeer(item => console.log('B received', item))
B.add(['second item'])

const C = createPeer(item => console.log('C received', item))
C.add(['third item'])

// A <-> B <-> C replication
const rA = A.replicate()
rA.pipe(B.replicate()).pipe(rA)
const rC = C.replicate()
rC.pipe(B.replicate()).pipe(rC)
