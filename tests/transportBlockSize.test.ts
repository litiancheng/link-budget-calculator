import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateNumberOfResourceElements,
  calculateTransportBlockSize,
  calculateTransportBlockSizeFromNRe,
  calculateTransportRate,
  lookupMcsParameters,
} from '../src/domain/transportBlockSize.ts'

test('MCS lookup follows the V19.4.0 PDSCH and transform-precoded PUSCH tables', () => {
  const pdsch1024Qam = lookupMcsParameters({ table: 'pdsch-table-4', mcsIndex: 23 })
  assert.ok(pdsch1024Qam.value)
  assert.equal(pdsch1024Qam.value.modulationOrder, 10)
  assert.equal(pdsch1024Qam.value.targetCodeRateX1024, 805.5)

  const pi2Bpsk = lookupMcsParameters({
    table: 'pusch-transform-precoding-table-1',
    mcsIndex: 0,
    pi2Bpsk: true,
  })
  assert.ok(pi2Bpsk.value)
  assert.equal(pi2Bpsk.value.modulationOrder, 1)
  assert.equal(pi2Bpsk.value.targetCodeRateX1024, 240)

  const qpsk = lookupMcsParameters({
    table: 'pusch-transform-precoding-table-1',
    mcsIndex: 0,
  })
  assert.ok(qpsk.value)
  assert.equal(qpsk.value.modulationOrder, 2)
  assert.equal(qpsk.value.targetCodeRateX1024, 120)
})

test('reserved MCS codepoints are rejected instead of being interpreted as data', () => {
  const result = lookupMcsParameters({ table: 'pdsch-table-4', mcsIndex: 27 })

  assert.equal(result.value, null)
  assert.equal(result.diagnostics[0]?.code, 'RESERVED_MCS_INDEX')
})

test('resource-element calculation applies the 12-subcarrier and 156-RE-per-PRB rules', () => {
  const downlink = calculateNumberOfResourceElements({
    direction: 'downlink',
    nPrb: 10,
    nSymbols: 12,
    nDmrsPrb: 12,
  })

  assert.equal(downlink.value, 1320)
  assert.equal(downlink.details?.nRePrimePerPrb, 132)
  assert.equal(downlink.details?.nRePerPrb, 132)

  const capped = calculateNumberOfResourceElements({
    direction: 'downlink',
    nPrb: 2,
    nSymbols: 14,
    nDmrsPrb: 0,
  })
  assert.equal(capped.value, 312)
  assert.equal(capped.details?.nRePrimePerPrb, 168)
  assert.equal(capped.details?.nRePerPrb, 156)

  const multiSlotUplink = calculateNumberOfResourceElements({
    direction: 'uplink',
    nPrb: 20,
    nSymbols: 14,
    nDmrsPrb: 24,
    nOhPrb: 6,
    nPrbOutsideBwp: 2,
    numberOfSlots: 2,
  })
  assert.equal(multiSlotUplink.value, 4968)
})

test('small-TBS branch uses the V19.4.0 table and its floor quantization', () => {
  const result = calculateTransportBlockSizeFromNRe({
    nRe: 256,
    modulationOrder: 2,
    targetCodeRateX1024: 1024,
    numberOfLayers: 1,
  })

  assert.equal(result.value, 528)
  assert.equal(result.details?.algorithmBranch, 'small')
  assert.equal(result.details?.nInfo, 512)
  assert.equal(result.details?.nInfoQuantized, 512)
})

test('the 3824 boundary belongs to the small branch', () => {
  const result = calculateTransportBlockSizeFromNRe({
    nRe: 956,
    modulationOrder: 4,
    targetCodeRateX1024: 1024,
    numberOfLayers: 1,
  })

  assert.equal(result.value, 3824)
  assert.equal(result.details?.algorithmBranch, 'small')
  assert.equal(result.details?.nInfoQuantized, 3808)
})

test('large-TBS branch rounds ties upward and applies the R-dependent code-block rules', () => {
  const firstLarge = calculateTransportBlockSizeFromNRe({
    nRe: 957,
    modulationOrder: 4,
    targetCodeRateX1024: 1024,
    numberOfLayers: 1,
  })
  assert.equal(firstLarge.value, 3840)
  assert.equal(firstLarge.details?.nInfoQuantized, 3840)

  const tie = calculateTransportBlockSizeFromNRe({
    nRe: 2012,
    modulationOrder: 2,
    targetCodeRateX1024: 1024,
    numberOfLayers: 1,
  })
  assert.equal(tie.details?.nInfo, 4024)
  assert.equal(tie.details?.nInfoQuantized, 4032)
  assert.equal(tie.value, 4032)

  const lowRate = calculateTransportBlockSizeFromNRe({
    nRe: 8000,
    modulationOrder: 2,
    targetCodeRateX1024: 256,
    numberOfLayers: 1,
  })
  assert.equal(lowRate.value, 3976)
  assert.equal(lowRate.details?.codeBlockCount, 2)

  const highRate = calculateTransportBlockSizeFromNRe({
    nRe: 10000,
    modulationOrder: 2,
    targetCodeRateX1024: 1024,
    numberOfLayers: 1,
  })
  assert.equal(highRate.value, 19968)
  assert.equal(highRate.details?.codeBlockCount, 3)
})

test('one function calculates a downlink TBS from resources and MCS table inputs', () => {
  const result = calculateTransportBlockSize({
    direction: 'downlink',
    mcsTable: 'pdsch-table-1',
    mcsIndex: 10,
    numberOfLayers: 2,
    nPrb: 10,
    nSymbols: 12,
    nDmrsPrb: 12,
  })

  assert.equal(result.value, 3496)
  assert.equal(result.details?.nRe, 1320)
  assert.equal(result.details?.nInfo, 3506.25)
  assert.equal(result.details?.nInfoQuantized, 3488)
})

test('one function calculates an uplink TBS and supports pi/2-BPSK MCS entries', () => {
  const result = calculateTransportBlockSize({
    direction: 'uplink',
    mcsTable: 'pusch-transform-precoding-table-1',
    mcsIndex: 0,
    pi2Bpsk: true,
    numberOfLayers: 1,
    nPrb: 20,
    nSymbols: 14,
    nDmrsPrb: 24,
    nOhPrb: 6,
    nPrbOutsideBwp: 2,
    numberOfSlots: 2,
  })

  assert.equal(result.value, 1160)
  assert.equal(result.details?.modulationOrder, 1)
  assert.equal(result.details?.nRe, 4968)
})

test('PDSCH TB scaling is applied only when explicitly requested', () => {
  const result = calculateTransportBlockSizeFromNRe({
    nRe: 10000,
    modulationOrder: 2,
    targetCodeRateX1024: 1024,
    numberOfLayers: 1,
    scalingFactor: 0.5,
  })

  assert.equal(result.value, 9992)
  assert.equal(result.details?.scalingFactor, 0.5)
  assert.equal(result.details?.nInfo, 10000)
})

test('uplink rejects the PDSCH 1024QAM table and downlink rejects multi-slot resource input', () => {
  const wrongTable = calculateTransportBlockSize({
    direction: 'uplink',
    mcsTable: 'pdsch-table-4',
    mcsIndex: 0,
    numberOfLayers: 1,
    nPrb: 1,
    nSymbols: 12,
    nDmrsPrb: 0,
  })
  assert.equal(wrongTable.value, null)
  assert.equal(wrongTable.diagnostics[0]?.code, 'UNSUPPORTED_MCS_TABLE')

  const wrongSlotCount = calculateNumberOfResourceElements({
    direction: 'downlink',
    nPrb: 1,
    nSymbols: 12,
    nDmrsPrb: 0,
    numberOfSlots: 2,
  })
  assert.equal(wrongSlotCount.value, null)
  assert.equal(wrongSlotCount.diagnostics[0]?.field, 'numberOfSlots')
})

test('transport rate calculates ordinary and special downlink slots independently', () => {
  const inputs = {
    mcsTable: 'pdsch-table-2' as const,
    mcsIndex: 10,
    numberOfLayers: 1,
    nPrb: 10,
    nDmrsPrb: 12,
    nOhPrb: 0,
    nPrbOutsideBwp: 0,
    numberOfSlots: 1,
    pi2Bpsk: false,
    scalingFactor: 1 as const,
    downlinkSlotsPer10ms: 10,
    uplinkSlotsPer10ms: 10,
    specialSlotsPer10ms: 1,
    specialDownlinkSymbols: 10,
    pdcchSymbols: 2,
  }
  const ordinary = calculateTransportBlockSize({ ...inputs, direction: 'downlink', nSymbols: 12 })
  const special = calculateTransportBlockSize({ ...inputs, direction: 'downlink', nSymbols: 8 })
  const rate = calculateTransportRate({ ...inputs, direction: 'downlink' })

  assert.equal(rate.details?.normalDownlinkSymbols, 12)
  assert.equal(rate.details?.specialDownlinkSymbols, 8)
  assert.equal(rate.details?.normalDownlinkTbs, ordinary.value)
  assert.equal(rate.details?.specialDownlinkTbs, special.value)
  assert.equal(rate.details?.bitsPer10ms, (ordinary.value ?? 0) * 10 + (special.value ?? 0))
  assert.equal(rate.value, ((ordinary.value ?? 0) * 10 + (special.value ?? 0)) / 10_000)
})

test('transport rate uses only uplink slots and ignores special-slot uplink symbols', () => {
  const inputs = {
    mcsTable: 'pdsch-table-2' as const,
    mcsIndex: 10,
    numberOfLayers: 1,
    nPrb: 10,
    nDmrsPrb: 12,
    nOhPrb: 0,
    nPrbOutsideBwp: 0,
    numberOfSlots: 1,
    pi2Bpsk: false,
    scalingFactor: 1 as const,
    downlinkSlotsPer10ms: 10,
    uplinkSlotsPer10ms: 10,
    specialSlotsPer10ms: 3,
    specialDownlinkSymbols: 10,
    pdcchSymbols: 2,
  }
  const uplinkTbs = calculateTransportBlockSize({ ...inputs, direction: 'uplink', nSymbols: 14 })
  const rate = calculateTransportRate({ ...inputs, direction: 'uplink' })

  assert.equal(rate.details?.uplinkSymbols, 14)
  assert.equal(rate.details?.uplinkTbs, uplinkTbs.value)
  assert.equal(rate.details?.bitsPer10ms, (uplinkTbs.value ?? 0) * 10)
  assert.equal(rate.value, (uplinkTbs.value ?? 0) / 1_000)
})

test('transport rate rejects an unusable special downlink duration', () => {
  const rate = calculateTransportRate({
    direction: 'downlink',
    mcsTable: 'pdsch-table-2',
    mcsIndex: 10,
    numberOfLayers: 1,
    nPrb: 10,
    nDmrsPrb: 12,
    downlinkSlotsPer10ms: 10,
    uplinkSlotsPer10ms: 0,
    specialSlotsPer10ms: 1,
    specialDownlinkSymbols: 2,
    pdcchSymbols: 2,
  })

  assert.equal(rate.value, null)
  assert.equal(rate.diagnostics[0]?.field, 'specialDownlinkSymbols')
})
