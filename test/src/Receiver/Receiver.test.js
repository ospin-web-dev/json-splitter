const Receiver = require('../../../src/Receiver/Receiver')

describe('Receiver', () => {

  describe('new', () => {
    it('has a default option for timeout if none is provided', () => {
      const { opts: { timeout } } = new Receiver()

      expect(timeout).toBe(Receiver.DEFAULT_OPTS.timeout)
    })

    it('sets the timeout option if provided', () => {
      const nonDefault = Receiver.DEFAULT_OPTS.timeout * 10
      const { opts: { timeout } } = new Receiver({ timeout: nonDefault })

      expect(timeout).toBe(nonDefault)
    })
  })

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
          const [ a, b, c ] = getChunks()

          const orderPermutations = [
            [ a, c, b ],
            [ b, c, a ],
            [ b, a, c ],
            [ c, a, b ],
            [ c, b, a ],
          ]

          const { payload: expected } = completeASeries([ a, b, c ])

          orderPermutations.forEach(perm => {
            const { payload: result } = completeASeries(perm)
            expect(result).toEqual(expect.objectContaining(expected))
          })
        })
      })
    })
  })

  describe('removeStalePools', () => {
    it('is automatically triggered every x ms based on the timout option', async () => {
      const timeout = 100
      const intervals = 3
      const receiver = new Receiver({ timeout })

      receiver.removeStalePools = jest.fn()
      await new Promise(r => setTimeout(r, timeout * intervals))

      expect(receiver.removeStalePools).toHaveBeenCalledTimes(intervals - 1)
    })

    it('does not remove chunks which have been updated recently enough', () => {
      const groupId = '8464f55c-8595-4ac6-92a9-3567d8a5098c'

      const chunks = [
        {
          multiMessage: {
            groupId,
            totalChunks: 3,
            chunkIdx: 2,
          },
        },
        {
          multiMessage: {
            groupId,
            totalChunks: 3,
            chunkIdx: 0,
          },
        },
      ]

      const receiver = new Receiver()
      receiver.receiveMany(chunks)

      const poolsCountPre = Object.keys(receiver.chunkPools).length
      expect(poolsCountPre).toBe(1)

      receiver.removeStalePools()
      const poolsCountPost = Object.keys(receiver.chunkPools).length
      expect(poolsCountPost).toBe(poolsCountPre)
    })

    it('removes those pools which have an updatedAt > the receivers timeout option', () => {
      const staleGroupId = '8464f55c-8595-4ac6-92a9-3567d8a5098c'
      const freshGroupId = '99999999-9999-9999-9999-999999999999'

      const chunks = [
        {
          multiMessage: {
            groupId: staleGroupId,
            totalChunks: 10,
            chunkIdx: 0,
          },
        },
        {
          multiMessage: {
            groupId: freshGroupId,
            totalChunks: 5,
            chunkIdx: 0,
          },
        },
      ]

      const receiver = new Receiver()
      chunks.forEach(chunk => receiver.receive(chunk))

      const totalPoolsPre = Object.entries(receiver.chunkPools).length
      expect(totalPoolsPre).toBe(2)

      const stalePool = receiver.getPoolById(staleGroupId)
      stalePool.updatedAt = Date.now() - receiver.opts.timeout

      receiver.removeStalePools()

      const absent = receiver.getPoolById(staleGroupId)
      expect(absent).toBe(undefined)

      const totalPoolsPost = Object.entries(receiver.chunkPools).length
      expect(totalPoolsPost).toBe(1)
    })
  })
})
