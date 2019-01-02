# want-have-replication

**Replicate anything JSON-serialisable between two peers.**

[![npm version](https://img.shields.io/npm/v/want-have-replication.svg)](https://www.npmjs.com/package/want-have-replication)
[![build status](https://img.shields.io/travis/derhuerst/want-have-replication.svg)](https://travis-ci.org/derhuerst/want-have-replication)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/want-have-replication.svg)
[![chat on gitter](https://badges.gitter.im/derhuerst.svg)](https://gitter.im/derhuerst)


## Installing

```shell
npm install want-have-replication
```


## Usage

```js
const createPeer = require('want-have-replication')

const A = createPeer('A', item => console.log('A received', item))
A.add('first item')

const B = createPeer('B', item => console.log('B received', item))
B.add(['second', 'item'])

const C = createPeer('C', item => console.log('C received', item))
C.add({third: 'item'})

// A <-> B <-> C replication
const rA = A.replicate()
rA.pipe(B.replicate()).pipe(rA)
const rC = C.replicate()
rC.pipe(B.replicate()).pipe(rC)
```

```
A received [second: 'item']
C received [second: 'item']
B received 'first item'
C received 'first item'
B received {third: 'item'}
A received {third: 'item'}
```


## Contributing

If you have a question or have difficulties using `want-have-replication`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/derhuerst/want-have-replication/issues).
