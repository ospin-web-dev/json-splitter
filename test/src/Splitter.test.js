//const uuidv4 = require('uuid/v4')
const Joi = require('@hapi/joi')
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

  describe('split', () => {
    describe('when the maxChunkSize is too small for a key + value in the object', () => {
      describe('when no target is provided', () => {
        it('throws error', () => {
          const obj = { a: '0123456789' }

          expect(() => Splitter.split(obj, { maxChunkSize: 5 }))
            .toThrow(`maxChunkSize too small for key value: [ a, ${obj.a} ]`)
        })
      })

      describe('when a target is provided and a key + value in the target is too large', () => {
        it('throws error', () => {
          const obj = { a: 'b', data: { d: '0123456789' } }

          const opts = { maxChunkSize: 5, targetKey: 'data' }
          expect(() => Splitter.split(obj, opts))
            .toThrow(`maxChunkSize too small for key value: [ d, ${obj.data.d} ]`)
        })
      })

      describe('for keys outside of the provided target', () => {
        it('throws error', () => {
          // TODO: check if the keys in the top level, PLUS the largest key in the target PLUS the header room is larger than the smallest chunk size
        })
      })
    })

    describe('when the payload is under the maxChunkSize', () => {
      it('returns an array with a copy of the original object with no multiMessage property applied', () => {
        const obj = { a: 'b', c: { d: '123' } }

        const objSize = Splitter.getSize(obj)
        expect(Splitter.DEFAULT_OPTIONS.maxChunkSize).toBeGreaterThan(objSize)

        const chunks = Splitter.split(obj)
        expect(chunks.length).toEqual(1)
        expect(chunks[0]).toEqual(expect.objectContaining(obj))
      })
    })

    describe('when the payload is over or equal to the maxChunkSize', () => {

      const UUIDV4_REGEX = /[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/
      const multiMessageSchema = Joi.object({
        groupId: Joi.string().required().pattern(UUIDV4_REGEX),
        chunkIdx: Joi.number().required(),
        totalChunks: Joi.number().required(),
      })

      it('adds the proper multiMessage property to each of the returned objects', () => {
        const obj = { a: 'b', c: { d: '123' } }
        const opts = {
          maxChunkSize: Math.ceil(Splitter.getSize(obj) / 2),
        }

        const chunks = Splitter.split(obj, opts)
        expect(chunks.length).toEqual(2)

        chunks.forEach(({ multiMessage }, idx) => {
          expect(() => {
            Joi.assert(multiMessage, multiMessageSchema)
          }).not.toThrow()

          const { chunkIdx, totalChunks } = multiMessage
          expect(chunkIdx).toEqual(idx)
          expect(totalChunks).toEqual(chunks.length)
        })
      })

      it.skip('splits the payload in to the minimum amount of chunks possible', () => {
        const obj = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e', f: 'f', h: 'h', i: 'i', j: 'j', k: 'k' }
        const sizeGreaterThanHalf = Math.ceil(Splitter.getSize(obj) / 2)
        const sizeLessThanOne5th = Math.floor(Splitter.getSize(obj) - 1 / 5)
        const opts = {
        }

        const { length } = Splitter.split(obj, opts)
        expect(length).toEqual(2)
      })

      it('returns chunks, each of which is under the target size', () => {
      })

    })

  })

})
