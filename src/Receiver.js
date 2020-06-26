const ObjUtils = require('./ObjUtils')
const Splitter = require('./Splitter')

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

  static addChunkToPool(pool, chunk) {
    const { chunkIdx } = Receiver.getChunkHeaders(chunk)

    const cleanedChunk = Receiver.removeChunkHeaders({ ...chunk })
    pool[chunkIdx] = cleanedChunk
  }

  static combinePool(pool) {
    // DEEP MERGE
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
