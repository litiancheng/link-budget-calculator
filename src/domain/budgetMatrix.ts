export type BudgetRowKind = 'input' | 'result'

export type BudgetRowDefinition = {
  id: string
  parameter: string
  unit: string
  kind: BudgetRowKind
  field?: string
  editor: 'text' | 'select' | 'readonly'
  groupId: string
}

export type BudgetGroupDefinition = {
  id: string
  label: string
  rowIds: readonly string[]
}

export const BUDGET_ROWS: readonly BudgetRowDefinition[] = Object.freeze([
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
])

export const BUDGET_GROUPS: readonly BudgetGroupDefinition[] = Object.freeze([
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
    rowIds: ['coverage-distance'],
  },
])

export function getBudgetRowsForScenarioCount(scenarioCount: number): readonly BudgetRowDefinition[] {
  return scenarioCount > 0 ? BUDGET_ROWS : BUDGET_ROWS.filter((row) => row.kind !== 'result')
}

export function getBudgetGroupsForScenarioCount(scenarioCount: number): readonly BudgetGroupDefinition[] {
  return scenarioCount > 0 ? BUDGET_GROUPS : BUDGET_GROUPS.filter((group) => group.id !== 'results')
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
}: {
  text: string
  startRow: number
  startColumn: number
  scenarioIds: readonly string[]
}): BudgetPastePlan {
  const matrix = parseBudgetClipboard(text)
  const startDefinition = BUDGET_ROWS[startRow]

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
    const rowDefinition = BUDGET_ROWS[startRow + rowOffset]

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
