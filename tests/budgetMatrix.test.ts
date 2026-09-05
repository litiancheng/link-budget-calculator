import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BUDGET_ROWS,
  getBudgetGroupsForScenarioCount,
  getBudgetRowsForScenarioCount,
  budgetParameterLabel,
  parseBudgetClipboard,
  planBudgetClipboardPaste,
  serializeBudgetClipboard,
} from '../src/domain/budgetMatrix.ts'

test('empty scenario collections do not project calculated result rows or groups', () => {
  const rows = getBudgetRowsForScenarioCount(0)
  const groups = getBudgetGroupsForScenarioCount(0)

  assert.equal(rows.some((row) => row.kind === 'result'), false)
  assert.equal(groups.some((group) => group.id === 'results'), false)
  assert.equal(getBudgetRowsForScenarioCount(1).some((row) => row.kind === 'result'), true)
  assert.equal(getBudgetGroupsForScenarioCount(1).some((group) => group.id === 'results'), true)
})

test('budget rows keep units in the fixed parameter-name column and reserve a result row', () => {
  const frequency = BUDGET_ROWS.find((row) => row.id === 'frequency')
  const coverage = BUDGET_ROWS.find((row) => row.id === 'coverage-distance')

  assert.ok(frequency)
  assert.equal(budgetParameterLabel(frequency), '载波频率（GHz）')
  assert.ok(coverage)
  assert.equal(coverage.kind, 'result')
  assert.equal(budgetParameterLabel(coverage), '覆盖距离（km）')
})

test('TBS inputs separate always-visible basics from collapsible advanced rows', () => {
  const basicRows = getBudgetRowsForScenarioCount(1, false)
    .filter((row) => row.groupId === 'transport-block')
    .map((row) => row.id)
  const allRows = getBudgetRowsForScenarioCount(1, true)
    .filter((row) => row.groupId === 'transport-block')
    .map((row) => row.id)

  assert.deepEqual(basicRows, ['tb-direction', 'tb-mcs-index', 'tb-layers', 'tb-prb', 'tb-symbols'])
  assert.deepEqual(allRows, [...basicRows, 'tb-mcs-table', 'tb-dmrs-re'])

  const collapsedGroup = getBudgetGroupsForScenarioCount(1, false).find((group) => group.id === 'transport-block')
  assert.deepEqual(collapsedGroup?.rowIds, basicRows)
})

test('clipboard copy emits a predictable TSV without group labels', () => {
  const rows = [
    {
      id: 'path-loss-model',
      values: { baseline: 'free-space' },
    },
    {
      id: 'coverage-distance',
      values: { baseline: '1.00' },
    },
  ]

  const text = serializeBudgetClipboard({
    columns: [
      { id: 'parameter', kind: 'parameter', title: '参数名称' },
      { id: 'baseline', kind: 'scenario', title: '基准链路' },
    ],
    rows,
    includeHeader: true,
  })

  assert.equal(text, '参数名称\t基准链路\n路损模型\tfree-space\n覆盖距离（km）\t1.00')
})

test('paste requires an editable scenario input as its origin and skips read-only cells', () => {
  const startRow = BUDGET_ROWS.findIndex((row) => row.id === 'margin')
  const coverageRow = BUDGET_ROWS.findIndex((row) => row.id === 'coverage-distance')

  const plan = planBudgetClipboardPaste({
    text: '12\t13\n1.1\t1.2',
    startRow,
    startColumn: 1,
    scenarioIds: ['baseline', 'urban'],
  })

  assert.equal(plan.accepted, true)
  assert.deepEqual(plan.updates, [
    { scenarioId: 'baseline', field: 'linkMarginDb', value: '12' },
    { scenarioId: 'urban', field: 'linkMarginDb', value: '13' },
  ])
  assert.equal(plan.skippedReadOnlyCells, 2)
  assert.equal(coverageRow > startRow, true)

  const rejected = planBudgetClipboardPaste({
    text: '场景 A\t场景 B',
    startRow,
    startColumn: 0,
    scenarioIds: ['baseline', 'urban'],
  })
  assert.equal(rejected.accepted, false)
  assert.deepEqual(rejected.updates, [])
})

test('paste treats source text as data and ignores cells beyond the matrix', () => {
  const startRow = BUDGET_ROWS.findIndex((row) => row.id === 'path-loss-model')
  const plan = planBudgetClipboardPaste({
    text: '场景 A\t场景 B\tignored\n2.4\t5.8\tignored\n100.1\t110\tignored',
    startRow,
    startColumn: 1,
    scenarioIds: ['baseline', 'urban'],
  })

  assert.equal(plan.accepted, true)
  assert.deepEqual(plan.updates.slice(0, 6), [
    { scenarioId: 'baseline', field: 'pathLossModel', value: '场景 A' },
    { scenarioId: 'urban', field: 'pathLossModel', value: '场景 B' },
    { scenarioId: 'baseline', field: 'carrierFrequencyGHz', value: '2.4' },
    { scenarioId: 'urban', field: 'carrierFrequencyGHz', value: '5.8' },
    { scenarioId: 'baseline', field: 'txPowerDbm', value: '100.1' },
    { scenarioId: 'urban', field: 'txPowerDbm', value: '110' },
  ])
  assert.equal(plan.ignoredOutOfRangeCells, 3)
  assert.deepEqual(parseBudgetClipboard('a\tb\r\nc\td\n'), [
    ['a', 'b'],
    ['c', 'd'],
  ])
})

test('clipboard serialization keeps cell values inside their TSV boundaries', () => {
  const text = serializeBudgetClipboard({
    columns: [{ id: 'baseline', kind: 'scenario', title: '基准\t链路' }],
    rows: [
      {
        id: 'path-loss-model',
        values: { baseline: 'free\nspace' },
      },
    ],
    includeHeader: true,
  })

  assert.equal(text, '基准 链路\nfree space')
})

test('paste rejects malformed origin coordinates instead of accepting a no-op', () => {
  const startRow = BUDGET_ROWS.findIndex((row) => row.id === 'path-loss-model')

  const plan = planBudgetClipboardPaste({
    text: 'free-space',
    startRow,
    startColumn: Number.NaN,
    scenarioIds: ['baseline'],
  })

  assert.equal(plan.accepted, false)
  assert.deepEqual(plan.updates, [])
})

test('paste follows the currently visible rows when advanced inputs are collapsed', () => {
  const visibleRows = getBudgetRowsForScenarioCount(1, false)
  const startRow = visibleRows.findIndex((row) => row.id === 'tb-symbols')

  const plan = planBudgetClipboardPaste({
    text: '12\n100.1',
    startRow,
    startColumn: 1,
    scenarioIds: ['baseline'],
    visibleRows,
  })

  assert.deepEqual(plan.updates, [
    { scenarioId: 'baseline', field: 'nSymbols', value: '12' },
    { scenarioId: 'baseline', field: 'pathLossModel', value: '100.1' },
  ])
})
