import { NS3_PDSCH_CURVES } from '../data/nrNs3Curves.ts'
import type { McsTableId } from './transportBlockSize.ts'

export type Ns3McsTableId = 'pdsch-table-1' | 'pdsch-table-2'

export type SinrLookupMethod =
  | 'interpolation'
  | 'log10-extrapolation-low-bler'
  | 'log10-extrapolation-high-bler'

export type SinrDiagnosticCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_MCS_TABLE'
  | 'CURVE_NOT_FOUND'
  | 'EXTRAPOLATION_FAILED'

export type SinrDiagnostic = {
  code: SinrDiagnosticCode
  field: string
  value?: string
  message?: string
}

export type SinrLookupInput = {
  mcsTable: McsTableId
  mcsIndex: number
  baseGraph: 1 | 2
  codeBlockSizeBits: number
  codeBlockCount: number
  targetBler: number
}

export type SinrLookupResult = {
  value: number | null
  method: SinrLookupMethod | null
  diagnostics: readonly SinrDiagnostic[]
}

type CurvePoint = {
  sinrDb: number
  tbBler: number
}

function failure(
  code: SinrDiagnosticCode,
  field: string,
  message: string,
  value?: unknown,
): SinrLookupResult {
  return {
    value: null,
    method: null,
    diagnostics: [{ code, field, message, value: value === undefined ? undefined : String(value) }],
  }
}

function success(value: number, method: SinrLookupMethod): SinrLookupResult {
  return { value, method, diagnostics: [] }
}

function isSupportedTable(table: McsTableId): table is Ns3McsTableId {
  return table === 'pdsch-table-1' || table === 'pdsch-table-2'
}

function selectCodeBlockCurve(input: SinrLookupInput) {
  if (!isSupportedTable(input.mcsTable)) return undefined

  const table = NS3_PDSCH_CURVES[input.mcsTable]
  const graph = table?.[String(input.baseGraph)]
  const mcs = graph?.[String(input.mcsIndex)]
  if (!mcs) return undefined

  const sizes = Object.keys(mcs).map(Number).sort((a, b) => a - b)
  if (sizes.length === 0) return undefined

  let selectedSize = sizes[0]
  sizes.forEach((size) => {
    if (size <= input.codeBlockSizeBits) selectedSize = size
  })

  return mcs[String(selectedSize)]
}

function buildTbBlerPoints(input: SinrLookupInput): CurvePoint[] | null {
  const curve = selectCodeBlockCurve(input)
  if (!curve || curve.sinrDb.length !== curve.cbBler.length || curve.sinrDb.length === 0) return null

  const points = curve.sinrDb
    .map((sinrDb, index) => ({
      sinrDb,
      tbBler: 1 - (1 - Math.max(0, Math.min(1, curve.cbBler[index]))) ** input.codeBlockCount,
    }))
    .filter((point) => Number.isFinite(point.sinrDb) && Number.isFinite(point.tbBler))
    .sort((a, b) => a.sinrDb - b.sinrDb)

  const deduplicated: CurvePoint[] = []
  points.forEach((point) => {
    const previous = deduplicated[deduplicated.length - 1]
    if (previous && previous.sinrDb === point.sinrDb) deduplicated[deduplicated.length - 1] = point
    else deduplicated.push(point)
  })
  return deduplicated
}

function findInRangeSinr(points: readonly CurvePoint[], targetBler: number) {
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]
    if (point.tbBler === targetBler) return point.sinrDb

    const next = points[index + 1]
    if (!next || point.tbBler <= 0 || next.tbBler <= 0 || point.tbBler === next.tbBler) continue
    if ((targetBler - point.tbBler) * (targetBler - next.tbBler) < 0) {
      return point.sinrDb +
        ((targetBler - point.tbBler) * (next.sinrDb - point.sinrDb)) /
        (next.tbBler - point.tbBler)
    }
  }
  return null
}

function tailFit(points: readonly CurvePoint[], fromLowSinr: boolean, targetBler: number) {
  const candidates = points
    .filter((point) => point.tbBler > 0 && point.tbBler <= 1)
    .sort((a, b) => fromLowSinr ? a.sinrDb - b.sinrDb : b.sinrDb - a.sinrDb)

  const first = candidates[0]
  const second = candidates.find((point) => point.tbBler !== first?.tbBler && point.sinrDb !== first?.sinrDb)
  if (!first || !second) return null

  const x0 = first.sinrDb
  const x1 = second.sinrDb
  const y0 = Math.log10(first.tbBler)
  const y1 = Math.log10(second.tbBler)
  const slope = (y1 - y0) / (x1 - x0)
  if (!Number.isFinite(slope) || slope === 0) return null

  const result = x0 + (Math.log10(targetBler) - y0) / slope
  return Number.isFinite(result) ? result : null
}

export function lookupTargetSinr(input: SinrLookupInput): SinrLookupResult {
  if (!isSupportedTable(input.mcsTable)) {
    return failure(
      'UNSUPPORTED_MCS_TABLE',
      'mcsTable',
      'ns-3 SINR 曲线只支持 PDSCH Table 1 和 Table 2',
      input.mcsTable,
    )
  }
  if (!Number.isInteger(input.mcsIndex) || input.mcsIndex < 0 || input.mcsIndex > 31) {
    return failure('INVALID_INPUT', 'mcsIndex', 'MCS 索引必须是 0 到 31 的整数', input.mcsIndex)
  }
  if (![1, 2].includes(input.baseGraph)) {
    return failure('INVALID_INPUT', 'baseGraph', 'Base Graph 必须是 1 或 2', input.baseGraph)
  }
  if (!Number.isInteger(input.codeBlockSizeBits) || input.codeBlockSizeBits <= 0) {
    return failure('INVALID_INPUT', 'codeBlockSizeBits', 'Code Block Size 必须是正整数', input.codeBlockSizeBits)
  }
  if (!Number.isInteger(input.codeBlockCount) || input.codeBlockCount <= 0) {
    return failure('INVALID_INPUT', 'codeBlockCount', 'Code Block 数量必须是正整数', input.codeBlockCount)
  }
  if (!Number.isFinite(input.targetBler) || input.targetBler <= 0 || input.targetBler >= 1) {
    return failure('INVALID_INPUT', 'targetBlerPercent', '目标 BLER 必须大于 0% 且小于 100%', input.targetBler)
  }

  const points = buildTbBlerPoints(input)
  if (!points || points.length < 2) {
    return failure('CURVE_NOT_FOUND', 'mcsIndex', '找不到匹配的 ns-3 BLER 曲线', input.mcsIndex)
  }

  const inRange = findInRangeSinr(points, input.targetBler)
  if (inRange !== null) return success(inRange, 'interpolation')

  const positiveBler = points.map((point) => point.tbBler).filter((bler) => bler > 0)
  const minimumPositiveBler = Math.min(...positiveBler)
  const maximumBler = Math.max(...positiveBler)

  if (input.targetBler < minimumPositiveBler) {
    const value = tailFit(points, false, input.targetBler)
    return value === null
      ? failure('EXTRAPOLATION_FAILED', 'targetBlerPercent', '低 BLER 尾部无法进行 log10(BLER) 外推')
      : success(value, 'log10-extrapolation-low-bler')
  }

  if (input.targetBler > maximumBler) {
    const value = tailFit(points, true, input.targetBler)
    return value === null
      ? failure('EXTRAPOLATION_FAILED', 'targetBlerPercent', '高 BLER 尾部无法进行 log10(BLER) 外推')
      : success(value, 'log10-extrapolation-high-bler')
  }

  return failure('EXTRAPOLATION_FAILED', 'targetBlerPercent', '目标 BLER 未落在可反解的单调曲线段内')
}
