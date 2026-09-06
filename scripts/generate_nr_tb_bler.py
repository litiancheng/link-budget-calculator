#!/usr/bin/env python3
"""Extract official ns-3 NR/Sionna BLER curves and form TB-BLER curves.

The script deliberately reads source trees supplied on the command line. It
does not use the repository's local ns-3 checkout. Source trees are expected
to be official 5G-LENA NR and NVIDIA Sionna checkouts pinned by the caller.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import subprocess
from pathlib import Path


PRB_COUNTS = (10, 100, 200)
N_SYMBOLS = 12
N_DMRS_PER_PRB = 24
N_OH_PER_PRB = 0
LAYERS = 1
TARGET_TBLER = 0.1
NUMBER_RE = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"


def numbers(text: str) -> list[float]:
    return [float(x) for x in re.findall(NUMBER_RE, text)]


def initializer(text: str, name: str) -> str:
    match = re.search(rf"{re.escape(name)}\s*=\s*\{{(.*?)\}};", text, re.S)
    if not match:
        raise ValueError(f"initializer not found: {name}")
    return match.group(1)


def parse_mcs_tables(nr_root: Path) -> dict[int, list[tuple[int, float]]]:
    text = (nr_root / "model" / "nr-mcs-tables.cc").read_text(encoding="utf-8")
    result: dict[int, list[tuple[int, float]]] = {}
    for table in (1, 2):
        m_body = re.sub(r"//.*", "", initializer(text, f"NrMcsTables::m_mcsMTable{table}"))
        m_values = [int(x) for x in numbers(m_body)]
        rate_body = re.sub(r"//.*", "", initializer(text, f"NrMcsTables::m_mcsEcrTable{table}"))
        rates = [float(a) / float(b) for a, b in re.findall(
            rf"({NUMBER_RE})\s*/\s*({NUMBER_RE})", rate_body)]
        if len(m_values) != len(rates):
            raise ValueError(f"MCS table {table} modulation/rate length mismatch")
        result[table] = list(zip(m_values, rates))
    return result


def parse_ns3_curves(nr_root: Path, table: int) -> dict[int, dict[int, dict[int, tuple[list[float], list[float]]]]]:
    text = (nr_root / "model" / f"nr-eesm-t{table}.cc").read_text(encoding="utf-8")
    result: dict[int, dict[int, dict[int, tuple[list[float], list[float]]]]] = {0: {}, 1: {}}
    bg_markers = list(re.finditer(r"// BG TYPE ([12])", text))
    mcs_markers = list(re.finditer(r"// MCS (\d+)", text))
    entry = re.compile(
        rf"\{{(\d+)U,\s*// SINR.*?DoubleTuple\{{\s*\{{([^}}]*)\}},\s*// SINR\s*\{{([^}}]*)\}}\s*// BLER",
        re.S,
    )
    for marker in mcs_markers:
        bg = 0
        for bg_marker in bg_markers:
            if bg_marker.start() < marker.start():
                bg = int(bg_marker.group(1)) - 1
        mcs = int(marker.group(1))
        end = next((m.start() for m in mcs_markers if m.start() > marker.start()), len(text))
        body = text[marker.end():end]
        curves = {}
        for cb_size, sinr_body, bler_body in entry.findall(body):
            sinr = numbers(sinr_body)
            bler = numbers(bler_body)
            if len(sinr) != len(bler) or not sinr:
                continue
            curves[int(cb_size)] = (sinr, bler)
        if curves:
            result[bg][mcs] = curves
    return result


def parse_sionna_table(path: Path) -> dict[int, dict[int, tuple[list[float], list[float]]]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    categories = data["category"]
    category = next(iter(categories.values()))
    index = next(iter(category["index"].values()))
    result = {}
    for mcs_text, mcs_data in index["MCS"].items():
        snr = [float(x) for x in mcs_data["SNR_db"]]
        curves = {}
        for cb_text, cb_data in mcs_data["CBS"].items():
            bler = [float(x) for x in cb_data["BLER"]]
            if len(snr) == len(bler) and snr:
                curves[int(cb_text)] = (snr, bler)
        if curves:
            result[int(mcs_text)] = curves
    return result


def tbs_for(mcs: int, q_m: int, rate: float, prb: int) -> int:
    n_re = min(156, 12 * N_SYMBOLS - N_DMRS_PER_PRB - N_OH_PER_PRB) * prb
    n_info = n_re * rate * q_m * LAYERS
    if n_info <= 3824:
        n = max(3, math.floor(math.log2(n_info)) - 6)
        quantized = max(24, (2**n) * math.floor(n_info / (2**n)))
        small = [24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128,
                 136, 144, 152, 160, 168, 176, 184, 192, 208, 224, 240, 256,
                 272, 288, 304, 320, 336, 352, 368, 384, 408, 432, 456, 480,
                 504, 528, 552, 576, 608, 640, 672, 704, 736, 768, 808, 848,
                 888, 928, 984, 1032, 1064, 1128, 1160, 1192, 1224, 1256,
                 1288, 1320, 1352, 1416, 1480, 1544, 1608, 1672, 1736, 1800,
                 1864, 1928, 2024, 2088, 2152, 2216, 2280, 2408, 2472, 2536,
                 2600, 2664, 2728, 2792, 2856, 2976, 3104, 3240, 3368, 3496,
                 3624, 3752, 3824]
        return next(x for x in small if x >= quantized)
    n = math.floor(math.log2(n_info - 24)) - 5
    unit = 2**n
    quantized = max(3840, unit * math.floor((n_info - 24) / unit + 0.5))
    if rate <= 0.25:
        c = math.ceil((quantized + 24) / 3816)
    elif quantized > 8424:
        c = math.ceil((quantized + 24) / 8424)
    else:
        c = 1
    return int(8 * c * math.ceil((quantized + 24) / (8 * c)) - 24)


def segmentation(tbs: int, rate: float) -> tuple[int, int]:
    bg2 = tbs <= 292 or rate <= 0.25 or (tbs <= 3824 and rate <= 0.67)
    kcb = 3840 if bg2 else 8448
    b = tbs + 24
    kb = 6 if bg2 else 22
    if bg2:
        if b >= 640:
            kb = 10
        elif b >= 560:
            kb = 9
        elif b >= 192:
            kb = 8
    c = 1 if b <= kcb else math.ceil(b / (kcb - 24))
    b1 = b + (0 if c == 1 else c * 24)
    k1 = b1 / c
    lifting = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24,
               26, 28, 30, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 88, 96,
               104, 112, 120, 128, 144, 160, 176, 192, 208, 224, 240, 256, 288,
               320, 352, 384]
    z = next(x for x in lifting if kb * x >= k1)
    return z * (10 if bg2 else 22), c


def interp(x: float, xs: list[float], ys: list[float]) -> float:
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    i = next(i for i in range(1, len(xs)) if xs[i] >= x)
    if xs[i] == xs[i - 1]:
        return ys[i]
    f = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
    return ys[i - 1] + f * (ys[i] - ys[i - 1])


def cb_curve(curves: dict[int, tuple[list[float], list[float]]], cb_size: int, x: float) -> float:
    sizes = sorted(curves)
    if cb_size <= sizes[0] or cb_size >= sizes[-1]:
        chosen = sizes[0] if cb_size <= sizes[0] else sizes[-1]
        xs, ys = curves[chosen]
        return interp(x, xs, ys)
    hi = next(i for i, size in enumerate(sizes) if size >= cb_size)
    lo = hi - 1
    s0, s1 = sizes[lo], sizes[hi]
    y0 = interp(x, *curves[s0])
    y1 = interp(x, *curves[s1])
    f = (cb_size - s0) / (s1 - s0)
    return y0 + f * (y1 - y0)


def threshold(points: list[tuple[float, float]]) -> tuple[float | None, str]:
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        if y0 == TARGET_TBLER:
            return x0, "exact"
        if (y0 - TARGET_TBLER) * (y1 - TARGET_TBLER) <= 0 and y0 != y1:
            return x0 + (TARGET_TBLER - y0) * (x1 - x0) / (y1 - y0), "linear"
    if points and points[-1][1] == TARGET_TBLER:
        return points[-1][0], "exact"
    return None, "out_of_range"


def add_curve(rows, thresholds, source, direction, table_name, mcs, prb, q_m, rate, curves, ns3_mode=False):
    tbs = tbs_for(mcs, q_m, rate, prb)
    cb_size, cb_count = segmentation(tbs, rate)
    if ns3_mode:
        available = sorted(curves)
        selected = available[0]
        for candidate in available:
            if candidate <= cb_size:
                selected = candidate
            else:
                break
        selected_curves = {selected: curves[selected]}
        x_values = curves[selected][0]
        values = [interp(x, *curves[selected]) for x in x_values]
    else:
        selected_curves = curves
        x_values = sorted({x for xs, _ in curves.values() for x in xs})
        values = [cb_curve(selected_curves, cb_size, x) for x in x_values]
    points = [(float(x), max(0.0, min(1.0, 1 - (1 - y) ** cb_count))) for x, y in zip(x_values, values)]
    crossing, method = threshold(points)
    thresholds.append({"source": source, "direction": direction, "mcs_table": table_name,
                       "mcs_index": mcs, "prb_count": prb, "tbs_bits": tbs,
                       "code_block_size_bits": cb_size, "code_block_count": cb_count,
                       "sinr_db_at_tbler_10pct": crossing, "fit_method": method})
    for sinr, tbler in points:
        rows.append({"source": source, "direction": direction, "mcs_table": table_name,
                     "mcs_index": mcs, "prb_count": prb, "sinr_db": sinr,
                     "tbler": tbler, "tbs_bits": tbs, "code_block_size_bits": cb_size,
                     "code_block_count": cb_count})


def git_sha(root: Path) -> str:
    return subprocess.check_output(
        ["git", "-c", f"safe.directory={root}", "-C", str(root), "rev-parse", "HEAD"],
        text=True,
    ).strip()


def write_ns3_curve_module(nr_root: Path, output_path: Path) -> None:
    """Write the official ns-3 PDSCH CB curves as a browser-loadable module.

    The application must select curves by the code-block size calculated for
    the current scenario.  The older CSV output is intentionally not used for
    this because it bakes in one fixed resource configuration.
    """
    tables = {}
    for table in (1, 2):
        curves = parse_ns3_curves(nr_root, table)
        table_curves = {}
        for bg_index, mcs_curves in curves.items():
            bg_curves = {}
            for mcs, size_curves in mcs_curves.items():
                bg_curves[str(mcs)] = {
                    str(cb_size): {
                        "sinrDb": sinr,
                        "cbBler": bler,
                    }
                    for cb_size, (sinr, bler) in sorted(size_curves.items())
                }
            table_curves[str(bg_index + 1)] = bg_curves
        tables[f"pdsch-table-{table}"] = table_curves

    module = "// Generated from official 5G-LENA NR source. Do not edit by hand.\n"
    module += f"// Source: https://gitlab.com/cttc-lena/nr.git @ {git_sha(nr_root)}\n\n"
    module += "export type NrNs3Curve = Readonly<{ sinrDb: readonly number[]; cbBler: readonly number[] }>\n"
    module += "export type NrNs3CurveMap = Readonly<Record<string, NrNs3Curve>>\n"
    module += "export type NrNs3McsTable = Readonly<Record<string, NrNs3CurveMap>>\n"
    module += "export type NrNs3CurveTable = Readonly<Record<string, NrNs3McsTable>>\n\n"
    module += "export const NS3_PDSCH_CURVES: Readonly<Record<string, NrNs3CurveTable>> = "
    module += json.dumps(tables, separators=(",", ":"), ensure_ascii=False)
    module += "\n\n"
    module += f"export const NS3_PDSCH_CURVE_SOURCE = Object.freeze({{ repository: 'https://gitlab.com/cttc-lena/nr.git', commit: '{git_sha(nr_root)}' }})\n"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(module, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nr-root", type=Path, required=True)
    parser.add_argument("--sionna-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--normalized-ns3-output", type=Path)
    args = parser.parse_args()
    rows, thresholds = [], []
    mcs_tables = parse_mcs_tables(args.nr_root)
    for table in (1, 2):
        curves = parse_ns3_curves(args.nr_root, table)
        for mcs, (q_m, rate) in enumerate(mcs_tables[table]):
            for prb in PRB_COUNTS:
                for bg in (0, 1):
                    if mcs in curves[bg]:
                        add_curve(rows, thresholds, "ns-3-5g-lena", "PDSCH", f"Table {table}",
                                  mcs, prb, q_m, rate, curves[bg][mcs], True)
                        break
    for path in sorted((args.sionna_root / "src" / "sionna" / "sys" / "bler_tables").glob("*.json")):
        match = re.match(r"(PDSCH|PUSCH)_table(\d+)\.json", path.name)
        if not match:
            continue
        direction, table_number = match.groups()
        curves_by_mcs = parse_sionna_table(path)
        # Sionna's table JSON does not duplicate the MCS metadata; use the
        # official NR Table 1/2 values for common tables and derive the other
        # tables from their published MCS modulation/rate entries below.
        mcs_metadata = mcs_tables[int(table_number)] if int(table_number) in mcs_tables else []
        for mcs, curves in curves_by_mcs.items():
            if mcs < len(mcs_metadata):
                q_m, rate = mcs_metadata[mcs]
            else:
                # Table 3/4 and PUSCH tables are present in Sionna's JSON;
                # their modulation/rate can be recovered from the table's
                # effective code-rate metadata only by the MCS decoder. Keep
                # the table entries' actual range and use the corresponding
                # 38.214 values for the published tables.
                published = {
                    ("PDSCH", 3): [(2, 30/1024),(2,40/1024),(2,50/1024),(2,64/1024),(2,78/1024),(2,99/1024),(2,120/1024),(2,157/1024),(2,193/1024),(2,251/1024),(2,308/1024),(2,379/1024),(2,449/1024),(2,526/1024),(2,602/1024),(4,340/1024),(4,378/1024),(4,434/1024),(4,490/1024),(4,553/1024),(4,616/1024),(6,438/1024),(6,466/1024),(6,517/1024),(6,567/1024),(6,616/1024),(6,666/1024),(6,719/1024),(6,772/1024)],
                    ("PDSCH", 4): [(2,120/1024),(2,193/1024),(4,449/1024),(4,378/1024),(4,490/1024),(4,616/1024),(6,466/1024),(6,517/1024),(6,567/1024),(6,616/1024),(6,666/1024),(6,719/1024),(6,772/1024),(6,822/1024),(6,873/1024),(8,682.5/1024),(8,711/1024),(8,754/1024),(8,797/1024),(8,841/1024),(8,885/1024),(8,916.5/1024),(8,948/1024),(10,805.5/1024),(10,853/1024),(10,900.5/1024),(10,948/1024)],
                    ("PUSCH", 1): [
                        (2, 120/1024), (2, 157/1024), (2, 193/1024), (2, 251/1024),
                        (2, 308/1024), (2, 379/1024), (2, 449/1024), (2, 526/1024),
                        (2, 602/1024), (2, 679/1024), (4, 340/1024), (4, 378/1024),
                        (4, 434/1024), (4, 490/1024), (4, 553/1024), (4, 616/1024),
                        (4, 658/1024), (6, 466/1024), (6, 517/1024), (6, 567/1024),
                        (6, 616/1024), (6, 666/1024), (6, 719/1024), (6, 772/1024),
                        (6, 822/1024), (6, 873/1024), (6, 910/1024), (6, 948/1024)],
                    ("PUSCH", 2): [
                        (2, 30/1024), (2, 40/1024), (2, 50/1024), (2, 64/1024),
                        (2, 78/1024), (2, 99/1024), (2, 120/1024), (2, 157/1024),
                        (2, 193/1024), (2, 251/1024), (2, 308/1024), (2, 379/1024),
                        (2, 449/1024), (2, 526/1024), (2, 602/1024), (2, 679/1024),
                        (4, 378/1024), (4, 434/1024), (4, 490/1024), (4, 553/1024),
                        (4, 616/1024), (4, 658/1024), (4, 699/1024), (4, 772/1024),
                        (6, 567/1024), (6, 616/1024), (6, 666/1024), (6, 772/1024)],
                }[(direction, int(table_number))]
                q_m, rate = published[mcs]
            for prb in PRB_COUNTS:
                add_curve(rows, thresholds, "sionna", direction, f"Table {table_number}",
                          mcs, prb, q_m, rate, curves)
    args.output.mkdir(parents=True, exist_ok=True)
    curve_path = args.output / "sinr_tb_bler_curves.csv"
    threshold_path = args.output / "sinr_tb_bler_10pct.csv"
    with curve_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)
    with threshold_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(thresholds[0]))
        writer.writeheader(); writer.writerows(thresholds)
    metadata = {
        "resources": {"prb_counts": PRB_COUNTS, "scheduled_symbols": N_SYMBOLS,
                      "dmrs_re_per_prb": N_DMRS_PER_PRB, "oh_re_per_prb": N_OH_PER_PRB,
                      "layers": LAYERS, "harq": "none"},
        "target_tbler": TARGET_TBLER,
        "sources": {"nr_repo": "https://gitlab.com/cttc-lena/nr.git",
                     "nr_commit": git_sha(args.nr_root),
                     "sionna_repo": "https://github.com/NVlabs/sionna.git",
                     "sionna_commit": git_sha(args.sionna_root)},
        "curve_method": "official source curves; linear interpolation for threshold only; no Monte Carlo",
        "notes": "ns-3 curves use the official lower/equal code-block-size lookup rule; Sionna curves linearly interpolate across CBS entries before TB-BLER composition.",
        "row_count": len(rows), "threshold_count": len(thresholds),
    }
    (args.output / "generation_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    if args.normalized_ns3_output:
        write_ns3_curve_module(args.nr_root, args.normalized_ns3_output)
    print(f"wrote {len(rows)} curve rows and {len(thresholds)} threshold rows to {args.output}")


if __name__ == "__main__":
    main()
