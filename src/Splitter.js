const uuidv4 = require('uuid').v4

class Splitter {

  static get DEFAULT_OPTIONS() {
    return {
      maxChunkSize: 125000,
      targetKey: null,
    }
  }

  static get DEFAULT_CHUNK_HEADER() {
    return {
      groupId: uuidv4(),
      totalChunks: null,
      chunkIdx: null,
    }
  }

  static get MAX_CHUNKS() { return 100 }

  static get MAX_CHUNK_HEADER_SIZE() {
    return this.getSize({
      ...this.DEFAULT_CHUNK_HEADER,
      totalChunks: this.MAX_CHUNKS,
      chunkIdx: this.MAX_CHUNKS - 1,
    })
  }

  static assertType(value) {
    const type = typeof value
    const valid = (
      !Array.isArray(value)
      && (type === 'string' || type === 'object')
      && !!value // null check
    )

    if (!valid) {
      throw new Error(`unsupported value: ${value}`)
    }
  }

  static getLargestKeyValuePairSize(obj) {
    return Object.keys(obj).reduce(({ largestKey, largestPair }, key) => {
      const size = this.getSize({ [key]: obj[key] })

      return size > largestPair
        ? { largestKey: key, largestPair: size }
        : { largestKey, largestPair }

    }, { largestKey: null, largestPair: -1 })
  }

  static assertValidMaxChunkSize(obj, maxChunkSize, targetKey) {
    if (targetKey) {
      this.assertValidMaxChunkSize(obj[targetKey], maxChunkSize)
    }

    const freeSpacePerChunk = maxChunkSize - this.MAX_CHUNK_HEADER_SIZE

    const { largestKey, largestPair } = this.getLargestKeyValuePairSize(obj)

    if (freeSpacePerChunk <= largestPair) {
      const value = obj[largestKey]
      throw new Error(`maxChunkSize too small for key value: [ ${largestKey}, ${value} ]`)
    }
  }

  static serializeValue(value) {
    this.assertType(value)

    const string = typeof value === 'object'
      ? JSON.stringify(value)
      : value

    return JSON.parse(string) // for the deep clone
  }

  static getSize(value) {
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    return Buffer.from(str).length
  }

  static chunkingRequired(obj, maxChunkSize) {
    const totalSize = this.getSize(obj)
    return (totalSize >= maxChunkSize)
  }

  static split(value, options) {
    const { maxChunkSize, targetKey } = { ...this.DEFAULT_OPTIONS, ...options }

    const obj = this.serializeValue(value)
    if (!this.chunkingRequired(obj, maxChunkSize)) return [ obj ]

    this.assertValidMaxChunkSize(obj, maxChunkSize, targetKey)

    const multiMessage = {
      ...this.DEFAULT_CHUNK_HEADER,
      groupId: uuidv4(),
    }

    return [
      { ...obj, multiMessage: { ...multiMessage, totalChunks: 2, chunkIdx: 0 } },
      { ...obj, multiMessage: { ...multiMessage, totalChunks: 2, chunkIdx: 1 } },
    ]
  }

}

module.exports = Splitter
