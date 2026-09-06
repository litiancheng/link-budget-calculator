import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createScenarioMatrix,
  DEFAULT_SCENARIO_INPUTS,
  freeSpacePathLossModel,
  PathLossModelRegistry,
} from '../src/domain/scenarioMatrix.ts'

test('default scenario calculates roughly one kilometre of free-space coverage', () => {
  const matrix = createScenarioMatrix({
    scenarios: [
      {
        id: 'baseline',
        name: '基准链路',
        inputs: { ...DEFAULT_SCENARIO_INPUTS },
      },
    ],
  })

  const baseline = matrix.getScenario('baseline')

  assert.ok(baseline)
  assert.equal(baseline.diagnostics.length, 0)
  assert.ok(baseline.result.coverageDistanceKm !== null)
  assert.ok(Math.abs(baseline.result.coverageDistanceKm - 1.005) < 0.01)
})

test('default scenario calculates the protocol TBS with Table 2', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const baseline = matrix.getScenario('baseline')

  assert.ok(baseline)
  assert.equal(baseline.inputs.mcsTable, 'pdsch-table-2')
  assert.equal(baseline.result.transportBlockSizeBits, 3496)
  assert.deepEqual(baseline.tbDiagnostics, [])
})

test('default scenario derives downlink symbols and calculates Mbps over 10 ms', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const baseline = matrix.getScenario('baseline')

  assert.ok(baseline)
  assert.equal(baseline.inputs.nSymbols, undefined)
  assert.equal(baseline.inputs.pdcchSymbols, '2')
  assert.equal(baseline.result.transportRateMbps, 3.496)
  assert.deepEqual(baseline.rateDiagnostics, [])
})

test('default scenario derives the target SINR from the official ns-3 curve', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const baseline = matrix.getScenario('baseline')

  assert.ok(baseline)
  assert.equal(baseline.inputs.targetBlerPercent, '10')
  assert.equal(baseline.result.targetSinrMethod, 'interpolation')
  assert.ok(baseline.result.targetSinrDb !== null)
  assert.ok(Math.abs(baseline.result.targetSinrDb - 11.0654783166) < 1e-9)
  assert.deepEqual(baseline.sinrDiagnostics, [])
})

test('scenario target BLER updates can select log10 extrapolation', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const updated = matrix.updateInput('baseline', 'targetBlerPercent', '0.0001')

  assert.equal(updated.result.targetSinrMethod, 'log10-extrapolation-low-bler')
  assert.ok(updated.result.targetSinrDb !== null)
  assert.deepEqual(updated.sinrDiagnostics, [])
})

test('invalid target BLER clears only SINR and preserves other results', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const updated = matrix.updateInput('baseline', 'targetBlerPercent', '100')

  assert.equal(updated.result.targetSinrDb, null)
  assert.equal(updated.result.coverageDistanceKm !== null, true)
  assert.equal(updated.result.transportBlockSizeBits, 3496)
  assert.equal(updated.sinrDiagnostics[0]?.field, 'targetBlerPercent')
})

test('target SINR is available for the requested Table 1/2 PRB sizes', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  for (const mcsTable of ['pdsch-table-1', 'pdsch-table-2'] as const) {
    for (const nPrb of ['10', '100', '200']) {
      const updated = matrix.updateInputs('baseline', { mcsTable, nPrb, targetBlerPercent: '10' })
      assert.ok(updated.result.targetSinrDb !== null, `${mcsTable} PRB=${nPrb}`)
      assert.deepEqual(updated.sinrDiagnostics, [])
    }
  }
})

test('scenario rate follows the selected direction and ignores the other slot counts', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const uplink = matrix.updateInputs('baseline', {
    direction: 'uplink',
    downlinkSlotsPer10ms: '0',
    uplinkSlotsPer10ms: '10',
    specialSlotsPer10ms: '3',
    specialDownlinkSymbols: '10',
  })

  assert.equal(uplink.result.transportRateMbps, 3.968)
  assert.deepEqual(uplink.rateDiagnostics, [])
})

test('invalid rate configuration reports rate diagnostics without clearing coverage', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const updated = matrix.updateInput('baseline', 'pdcchSymbols', '14')

  assert.ok(updated.result.coverageDistanceKm !== null)
  assert.equal(updated.result.transportRateMbps, null)
  assert.equal(updated.rateDiagnostics[0]?.field, 'pdcchSymbols')
})

test('link-budget TBS restricts the MCS table to Table 1 or Table 2', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const tableOne = matrix.updateInput('baseline', 'mcsTable', 'pdsch-table-1')
  assert.ok(tableOne.result.transportBlockSizeBits !== null)
  assert.equal(tableOne.tbDiagnostics.length, 0)

  const tableThree = matrix.updateInput('baseline', 'mcsTable', 'pdsch-table-3')
  assert.equal(tableThree.result.transportBlockSizeBits, null)
  assert.deepEqual(tableThree.tbDiagnostics[0], {
    code: 'UNSUPPORTED_MCS_TABLE',
    field: 'mcsTable',
    value: 'pdsch-table-3',
    message: '链路预算只允许使用 MCS Table 1 或 Table 2',
  })
})

test('invalid TBS input clears only the TBS result and reports its field', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const updated = matrix.updateInput('baseline', 'nPrb', '0')

  assert.equal(updated.result.transportBlockSizeBits, null)
  assert.equal(updated.tbDiagnostics[0]?.code, 'INVALID_INPUT')
  assert.equal(updated.tbDiagnostics[0]?.field, 'nPrb')
  assert.ok(updated.result.coverageDistanceKm !== null)
})

test('missing path loss clears the previous result and reports the input field', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const updated = matrix.updateInput('baseline', 'pathLossDb', '')

  assert.equal(updated.result.coverageDistanceKm, null)
  assert.deepEqual(updated.diagnostics[0], {
    code: 'MISSING_INPUT',
    field: 'pathLossDb',
    modelId: 'free-space',
  })
})

test('non-positive model inputs are rejected with structured diagnostics', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const invalidLoss = matrix.updateInput('baseline', 'pathLossDb', '0')
  assert.equal(invalidLoss.result.coverageDistanceKm, null)
  assert.equal(invalidLoss.diagnostics[0]?.code, 'INVALID_INPUT')
  assert.equal(invalidLoss.diagnostics[0]?.field, 'pathLossDb')
  assert.equal(invalidLoss.diagnostics[0]?.message, '路损值必须大于 0')

  const invalidFrequency = matrix.updateInput('baseline', 'carrierFrequencyGHz', '-2.4')
  assert.equal(invalidFrequency.result.coverageDistanceKm, null)
  assert.equal(invalidFrequency.diagnostics[0]?.code, 'INVALID_INPUT')
  assert.equal(invalidFrequency.diagnostics[0]?.field, 'carrierFrequencyGHz')
  assert.equal(invalidFrequency.diagnostics[0]?.message, '载波频率必须大于 0')
})

test('a diagnostic in one scenario does not block another scenario', () => {
  const matrix = createScenarioMatrix({
    scenarios: [
      { id: 'broken', name: '无效链路', inputs: { ...DEFAULT_SCENARIO_INPUTS, pathLossDb: '' } },
      { id: 'valid', name: '有效链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } },
    ],
  })

  const snapshot = matrix.getSnapshot()
  const broken = snapshot.scenarios.find((scenario) => scenario.id === 'broken')
  const valid = snapshot.scenarios.find((scenario) => scenario.id === 'valid')

  assert.ok(broken)
  assert.ok(valid)
  assert.equal(broken.result.coverageDistanceKm, null)
  assert.equal(broken.diagnostics[0]?.field, 'pathLossDb')
  assert.ok(valid.result.coverageDistanceKm !== null)
  assert.equal(valid.diagnostics.length, 0)
})

test('free-space model exposes forward and inverse calculations in the declared units', () => {
  const forward = freeSpacePathLossModel.calculatePathLoss({ carrierFrequencyGHz: '2.4', distanceKm: '1' })
  const inverse = freeSpacePathLossModel.solveDistance({ carrierFrequencyGHz: '2.4', pathLossDb: '100.054' })

  assert.ok(forward.value !== null)
  assert.ok(Math.abs(forward.value - 100.054) < 0.001)
  assert.ok(inverse.value !== null)
  assert.ok(Math.abs(inverse.value - 1) < 0.001)
})

test('scenario input text is preserved and an unknown model is diagnosed', () => {
  const registry = new PathLossModelRegistry()
  const matrix = createScenarioMatrix({
    registry,
    scenarios: [{ id: 'baseline', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const updated = matrix.updateInput('baseline', 'pathLossDb', ' 100.1 ')
  assert.equal(updated.inputs.pathLossDb, ' 100.1 ')
  assert.ok(updated.result.coverageDistanceKm !== null)

  const unknown = matrix.updateInput('baseline', 'pathLossModel', 'not-registered')
  assert.equal(unknown.result.coverageDistanceKm, null)
  assert.equal(unknown.diagnostics[0]?.code, 'UNKNOWN_MODEL')
  assert.equal(unknown.diagnostics[0]?.field, 'pathLossModel')
})

test('scenario lifecycle keeps stable ids and independent default inputs', () => {
  const matrix = createScenarioMatrix({
    scenarios: [{ id: 'first', name: '基准链路', inputs: { ...DEFAULT_SCENARIO_INPUTS } }],
  })

  const added = matrix.addScenario()

  assert.equal(added.name, '新场景')
  assert.notEqual(added.id, 'first')
  assert.deepEqual(added.inputs, DEFAULT_SCENARIO_INPUTS)

  matrix.updateInput('first', 'pathLossDb', '110')
  assert.equal(matrix.getScenario(added.id)?.inputs.pathLossDb, DEFAULT_SCENARIO_INPUTS.pathLossDb)

  matrix.renameScenario(added.id, '基准链路')
  assert.equal(matrix.getScenario(added.id)?.name, '基准链路')
  matrix.renameScenario(added.id, '   ')
  assert.equal(matrix.getScenario(added.id)?.name, '基准链路')

  assert.equal(matrix.removeScenario('first'), true)
  assert.equal(matrix.removeScenario(added.id), true)
  assert.deepEqual(matrix.getSnapshot().scenarios, [])

  const recreated = matrix.addScenario()
  assert.equal(recreated.name, '新场景')
  assert.equal(matrix.getSnapshot().scenarios.length, 1)
})

test('removing a middle scenario preserves the remaining order, ids, inputs, and results', () => {
  const matrix = createScenarioMatrix({
    scenarios: [
      { id: 'first', name: '第一条', inputs: { ...DEFAULT_SCENARIO_INPUTS, pathLossDb: '100.1' } },
      { id: 'middle', name: '中间条', inputs: { ...DEFAULT_SCENARIO_INPUTS, pathLossDb: '110' } },
      { id: 'last', name: '最后一条', inputs: { ...DEFAULT_SCENARIO_INPUTS, pathLossDb: '120' } },
    ],
  })

  const before = matrix.getSnapshot().scenarios
  const firstBefore = before.find((scenario) => scenario.id === 'first')
  const lastBefore = before.find((scenario) => scenario.id === 'last')

  assert.equal(matrix.removeScenario('middle'), true)
  assert.deepEqual(
    matrix.getSnapshot().scenarios.map((scenario) => scenario.id),
    ['first', 'last'],
  )
  assert.deepEqual(matrix.getScenario('first'), firstBefore)
  assert.deepEqual(matrix.getScenario('last'), lastBefore)
})

test('generated scenario ids remain unique after deleting and recreating scenarios', () => {
  const matrix = createScenarioMatrix({ scenarios: [] })

  const first = matrix.addScenario()
  const second = matrix.addScenario()
  assert.equal(matrix.removeScenario(first.id), true)

  const recreated = matrix.addScenario()

  assert.notEqual(recreated.id, first.id)
  assert.deepEqual(
    matrix.getSnapshot().scenarios.map((scenario) => scenario.id),
    [second.id, recreated.id],
  )
})

test('batch input updates calculate a scenario once after all raw values are written', () => {
  let solveCalls = 0
  const registry = new PathLossModelRegistry([
    {
      id: 'counting-model',
      label: '计数模型',
      calculatePathLoss: () => ({ value: 1, diagnostics: [] }),
      solveDistance: (inputs) => {
        solveCalls += 1
        return { value: Number(inputs.pathLossDb), diagnostics: [] }
      },
    },
  ])
  const matrix = createScenarioMatrix({
    registry,
    scenarios: [
      {
        id: 'baseline',
        name: '基准链路',
        inputs: { ...DEFAULT_SCENARIO_INPUTS, pathLossModel: 'counting-model' },
      },
    ],
  })

  matrix.updateInputs('baseline', {
    pathLossDb: '101',
    carrierFrequencyGHz: '2.5',
    txPowerDbm: '24',
  })

  assert.equal(solveCalls, 1)
  assert.equal(matrix.getScenario('baseline')?.result.coverageDistanceKm, 101)
})

test('multi-scenario batch input updates solve each affected scenario once', () => {
  let solveCalls = 0
  const registry = new PathLossModelRegistry([
    {
      id: 'counting-model',
      label: '计数模型',
      calculatePathLoss: () => ({ value: 1, diagnostics: [] }),
      solveDistance: (inputs) => {
        solveCalls += 1
        return { value: Number(inputs.pathLossDb), diagnostics: [] }
      },
    },
  ])
  const matrix = createScenarioMatrix({
    registry,
    scenarios: [
      {
        id: 'baseline',
        name: '基准链路',
        inputs: { ...DEFAULT_SCENARIO_INPUTS, pathLossModel: 'counting-model' },
      },
      {
        id: 'urban',
        name: '城市遮挡',
        inputs: { ...DEFAULT_SCENARIO_INPUTS, pathLossModel: 'counting-model' },
      },
    ],
  })

  solveCalls = 0
  const updated = matrix.updateInputsBatch({
    baseline: { pathLossDb: '101' },
    urban: { pathLossDb: '111', carrierFrequencyGHz: '5.8' },
  })

  assert.equal(solveCalls, 2)
  assert.deepEqual(
    updated.map((scenario) => [scenario.id, scenario.result.coverageDistanceKm]),
    [
      ['baseline', 101],
      ['urban', 111],
    ],
  )
})

test('free-space models publish their input and result extension metadata', () => {
  assert.deepEqual(freeSpacePathLossModel.inputDefinitions, [
    { field: 'carrierFrequencyGHz', label: '载波频率', unit: 'GHz', defaultValue: '2.4', groupId: 'propagation', editor: 'text' },
    { field: 'pathLossDb', label: '路损值', unit: 'dB', defaultValue: '100.1', groupId: 'propagation', editor: 'text' },
  ])
  assert.deepEqual(freeSpacePathLossModel.resultDefinitions, [
    { field: 'coverageDistanceKm', label: '覆盖距离', unit: 'km', groupId: 'results' },
  ])
})
