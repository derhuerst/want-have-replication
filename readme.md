# want-have-replication

**Replicate items between two peers.**

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

const p1 = createPeer((item) => {
	console.log('p1 received', item)
})
p1.add({foo: 'bar'})
p1.add([1, 2])

const p2 = createPeer((item) => {
	console.log('p2 received', item)
})
p2.add({bar: 'baz'})

const r1 = p1.replicate()
const r2 = p2.replicate()
r1.pipe(r2).pipe(r1)
```

```
p2 received { foo: 'bar' }
p2 received [ 1, 2 ]
p1 received { bar: 'baz' }
```


## Contributing

If you have a question or have difficulties using `want-have-replication`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, refer to [the issues page](https://github.com/derhuerst/want-have-replication/issues).
