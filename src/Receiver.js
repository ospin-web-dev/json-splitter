const merge = require('deepmerge')

const ObjUtils = require('./ObjUtils')
const Splitter = require('./Splitter')


/* Receiver is used to accept incoming chunks
 * as chunks arrive (via the `receive` method on an instance),
 * they are stored in their respective chunk 'pool'.
 * Each pool holds on to chunks that belong together.
 * Once a pool has received its fulfilling chunk (the last chunk in a series),
 * it returns the combined payload without any chunk meta data. If this were to be
 * refactored/expanded, considering abstracting a pool into its own class.
 *
 * Each Receiver instance is provided with a timeout limit. Once reached,
 * the instance will delete any outstanding chunk pools that have been waiting
 * to be completed for too long. This should prevent chunks being held on to forever
 * that had a sibling chunk lost in the aether due to a network or upstream issue.
 */

class Receiver {

  static get DEFAULT_OPTS() {
    return { timeout: 1000 * 10 }
  }

  static getChunkHeaders(chunk) {
    return chunk[Splitter.DEFAULT_CHUNK_HEADER_KEY]
  }

  static assertValidHeaderKeys(chunk) {
    const msgKeys = new Set(Object.keys(this.getChunkHeaders(chunk)))
    const expectedKeys = new Set(Object.keys(Splitter.DEFAULT_CHUNK_HEADER_DATA))

    expectedKeys.forEach(key => {
      if (!msgKeys.has(key)) {
        throw new Error(`chunk missing required key in 'multiMessage': ${key}`)
      }
    })
  }

  static isPartOfMultiMessage(chunk) {
    return Object.prototype.hasOwnProperty.call(
      chunk, Splitter.DEFAULT_CHUNK_HEADER_KEY,
    )
  }

  static respondComplete(payload) {
    return {
      complete: true,
      chunksOutstanding: 0,
      payload,
    }
  }

  static respondIncomplete(chunksOutstanding) {
    return {
      complete: false,
      chunksOutstanding,
    }
  }

  static removeChunkHeaders(chunk) {
    // note: this mutates the chunk
    delete chunk[Splitter.DEFAULT_CHUNK_HEADER_KEY]
    return chunk
  }

  static addChunkToPool(pool, chunk) {
    // note: this mutates the pool
    const { chunkIdx } = Receiver.getChunkHeaders(chunk)

    const cleanedChunk = Receiver.removeChunkHeaders({ ...chunk })
    pool[chunkIdx] = cleanedChunk
  }

  static combinePool(pool) {
    const overwriteArrs = (_, srcArr) => srcArr

    const payload = merge.all(pool, { arrayMerge: overwriteArrs })
    delete payload.multiMessage

    return payload
  }

  static countChunksMissing(pool) {
    return pool.filter(chunk => chunk === null).length
  }

  static analyzePool(pool) {
    const chunksOutstanding = Receiver.countChunksMissing(pool)

    return {
      complete: chunksOutstanding === 0,
      chunksOutstanding,
    }
  }

  constructor(opts = {}) {
    // const { timeout } = { ...Receiver.DEFAULT_OPTS, ...opts }
    this.chunkPools = {}
  }

  removePoolsOlderThan() {
  }

  poolExistsById(poolId) {
    return Object.prototype.hasOwnProperty.call(this.chunkPools, poolId)
  }

  getPoolById(id) {
    return this.chunkPools[id]
  }

  createChunkPool(groupId, size) {
    this.chunkPools[groupId] = Array(size).fill(null)
  }

  storeChunk(chunk) {
    const { groupId, totalChunks } = Receiver.getChunkHeaders(chunk)

    if (!this.poolExistsById(groupId)) {
      this.createChunkPool(groupId, totalChunks)
    }

    const pool = this.getPoolById(groupId)

    Receiver.addChunkToPool(pool, chunk)
    return pool
  }

  receive(chunk) {
    if (!Receiver.isPartOfMultiMessage(chunk)) {
      return Receiver.respondComplete(chunk)
    }

    Receiver.assertValidHeaderKeys(chunk)

    const chunksPool = this.storeChunk(chunk)
    const { complete, chunksOutstanding } = Receiver.analyzePool(chunksPool)

    if (!complete) {
      return Receiver.respondIncomplete(chunksOutstanding)
    }

    const payload = Receiver.combinePool(chunksPool)
    return Receiver.respondComplete(payload)
  }

}

module.exports = Receiver
