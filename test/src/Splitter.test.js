//const uuidv4 = require('uuid/v4')
const Splitter = require('../../src/Splitter')

describe('Splitter', () => {

  describe('serializeValue', () => {
    it('throws error if the value is neither string nor object', () => {
      const vals = [1, false, [], null, (() => {})]

      vals.forEach(val => {
        expect(() => Splitter.serializeValue(val))
          .toThrowError('unsupported')
      })
    })

    describe('when passed an object', () => {

      it('returns a deep clone of the OBJECT', () => {
        const OBJECT = { a: 1, b: { b1: 'abc', b2: {} } }
        const clone = Splitter.serializeValue(OBJECT)

        expect(JSON.stringify(clone)).toEqual(JSON.stringify(OBJECT))

        clone.a = 2
        clone.b.b1 = 'cde'
        clone.b.b2.b2a = 'plenty nested'

        expect(OBJECT !== clone).toBe(true)
        expect(OBJECT.a).toEqual(1)
        expect(OBJECT.b.b1).toEqual('abc')
        expect(OBJECT.b.b2 !== clone.b.b2).toBe(true)
        expect(OBJECT.b.b2).toEqual({})
      })
    })

    describe('when passed a string', () => {
      const OBJECT = { a: 1, b: { b1: 'abc', b2: {} } }

      it('returns an object', () => {
        const str = JSON.stringify(OBJECT)
        const obj = Splitter.serializeValue(str)

        expect(typeof obj).toEqual('object')
        expect(JSON.stringify(obj)).toEqual(str)
      })
    })
  })

  describe('getSize', () => {
    it('returns the same size, in bytes, of the payload whether a string or an object', () => {
      const obj = { a: 'b', c: { d: '123' } }
      const str = JSON.stringify(obj)

      const objSize = Splitter.getSize(obj)
      const strSize = Splitter.getSize(str)

      expect(objSize).toEqual(strSize)
      expect(objSize).toEqual(25)
    })
  })

})
