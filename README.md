[![codecov](https://codecov.io/gh/ospin-web-dev/obj-splitter/branch/master/graph/badge.svg)](https://codecov.io/gh/ospin-web-dev/obj-splitter)

**Split objects into size-limited chunks!**

Are _you_ fed up with pesky MQTT payload size limits?  
Are _you_ ready to make big objects smaller, perhaps for the purposes of circumventing restrictive network limits?

Then this package is for **you**!

## Overview

This package comes with two modules - one to split an object up into _chunks_ (`Splitter`), and another to re-assemble said _chunks_ back in to the original object (`Receiver`).

#### End-to-end example

```js
const { Splitter, Receiver } = require('@ospin/obj-splitter')

// here is an object we would like to split up
const obj = {
  a: Array(500).fill('a'), // <-- ~2000 bytes
  b: Array(500).fill('b'), // <-- ~2000 bytes
}

/* Splitter.split will break the object up into chunks
 *   each returned chunk will have header data within it
 *   header data can be used later to associate chunks
 */
const chunks = Splitter.split(obj, { maxChunkSize: 2500 })

console.log(chunks.length)
// -> 2

console.log(chunks)
/*
[
  {
    a: [ 'a', ... 499 more items ],
    multiMessage: {
      groupId: '18934ceb-a66d-4bfd-b105-467132b4a9ce',
      totalChunks: 2,
      chunkIdx: 0
    }
  },
  {
    b: [ 'b', ... 499 more items ],
    multiMessage: {
      groupId: '18934ceb-a66d-4bfd-b105-467132b4a9ce',
      totalChunks: 2,
      chunkIdx: 1
    }
  }
}
*/
```

In the chunks returned, the first has the key + value of the original objects `a` property, and the second has `b`. Together, the `a` and `b` properties in the original object would have exceeded the options `maxChunkSize` option. Each chunk returned is under the `maxChunkSize` (bytes) provided.

The `multiMessage` key (which will have been added to the chunks) contains header/meta data about the chunk:
```js
multiMessage: {
  groupId: <uuidv4>, // unique identifier for a group of chunks which belong together
  totalChunks: <integer>, // the total chunks the original object was split in to
  chunkIdx: <number>, // this chunks identifier relative to its sibling chunks
}
```

Using the `Receiver`, these chunks can be re-combined to form the original object:
```js
// continued from above ...
const [ chunkA, chunkB ] = chunks

const receiver = new Receiver()

const incompleteResult = Receiver.receive(chunkA)

console.log(incompleteResult)
// -> { complete: false, chunksOutstanding: 1 }
// since chunkA was only 1 of 2 chunks needed to fulfill the series, .receive returned a partially completed response

const completeResult = Receiver.receive(chunkB)

console.log(completeResult)
/*
{
  complete: true,
  chunksOutstanding: 0,
  payload: {
    a: [ 'a', ... 499 more items ],
    b: [ 'b', ... 499 more items ],
  }
}
*/
```

Upon receiving the second (and final) chunk, the receiver combines the chunks, removes the header data, and returns a success object. This returned payload will match the original object that was split up:

```js
const { payload } = completeResult

JSON.stringify(payload) === JSON.stringify(obj)
// true
```


#### Splitter.split options

The second argument in `splitter.split` is an optional argument
```js
Splitter.split(<obj>, {
  maxChunkSize: <number>, // max size in bytes that a chunk will be
  targetKey: <string>, // (optional) key in the first argument <obj>
})
```

If no `targetKey` is provided, the splitter will split the object's top level keys only. If a target key is provided, the splitter will split that target key up among several chunks. **Each chunk will have all of the top level keys**. E.g.:

```js
const obj = {
  a: 'this is a top level value!',
  b: 'this is ALSO a top level value!',
  data: {
    nestedA: Array(500).fill('a'), // <-- ~2000 bytes
    nestedB: Array(500).fill('b'), // <-- ~2000 bytes
  }
}

const opts = {
  maxChunkSize: 2500,
  targetKey: 'data',
}
const chunks = Splitter.split(obj, opts)

console.log(chunks)
/*
[
  {
    a: 'this is a top level value!',
    b: 'this is ALSO a top level value!',
    data: {
      nestedA:  [ 'a', ... 499 more items ],
    },
    multiMessage: {
      groupId: '18934ceb-a66d-4bfd-b105-467132b4a9ce',
      totalChunks: 2,
      chunkIdx: 0
    }
  },
  {
    a: 'this is a top level value!',
    b: 'this is ALSO a top level value!',
    data: {
      nestedB: [ 'b', ... 499 more items ],
    },
    multiMessage: {
      groupId: '18934ceb-a66d-4bfd-b105-467132b4a9ce',
      totalChunks: 2,
      chunkIdx: 1
    }
  },
}
*/
```

#### Receiver

The receiver instance will keep track of multiple series of incoming chunks:

```js
const receiver = new Receiver({ timeout: 10000 })
// the receiver opts default to a 10 second timeout (10000 ms)

const objA = { /* data */ }
const [ chunkA1, chunkA2 ] = Splitter.split(objA)

const objB = { /* data */ }
const [ chunkB1, chunkB2, chunkB3 ] = Splitter.split(objB)

receiver.receive(chunkA1)
// currently, the receiver is only keeping track of one group of chunks, the group of chunks that were made from objA

console.log(receiver.chunkPools)
/* {
 *   objA: [ chunkA1, <missing> ]
 * }
 */

receiver.receive(chunkB2)
// the receiver now has two groups of chunks it is waiting to fulfill

console.log(receiver.chunkPools)
/* {
 *   objA: [ chunkA1, <missing> ],
 *   objB: [ <missing>, chunkB2, <missing> ],
 * }
 */

```

...and it will remove outstanding chunk groups if there has been no chunk added to the pool in a certain amount of time:

```js
// ... continued from above
// 10 seconds is the default duration the receiver will hold on to chunks that are waiting for their siblings to arrive

// wait 5 seconds
receiver.receive(chunkB1)
// wait another 5 seconds
// ...and objA's chunk pool has become stale.
// objB's chunk pool remains as its timer was refreshed when it received another chunk

console.log(receiver.chunkPools)
/* {
 *   objB: [ <missing>, chunkB2, chunkB3 ],
 * }
 */


// wait another 10 seconds and all pools have become stale
// -> { <empty }

```


#### Notes
**Q:** how deep will this split an object? (e.g. will it look multiple keys down)  
**A:** at most, **this will split only 1 level deep**. I.e., this will not search down the object tree for values to split.
  - if no `targetKey` is provided in the options, this will split the top level object key/values only
  - if a `targetKey` is provided in the options, this will split the `targetKey`'s value up among chunks

**Q:** I need it to search down the object tree and split some deeply nested values?  
**A:** This can be updated to do that without too much trouble. Get in touch, make a PR, fork it, etc.

**Q:** if the object I am trying to split has a `multiMessage` key itself, will this overwrite it?  
**A:** yes. there may also be other unforeseen consequences. As of initial release, there is neither test coverage nor documented expected behavior for objects that already have `multiMessage` key.

**Q:** Why was this made?  
**A:** To deal with AWS IoT MQTT payload limits of 128kB

**Q:** Can it be used for other things  
**A:** You bet

**Q:** Is the space the header/metadata takes up in `multiMessage` subtracted from the `maxChunkSize` option?  
**A:** yes. expect the header/metadata to reserve ~100 bytes of space for itself (it will automatically subtract its requirements from the provided `maxChunkSize` when breaking up an object in to chunks)

**Q:** I have further questions re: the implementation  
**A:** see the test coverage!
