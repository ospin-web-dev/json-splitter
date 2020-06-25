const ObjUtils = require('./ObjUtils')

class Chunk {

  constructor(maxSize) {
    this.maxSize = maxSize
    this.obj = {}
  }

  getSize() {
    return ObjUtils.getSize(this.obj)
  }

  getSpaceRemaining() {
    return this.maxSize - this.getSize()
  }

  canFit(key, value) {
    const additionSize = ObjUtils.getKeyValueSize(key, value)
    return this.getSpaceRemaining() >= additionSize
  }

  canNotFit(key, value) {
    return !this.canFit(key, value)
  }

  assertCanFit(key, value) {
    if (!this.canFit(key, value)) {
      throw new Error(`can not fit ${key}, ${value} into ${this}`)
    }
  }

  addKeyValue(key, value) {
    this.assertCanFit(key, value)
    ObjUtils.addKeyValue(this.obj, key, value)
  }

}

module.exports = Chunk
