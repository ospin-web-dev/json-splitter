function assertObjOrString(value) {
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

class ObjUtils {

  static getSize(value) {
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    return Buffer.from(str).length
  }

  static getKeyValueSize(key, value) {
    // NOTE: this removes the two additional bytes from the '{}'
    // if you want the size of the whole object, use `getSize` plainly
    return this.getSize({ [key]: value }) - 2
  }

  static getLargestKeyValuePairSize(obj) {
    // TODO: change to object.entried
    return Object.keys(obj).reduce(({ largestKey, largestPairSize }, key) => {
      const value = obj[key]
      const size = this.getKeyValueSize(key, value)

      return size > largestPairSize
        ? { largestKey: key, largestPairSize: size }
        : { largestKey, largestPairSize }

    }, { largestKey: null, largestPairSize: -1 })
  }

  static serializeToObj(value) {
    assertObjOrString(value)

    const string = typeof value === 'object'
      ? JSON.stringify(value)
      : value

    return JSON.parse(string) // for the deep clone
  }

  static addKeyValue(obj, key, value) {
    obj[key] = value
  }

}

module.exports = ObjUtils
