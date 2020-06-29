const merge = require('deepmerge')

class Pool {

  constructor(id, size) {
    this.chunks = Array(size).fill(null)
    this.updatedAt = Date.now()
  }

  addChunkAtIdx(idx, chunk) {
    this.chunks[idx] = chunk
    this.updatedAt = Date.now()
  }

  combine() {
    const overwriteArrs = (_, srcArr) => srcArr
    return merge.all(this.chunks, { arrayMerge: overwriteArrs })
  }

  countChunksMissing() {
    return this.chunks.filter(chunk => chunk === null).length
  }

  analyze() {
    const chunksOutstanding = this.chunks.filter(chunk => chunk === null).length

    return {
      complete: chunksOutstanding === 0,
      chunksOutstanding,
    }
  }

}

module.exports = Pool
