import assert from 'node:assert/strict'
import test from 'node:test'

import { lookupTargetSinr } from '../src/domain/nrBlerCurve.ts'
import { calculateCodeBlockSegmentation } from '../src/domain/transportBlockSize.ts'

const defaultCurveInput = {
  mcsTable: 'pdsch-table-2' as const,
  mcsIndex: 10,
  baseGraph: 2 as const,
  codeBlockSizeBits: 3520,
  codeBlockCount: 1,
}

test('LDPC segmentation exposes the code-block size used by ns-3 curve selection', () => {
  assert.deepEqual(calculateCodeBlockSegmentation(3496, 658 / 1024), {
    baseGraph: 2,
    codeBlockSizeBits: 3520,
    codeBlockCount: 1,
  })
})

test('official ns-3 Table 2 curve interpolates the default 10% target', () => {
  const result = lookupTargetSinr({ ...defaultCurveInput, targetBler: 0.1 })

  assert.equal(result.method, 'interpolation')
  assert.ok(result.value !== null)
  assert.ok(Math.abs(result.value - 11.0654783166) < 1e-9)
  assert.deepEqual(result.diagnostics, [])
})

test('low-BLER tail uses log10(BLER) extrapolation instead of the zero sample', () => {
  const result = lookupTargetSinr({ ...defaultCurveInput, targetBler: 1e-6 })

  assert.equal(result.method, 'log10-extrapolation-low-bler')
  assert.ok(result.value !== null)
  assert.ok(Math.abs(result.value - 12.0265989593) < 1e-9)
})

test('high-BLER tail uses log10(BLER) extrapolation', () => {
  const result = lookupTargetSinr({ ...defaultCurveInput, targetBler: 0.9999 })

  assert.equal(result.method, 'log10-extrapolation-high-bler')
  assert.ok(result.value !== null)
  assert.ok(Math.abs(result.value - 10.4060591909) < 1e-9)
})

test('target BLER endpoints are rejected before taking the logarithm', () => {
  for (const targetBler of [0, 1, Number.NaN]) {
    const result = lookupTargetSinr({ ...defaultCurveInput, targetBler })
    assert.equal(result.value, null)
    assert.equal(result.diagnostics[0]?.code, 'INVALID_INPUT')
  }
})
