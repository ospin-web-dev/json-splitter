const uuidv4 = require('uuid').v4

const ObjUtils = require('./ObjUtils')
const Chunk = require('./Chunk')

class Splitter {

  static get MAX_CHUNKS() { return 1000 }

  // this must be referenced to account for the meta data size reqs
  static get DEFAULT_CHUNK_HEADER_KEY() { return 'multiMessage' }

  // this must be referenced to account for the meta data size reqs
  static get DEFAULT_CHUNK_HEADER_DATA() {
    return {
      groupId: uuidv4(),
      totalChunks: this.MAX_CHUNKS,
      chunkIdx: this.MAX_CHUNKS - 1,
    }
  }

  static get MAX_CHUNK_HEADER_SIZE() {
    // a limit for the total size a large header could take up
    return ObjUtils.getSize({
      [this.DEFAULT_CHUNK_HEADER_KEY]: this.DEFAULT_CHUNK_HEADER_DATA,
    })
  }

  static get FIXED_CHUNK_SIZE_OVERHEAD() {
    return this.MAX_CHUNK_HEADER_SIZE + 2 // the + 2 is from the base object: '{}'
  }

  static get MINIMUM_CHUNK_SIZE() {
    return this.MAX_CHUNK_HEADER_SIZE * 2
  }

  static assertValidMaxChunkSize(obj, maxChunkSize) {
    const { largestKey, largestPairSize } = ObjUtils.getLargestKeyValuePairSize(obj)

    if (maxChunkSize < largestPairSize) {
      const value = obj[largestKey]
      throw new Error(`maxChunkSize too small for key value: [ ${largestKey}, ${value} ]`)
    }
  }

  static chunkingRequired(obj, maxChunkSize) {
    const totalSize = ObjUtils.getSize(obj)
    return (totalSize >= maxChunkSize)
  }

  static assertTargetIsObject(obj, targetKey) {
    const target = obj[targetKey]

    if (Array.isArray(target) || typeof target !== 'object') {
      throw new Error(`target must be an object. Target: ${target}`)
    }
  }

  static assertMinimumChunkSize(maxChunkSize) {
    if (maxChunkSize < this.MINIMUM_CHUNK_SIZE) {
      throw new Error(`maxChunkSize must be greater than minimum of ${this.MINIMUM_CHUNK_SIZE}`)
    }
  }

  static assignHeaderToChunks(chunks) {
    const groupId = uuidv4()

    chunks.forEach((chunk, idx) => chunk.mergeObject({
      [this.DEFAULT_CHUNK_HEADER_KEY]: {
        ...this.DEFAULT_CHUNK_HEADER_DATA,
        groupId,
        chunkIdx: idx,
        totalChunks: chunks.length,
      },
    }))
  }

  static get DEFAULT_OPTIONS() {
    return {
      maxChunkSize: 125000,
      targetKey: null,
    }
  }

  static createChunksFromObj(obj, chunkSizeLimit) {
    this.assertValidMaxChunkSize(obj, chunkSizeLimit)
    const last = arr => arr[arr.length - 1]
    const addNewChunk = arr => arr.push(new Chunk(chunkSizeLimit))

    return Object.entries(obj).reduce((chunks, [ key, value ]) => {
      if (last(chunks).canNotFit(key, value)) {
        addNewChunk(chunks)
      }
      // A the biggest key + value will always be able to fit into an empty chunk
      // that was asserted in `assertValidMaxChunkSize`
      last(chunks).addKeyValue(key, value)

      return chunks
    }, [ new Chunk(chunkSizeLimit) ])
  }

  static createChunksFromObjTarget(obj, targetKey, chunkSizeLimit) {
    this.assertTargetIsObject(obj, targetKey)

    /* if a targetKey was provided to break up a nested object
     * we need to reduce the free space per chunk by the amount of space
     * all of the top level keys require (as all of the top
     * level keys are sent with each of the chunks) as well as the
     * nested targets key + base object
    */
    const topLevelData = { ...obj, [targetKey]: {} }
    const topLevelDataSizeReq = ObjUtils.getSize(topLevelData)
    const remainingMaxChunkSize = chunkSizeLimit - topLevelDataSizeReq
    const target = obj[targetKey]

    this.assertValidMaxChunkSize(target, remainingMaxChunkSize)

    const chunks = this.createChunksFromObj(obj[targetKey], chunkSizeLimit)
    chunks.forEach(chunk => {
      chunk.obj = { ...topLevelData, [targetKey]: chunk.obj }
    })

    return chunks
  }

  static split(strOrObj, options) {
    const { maxChunkSize, targetKey } = { ...this.DEFAULT_OPTIONS, ...options }
    this.assertMinimumChunkSize(maxChunkSize)

    const obj = ObjUtils.serializeToObj(strOrObj)

    if (!this.chunkingRequired(obj, maxChunkSize)) return [ obj ]

    const chunkSizeLimit = maxChunkSize - this.MAX_CHUNK_HEADER_SIZE

    const chunks = targetKey
      ? this.createChunksFromObjTarget(obj, targetKey, chunkSizeLimit)
      : this.createChunksFromObj(obj, chunkSizeLimit)

    this.assignHeaderToChunks(chunks)

    return chunks.map(chunk => chunk.obj)
  }

}

module.exports = Splitter
