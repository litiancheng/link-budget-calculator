export type BudgetRowKind = 'input' | 'result'
export type BudgetRowVisibility = 'basic' | 'advanced'

export type BudgetRowDefinition = {
  id: string
  parameter: string
  unit: string
  kind: BudgetRowKind
  field?: string
  editor: 'text' | 'select' | 'readonly'
  groupId: string
  visibility?: BudgetRowVisibility
}

export type BudgetGroupDefinition = {
  id: string
  label: string
  rowIds: readonly string[]
}

export const BUDGET_ROWS: readonly BudgetRowDefinition[] = Object.freeze([
  {
    id: 'tb-direction',
    parameter: '传输方向',
    unit: '',
    kind: 'input',
    field: 'direction',
    editor: 'select',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-mcs-index',
    parameter: 'MCS 索引',
    unit: '',
    kind: 'input',
    field: 'mcsIndex',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-layers',
    parameter: '传输层数',
    unit: '',
    kind: 'input',
    field: 'numberOfLayers',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-prb',
    parameter: '分配 PRB 数',
    unit: '',
    kind: 'input',
    field: 'nPrb',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-target-bler',
    parameter: '目标 BLER',
    unit: '%',
    kind: 'input',
    field: 'targetBlerPercent',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-downlink-slots',
    parameter: '下行时隙数',
    unit: '每10ms',
    kind: 'input',
    field: 'downlinkSlotsPer10ms',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-uplink-slots',
    parameter: '上行时隙数',
    unit: '每10ms',
    kind: 'input',
    field: 'uplinkSlotsPer10ms',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-special-slots',
    parameter: '特殊时隙数',
    unit: '每10ms',
    kind: 'input',
    field: 'specialSlotsPer10ms',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-special-downlink-symbols',
    parameter: '特殊时隙下行符号数',
    unit: '',
    kind: 'input',
    field: 'specialDownlinkSymbols',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-pdcch-symbols',
    parameter: 'PDCCH 占用符号数',
    unit: '',
    kind: 'input',
    field: 'pdcchSymbols',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'basic',
  },
  {
    id: 'tb-mcs-table',
    parameter: 'MCS 表',
    unit: '',
    kind: 'input',
    field: 'mcsTable',
    editor: 'select',
    groupId: 'transport-block',
    visibility: 'advanced',
  },
  {
    id: 'tb-dmrs-re',
    parameter: '每 PRB DM-RS RE 数',
    unit: 'RE',
    kind: 'input',
    field: 'nDmrsPrb',
    editor: 'text',
    groupId: 'transport-block',
    visibility: 'advanced',
  },
  {
    id: 'path-loss-model',
    parameter: '路损模型',
    unit: '',
    kind: 'input',
    field: 'pathLossModel',
    editor: 'select',
    groupId: 'transmitter',
  },
  {
    id: 'frequency',
    parameter: '载波频率',
    unit: 'GHz',
    kind: 'input',
    field: 'carrierFrequencyGHz',
    editor: 'text',
    groupId: 'transmitter',
  },
  {
    id: 'tx-power',
    parameter: '发射功率',
    unit: 'dBm',
    kind: 'input',
    field: 'txPowerDbm',
    editor: 'text',
    groupId: 'transmitter',
  },
  {
    id: 'tx-gain',
    parameter: '发射天线增益',
    unit: 'dBi',
    kind: 'input',
    field: 'txGainDbi',
    editor: 'text',
    groupId: 'transmitter',
  },
  {
    id: 'tx-loss',
    parameter: '发射端馈线损耗',
    unit: 'dB',
    kind: 'input',
    field: 'txLossDb',
    editor: 'text',
    groupId: 'transmitter',
  },
  {
    id: 'path-loss',
    parameter: '路损值',
    unit: 'dB',
    kind: 'input',
    field: 'pathLossDb',
    editor: 'text',
    groupId: 'propagation',
  },
  {
    id: 'rx-gain',
    parameter: '接收天线增益',
    unit: 'dBi',
    kind: 'input',
    field: 'rxGainDbi',
    editor: 'text',
    groupId: 'receiver',
  },
  {
    id: 'rx-sensitivity',
    parameter: '接收灵敏度',
    unit: 'dBm',
    kind: 'input',
    field: 'rxSensitivityDbm',
    editor: 'text',
    groupId: 'receiver',
  },
  {
    id: 'margin',
    parameter: '预留链路余量',
    unit: 'dB',
    kind: 'input',
    field: 'linkMarginDb',
    editor: 'text',
    groupId: 'receiver',
  },
  {
    id: 'coverage-distance',
    parameter: '覆盖距离',
    unit: 'km',
    kind: 'result',
    editor: 'readonly',
    groupId: 'results',
  },
  {
    id: 'transport-block-size',
    parameter: '传输块大小',
    unit: 'bits',
    kind: 'result',
    editor: 'readonly',
    groupId: 'results',
  },
  {
    id: 'transport-rate',
    parameter: '传输速率',
    unit: 'Mbps',
    kind: 'result',
    editor: 'readonly',
    groupId: 'results',
  },
  {
    id: 'target-sinr',
    parameter: '目标 SINR',
    unit: 'dB',
    kind: 'result',
    editor: 'readonly',
    groupId: 'results',
  },
])

export const BUDGET_GROUPS: readonly BudgetGroupDefinition[] = Object.freeze([
  {
    id: 'transport-block',
    label: '传输块参数',
    rowIds: [
      'tb-direction',
      'tb-mcs-index',
      'tb-layers',
      'tb-prb',
      'tb-target-bler',
      'tb-downlink-slots',
      'tb-uplink-slots',
      'tb-special-slots',
      'tb-special-downlink-symbols',
      'tb-pdcch-symbols',
      'tb-mcs-table',
      'tb-dmrs-re',
    ],
  },
  {
    id: 'transmitter',
    label: '发射端参数',
    rowIds: ['path-loss-model', 'frequency', 'tx-power', 'tx-gain', 'tx-loss'],
  },
  {
    id: 'propagation',
    label: '传播与环境',
    rowIds: ['path-loss'],
  },
  {
    id: 'receiver',
    label: '接收端参数',
    rowIds: ['rx-gain', 'rx-sensitivity', 'margin'],
  },
  {
    id: 'results',
    label: '计算结果',
    rowIds: ['coverage-distance', 'transport-block-size', 'target-sinr'],
  },
])

export function getBudgetRowsForScenarioCount(
  scenarioCount: number,
  showAdvancedInputs = true,
): readonly BudgetRowDefinition[] {
  const rows = scenarioCount > 0 ? BUDGET_ROWS : BUDGET_ROWS.filter((row) => row.kind !== 'result')
  return showAdvancedInputs ? rows : rows.filter((row) => row.visibility !== 'advanced')
}

export function getBudgetGroupsForScenarioCount(
  scenarioCount: number,
  showAdvancedInputs = true,
): readonly BudgetGroupDefinition[] {
  const visibleRowIds = new Set(getBudgetRowsForScenarioCount(scenarioCount, showAdvancedInputs).map((row) => row.id))
  const groups = scenarioCount > 0 ? BUDGET_GROUPS : BUDGET_GROUPS.filter((group) => group.id !== 'results')

  return groups
    .map((group) => ({
      ...group,
      rowIds: group.rowIds.filter((rowId) => visibleRowIds.has(rowId)),
    }))
    .filter((group) => group.rowIds.length > 0)
}

export type BudgetClipboardColumn =
  | { id: 'parameter'; kind: 'parameter'; title: string }
  | { id: string; kind: 'scenario'; title: string }

export type BudgetClipboardRow = {
  id: string
  values: Readonly<Record<string, unknown>>
}

export type BudgetClipboardOptions = {
  columns: readonly BudgetClipboardColumn[]
  rows: readonly BudgetClipboardRow[]
  includeHeader?: boolean
}

export type BudgetPasteUpdate = {
  scenarioId: string
  field: string
  value: string
}

export type BudgetPastePlan = {
  accepted: boolean
  updates: readonly BudgetPasteUpdate[]
  skippedReadOnlyCells: number
  ignoredOutOfRangeCells: number
}

export function budgetParameterLabel(row: BudgetRowDefinition) {
  return row.unit ? `${row.parameter}（${row.unit}）` : row.parameter
}

export function getBudgetRow(rowId: string) {
  return BUDGET_ROWS.find((row) => row.id === rowId)
}

function clipboardValue(value: unknown) {
  return value == null ? '' : String(value).replace(/[\t\r\n]/g, ' ')
}

export function serializeBudgetClipboard({ columns, rows, includeHeader = false }: BudgetClipboardOptions) {
  const lines: string[] = []

  if (includeHeader) {
    lines.push(columns.map((column) => clipboardValue(column.title)).join('\t'))
  }

  rows.forEach((row) => {
    const definition = getBudgetRow(row.id)
    lines.push(
      columns
        .map((column) => {
          if (column.kind === 'parameter') {
            return clipboardValue(definition ? budgetParameterLabel(definition) : row.id)
          }
          return clipboardValue(row.values[column.id])
        })
        .join('\t'),
    )
  })

  return lines.join('\n')
}

export function parseBudgetClipboard(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!normalized) return []

  const lines = normalized.split('\n')
  if (lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t'))
}

export function planBudgetClipboardPaste({
  text,
  startRow,
  startColumn,
  scenarioIds,
  visibleRows = BUDGET_ROWS,
}: {
  text: string
  startRow: number
  startColumn: number
  scenarioIds: readonly string[]
  visibleRows?: readonly BudgetRowDefinition[]
}): BudgetPastePlan {
  const matrix = parseBudgetClipboard(text)
  const startDefinition = visibleRows[startRow]

  if (
    matrix.length === 0 ||
    !Number.isInteger(startRow) ||
    startRow < 0 ||
    !startDefinition ||
    startDefinition.kind !== 'input' ||
    !Number.isInteger(startColumn) ||
    startColumn < 1 ||
    startColumn > scenarioIds.length ||
    !scenarioIds[startColumn - 1]
  ) {
    return {
      accepted: false,
      updates: [],
      skippedReadOnlyCells: 0,
      ignoredOutOfRangeCells: 0,
    }
  }

  const updates: BudgetPasteUpdate[] = []
  let skippedReadOnlyCells = 0
  let ignoredOutOfRangeCells = 0

  matrix.forEach((sourceRow, rowOffset) => {
    const rowDefinition = visibleRows[startRow + rowOffset]

    sourceRow.forEach((value, columnOffset) => {
      const scenarioId = scenarioIds[startColumn - 1 + columnOffset]

      if (!rowDefinition || !scenarioId) {
        ignoredOutOfRangeCells += 1
        return
      }

      if (rowDefinition.kind !== 'input' || !rowDefinition.field) {
        skippedReadOnlyCells += 1
        return
      }

      updates.push({
        scenarioId,
        field: rowDefinition.field,
        value,
      })
    })
  })

  return {
    accepted: true,
    updates,
    skippedReadOnlyCells,
    ignoredOutOfRangeCells,
  }
}
