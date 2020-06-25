const Joi = require('@hapi/joi')

const Splitter = require('../../src/Splitter')
const ObjUtils = require('../../src/ObjUtils')

describe('Splitter', () => {

  describe('serializeToObj', () => {
    it('throws error if the value is neither string nor object', () => {
      const vals = [1, false, [], null, (() => {})]

      vals.forEach(val => {
        expect(() => ObjUtils.serializeToObj(val))
          .toThrowError('unsupported')
      })
    })

    describe('when passed an object', () => {

      it('returns a deep clone of the OBJECT', () => {
        const OBJECT = { a: 1, b: { b1: 'abc', b2: {} } }
        const clone = ObjUtils.serializeToObj(OBJECT)

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
        const obj = ObjUtils.serializeToObj(str)

        expect(typeof obj).toEqual('object')
        expect(JSON.stringify(obj)).toEqual(str)
      })
    })
  })

  describe('getSize', () => {
    it('returns the same size, in bytes, of the payload whether a string or an object', () => {
      const obj = { a: 'b', c: { d: '123' } }
      const str = JSON.stringify(obj)

      const objSize = ObjUtils.getSize(obj)
      const strSize = ObjUtils.getSize(str)

      expect(objSize).toEqual(strSize)
      expect(objSize).toEqual(25)
    })
  })

  describe('split', () => {
    describe('when the maxChunkSize is under the minimum', () => {
      it('throws error', () => {
        const obj = { a: '0123456789' }

        expect(() => Splitter.split(obj, { maxChunkSize: Splitter.MINIMUM_CHUNK_SIZE - 1 }))
          .toThrow(`maxChunkSize must be greater than minimum of ${Splitter.MINIMUM_CHUNK_SIZE}`)
      })
    })

    describe('when the maxChunkSize is too small for a key + value in the object', () => {
      describe('when no target is provided', () => {
        it('throws error', () => {
          const obj = { a: Array(Splitter.MINIMUM_CHUNK_SIZE * 10).fill('a') }

          expect(() => Splitter.split(obj, { maxChunkSize: Splitter.MINIMUM_CHUNK_SIZE * 2 }))
            .toThrow(`maxChunkSize too small for key value: [ a, ${obj.a} ]`)
        })
      })

      describe('when a target is provided', () => {
        it('throws error when a key + value in the target is too large', () => {
          const obj = {
            data: {
              d: Array(Splitter.MINIMUM_CHUNK_SIZE * 10).fill('a'),
            },
          }

          const opts = {
            maxChunkSize: Splitter.MINIMUM_CHUNK_SIZE * 2,
            targetKey: 'data',
          }

          expect(() => Splitter.split(obj, opts))
            .toThrow(`maxChunkSize too small for key value: [ d, ${obj.data.d} ]`)
        })

        it('throws error if the keys in top level + the largest key in the target + the header are too large combined', () => {
          const obj = {
            a: Array(200).join('x'),
            data: {
              d: Array(300).join('x'),
              e: Array(200).join('x'),
              f: Array(200).join('x'),
              g: Array(200).join('x'),
            },
          }

          const topLevelKeysSize = ObjUtils.getSize({ a: obj.a, data: {} })
          const {
            largestPairSize: largestTargetKeySize,
          } = ObjUtils.getLargestKeyValuePairSize(obj.data)

          const spaceReqWithoutHeaders = topLevelKeysSize + largestTargetKeySize

          const opts = { maxChunkSize: spaceReqWithoutHeaders, targetKey: 'data' }
          expect(() => Splitter.split(obj, opts))
            .toThrow(`maxChunkSize too small for key value: [ d, ${obj.data.d} ]`)
        })
      })
    })

    describe('when the payload is under the maxChunkSize', () => {
      it('returns an array with a copy of the original object with no multiMessage property applied', () => {
        const obj = { a: 'b', c: { d: '123' } }

        const objSize = ObjUtils.getSize(obj)
        expect(Splitter.DEFAULT_OPTIONS.maxChunkSize).toBeGreaterThan(objSize)

        const chunks = Splitter.split(obj)
        expect(chunks.length).toEqual(1)
        expect(chunks[0]).toEqual(expect.objectContaining(obj))
      })
    })

    describe('when the payload is over the maxChunkSize', () => {

      it('adds the proper multiMessage property to each of the returned objects', () => {
        const obj = {
          a: Array(100).fill(1),
          b: Array(100).fill(2),
        }
        const opts = { maxChunkSize: ObjUtils.getSize(obj.a) * 1.5 }

        const chunks = Splitter.split(obj, opts)
        expect(chunks.length).toEqual(2)

        const UUIDV4_REGEX = /[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/
        const multiMessageSchema = Joi.object({
          groupId: Joi.string().required().pattern(UUIDV4_REGEX),
          chunkIdx: Joi.number().required(),
          totalChunks: Joi.number().required(),
        })

        chunks.forEach(({ multiMessage }, idx) => {
          expect(() => {
            Joi.assert(multiMessage, multiMessageSchema)
          }).not.toThrow()

          const { chunkIdx, totalChunks } = multiMessage
          expect(chunkIdx).toEqual(idx)
          expect(totalChunks).toEqual(chunks.length)
        })
      })

      it('splits the payload in to the minimum amount of chunks possible', () => {
        const obj = {
          a: Array(300).fill(1),
          b: Array(300).fill(2),
          c: Array(300).fill(3),
        }

        const { largestPairSize } = ObjUtils.getLargestKeyValuePairSize(obj)
        const maxChunkSize = largestPairSize + Splitter.FIXED_CHUNK_SIZE_OVERHEAD

        expect(maxChunkSize).toBeLessThan(largestPairSize * 2)

        const { length } = Splitter.split(obj, { maxChunkSize })
        expect(length).toEqual(3)
      })

      it.skip('returns chunks, each of which is under the target size', () => {
        const obj = {
          a: Array(300).fill(1),
          b: Array(300).fill(2),
          c: Array(300).fill(3),
        }

        const { largestPairSize } = ObjUtils.getLargestKeyValuePairSize(obj)

        const maxChunkSize = largestPairSize + Splitter.FIXED_CHUNK_SIZE_OVERHEAD

        expect(maxChunkSize).toBeLessThan(largestPairSize * 2)

        const chunks = Splitter.split(obj, { maxChunkSize })
        chunks.forEach(chunk => {
          console.log(chunk)
          const size = ObjUtils.getSize(chunk)
          expect(size).toBeLessThan(maxChunkSize)
        })
      })

      describe('when a target is provided', () => {
        it('only the first chunk has all of the top level keys', () => {
          // TODO
        })
      })

    })

  })

})
