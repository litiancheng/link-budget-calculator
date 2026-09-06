<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { TabulatorFull as Tabulator } from 'tabulator-tables'
import {
  createScenarioMatrix,
  DEFAULT_SCENARIO_INPUTS,
  type ModelDiagnostic,
  type ScenarioView,
} from '../domain/scenarioMatrix'
import {
  BUDGET_ROWS,
  budgetParameterLabel,
  getBudgetRowsForScenarioCount,
  planBudgetClipboardPaste,
  serializeBudgetClipboard,
  type BudgetRowDefinition,
} from '../domain/budgetMatrix'
import type { TbsDiagnostic } from '../domain/transportBlockSize'

type BudgetTableRow = {
  id: string
  rowType: 'input' | 'result'
  parameter: string
  [field: string]: unknown
}

const tableElement = ref<HTMLElement | null>(null)
let table: any = null

const scenarioAddField = '__scenario_add__'
const emit = defineEmits<{
  (event: 'scenario-count-change', count: number): void
}>()


const scenarioMatrix = createScenarioMatrix({
  scenarios: [
    {
      id: 'baseline',
      name: '基准链路',
      inputs: { ...DEFAULT_SCENARIO_INPUTS },
    },
    {
      id: 'urban',
      name: '城市遮挡',
      inputs: {
        ...DEFAULT_SCENARIO_INPUTS,
        carrierFrequencyGHz: '5.8',
        pathLossDb: '105.8',
        txPowerDbm: '20',
        txGainDbi: '8.5',
        txLossDb: '1.8',
        rxGainDbi: '8.5',
        rxSensitivityDbm: '-88',
        linkMarginDb: '-2.6',
      },
    },
    {
      id: 'rural',
      name: '开阔环境',
      inputs: {
        ...DEFAULT_SCENARIO_INPUTS,
        carrierFrequencyGHz: '5.8',
        pathLossDb: '117.3',
        txPowerDbm: '27',
        txGainDbi: '11.2',
        txLossDb: '1.1',
        rxGainDbi: '11.2',
        rxSensitivityDbm: '-96',
        linkMarginDb: '15.7',
      },
    },
    {
      id: 'lab',
      name: '实验室校验',
      inputs: {
        ...DEFAULT_SCENARIO_INPUTS,
        carrierFrequencyGHz: '18',
        pathLossDb: '107.1',
        txPowerDbm: '15',
        txGainDbi: '16',
        txLossDb: '2.4',
        rxGainDbi: '16',
        rxSensitivityDbm: '-76',
        linkMarginDb: '7.5',
      },
    },
  ],
})

const scenarioViews = ref<ScenarioView[]>([])
const showAdvancedInputs = ref(false)
let rows: BudgetTableRow[] = []

const diagnosticFieldLabels: Record<string, string> = {
  pathLossModel: '路损模型',
  carrierFrequencyGHz: '载波频率',
  pathLossDb: '路损值',
  distanceKm: '传播距离',
  direction: '传输方向',
  mcsIndex: 'MCS 索引',
  numberOfLayers: '传输层数',
  nPrb: '分配 PRB 数',
  downlinkSlotsPer10ms: '下行时隙数（每10ms）',
  uplinkSlotsPer10ms: '上行时隙数（每10ms）',
  specialSlotsPer10ms: '特殊时隙数（每10ms）',
  specialDownlinkSymbols: '特殊时隙下行符号数',
  pdcchSymbols: 'PDCCH 占用符号数',
  mcsTable: 'MCS 表',
  nDmrsPrb: '每 PRB DM-RS RE 数',
}

const tbsDiagnosticFieldLabels: Record<string, string> = {
  direction: '传输方向',
  mcsTable: 'MCS 表',
  mcsIndex: 'MCS 索引',
  numberOfLayers: '传输层数',
  nPrb: '分配 PRB 数',
  downlinkSlotsPer10ms: '下行时隙数（每10ms）',
  uplinkSlotsPer10ms: '上行时隙数（每10ms）',
  specialSlotsPer10ms: '特殊时隙数（每10ms）',
  specialDownlinkSymbols: '特殊时隙下行符号数',
  pdcchSymbols: 'PDCCH 占用符号数',
  nDmrsPrb: '每 PRB DM-RS RE 数',
}

function escapeHtml(value: unknown) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function diagnosticMessage(diagnostic: ModelDiagnostic) {
  const label = diagnosticFieldLabels[diagnostic.field] ?? '输入值'
  if (diagnostic.message) return diagnostic.message
  if (diagnostic.code === 'MISSING_INPUT') return '请输入' + label
  if (diagnostic.code === 'INVALID_INPUT') return label + '必须大于 0'
  if (diagnostic.code === 'UNKNOWN_MODEL') return '不支持路损模型：' + (diagnostic.value ?? '')
  return '当前输入无法计算'
}

function tbsDiagnosticMessage(diagnostic: TbsDiagnostic) {
  const label = tbsDiagnosticFieldLabels[diagnostic.field] ?? 'TBS 输入值'
  if (diagnostic.message) return diagnostic.message
  if (diagnostic.code === 'RESERVED_MCS_INDEX') return label + '在所选 MCS 表中为保留值'
  if (diagnostic.code === 'UNSUPPORTED_MCS_TABLE') return '链路预算只允许使用 MCS Table 1 或 Table 2'
  if (diagnostic.code === 'INVALID_INPUT') return label + '输入无效'
  return '当前 TBS 无法计算'
}

function scenarioResultValue(view: ScenarioView, definition: BudgetRowDefinition) {
  if (definition.id === 'transport-block-size') {
    if (view.result.transportBlockSizeBits !== null) {
      return String(view.result.transportBlockSizeBits)
    }

    const diagnostic = view.tbDiagnostics[0]
    return diagnostic ? tbsDiagnosticMessage(diagnostic) : ''
  }

  if (definition.id === 'transport-rate') {
    if (view.result.transportRateMbps !== null) {
      return view.result.transportRateMbps.toFixed(2)
    }

    const diagnostic = view.rateDiagnostics[0]
    return diagnostic ? tbsDiagnosticMessage(diagnostic) : ''
  }

  if (view.result.coverageDistanceKm !== null) {
    return view.result.coverageDistanceKm.toFixed(2)
  }

  const diagnostic = view.diagnostics[0]
  return diagnostic ? diagnosticMessage(diagnostic) : ''
}

function scenarioInputValue(view: ScenarioView, definition: BudgetRowDefinition) {
  return definition.field ? view.inputs[definition.field] ?? '' : ''
}

function projectRows(views: readonly ScenarioView[]) {
  return getBudgetRowsForScenarioCount(views.length, showAdvancedInputs.value).map((definition): BudgetTableRow => {
    const row: BudgetTableRow = {
      id: definition.id,
      rowType: definition.kind,
      parameter: budgetParameterLabel(definition),
    }

    views.forEach((view) => {
      row[view.id] =
        definition.kind === 'result'
          ? scenarioResultValue(view, definition)
          : scenarioInputValue(view, definition)
    })

    return row
  })
}

function syncProjection() {
  const snapshot = scenarioMatrix.getSnapshot()
  scenarioViews.value = [...snapshot.scenarios]
  rows = projectRows(snapshot.scenarios)
  emit('scenario-count-change', snapshot.scenarios.length)
}

function viewForScenario(id: string) {
  return scenarioViews.value.find((view) => view.id === id)
}

function hasDiagnostic(scenarioId: string, field: string) {
  const view = viewForScenario(scenarioId)
  return (
    view?.diagnostics.some((diagnostic) => diagnostic.field === field) ||
    view?.tbDiagnostics.some((diagnostic) => diagnostic.field === field) ||
    view?.rateDiagnostics.some((diagnostic) => diagnostic.field === field) ||
    false
  )
}

function scenarioResultIsValid(view: ScenarioView, definition: BudgetRowDefinition) {
  if (definition.id === 'transport-block-size') return view.result.transportBlockSizeBits !== null
  if (definition.id === 'transport-rate') return view.result.transportRateMbps !== null
  return view.result.coverageDistanceKm !== null
}

function modelLabel(value: unknown) {
  const model = scenarioMatrix.listPathLossModels().find((item) => item.id === value)
  return model?.label ?? String(value ?? '')
}

function tbsInputLabel(definition: BudgetRowDefinition, value: unknown) {
  const rawValue = String(value ?? '')
  if (definition.id === 'tb-direction') {
    return {
      downlink: '下行（DL-SCH / PDSCH）',
      uplink: '上行（UL-SCH / PUSCH）',
    }[rawValue] ?? rawValue
  }

  if (definition.id === 'tb-mcs-table') {
    return {
      'pdsch-table-1': 'Table 1',
      'pdsch-table-2': 'Table 2',
    }[rawValue] ?? rawValue
  }

  return rawValue
}

function budgetRowForCell(data: BudgetTableRow) {
  return BUDGET_ROWS.find((row) => row.id === data.id)
}


function valueFormatter(cell: any) {
  const value = cell.getValue()
  const data = cell.getRow().getData() as BudgetTableRow
  const scenarioId = String(cell.getField() ?? '')
  const definition = budgetRowForCell(data)

  if (!definition) return ''

  if (definition.field) {
    cell.getElement()?.classList.toggle('table-cell--error', hasDiagnostic(scenarioId, definition.field))
  }

  if (definition.kind === 'result') {
    const resultValue = String(value ?? '')
    if (!resultValue) return '<span class="table-value table-value--error">暂无结果</span>'
    const scenario = viewForScenario(scenarioId)
    if (!scenario || !scenarioResultIsValid(scenario, definition)) {
      return '<span class="table-value table-value--error">' + escapeHtml(resultValue) + '</span>'
    }
    return '<span class="table-value table-value--result">' + escapeHtml(resultValue) + '</span>'
  }

  if (definition.id === 'path-loss-model') {
    return '<span class="table-value">' + escapeHtml(modelLabel(value)) + '</span>'
  }

  return '<span class="table-value">' + escapeHtml(tbsInputLabel(definition, value)) + '</span>'
}

function isScenarioField(field: string) {
  return scenarioViews.value.some((view) => view.id === field)
}

function isEditableScenarioCell(cell: any) {
  const data = cell.getRow().getData() as BudgetTableRow
  const definition = budgetRowForCell(data)
  return Boolean(definition?.kind === 'input' && isScenarioField(String(cell.getField() ?? '')))
}

function budgetEditor(
  cell: any,
  onRendered: (callback: () => void) => void,
  success: (value: string) => void,
  cancel: () => void,
) {
  const data = cell.getRow().getData() as BudgetTableRow
  const definition = budgetRowForCell(data)
  const isSelect = definition?.editor === 'select'
  const editor = document.createElement(isSelect ? 'select' : 'input')

  editor.className = isSelect ? 'budget-select-editor' : 'budget-text-editor'
  if (editor instanceof HTMLInputElement) editor.type = 'text'

  const currentValue = String(cell.getValue() ?? '')
  editor.value = currentValue

  if (editor instanceof HTMLSelectElement) {
    const options = definition?.id === 'path-loss-model'
      ? scenarioMatrix.listPathLossModels().map((model) => ({ value: model.id, label: model.label }))
      : definition?.id === 'tb-direction'
        ? [
            { value: 'downlink', label: '下行（DL-SCH / PDSCH）' },
            { value: 'uplink', label: '上行（UL-SCH / PUSCH）' },
          ]
        : definition?.id === 'tb-mcs-table'
          ? [
              { value: 'pdsch-table-1', label: 'Table 1' },
              { value: 'pdsch-table-2', label: 'Table 2' },
            ]
          : []

    options.forEach((item) => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      option.selected = item.value === currentValue
      editor.appendChild(option)
    })

    if (
      definition?.id === 'path-loss-model' &&
      currentValue &&
      !options.some((option) => option.value === currentValue)
    ) {
      const option = document.createElement('option')
      option.value = currentValue
      option.textContent = currentValue
      option.selected = true
      editor.appendChild(option)
    }
  }

  let finished = false
  const finish = (commit: boolean) => {
    if (finished) return
    finished = true
    if (commit) success(editor.value)
    else cancel()
  }

  const openSelectPicker = (select: HTMLSelectElement) => {
    const picker = (select as HTMLSelectElement & { showPicker?: () => void }).showPicker
    try {
      if (typeof picker === 'function') picker.call(select)
      else select.click()
    } catch {
      // Some browsers require a transient user activation; keeping focus is
      // still a usable fallback because the user can open the native picker.
      select.focus()
    }
  }

  editor.addEventListener('blur', () => finish(true))
  editor.addEventListener('keydown', (event) => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault()
      finish(true)
    }

    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault()
      finish(false)
    }
  })

  if (editor instanceof HTMLSelectElement) {
    editor.addEventListener('change', () => finish(true))
  }

  onRendered(() => {
    editor.focus()
    if (editor instanceof HTMLInputElement) editor.select()
    if (editor instanceof HTMLSelectElement) openSelectPicker(editor)
  })

  return editor
}

function titleForScenario(scenario: ScenarioView) {
  const id = escapeHtml(scenario.id)
  const title = escapeHtml(scenario.name)

  return '<div class="scenario-header" data-scenario-id="' + id + '">' +
    '<span class="scenario-title" data-scenario-title="' + id + '" title="双击重命名">' +
    title +
    '</span>' +
    '<button type="button" class="scenario-delete" data-scenario-delete="' +
    id +
    '" aria-label="删除场景：' +
    title +
    '" title="删除场景">×</button>' +
    '</div>'
}

function buildColumns() {
  return [
    {
      title: '参数名称',
      field: 'parameter',
      frozen: true,
      width: 170,
      minWidth: 150,
      headerSort: false,
      formatter: (cell: any) => '<span class="parameter-label">' + escapeHtml(cell.getValue()) + '</span>',
    },
    ...scenarioViews.value.map((scenario) => ({
      title: titleForScenario(scenario),
      field: scenario.id,
      width: 170,
      minWidth: 150,
      cssClass: 'scenario-column',
      headerHozAlign: 'left',
      hozAlign: 'right',
      headerSort: false,
      editor: budgetEditor,
      editable: isEditableScenarioCell,
      cellEdited: handleCellEdited,
      formatter: valueFormatter,
    })),
    {
      title: '<button type="button" class="scenario-add" data-scenario-add aria-label="新增场景" title="新增场景">+</button>',
      field: scenarioAddField,
      width: 44,
      minWidth: 44,
      maxWidth: 44,
      cssClass: 'scenario-add-column',
      headerHozAlign: 'center',
      hozAlign: 'center',
      headerSort: false,
      formatter: () => '',
    },
  ]
}

function destroyTable() {
  tableElement.value?.removeEventListener('click', handleScenarioTableClick)
  tableElement.value?.removeEventListener('dblclick', handleScenarioTitleDoubleClick)
  tableElement.value?.removeEventListener('copy', handleCopyEvent, true)
  tableElement.value?.removeEventListener('paste', handlePasteEvent, true)
  tableElement.value?.removeEventListener('keydown', handleCopyShortcut, true)
  table?.destroy()
  table = null
}

function initTable() {
  if (!tableElement.value) return

  table = new Tabulator(tableElement.value, {
    data: rows,
    columns: buildColumns(),
    layout: 'fitDataTable',
    editTriggerEvent: 'dblclick',
    placeholder: '暂无场景，请点击右上角 + 新增',
    selectableRange: 1,
    selectableRangeColumns: true,
    selectableRangeRows: false,
    selectableRangeClearCells: false,
    movableColumns: false,
    resizableRows: false,
    rowHeader: false,
    rowFormatter: (row: any) => {
      row.getElement().classList.add('budget-row--' + row.getData().rowType)
    },
  })

  tableElement.value.addEventListener('click', handleScenarioTableClick)
  tableElement.value.addEventListener('dblclick', handleScenarioTitleDoubleClick)
  tableElement.value.addEventListener('copy', handleCopyEvent, true)
  tableElement.value.addEventListener('paste', handlePasteEvent, true)
  tableElement.value.addEventListener('keydown', handleCopyShortcut, true)
}

function syncScenarioViews(views: readonly ScenarioView[]) {
  views.forEach((view) => {
    const index = scenarioViews.value.findIndex((item) => item.id === view.id)
    if (index >= 0) scenarioViews.value[index] = view
  })

  const projectedRows = projectRows(scenarioViews.value)
  rows = projectedRows

  if (!table) return

  const tableRows = table.getRows()
  projectedRows.forEach((projectedRow) => {
    const tableRow = tableRows.find((row: any) => row.getData().id === projectedRow.id)
    if (tableRow) Object.assign(tableRow.getData(), projectedRow)
  })
  table.redraw(true)
}

function handleCellEdited(cell: any) {
  const field = String(cell.getColumn().getField() ?? '')
  const data = cell.getRow().getData() as BudgetTableRow
  const definition = budgetRowForCell(data)

  if (!definition?.field || !isScenarioField(field) || !isEditableScenarioCell(cell)) return

  const view = scenarioMatrix.updateInput(field, definition.field, cell.getValue())
  syncScenarioViews([view])
}

function rebuildTable() {
  if (!tableElement.value) return
  destroyTable()
  initTable()
}

function toggleAdvancedInputs() {
  showAdvancedInputs.value = !showAdvancedInputs.value
  rows = projectRows(scenarioViews.value)
  rebuildTable()
}

function addScenario() {
  scenarioMatrix.addScenario()
  syncProjection()
  rebuildTable()
}

function removeScenario(id: string) {
  if (!scenarioMatrix.removeScenario(id)) return
  syncProjection()
  rebuildTable()
}

function startScenarioRename(id: string, titleElement: HTMLElement) {
  const scenario = viewForScenario(id)
  if (!scenario || titleElement.querySelector('input')) return

  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'scenario-title-input'
  input.value = scenario.name
  input.maxLength = 40
  input.setAttribute('aria-label', '编辑场景名：' + scenario.name)

  let finished = false
  const finish = (commit: boolean) => {
    if (finished) return
    finished = true

    const nextName = input.value.trim()
    if (commit && nextName) {
      scenarioMatrix.renameScenario(id, nextName)
      syncProjection()
      rebuildTable()
      return
    }

    input.replaceWith(titleElement)
  }

  input.addEventListener('blur', () => finish(true))
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      input.blur()
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      finish(false)
    }
  })

  titleElement.replaceWith(input)
  input.focus()
  input.select()
}

function handleScenarioTableClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null
  if (!target) return

  const deleteButton = target.closest('[data-scenario-delete]') as HTMLElement | null
  if (deleteButton) {
    event.preventDefault()
    event.stopPropagation()
    const id = deleteButton.dataset.scenarioDelete
    if (id) removeScenario(id)
    return
  }

  const addButton = target.closest('[data-scenario-add]') as HTMLElement | null
  if (addButton) {
    event.preventDefault()
    event.stopPropagation()
    addScenario()
  }
}

function handleScenarioTitleDoubleClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null
  const titleElement = target?.closest('[data-scenario-title]') as HTMLElement | null
  if (!titleElement) return

  event.preventDefault()
  event.stopPropagation()
  const id = titleElement.dataset.scenarioTitle
  if (id) startScenarioRename(id, titleElement)
}

function selectedRange() {
  return table?.getRanges?.()?.[0] ?? null
}

function selectedRangeTsv() {
  const range = selectedRange()
  if (!range) return ''

  const columns = range.getColumns().filter((column: any) => column.getField() !== scenarioAddField)
  const data = range.getData()
  const clipboardColumns = columns.map((column: any) => {
    const field = String(column.getField() ?? '')
    const scenario = viewForScenario(field)

    if (scenario) {
      return { id: field, kind: 'scenario' as const, title: scenario.name }
    }

    return { id: 'parameter' as const, kind: 'parameter' as const, title: '参数名称' }
  })

  const headerSelected = columns.some((column: any) =>
    column.getElement()?.classList.contains('tabulator-range-selected'),
  )

  return serializeBudgetClipboard({
    columns: clipboardColumns,
    rows: data.map((row: BudgetTableRow) => ({
      id: row.id,
      values: row,
    })),
    includeHeader: headerSelected,
  })
}

function isEditorTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select'))
}

function copyWithLegacyFallback(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    document.execCommand('copy')
  } finally {
    textarea.remove()
  }
}

async function copyToExcel() {
  const text = selectedRangeTsv()
  if (!text) return

  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
    await navigator.clipboard.writeText(text)
  } catch {
    copyWithLegacyFallback(text)
  }
}

function pasteIntoTable(text: string) {
  const range = selectedRange()
  const startCell = range?.getStructuredCells?.()?.[0]?.[0]

  if (!range || !startCell) return

  const allRows = table.getRows()
  const allColumns = table.getColumns()
  const startRow = allRows.findIndex((row: any) => row === startCell.getRow())
  const startColumn = allColumns.findIndex(
    (column: any) => column.getField() === startCell.getColumn().getField(),
  )

  const plan = planBudgetClipboardPaste({
    text,
    startRow,
    startColumn,
    scenarioIds: scenarioViews.value.map((view) => view.id),
    visibleRows: getBudgetRowsForScenarioCount(scenarioViews.value.length, showAdvancedInputs.value),
  })

  if (!plan.accepted) return

  const updatesByScenario: Record<string, Record<string, string>> = {}
  plan.updates.forEach((update) => {
    const inputs = updatesByScenario[update.scenarioId] ?? {}
    inputs[update.field] = update.value
    updatesByScenario[update.scenarioId] = inputs
  })

  syncScenarioViews(scenarioMatrix.updateInputsBatch(updatesByScenario))
}

function handleCopyEvent(event: ClipboardEvent) {
  if (isEditorTarget(event.target)) return

  const text = selectedRangeTsv()
  if (!text || !event.clipboardData) return

  event.preventDefault()
  event.stopPropagation()
  event.clipboardData.setData('text/plain', text)
}

function handlePasteEvent(event: ClipboardEvent) {
  if (isEditorTarget(event.target) || !event.clipboardData) return

  event.preventDefault()
  event.stopPropagation()
  pasteIntoTable(event.clipboardData.getData('text/plain'))
}

function handleCopyShortcut(event: KeyboardEvent) {
  if (isEditorTarget(event.target)) return
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'c') return

  event.preventDefault()
  event.stopPropagation()
  void copyToExcel()
}

onMounted(() => {
  syncProjection()
  initTable()
})

onBeforeUnmount(destroyTable)
</script>

<template>
  <div class="budget-table-shell">
    <div class="budget-table-toolbar">
      <span>双击编辑场景名或数值；点击标题旁 × 删除场景；拖选单元格复制数据</span>
      <div class="budget-table-actions">
        <button
          type="button"
          class="budget-table-advanced-toggle"
          :aria-expanded="showAdvancedInputs"
          @click="toggleAdvancedInputs"
        >
          {{ showAdvancedInputs ? '收起高级参数' : '展开高级参数' }}
        </button>
        <button type="button" class="budget-table-copy" @click="copyToExcel">复制到 Excel</button>
      </div>
    </div>

    <div class="budget-matrix-layout">
      <div ref="tableElement" class="budget-table budget-table--report" />
    </div>
  </div>
</template>
