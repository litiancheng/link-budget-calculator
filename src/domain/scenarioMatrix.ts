import {
  calculateTransportBlockSize,
  calculateTransportRate,
  NR_SLOT_SYMBOLS,
  type McsTableId,
  type TbsDiagnostic,
  type TransportDirection,
} from './transportBlockSize.ts'

export const FREE_SPACE_PATH_LOSS_MODEL_ID = 'free-space'

export const DEFAULT_SCENARIO_INPUTS = Object.freeze({
  direction: 'downlink',
  mcsTable: 'pdsch-table-2',
  mcsIndex: '10',
  numberOfLayers: '1',
  nPrb: '10',
  downlinkSlotsPer10ms: '10',
  uplinkSlotsPer10ms: '10',
  specialSlotsPer10ms: '0',
  specialDownlinkSymbols: '0',
  pdcchSymbols: '2',
  nDmrsPrb: '12',
  nOhPrb: '0',
  nPrbOutsideBwp: '0',
  numberOfSlots: '1',
  pi2Bpsk: 'false',
  scalingFactor: '1',
  pathLossModel: FREE_SPACE_PATH_LOSS_MODEL_ID,
  carrierFrequencyGHz: '2.4',
  pathLossDb: '100.1',
  txPowerDbm: '23',
  txGainDbi: '2.1',
  txLossDb: '1.2',
  rxGainDbi: '2.1',
  rxSensitivityDbm: '-92',
  linkMarginDb: '12.9',
})

export type RawInputValue = string | number | null | undefined
export type RawInputs = Readonly<Record<string, RawInputValue>>
export type ScenarioInputs = Record<string, string>

export type DiagnosticCode = 'MISSING_INPUT' | 'INVALID_INPUT' | 'UNKNOWN_MODEL' | 'CALCULATION_FAILED'

export type ModelDiagnostic = {
  code: DiagnosticCode
  field: string
  modelId?: string
  value?: string
  message?: string
}

export type PathLossModelInputDefinition = {
  field: string
  label: string
  unit?: string
  defaultValue?: string
  groupId?: string
  editor?: 'text' | 'select'
}

export type PathLossModelResultDefinition = {
  field: string
  label: string
  unit?: string
  groupId?: string
}

export type ModelResult = {
  value: number | null
  diagnostics: readonly ModelDiagnostic[]
}

export type PathLossModel = {
  id: string
  label: string
  inputDefinitions?: readonly PathLossModelInputDefinition[]
  resultDefinitions?: readonly PathLossModelResultDefinition[]
  calculatePathLoss: (inputs: RawInputs) => ModelResult
  solveDistance: (inputs: RawInputs) => ModelResult
}

export type ScenarioSeed = {
  id: string
  name: string
  inputs?: RawInputs
}

export type ScenarioView = {
  id: string
  name: string
  inputs: Readonly<ScenarioInputs>
  result: {
    coverageDistanceKm: number | null
    transportBlockSizeBits: number | null
    transportRateMbps: number | null
  }
  diagnostics: readonly ModelDiagnostic[]
  tbDiagnostics: readonly TbsDiagnostic[]
  rateDiagnostics: readonly TbsDiagnostic[]
}

export type ScenarioMatrixSnapshot = {
  scenarios: readonly ScenarioView[]
}

export type CreateScenarioMatrixOptions = {
  registry?: PathLossModelRegistry
  scenarios?: readonly ScenarioSeed[]
}

export type ScenarioInputBatch = Readonly<Record<string, RawInputs>>

const FSPL_CONSTANT_DB = 92.45

function toInputString(value: RawInputValue) {
  return value == null ? '' : String(value)
}

function normalizeInputs(inputs: RawInputs = {}) {
  return Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, toInputString(value)]))
}

function readScenarioNumber(inputs: RawInputs, field: string) {
  const text = toInputString(inputs[field]).trim()
  return text ? Number(text) : Number.NaN
}

function calculateScenarioTransportBlockSize(inputs: ScenarioInputs) {
  const mcsTable = inputs.mcsTable.trim() as McsTableId
  if (mcsTable !== 'pdsch-table-1' && mcsTable !== 'pdsch-table-2') {
    return {
      value: null,
      diagnostics: [
        {
          code: 'UNSUPPORTED_MCS_TABLE',
          field: 'mcsTable',
          value: inputs.mcsTable,
          message: '链路预算只允许使用 MCS Table 1 或 Table 2',
        },
      ] satisfies TbsDiagnostic[],
    }
  }

  return calculateTransportBlockSize({
    direction: inputs.direction.trim() as TransportDirection,
    mcsTable,
    mcsIndex: readScenarioNumber(inputs, 'mcsIndex'),
    numberOfLayers: readScenarioNumber(inputs, 'numberOfLayers'),
    nPrb: readScenarioNumber(inputs, 'nPrb'),
    nSymbols: inputs.direction.trim() === 'downlink'
      ? NR_SLOT_SYMBOLS - readScenarioNumber(inputs, 'pdcchSymbols')
      : NR_SLOT_SYMBOLS,
    nDmrsPrb: readScenarioNumber(inputs, 'nDmrsPrb'),
    nOhPrb: 0,
    nPrbOutsideBwp: 0,
    numberOfSlots: 1,
    pi2Bpsk: false,
    scalingFactor: 1,
  })
}

function calculateScenarioTransportRate(inputs: ScenarioInputs) {
  const mcsTable = inputs.mcsTable.trim() as McsTableId
  if (mcsTable !== 'pdsch-table-1' && mcsTable !== 'pdsch-table-2') {
    return {
      value: null,
      diagnostics: [
        {
          code: 'UNSUPPORTED_MCS_TABLE',
          field: 'mcsTable',
          value: inputs.mcsTable,
          message: '链路预算只允许使用 MCS Table 1 或 Table 2',
        },
      ] satisfies TbsDiagnostic[],
    }
  }

  return calculateTransportRate({
    direction: inputs.direction.trim() as TransportDirection,
    mcsTable,
    mcsIndex: readScenarioNumber(inputs, 'mcsIndex'),
    numberOfLayers: readScenarioNumber(inputs, 'numberOfLayers'),
    nPrb: readScenarioNumber(inputs, 'nPrb'),
    nDmrsPrb: readScenarioNumber(inputs, 'nDmrsPrb'),
    nOhPrb: 0,
    nPrbOutsideBwp: 0,
    numberOfSlots: 1,
    pi2Bpsk: false,
    scalingFactor: 1,
    downlinkSlotsPer10ms: readScenarioNumber(inputs, 'downlinkSlotsPer10ms'),
    uplinkSlotsPer10ms: readScenarioNumber(inputs, 'uplinkSlotsPer10ms'),
    specialSlotsPer10ms: readScenarioNumber(inputs, 'specialSlotsPer10ms'),
    specialDownlinkSymbols: readScenarioNumber(inputs, 'specialDownlinkSymbols'),
    pdcchSymbols: readScenarioNumber(inputs, 'pdcchSymbols'),
  })
}

function success(value: number): ModelResult {
  return { value, diagnostics: [] }
}

function failure(diagnostic: ModelDiagnostic): ModelResult {
  return { value: null, diagnostics: [diagnostic] }
}

function readPositiveNumber(inputs: RawInputs, aliases: readonly string[], field: string, invalidMessage = '输入值必须大于 0'): ModelResult & { parsed?: number } {
  const raw = aliases.map((alias) => inputs[alias]).find((value) => value !== undefined && value !== null)
  const text = toInputString(raw)

  if (!text.trim()) {
    return {
      value: null,
      diagnostics: [{ code: 'MISSING_INPUT', field }],
    }
  }

  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return {
      value: null,
      diagnostics: [{ code: 'INVALID_INPUT', field, value: text, message: invalidMessage }],
    }
  }

  return { ...success(parsed), parsed }
}

function firstDiagnostic(...results: Array<ModelResult & { parsed?: number }>) {
  return results.find((result) => result.diagnostics.length > 0)?.diagnostics[0]
}

export const freeSpacePathLossModel: PathLossModel = {
  id: FREE_SPACE_PATH_LOSS_MODEL_ID,
  label: '自由空间路损',
  inputDefinitions: [
    { field: 'carrierFrequencyGHz', label: '载波频率', unit: 'GHz', defaultValue: '2.4', groupId: 'propagation', editor: 'text' },
    { field: 'pathLossDb', label: '路损值', unit: 'dB', defaultValue: '100.1', groupId: 'propagation', editor: 'text' },
  ],
  resultDefinitions: [
    { field: 'coverageDistanceKm', label: '覆盖距离', unit: 'km', groupId: 'results' },
  ],

  calculatePathLoss(inputs) {
    const frequency = readPositiveNumber(
      inputs,
      ['carrierFrequencyGHz', 'frequencyGHz', 'frequency'],
      'carrierFrequencyGHz',
      '载波频率必须大于 0',
    )
    const distance = readPositiveNumber(inputs, ['distanceKm', 'distance'], 'distanceKm', '传播距离必须大于 0')
    const diagnostic = firstDiagnostic(frequency, distance)
    if (diagnostic || frequency.parsed === undefined || distance.parsed === undefined) {
      return failure(
        diagnostic
          ? { ...diagnostic, modelId: FREE_SPACE_PATH_LOSS_MODEL_ID }
          : {
              code: 'CALCULATION_FAILED',
              field: 'distanceKm',
              modelId: FREE_SPACE_PATH_LOSS_MODEL_ID,
            },
      )
    }

    return success(FSPL_CONSTANT_DB + 20 * Math.log10(frequency.parsed) + 20 * Math.log10(distance.parsed))
  },

  solveDistance(inputs) {
    const frequency = readPositiveNumber(
      inputs,
      ['carrierFrequencyGHz', 'frequencyGHz', 'frequency'],
      'carrierFrequencyGHz',
      '载波频率必须大于 0',
    )
    const pathLoss = readPositiveNumber(inputs, ['pathLossDb', 'pathLoss', 'lossDb'], 'pathLossDb', '路损值必须大于 0')
    const diagnostic = firstDiagnostic(frequency, pathLoss)
    if (diagnostic || frequency.parsed === undefined || pathLoss.parsed === undefined) {
      return failure(
        diagnostic
          ? { ...diagnostic, modelId: FREE_SPACE_PATH_LOSS_MODEL_ID }
          : {
              code: 'CALCULATION_FAILED',
              field: 'pathLossDb',
              modelId: FREE_SPACE_PATH_LOSS_MODEL_ID,
            },
      )
    }

    const distance = 10 ** ((pathLoss.parsed - FSPL_CONSTANT_DB - 20 * Math.log10(frequency.parsed)) / 20)
    if (!Number.isFinite(distance)) {
      return failure({
        code: 'CALCULATION_FAILED',
        field: 'pathLossDb',
        modelId: FREE_SPACE_PATH_LOSS_MODEL_ID,
      })
    }

    return success(distance)
  },
}

export class PathLossModelRegistry {
  private readonly models = new Map<string, PathLossModel>()

  constructor(models: readonly PathLossModel[] = [freeSpacePathLossModel]) {
    models.forEach((model) => this.register(model))
  }

  register(model: PathLossModel) {
    if (this.models.has(model.id)) {
      throw new Error(`A path-loss model with id "${model.id}" is already registered`)
    }

    this.models.set(model.id, model)
    return this
  }

  get(id: string) {
    return this.models.get(id)
  }

  list() {
    return [...this.models.values()]
  }
}

export class ScenarioMatrix {
  private readonly registry: PathLossModelRegistry
  private readonly scenarios: Array<{ id: string; name: string; inputs: ScenarioInputs }> = []
  private nextScenarioNumber = 1

  constructor(options: CreateScenarioMatrixOptions = {}) {
    this.registry = options.registry ?? new PathLossModelRegistry()
    const seeds = options.scenarios ?? [{ id: 'scenario-1', name: '新场景', inputs: DEFAULT_SCENARIO_INPUTS }]

    seeds.forEach((seed) => {
      if (this.scenarios.some((scenario) => scenario.id === seed.id)) {
        throw new Error(`A scenario with id "${seed.id}" is already present`)
      }

      this.scenarios.push({
        id: seed.id,
        name: seed.name,
        inputs: normalizeInputs({ ...DEFAULT_SCENARIO_INPUTS, ...(seed.inputs ?? {}) }),
      })
      this.advanceScenarioNumber(seed.id)
    })
  }

  getScenario(id: string) {
    const scenario = this.scenarios.find((item) => item.id === id)
    return scenario ? this.toView(scenario) : undefined
  }

  listPathLossModels() {
    return this.registry.list()
  }

  getSnapshot(): ScenarioMatrixSnapshot {
    return { scenarios: this.scenarios.map((scenario) => this.toView(scenario)) }
  }

  updateInput(id: string, field: string, value: RawInputValue) {
    const scenario = this.requireScenario(id)
    this.applyInputValues(scenario, { [field]: value })
    return this.toView(scenario)
  }

  updateInputs(id: string, values: RawInputs) {
    const scenario = this.requireScenario(id)
    this.applyInputValues(scenario, values)
    return this.toView(scenario)
  }

  updateInputsBatch(batch: ScenarioInputBatch) {
    const entries = Object.entries(batch).map(([id, values]) => ({
      scenario: this.requireScenario(id),
      values,
    }))

    entries.forEach(({ scenario, values }) => this.applyInputValues(scenario, values))

    return entries.map(({ scenario }) => this.toView(scenario))
  }

  recalculateScenario(id: string) {
    const scenario = this.requireScenario(id)
    return this.toView(scenario)
  }

  recalculateAll() {
    return this.getSnapshot()
  }

  addScenario(seed: Partial<ScenarioSeed> = {}) {
    const id = seed.id ?? this.createScenarioId()
    if (this.scenarios.some((scenario) => scenario.id === id)) {
      throw new Error(`A scenario with id "${id}" is already present`)
    }

    const scenario = {
      id,
      name: seed.name ?? '新场景',
      inputs: normalizeInputs({ ...DEFAULT_SCENARIO_INPUTS, ...(seed.inputs ?? {}) }),
    }
    this.scenarios.push(scenario)
    this.advanceScenarioNumber(id)
    return this.toView(scenario)
  }

  removeScenario(id: string) {
    const index = this.scenarios.findIndex((scenario) => scenario.id === id)
    if (index < 0) return false
    this.scenarios.splice(index, 1)
    return true
  }

  renameScenario(id: string, name: string) {
    const scenario = this.requireScenario(id)
    if (name.trim()) scenario.name = name
    return this.toView(scenario)
  }

  private toView(scenario: { id: string; name: string; inputs: ScenarioInputs }): ScenarioView {
    const modelId = scenario.inputs.pathLossModel
    const model = this.registry.get(modelId)
    const calculation = model
      ? model.solveDistance(scenario.inputs)
      : failure({
          code: modelId ? 'UNKNOWN_MODEL' : 'MISSING_INPUT',
          field: 'pathLossModel',
          value: modelId,
        })
    const tbsCalculation = calculateScenarioTransportBlockSize(scenario.inputs)
    const rateCalculation = calculateScenarioTransportRate(scenario.inputs)

    return {
      id: scenario.id,
      name: scenario.name,
      inputs: { ...scenario.inputs },
      result: {
        coverageDistanceKm: calculation.value,
        transportBlockSizeBits: tbsCalculation.value,
        transportRateMbps: rateCalculation.value,
      },
      diagnostics: [...calculation.diagnostics],
      tbDiagnostics: [...tbsCalculation.diagnostics],
      rateDiagnostics: [...rateCalculation.diagnostics],
    }
  }

  private applyInputValues(scenario: { inputs: ScenarioInputs }, values: RawInputs) {
    Object.entries(values).forEach(([field, value]) => {
      scenario.inputs[field] = toInputString(value)
    })
  }

  private requireScenario(id: string) {
    const scenario = this.scenarios.find((item) => item.id === id)
    if (!scenario) throw new Error(`Unknown scenario "${id}"`)
    return scenario
  }

  private createScenarioId() {
    while (this.scenarios.some((scenario) => scenario.id === `scenario-${this.nextScenarioNumber}`)) {
      this.nextScenarioNumber += 1
    }
    return `scenario-${this.nextScenarioNumber}`
  }

  private advanceScenarioNumber(id: string) {
    const match = /^scenario-(\d+)$/.exec(id)
    if (match) this.nextScenarioNumber = Math.max(this.nextScenarioNumber, Number(match[1]) + 1)
  }
}

export function createScenarioMatrix(options: CreateScenarioMatrixOptions = {}) {
  return new ScenarioMatrix(options)
}
