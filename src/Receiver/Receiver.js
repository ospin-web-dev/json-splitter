const Pool = require('./Pool')
const Splitter = require('../Splitter/Splitter')

/* Receiver is used to accept incoming chunks
 * as chunks arrive (via the `receive` method on an instance),
 * they are stored in their respective chunk 'pool'.
 * Each pool holds on to chunks that belong together.
 * Once a pool has received its fulfilling chunk (the last chunk in a series),
 * it returns the combined payload without any chunk meta data.
 *
 * Each Receiver instance is provided with a timeout limit. Once reached,
 * the instance will delete any outstanding chunk pools that have been waiting
 * to be completed for too long. This should prevent chunks being held on to forever
 * that had a sibling chunk lost in the aether due to a network or upstream issue.
 * See `startPoolManager`
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
    delete chunk[Splitter.DEFAULT_CHUNK_HEADER_KEY]
    return chunk
  }

  constructor(opts = {}) {
    this.opts = { ...Receiver.DEFAULT_OPTS, ...opts }

    this.chunkPools = {}
    this.startPoolManager()
  }

  startPoolManager() {
    setInterval(() => {
      this.removeStalePools()
    }, this.opts.timeout)
  }

  deleteChunkPool(poolId) {
    delete this.chunkPools[poolId]
  }

  removeStalePools() {
    const now = Date.now()

    Object.entries(this.chunkPools).forEach(([ poolId, { updatedAt } ]) => {
      const decay = now - updatedAt
      const poolIsStale = decay >= this.opts.timeout

      if (poolIsStale) this.deleteChunkPool(poolId)
    })
  }

  poolExistsById(poolId) {
    return Object.prototype.hasOwnProperty.call(this.chunkPools, poolId)
  }

  getPoolById(id) {
    return this.chunkPools[id]
  }

  createChunkPool(groupId, size) {
    this.chunkPools[groupId] = new Pool(groupId, size)
  }

  storeChunk(chunk) {
    const { groupId, totalChunks, chunkIdx } = Receiver.getChunkHeaders(chunk)

    if (!this.poolExistsById(groupId)) {
      this.createChunkPool(groupId, totalChunks)
    }

    const cleanedChunk = Receiver.removeChunkHeaders({ ...chunk })

    const pool = this.getPoolById(groupId)
    pool.addChunkAtIdx(chunkIdx, cleanedChunk)

    return pool
  }

  receive(chunk) {
    if (!Receiver.isPartOfMultiMessage(chunk)) {
      return Receiver.respondComplete(chunk)
    }

    Receiver.assertValidHeaderKeys(chunk)

    const chunksPool = this.storeChunk(chunk)
    const { complete, chunksOutstanding } = chunksPool.analyze()

    if (!complete) {
      return Receiver.respondIncomplete(chunksOutstanding)
    }

    const payload = chunksPool.combine()
    return Receiver.respondComplete(payload)
  }

}

module.exports = Receiver
