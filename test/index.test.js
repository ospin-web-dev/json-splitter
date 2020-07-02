const { Receiver, Splitter } = require('../index.js')
const ObjUtils = require('../src/ObjUtils')

function expectDeepEqual(a, b) {
  expect(a).toEqual(expect.objectContaining(b))
}

describe('splitting and reconstructing payloads', () => {

  describe('when the object is under the max size', () => {
    it('reconstructs the original object', () => {
      const obj = { a: Array(1000).fill('a') }
      const objSize = ObjUtils.getSize(obj)

      const maxChunkSize = objSize + Splitter.MAX_CHUNK_HEADER_SIZE
      const chunks = Splitter.split(obj, { maxChunkSize })

      const receiver = new Receiver()
      const { payload } = receiver.receiveMany(chunks)

      expectDeepEqual(payload, obj)
    })
  })

  describe('when the object is over the max size', () => {
    it('reconstructs the original object', () => {
      const obj = {
        a: Array(1000).fill('a'),
        b: Array(1000).fill('b'),
      }

      const maxChunkSize =
        ObjUtils.getLargestKeyValuePairSize(obj) + 2
        + Splitter.MAX_CHUNK_HEADER_SIZE

      const chunks = Splitter.split(obj, { maxChunkSize })

      expect(chunks.length).toBe(2)
      expect(chunks[0].a).toEqual(obj.a)
      expect(chunks[0].b).toEqual(undefined)
      expect(chunks[1].b).toEqual(obj.b)
      expect(chunks[1].a).toEqual(undefined)
      expect(chunks[1].a).toEqual(undefined)
      chunks.forEach(chunk => {
        expect(ObjUtils.getSize(chunk)).toBeLessThan(maxChunkSize)
      })

      const receiver = new Receiver()
      const { payload } = receiver.receiveMany(chunks)

      expectDeepEqual(payload, obj)
    })

    describe('when a target is provided', () => {
      it('reconstructs the original object', () => {
        const obj = {
          topLevel: Array(10).fill(1),
          data: {
            a: Array(1000).fill('a'),
            b: Array(1000).fill('b'),
          },
        }

        const maxChunkSize =
          ObjUtils.getSize({ topLevel: obj.topLevel }) + 1
          + ObjUtils.getSize({ data: {} })
          + ObjUtils.getLargestKeyValuePairSize(obj.data)
          + Splitter.MAX_CHUNK_HEADER_SIZE

        const chunks = Splitter.split(obj, { maxChunkSize, targetKey: 'data' })

        expect(chunks.length).toBe(2)
        expect(chunks[0].a).toEqual(obj.a)
        expect(chunks[0].b).toEqual(undefined)
        expect(chunks[1].b).toEqual(obj.b)
        expect(chunks[1].a).toEqual(undefined)
        expect(chunks[1].a).toEqual(undefined)
        chunks.forEach(chunk => {
          expect(ObjUtils.getSize(chunk)).toBeLessThan(maxChunkSize)
        })

        const receiver = new Receiver()
        const { payload } = receiver.receiveMany(chunks)

        expectDeepEqual(payload, obj)
      })
    })
  })
})
