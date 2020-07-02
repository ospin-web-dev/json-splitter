const Chunk = require('../../../src/Splitter/Chunk')

describe('Chunk', () => {

  describe('an instance of', () => {
    describe('addKeyValue', () => {
      it('throws error when it does not have enough room', () => {
        const maxSize = 100
        const chunk = new Chunk(maxSize)

        expect(() => {
          chunk.addKeyValue('a', Array(101).fill(1))
        }).toThrowError(`can not fit`)
      })
    })
  })

})
