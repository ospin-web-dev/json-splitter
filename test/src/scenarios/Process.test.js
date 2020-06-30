const { Receiver, Splitter } = require('../../../index.js')
const ObjUtils = require('../../../src/ObjUtils')

const process = require('./ProcessData')

function expectDeepEqual(a, b) {
  expect(a).toEqual(expect.objectContaining(b))
}

function getProcessObj() {
  return JSON.parse(JSON.stringify(process))
}

// simulate mqtt max of 128kB with 3kb buffer room
const MAX_SIZE = 125 * 1000

describe('splitting and reconstructing process payloads', () => {

  describe('when the object is under the max size', () => {
    it('reconstructs the original object', () => {
      const obj = getProcessObj()
      const objSize = ObjUtils.getSize(obj)
      expect(objSize).toBeLessThan(MAX_SIZE)

      const chunks = Splitter.split(obj, { maxChunkSize: MAX_SIZE })

      const receiver = new Receiver()
      const { payload } = receiver.receiveMany(chunks)

      expectDeepEqual(payload, obj)
    })
  })

  describe('when the object is over the max size', () => {
    describe('when a target is provided', () => {
      it('reconstructs the original object', () => {
        const obj = getProcessObj()

        const aPhase = obj.description[0]
        const aPhaseSize = ObjUtils.getSize(aPhase)
        const phasesRequiredToBreachLimit = Math.ceil(MAX_SIZE / aPhaseSize)

        Array(phasesRequiredToBreachLimit).fill(aPhase).forEach((newPhase, idx) => {
          obj.description[idx] = newPhase
        })

        const objSize = ObjUtils.getSize(obj)
        expect(objSize).toBeGreaterThan(MAX_SIZE)

        const chunks = Splitter.split(obj, { maxChunkSize: MAX_SIZE, targetKey: 'description' })
        expect(chunks.length).toBe(2)

        chunks.forEach(chunk => {
          expect(ObjUtils.getSize(chunk)).toBeLessThan(MAX_SIZE)
        })

        const receiver = new Receiver()
        const { payload } = receiver.receiveMany(chunks)

        expectDeepEqual(payload, obj)
      })
    })
  })
})
