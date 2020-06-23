class Splitter {

  static get DEFAULT_OPTIONS() {
    return {
      maxSize: 125000,
      targetKeys: null,
    }
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

  static serializeValue(value) {
    this.assertType(value)

    const string = typeof value === 'object'
      ? JSON.stringify(value)
      : value

    return JSON.parse(string) // for the deep clone
  }

  static getSize(value) {
    const obj = this.serializeValue(value)

    return Buffer.from(JSON.stringify(obj)).length
  }

  static split(value, options) {
    const { maxSize, targetKeys } = { ...this.DEFAULT_OPTIONS, ...options }


  }

}

module.exports = Splitter
