const merge = require('deepmerge')

const Receiver = require('../../src/Receiver')
const ObjUtils = require('../../src/ObjUtils')

describe('Receiver', () => {

  describe('receive', () => {
    describe('upon receiving an object which does not have a multiMessage key', () => {
      it('returns the object', () => {
        const receiver = new Receiver()
        const chunklessChunk = { o: 'ok' }

        const expected = {
          complete: true,
          chunksOutstanding: 0,
          payload: chunklessChunk,
        }

        expect(receiver.receive(chunklessChunk)).toEqual(expected)
      })
    })

    describe('upon receiving a chunk', () => {
      it('throws error if the multiMessage is in bad shape', () => {
        const receiver = new Receiver()
        const chunk = { multiMessage: { groupId: 'ok' } }

        expect(() => receiver.receive(chunk)).toThrowError('totalChunks')
      })

      it('deletes orphaned chunks after they have not resolved within the time out', () => {
        // { complete: false, chunksOutstanding: x }
      })

    })

    describe('upon receiving a chunk which is one of a multiMessage series', () => {
      it('returns an object describing the number of chunks it is still waiting for', () => {
        const chunk = {
          multiMessage: {
            groupId: '8464f55c-8595-4ac6-92a9-3567d8a5098c',
            totalChunks: 3,
            chunkIdx: 0,
          },
        }

        const receiver = new Receiver()
        const expected = {
          complete: false,
          chunksOutstanding: 2,
        }

        expect(receiver.receive(chunk)).toEqual(expected)
      })

    })

    describe('upon receiving the multiMessage completing chunk', () => {

      const getChunks = () => ([
        {
          a: { a: 'a' },
          data: { targetA: [ 1 ] },
          multiMessage: {
            groupId: '8464f55c-8595-4ac6-92a9-3567d8a5098c',
            totalChunks: 3,
            chunkIdx: 0,
          },
        },
        {
          b: { b: 'b' },
          data: { targetB: [ 2 ] },
          multiMessage: {
            groupId: '8464f55c-8595-4ac6-92a9-3567d8a5098c',
            totalChunks: 3,
            chunkIdx: 1,
          },
        },
        {
          b: { b: 'overwrite!' },
          data: { targetB: [ 'overwrite!' ] },
          multiMessage: {
            groupId: '8464f55c-8595-4ac6-92a9-3567d8a5098c',
            totalChunks: 3,
            chunkIdx: 2,
          },
        },
      ])

      const getMergedChunkPayload = () => ({
        // this should be the result of merging the chunks above
        // intentionally not using the `merge` library
        a: { a: 'a' },
        data: { targetA: [ 1 ], targetB: [ 'overwrite!' ] },
        b: { b: 'overwrite!' },
      })

      function completeASeries(chunks) {
        const receiver = new Receiver()
        return chunks.reduce((acc, chunk) => (
          receiver.receive(chunk)
        ), null)
      }

      it('returns `complete` as true', () => {
        const chunks = getChunks()
        const { complete } = completeASeries(chunks)

        expect(complete).toBe(true)
      })

      describe('the payload', () => {

        it('has removed the multiMessage key + value', () => {
          const chunks = getChunks()
          const { payload } = completeASeries(chunks)

          const hasMultiMessage = Object.prototype.hasOwnProperty.call(payload, 'multiMessage')
          expect(hasMultiMessage).toBe(false)
        })

        it('is correctly merged', () => {
          const chunks = getChunks()
          const { payload } = completeASeries(chunks)

          const expected = getMergedChunkPayload()
          expect(payload).toEqual(expect.objectContaining(expected))
        })

        it('has combined the chunks via right reduce (later keys overwrite previous matching keys) based on their chunkIdx, _and not_ the order they arrived', () => {
          const chunks = getChunks()
          const { payload } = completeASeries(chunks)

          expect(hasMultiMessage).toBe(false)
        })
      })
    })
  })

})
