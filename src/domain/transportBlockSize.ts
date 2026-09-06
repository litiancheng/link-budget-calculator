/**
 * TS 38.214 V19.4.0, clauses 5.1.3.1/5.1.3.2 and 6.1.4.1/6.1.4.2.
 *
 * This module calculates one transport block.  DCI and RRC procedures that
 * select an MCS table are deliberately represented by explicit inputs; the
 * numerical TBS procedure must not infer them from UI state.
 */

export type TransportDirection = 'downlink' | 'uplink'

export type McsTableId =
  | 'pdsch-table-1'
  | 'pdsch-table-2'
  | 'pdsch-table-3'
  | 'pdsch-table-4'
  | 'pusch-transform-precoding-table-1'
  | 'pusch-transform-precoding-table-2'

export type TbsScalingFactor = 0.25 | 0.5 | 1

export type McsParameters = {
  table: McsTableId
  index: number
  modulationOrder: number
  /** The value printed as R x 1024 in 38.214. */
  targetCodeRateX1024: number
  targetCodeRate: number
}

export type TbsDiagnosticCode =
  | 'INVALID_INPUT'
  | 'RESERVED_MCS_INDEX'
  | 'UNSUPPORTED_MCS_TABLE'
  | 'CALCULATION_FAILED'

export type TbsDiagnostic = {
  code: TbsDiagnosticCode
  field: string
  value?: string
  message?: string
}

export type TbsResult<TDetails = undefined> = {
  value: number | null
  diagnostics: readonly TbsDiagnostic[]
  details?: TDetails
}

export type McsLookupResult = {
  value: McsParameters | null
  diagnostics: readonly TbsDiagnostic[]
}

export type ResourceElementInputs = {
  direction: TransportDirection
  /** n_PRB: number of PRBs allocated to the PDSCH/PUSCH. */
  nPrb: number
  /** N_symb^sh: number of scheduled symbols in one slot. */
  nSymbols: number
  /** N_DMRS^PRB: DM-RS REs per PRB over the scheduled duration. */
  nDmrsPrb: number
  /** N_oh^PRB: configured overhead per PRB; 38.214 permits 0, 6, 12 or 18. */
  nOhPrb?: number
  /** n'_PRB: allocated PRBs outside the active DL/UL BWP in the special cases. */
  nPrbOutsideBwp?: number
  /** N in the PUSCH multi-slot TB-processing case; defaults to 1. */
  numberOfSlots?: number
}

export type ResourceElementDetails = {
  direction: TransportDirection
  nScRb: 12
  nPrb: number
  nPrbOutsideBwp: number
  allocatedPrbs: number
  nSymbols: number
  nDmrsPrb: number
  nOhPrb: number
  nRePrimePerPrb: number
  nRePerPrb: number
  numberOfSlots: number
  nRe: number
}

export type ResourceElementResult = TbsResult<ResourceElementDetails>

export type TransportBlockSizeFromNReInputs = {
  /** N_RE: total number of REs available for the transport block. */
  nRe: number
  /** Q_m: modulation order from the selected MCS table. */
  modulationOrder: number
  /** R x 1024 from the selected MCS table. */
  targetCodeRateX1024: number
  /** v: number of transmission layers. */
  numberOfLayers: number
  /** S in the PDSCH TB-scaling special case; defaults to 1. */
  scalingFactor?: TbsScalingFactor
}

export type TbsCalculationDetails = {
  direction?: TransportDirection
  mcsTable?: McsTableId
  mcsIndex?: number
  modulationOrder: number
  targetCodeRateX1024: number
  targetCodeRate: number
  numberOfLayers: number
  scalingFactor: number
  nRe: number
  nInfo: number
  nInfoQuantized: number
  quantizationExponent: number
  algorithmBranch: 'small' | 'large'
  smallTbsTableIndex?: number
  codeBlockCount?: number
  resourceElements?: ResourceElementDetails
}

export type TransportBlockSizeInputs = ResourceElementInputs & {
  direction: TransportDirection
  mcsTable: McsTableId
  mcsIndex: number
  numberOfLayers: number
  /** true when the PUSCH higher-layer tp-pi2BPSK condition applies. */
  pi2Bpsk?: boolean
  /** PDSCH TB scaling factor S; omit for the ordinary S=1 case. */
  scalingFactor?: TbsScalingFactor
}

export type TransportRateInputs = Omit<TransportBlockSizeInputs, 'nSymbols'> & {
  /** Number of ordinary downlink slots in one 10 ms radio frame. */
  downlinkSlotsPer10ms: number
  /** Number of ordinary uplink slots in one 10 ms radio frame. */
  uplinkSlotsPer10ms: number
  /** Number of special slots in one 10 ms radio frame. */
  specialSlotsPer10ms: number
  /** Number of downlink symbols in a special slot, including PDCCH symbols. */
  specialDownlinkSymbols: number
  /** Number of symbols occupied by PDCCH in each slot. */
  pdcchSymbols: number
}

export type TransportRateDetails = {
  direction: TransportDirection
  slotSymbols: 14
  normalDownlinkSymbols: number
  specialDownlinkSymbols: number
  uplinkSymbols: 14
  downlinkSlotsPer10ms: number
  uplinkSlotsPer10ms: number
  specialSlotsPer10ms: number
  normalDownlinkTbs?: number
  specialDownlinkTbs?: number
  uplinkTbs?: number
  bitsPer10ms: number
  rateMbps: number
}

const N_SC_RB = 12 as const
const MAX_RE_PER_PRB = 156 as const
export const NR_SLOT_SYMBOLS = 14 as const
export const RATE_PERIOD_SECONDS = 0.01 as const

/** Table 5.1.3.2-1, TBS for N_info <= 3824, TS 38.214 V19.4.0. */
export const TBS_TABLE_FOR_NINFO_LE_3824: readonly number[] = Object.freeze([
  24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128, 136, 144, 152, 160, 168,
  176, 184, 192, 208, 224, 240, 256, 272, 288, 304, 320, 336, 352, 368, 384, 408, 432, 456,
  480, 504, 528, 552, 576, 608, 640, 672, 704, 736, 768, 808, 848, 888, 928, 984, 1032, 1064,
  1128, 1160, 1192, 1224, 1256, 1288, 1320, 1352, 1416, 1480, 1544, 1608, 1672, 1736, 1800, 1864,
  1928, 2024, 2088, 2152, 2216, 2280, 2408, 2472, 2536, 2600, 2664, 2728, 2792, 2856, 2976, 3104,
  3240, 3368, 3496, 3624, 3752, 3824,
])

type StaticMcsRow = readonly [modulationOrder: number, targetCodeRateX1024: number | null]

const PDSCH_TABLE_1: readonly StaticMcsRow[] = [
  [2, 120], [2, 157], [2, 193], [2, 251], [2, 308], [2, 379], [2, 449], [2, 526],
  [2, 602], [2, 679], [4, 340], [4, 378], [4, 434], [4, 490], [4, 553], [4, 616],
  [4, 658], [6, 438], [6, 466], [6, 517], [6, 567], [6, 616], [6, 666], [6, 719],
  [6, 772], [6, 822], [6, 873], [6, 910], [6, 948], [2, null], [4, null], [6, null],
]

const PDSCH_TABLE_2: readonly StaticMcsRow[] = [
  [2, 120], [2, 193], [2, 308], [2, 449], [2, 602], [4, 378], [4, 434], [4, 490],
  [4, 553], [4, 616], [4, 658], [6, 466], [6, 517], [6, 567], [6, 616], [6, 666],
  [6, 719], [6, 772], [6, 822], [6, 873], [8, 682.5], [8, 711], [8, 754], [8, 797],
  [8, 841], [8, 885], [8, 916.5], [8, 948], [2, null], [4, null], [6, null], [8, null],
]

const PDSCH_TABLE_3: readonly StaticMcsRow[] = [
  [2, 30], [2, 40], [2, 50], [2, 64], [2, 78], [2, 99], [2, 120], [2, 157],
  [2, 193], [2, 251], [2, 308], [2, 379], [2, 449], [2, 526], [2, 602], [4, 340],
  [4, 378], [4, 434], [4, 490], [4, 553], [4, 616], [6, 438], [6, 466], [6, 517],
  [6, 567], [6, 616], [6, 666], [6, 719], [6, 772], [2, null], [4, null], [6, null],
]

const PDSCH_TABLE_4: readonly StaticMcsRow[] = [
  [2, 120], [2, 193], [4, 449], [4, 378], [4, 490], [4, 616], [6, 466], [6, 517],
  [6, 567], [6, 616], [6, 666], [6, 719], [6, 772], [6, 822], [6, 873], [8, 682.5],
  [8, 711], [8, 754], [8, 797], [8, 841], [8, 885], [8, 916.5], [8, 948], [10, 805.5],
  [10, 853], [10, 900.5], [10, 948], [2, null], [4, null], [6, null], [8, null], [10, null],
]

const PUSCH_TRANSFORM_TABLE_1: readonly StaticMcsRow[] = [
  [2, 120], [2, 157], [2, 193], [2, 251], [2, 308], [2, 379], [2, 449], [2, 526],
  [2, 602], [2, 679], [4, 340], [4, 378], [4, 434], [4, 490], [4, 553], [4, 616],
  [4, 658], [6, 466], [6, 517], [6, 567], [6, 616], [6, 666], [6, 719], [6, 772],
  [6, 822], [6, 873], [6, 910], [6, 948], [2, null], [2, null], [4, null], [6, null],
]

const PUSCH_TRANSFORM_TABLE_2: readonly StaticMcsRow[] = [
  [2, 120], [2, 157], [2, 193], [2, 251], [2, 308], [2, 379], [2, 449], [2, 526],
  [2, 602], [2, 679], [2, 308], [2, 379], [2, 449], [2, 526], [2, 602], [2, 679],
  [4, 378], [4, 434], [4, 490], [4, 553], [4, 616], [4, 658], [4, 699], [4, 772],
  [6, 567], [6, 616], [6, 666], [6, 772], [2, null], [2, null], [4, null], [6, null],
]

const STATIC_MCS_TABLES: Readonly<Partial<Record<McsTableId, readonly StaticMcsRow[]>>> = Object.freeze({
  'pdsch-table-1': PDSCH_TABLE_1,
  'pdsch-table-2': PDSCH_TABLE_2,
  'pdsch-table-3': PDSCH_TABLE_3,
  'pdsch-table-4': PDSCH_TABLE_4,
})

const ALL_MCS_TABLE_IDS: readonly McsTableId[] = Object.freeze([
  'pdsch-table-1',
  'pdsch-table-2',
  'pdsch-table-3',
  'pdsch-table-4',
  'pusch-transform-precoding-table-1',
  'pusch-transform-precoding-table-2',
])

const PDSCH_MCS_TABLE_IDS: readonly McsTableId[] = Object.freeze([
  'pdsch-table-1',
  'pdsch-table-2',
  'pdsch-table-3',
  'pdsch-table-4',
])

function failure<TDetails = undefined>(diagnostic: TbsDiagnostic): TbsResult<TDetails> {
  return { value: null, diagnostics: [diagnostic] }
}

function success<TDetails>(value: number, details: TDetails): TbsResult<TDetails> {
  return { value, diagnostics: [], details }
}

function mcsSuccess(value: McsParameters): McsLookupResult {
  return { value, diagnostics: [] }
}

function invalid(field: string, message: string, value?: unknown): TbsDiagnostic {
  return {
    code: 'INVALID_INPUT',
    field,
    message,
    value: value === undefined ? undefined : String(value),
  }
}

function isFiniteInteger(value: number) {
  return Number.isFinite(value) && Number.isInteger(value)
}

function isHalfInteger(value: number) {
  return Number.isFinite(value) && Number.isInteger(value * 2)
}

function floorLog2(value: number) {
  let exponent = Math.floor(Math.log2(value))

  // Correct the very rare boundary error caused by floating-point log2.  All
  // values used here are positive and within the safe integer range.
  while (2 ** (exponent + 1) <= value) exponent += 1
  while (2 ** exponent > value) exponent -= 1
  return exponent
}

function roundTiesUp(value: number) {
  // The argument is positive in clause 5.1.3.2.  This implements the
  // specification's "ties ... towards the next largest integer" rule.
  return Math.floor(value + 0.5)
}

function tableRows(table: McsTableId, pi2Bpsk: boolean) {
  if (table === 'pusch-transform-precoding-table-1') {
    const q = pi2Bpsk ? 1 : 2
    return [
      [q, 240 / q],
      [q, 314 / q],
      ...PUSCH_TRANSFORM_TABLE_1.slice(2),
    ] as readonly StaticMcsRow[]
  }

  if (table === 'pusch-transform-precoding-table-2') {
    const q = pi2Bpsk ? 1 : 2
    return [
      [q, 60 / q],
      [q, 80 / q],
      [q, 100 / q],
      [q, 128 / q],
      [q, 156 / q],
      [q, 198 / q],
      ...PUSCH_TRANSFORM_TABLE_2.slice(6),
    ] as readonly StaticMcsRow[]
  }

  return STATIC_MCS_TABLES[table]
}

function supportsTable(direction: TransportDirection, table: McsTableId) {
  if (direction === 'downlink') return PDSCH_MCS_TABLE_IDS.includes(table)
  return table !== 'pdsch-table-4'
}

export function lookupMcsParameters({
  table,
  mcsIndex,
  pi2Bpsk = false,
}: {
  table: McsTableId
  mcsIndex: number
  pi2Bpsk?: boolean
}): McsLookupResult {
  if (!ALL_MCS_TABLE_IDS.includes(table)) {
    return {
      value: null,
      diagnostics: [{
        code: 'UNSUPPORTED_MCS_TABLE',
        field: 'mcsTable',
        value: String(table),
        message: '不支持的 MCS 表',
      }],
    }
  }

  if (!isFiniteInteger(mcsIndex) || mcsIndex < 0 || mcsIndex > 31) {
    return { value: null, diagnostics: [invalid('mcsIndex', 'MCS 索引必须是 0 到 31 的整数', mcsIndex)] }
  }

  const rows = tableRows(table, pi2Bpsk)
  const row = rows?.[mcsIndex]
  if (!row || row[1] === null) {
    return {
      value: null,
      diagnostics: [{
        code: 'RESERVED_MCS_INDEX',
        field: 'mcsIndex',
        value: String(mcsIndex),
        message: 'MCS 索引在所选表中为保留值',
      }],
    }
  }

  return mcsSuccess({
    table,
    index: mcsIndex,
    modulationOrder: row[0],
    targetCodeRateX1024: row[1],
    targetCodeRate: row[1] / 1024,
  })
}

export function calculateNumberOfResourceElements(inputs: ResourceElementInputs): ResourceElementResult {
  const {
    direction,
    nPrb,
    nSymbols,
    nDmrsPrb,
    nOhPrb = 0,
    nPrbOutsideBwp = 0,
    numberOfSlots = 1,
  } = inputs

  if (direction !== 'downlink' && direction !== 'uplink') {
    return failure(invalid('direction', '传输方向必须是 downlink 或 uplink', direction))
  }
  if (!isFiniteInteger(nPrb) || nPrb <= 0) {
    return failure(invalid('nPrb', 'nPrb 必须是正整数', nPrb))
  }
  if (!isFiniteInteger(nSymbols) || nSymbols <= 0 || nSymbols > 14) {
    return failure(invalid('nSymbols', 'nSymbols 必须是 1 到 14 的整数', nSymbols))
  }
  if (!isFiniteInteger(nDmrsPrb) || nDmrsPrb < 0 || nDmrsPrb > N_SC_RB * nSymbols) {
    return failure(invalid('nDmrsPrb', 'nDmrsPrb 必须是不超过调度符号 RE 总数的非负整数', nDmrsPrb))
  }
  if (!isFiniteInteger(nOhPrb) || ![0, 6, 12, 18].includes(nOhPrb)) {
    return failure(invalid('nOhPrb', 'nOhPrb 必须是 0、6、12 或 18', nOhPrb))
  }
  if (!isFiniteInteger(nPrbOutsideBwp) || nPrbOutsideBwp < 0 || nPrbOutsideBwp >= nPrb) {
    return failure(invalid('nPrbOutsideBwp', 'nPrbOutsideBwp 必须是不超过已分配 PRB 数的非负整数', nPrbOutsideBwp))
  }
  if (!isFiniteInteger(numberOfSlots) || numberOfSlots <= 0) {
    return failure(invalid('numberOfSlots', 'numberOfSlots 必须是正整数', numberOfSlots))
  }
  if (direction === 'downlink' && numberOfSlots !== 1) {
    return failure(invalid('numberOfSlots', '下行 TBS 计算只接受一个 PDSCH 传输时隙；重复场景请先按规范确定 N_RE', numberOfSlots))
  }

  const nRePrimePerPrb = N_SC_RB * nSymbols - nDmrsPrb - nOhPrb
  if (nRePrimePerPrb <= 0) {
    return failure(invalid('nDmrsPrb', '可用于数据的每 PRB RE 数必须大于 0'))
  }

  const nRePerPrb = Math.min(MAX_RE_PER_PRB, nRePrimePerPrb)
  const allocatedPrbs = nPrb - nPrbOutsideBwp
  const nRe = nRePerPrb * allocatedPrbs * (direction === 'uplink' ? numberOfSlots : 1)
  if (!Number.isSafeInteger(nRe) || nRe <= 0) {
    return failure({
      code: 'CALCULATION_FAILED',
      field: 'nRe',
      message: 'N_RE 无法表示为正的安全整数',
    })
  }

  return success(nRe, {
    direction,
    nScRb: N_SC_RB,
    nPrb,
    nPrbOutsideBwp,
    allocatedPrbs,
    nSymbols,
    nDmrsPrb,
    nOhPrb,
    nRePrimePerPrb,
    nRePerPrb,
    numberOfSlots,
    nRe,
  })
}

function determineTbs(nInfo: number, targetCodeRate: number): TbsResult<TbsCalculationDetails> {
  if (!Number.isFinite(nInfo) || nInfo <= 0 || nInfo > Number.MAX_SAFE_INTEGER) {
    return failure<TbsCalculationDetails>({
      code: 'CALCULATION_FAILED',
      field: 'nInfo',
      message: 'N_info 必须是正数',
    })
  }

  if (nInfo <= 3824) {
    const quantizationExponent = Math.max(3, floorLog2(nInfo) - 6)
    const quantizationUnit = 2 ** quantizationExponent
    const nInfoQuantized = Math.max(24, quantizationUnit * Math.floor(nInfo / quantizationUnit))
    const tableIndex = TBS_TABLE_FOR_NINFO_LE_3824.findIndex((tbs) => tbs >= nInfoQuantized)

    if (tableIndex < 0) {
      return failure<TbsCalculationDetails>({
        code: 'CALCULATION_FAILED',
        field: 'nInfo',
        message: 'N_info 量化值超出小 TBS 表范围',
      })
    }

    return success(TBS_TABLE_FOR_NINFO_LE_3824[tableIndex], {
      modulationOrder: 0,
      targetCodeRateX1024: targetCodeRate * 1024,
      targetCodeRate,
      numberOfLayers: 0,
      scalingFactor: 1,
      nRe: 0,
      nInfo,
      nInfoQuantized,
      quantizationExponent,
      algorithmBranch: 'small' as const,
      smallTbsTableIndex: tableIndex + 1,
    })
  }

  const quantizationExponent = floorLog2(nInfo - 24) - 5
  const quantizationUnit = 2 ** quantizationExponent
  const nInfoQuantized = Math.max(3840, quantizationUnit * roundTiesUp((nInfo - 24) / quantizationUnit))

  let codeBlockCount: number | undefined
  let tbs: number
  if (targetCodeRate <= 0.25) {
    codeBlockCount = Math.ceil((nInfoQuantized + 24) / 3816)
    tbs = 8 * codeBlockCount * Math.ceil((nInfoQuantized + 24) / (8 * codeBlockCount)) - 24
  } else if (nInfoQuantized > 8424) {
    codeBlockCount = Math.ceil((nInfoQuantized + 24) / 8424)
    tbs = 8 * codeBlockCount * Math.ceil((nInfoQuantized + 24) / (8 * codeBlockCount)) - 24
  } else {
    tbs = 8 * Math.ceil((nInfoQuantized + 24) / 8) - 24
  }

  if (!Number.isSafeInteger(tbs) || tbs <= 0) {
    return failure<TbsCalculationDetails>({
      code: 'CALCULATION_FAILED',
      field: 'tbs',
      message: 'TBS 无法表示为正的安全整数',
    })
  }

  return success(tbs, {
    modulationOrder: 0,
    targetCodeRateX1024: targetCodeRate * 1024,
    targetCodeRate,
    numberOfLayers: 0,
    scalingFactor: 1,
    nRe: 0,
    nInfo,
    nInfoQuantized,
    quantizationExponent,
    algorithmBranch: 'large' as const,
    codeBlockCount,
  })
}

export function calculateTransportBlockSizeFromNRe(
  inputs: TransportBlockSizeFromNReInputs,
): TbsResult<TbsCalculationDetails> {
  const { nRe, modulationOrder, targetCodeRateX1024, numberOfLayers, scalingFactor = 1 } = inputs

  if (!isFiniteInteger(nRe) || nRe <= 0) {
    return failure(invalid('nRe', 'nRe 必须是正整数', nRe))
  }
  if (![1, 2, 4, 6, 8, 10].includes(modulationOrder)) {
    return failure(invalid('modulationOrder', '调制阶数必须是 1、2、4、6、8 或 10', modulationOrder))
  }
  if (!isHalfInteger(targetCodeRateX1024) || targetCodeRateX1024 <= 0 || targetCodeRateX1024 > 1024) {
    return failure(invalid('targetCodeRateX1024', 'R×1024 必须是正的整数或半整数且不超过 1024', targetCodeRateX1024))
  }
  if (!isFiniteInteger(numberOfLayers) || numberOfLayers <= 0 || numberOfLayers > 8) {
    return failure(invalid('numberOfLayers', 'numberOfLayers 必须是 1 到 8 的整数', numberOfLayers))
  }
  if (![0.25, 0.5, 1].includes(scalingFactor)) {
    return failure(invalid('scalingFactor', 'scalingFactor 必须是 1、0.5 或 0.25', scalingFactor))
  }

  const targetCodeRate = targetCodeRateX1024 / 1024
  const nInfo = scalingFactor * nRe * targetCodeRate * modulationOrder * numberOfLayers
  if (!Number.isFinite(nInfo) || nInfo <= 0 || nInfo > Number.MAX_SAFE_INTEGER) {
    return failure({
      code: 'CALCULATION_FAILED',
      field: 'nInfo',
      message: 'N_info 无法计算为正数',
    })
  }

  const determined = determineTbs(nInfo, targetCodeRate)
  if (determined.value === null || !determined.details) return determined

  return {
    value: determined.value,
    diagnostics: [],
    details: {
      ...determined.details,
      modulationOrder,
      targetCodeRateX1024,
      targetCodeRate,
      numberOfLayers,
      scalingFactor,
      nRe,
    },
  }
}

export function calculateTransportBlockSize(inputs: TransportBlockSizeInputs): TbsResult<TbsCalculationDetails> {
  const {
    direction,
    mcsTable,
    mcsIndex,
    numberOfLayers,
    pi2Bpsk = false,
    scalingFactor = 1,
    ...resourceInputs
  } = inputs

  if (direction !== 'downlink' && direction !== 'uplink') {
    return failure(invalid('direction', '传输方向必须是 downlink 或 uplink', direction))
  }
  if (!ALL_MCS_TABLE_IDS.includes(mcsTable) || !supportsTable(direction, mcsTable)) {
    return failure({
      code: 'UNSUPPORTED_MCS_TABLE',
      field: 'mcsTable',
      value: String(mcsTable),
      message: direction === 'downlink'
        ? '下行只能使用 PDSCH MCS 表'
        : '上行不能使用 PDSCH 1024QAM MCS 表；非变换预编码使用 PDSCH 表 1/2/3，变换预编码使用 PUSCH 表',
    })
  }
  if (direction === 'uplink' && scalingFactor !== 1) {
    return failure(invalid('scalingFactor', 'TBS 缩放因子只适用于下行 PDSCH 特殊场景', scalingFactor))
  }

  const mcs = lookupMcsParameters({ table: mcsTable, mcsIndex, pi2Bpsk })
  if (mcs.value === null) return { value: null, diagnostics: mcs.diagnostics }

  const resources = calculateNumberOfResourceElements({ direction, ...resourceInputs })
  if (resources.value === null || !resources.details) return { value: null, diagnostics: resources.diagnostics }

  const tbs = calculateTransportBlockSizeFromNRe({
    nRe: resources.value,
    modulationOrder: mcs.value.modulationOrder,
    targetCodeRateX1024: mcs.value.targetCodeRateX1024,
    numberOfLayers,
    scalingFactor,
  })
  if (tbs.value === null || !tbs.details) return tbs

  return {
    value: tbs.value,
    diagnostics: [],
    details: {
      ...tbs.details,
      direction,
      mcsTable,
      mcsIndex,
      resourceElements: resources.details,
    },
  }
}

function validateNonNegativeInteger(value: number, field: string, message: string) {
  return isFiniteInteger(value) && value >= 0
    ? undefined
    : invalid(field, message, value)
}

/**
 * Calculates the payload rate represented by a 10 ms slot configuration.
 * Ordinary and special downlink slots use separate TBS calculations because
 * their available data-symbol counts can differ. Special-slot uplink symbols
 * are intentionally excluded from the calculation.
 */
export function calculateTransportRate(inputs: TransportRateInputs): TbsResult<TransportRateDetails> {
  const {
    direction,
    downlinkSlotsPer10ms,
    uplinkSlotsPer10ms,
    specialSlotsPer10ms,
    specialDownlinkSymbols,
    pdcchSymbols,
    ...transportInputs
  } = inputs

  if (direction !== 'downlink' && direction !== 'uplink') {
    return failure(invalid('direction', '传输方向必须是 downlink 或 uplink', direction))
  }

  const countDiagnostics = [
    validateNonNegativeInteger(downlinkSlotsPer10ms, 'downlinkSlotsPer10ms', '下行时隙数必须是非负整数'),
    validateNonNegativeInteger(uplinkSlotsPer10ms, 'uplinkSlotsPer10ms', '上行时隙数必须是非负整数'),
    validateNonNegativeInteger(specialSlotsPer10ms, 'specialSlotsPer10ms', '特殊时隙数必须是非负整数'),
  ]
  const countDiagnostic = countDiagnostics.find(Boolean)
  if (countDiagnostic) return failure(countDiagnostic)

  if (!isFiniteInteger(pdcchSymbols) || pdcchSymbols < 0 || pdcchSymbols >= NR_SLOT_SYMBOLS) {
    return failure(invalid('pdcchSymbols', 'PDCCH 占用符号数必须是 0 到 13 的整数', pdcchSymbols))
  }
  if (!isFiniteInteger(specialDownlinkSymbols) || specialDownlinkSymbols < 0 || specialDownlinkSymbols > NR_SLOT_SYMBOLS) {
    return failure(invalid('specialDownlinkSymbols', '特殊时隙下行符号数必须是 0 到 14 的整数', specialDownlinkSymbols))
  }

  const normalDownlinkSymbols = NR_SLOT_SYMBOLS - pdcchSymbols
  const specialDownlinkDataSymbols = specialDownlinkSymbols - pdcchSymbols
  if (specialSlotsPer10ms > 0 && specialDownlinkDataSymbols <= 0) {
    return failure(invalid(
      'specialDownlinkSymbols',
      '存在特殊时隙时，特殊时隙下行符号数必须大于 PDCCH 占用符号数',
      specialDownlinkSymbols,
    ))
  }

  const makeTbsInputs = (slotDirection: TransportDirection, nSymbols: number): TransportBlockSizeInputs => ({
    ...transportInputs,
    direction: slotDirection,
    nSymbols,
  })

  let normalDownlinkTbs: number | undefined
  let specialDownlinkTbs: number | undefined
  let uplinkTbs: number | undefined

  if (direction === 'downlink') {
    if (downlinkSlotsPer10ms > 0) {
      const result = calculateTransportBlockSize(makeTbsInputs('downlink', normalDownlinkSymbols))
      if (result.value === null) return failure(result.diagnostics[0] ?? invalid('rate', '下行 TBS 无法计算'))
      normalDownlinkTbs = result.value
    }

    if (specialSlotsPer10ms > 0) {
      const result = calculateTransportBlockSize(makeTbsInputs('downlink', specialDownlinkDataSymbols))
      if (result.value === null) return failure(result.diagnostics[0] ?? invalid('rate', '特殊时隙下行 TBS 无法计算'))
      specialDownlinkTbs = result.value
    }
  } else if (uplinkSlotsPer10ms > 0) {
    const result = calculateTransportBlockSize(makeTbsInputs('uplink', NR_SLOT_SYMBOLS))
    if (result.value === null) return failure(result.diagnostics[0] ?? invalid('rate', '上行 TBS 无法计算'))
    uplinkTbs = result.value
  }

  const bitsPer10ms = direction === 'downlink'
    ? downlinkSlotsPer10ms * (normalDownlinkTbs ?? 0) + specialSlotsPer10ms * (specialDownlinkTbs ?? 0)
    : uplinkSlotsPer10ms * (uplinkTbs ?? 0)

  if (!Number.isSafeInteger(bitsPer10ms)) {
    return failure({
      code: 'CALCULATION_FAILED',
      field: 'bitsPer10ms',
      message: '10 ms 内传输比特数无法表示为安全整数',
    })
  }

  const rateMbps = bitsPer10ms / RATE_PERIOD_SECONDS / 1_000_000
  if (!Number.isFinite(rateMbps)) {
    return failure({
      code: 'CALCULATION_FAILED',
      field: 'rateMbps',
      message: '传输速率无法计算',
    })
  }

  return success(rateMbps, {
    direction,
    slotSymbols: NR_SLOT_SYMBOLS,
    normalDownlinkSymbols,
    specialDownlinkSymbols: specialDownlinkDataSymbols,
    uplinkSymbols: NR_SLOT_SYMBOLS,
    downlinkSlotsPer10ms,
    uplinkSlotsPer10ms,
    specialSlotsPer10ms,
    normalDownlinkTbs,
    specialDownlinkTbs,
    uplinkTbs,
    bitsPer10ms,
    rateMbps,
  })
}

/** Short aliases for callers that use the terminology "TB size"/"TBS". */
export const calculateTbs = calculateTransportBlockSize
export const calculateTbSize = calculateTransportBlockSize
export const calculateTBSize = calculateTransportBlockSize
export const calculateTbsFromNRe = calculateTransportBlockSizeFromNRe
export const calculateTbSizeFromNRe = calculateTransportBlockSizeFromNRe
export const calculateRate = calculateTransportRate
