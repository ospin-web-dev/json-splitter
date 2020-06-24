const uuidv4 = require('uuid').v4

const ObjUtils = require('./ObjUtils')

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
       * all of the top level keys require (this assumed all of the top
       * level keys are sent with every chunk, with the target being the
       * broken up across chunks
      */
      const upperKeysSizeReq = ObjUtils.getSize({ ...obj, [targetKey]: {} })
      const remainingMaxChunkSize = maxChunkSize - upperKeysSizeReq
      this.assertValidMaxChunkSize(obj[targetKey], remainingMaxChunkSize)
      return
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

  static addKeyValueToChunk(chunk, key, value) {
    chunk[key] = value
  }

  static get DEFAULT_OPTIONS() {
    return {
      maxChunkSize: 125000,
      targetKey: null,
    }
  }

  static split(strOrObj, options) {
    const { maxChunkSize, targetKey } = { ...this.DEFAULT_OPTIONS, ...options }
    this.assertMinimumChunkSize(maxChunkSize)

    const obj = ObjUtils.serializeToObj(strOrObj)
    if (!this.chunkingRequired(obj, maxChunkSize)) return [ obj ]

    this.assertValidMaxChunkSize(obj, maxChunkSize, targetKey)

    if (targetKey) return false

    const chunks = [{}]

    const getLastChunk = () => chunks[chunks.length - 1]

    const chunkHasRoomFor = (chunk, addition, maxSize) => {
      return (ObjUtils.getSize(chunk) + addition) <= maxSize
    }

    const allowedSize = maxChunkSize - this.FIXED_CHUNK_SIZE_OVERHEAD

    for (const [key, value] of Object.entries(obj)) {
      const currentChunk = getLastChunk()

      const keyValueSize = ObjUtils.getKeyValueSize(key, value)
      const chunkCanFit = chunkHasRoomFor(currentChunk, keyValueSize, allowedSize)

      if (chunkCanFit) {
        this.addKeyValueToChunk(currentChunk, key, value)
      } else {
        chunks.push({})
        const newCurrentChunk = getLastChunk()
        this.addKeyValueToChunk(newCurrentChunk, key, value)
      }
    }

    const groupId = uuidv4()
    const chunksWithMetaData = chunks.map((chunk, idx) => {
      chunk.multiMessage = {
        groupId,
        chunkIdx: idx,
        totalChunks: chunks.length,
      }

      return chunk
    })

    return chunksWithMetaData
  }

}

module.exports = Splitter
