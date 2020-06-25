const uuidv4 = require('uuid').v4

const ObjUtils = require('./ObjUtils')
const Chunk = require('./Chunk')

class Splitter {

  static get MAX_CHUNKS() { return 1000 }

  static get DEFAULT_CHUNK_HEADER() {
    return {
      groupId: uuidv4(),
      totalChunks: this.MAX_CHUNKS,
      chunkIdx: this.MAX_CHUNKS - 1,
    }
  }

  static get MAX_CHUNK_HEADER_SIZE() {
    // a limit for the total size a large header could take up
    return ObjUtils.getSize(this.DEFAULT_CHUNK_HEADER + 10)
  }

  static get FIXED_CHUNK_SIZE_OVERHEAD() {
    return this.MAX_CHUNK_HEADER_SIZE + 2 // the + 2 is from the base object: '{}'
  }

  static get MINIMUM_CHUNK_SIZE() {
    return this.MAX_CHUNK_HEADER_SIZE * 2
  }

  static assertValidMaxChunkSize(obj, maxChunkSize, targetKey) {
    // ensure the user provided 'maxChunkSize' is big enough
    if (targetKey) {
      /* if a targetKey was provided to break up a nested object
       * we reduce the free space per chunk by removing the amount of space
       * all of the top level keys require (as all of the top
       * level keys are sent with every chunk). The target is then
       * broken up across chunks. See tests
      */
      const upperKeysSizeReq = ObjUtils.getSize({ ...obj, [targetKey]: {} })
      const remainingMaxChunkSize = maxChunkSize - upperKeysSizeReq
      return this.assertValidMaxChunkSize(obj[targetKey], remainingMaxChunkSize)
    }

    const freeSpacePerChunk = maxChunkSize - this.FIXED_CHUNK_SIZE_OVERHEAD

    const { largestKey, largestPairSize } = ObjUtils.getLargestKeyValuePairSize(obj)

    if (freeSpacePerChunk < largestPairSize) {
      const value = obj[largestKey]
      throw new Error(`maxChunkSize too small for key value: [ ${largestKey}, ${value} ]`)
    }
  }

  static chunkingRequired(obj, maxChunkSize) {
    const totalSize = ObjUtils.getSize(obj)
    return (totalSize >= maxChunkSize)
  }

  static assertMinimumChunkSize(maxChunkSize) {
    if (maxChunkSize < this.MINIMUM_CHUNK_SIZE) {
      throw new Error(`maxChunkSize must be greater than minimum of ${this.MINIMUM_CHUNK_SIZE}`)
    }
  }

  static get DEFAULT_OPTIONS() {
    return {
      maxChunkSize: 125000,
      targetKey: null,
    }
  }

  static assignHeaderToChunks(chunks) {
    const groupId = uuidv4()

    chunks.forEach((chunk, idx) => {
      chunk.multiMessage = {
        groupId,
        chunkIdx: idx,
        totalChunks: chunks.length,
      }

      return chunk
    })
  }

  static createChunksFromObj(obj, maxChunkSize) {
    // remove the max space the headers might take up from the space a chunk has to grow
    const spaceForGrowth = maxChunkSize - this.FIXED_CHUNK_SIZE_OVERHEAD

    const last = arr => arr[arr.length - 1]
    const addNewChunk = arr => arr.push(new Chunk(spaceForGrowth))

    return Object.entries(obj).reduce((chunks, [ key, value ]) => {
      if (last(chunks).canNotFit(key, value)) {
        addNewChunk(chunks)
      }
      // A the biggest key + value will always be able to fit into an empty chunk
      // that was asserted in `assertValidMaxChunkSize`
      last(chunks).addKeyValue(key, value)

      return chunks
    }, [ new Chunk(spaceForGrowth) ])
  }

  static split(strOrObj, options) {
    const { maxChunkSize, targetKey } = { ...this.DEFAULT_OPTIONS, ...options }
    this.assertMinimumChunkSize(maxChunkSize)

    const obj = ObjUtils.serializeToObj(strOrObj)
    if (!this.chunkingRequired(obj, maxChunkSize)) return [ obj ]

    this.assertValidMaxChunkSize(obj, maxChunkSize, targetKey)

    // TODO: remove
    if (targetKey) return false

    const chunks = this.createChunksFromObj(obj, maxChunkSize)
    this.assignHeaderToChunks(chunks)

    return chunks
  }

}

module.exports = Splitter
