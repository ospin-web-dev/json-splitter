const Receiver = require('../../src/Receiver')
const ObjUtils = require('../../src/ObjUtils')

describe('Receiver', () => {

  const getTestableChunks = [
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
  ]

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
      it('returns the merged payload', () => {
        // { complete: true, chunksOutstanding: 0, payload: {} }
      })

      describe('the payload', () => {
        it('has removed the multiMessage key + value', () => {
        })

        it('has combined the chunks via right reduce (later keys overwrite previous matching keys) based on their chunkIdx, _and not_ the order they arrived', () => {
        })
      })
    })
  })

})
