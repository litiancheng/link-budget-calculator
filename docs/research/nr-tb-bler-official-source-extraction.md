# 官方 NR SINR–TB-BLER 数据提取记录

## 来源

- 5G-LENA NR：<https://gitlab.com/cttc-lena/nr.git>
  - commit: `fec689095e7fbaf6d48858846dd5fe8fe18daf9f`
  - 使用 `model/nr-eesm-t1.cc`、`model/nr-eesm-t2.cc`、`model/nr-mcs-tables.cc` 和 `model/nr-eesm-error-model.cc`。
- NVIDIA Sionna：<https://github.com/NVlabs/sionna.git>
  - commit: `f56ce0c2ce01d7c591957f89eb1c8ce02fd6d608`
  - 版本：2.0.1
  - 使用 `src/sionna/sys/bler_tables/*.json` 和 `src/sionna/phy/nr/utils.py`。

## 配置

- PRB：10、100、200
- 调度数据符号：12
- DM-RS：24 RE/PRB
- 每 PRB 额外开销：0
- 传输层数：1
- HARQ：关闭
- 目标：TB-BLER = 0.1

## 计算方法

直接解析官方代码中已有的 CB-BLER–SINR 表，不重新执行 Monte Carlo 仿真。根据 MCS、资源数、调制阶数和目标码率计算 TBS，再依据官方 NR LDPC base-graph 与 code-block segmentation 规则得到 code-block size 和数量：

```text
TB-BLER = 1 - (1 - CB-BLER)^C
```

ns-3 的 CB 曲线选择遵循其 `upper_bound` 后回退到不大于目标 CB size 的表项规则。Sionna 在相邻 CBS 表项之间做线性插值。应用运行时使用 ns-3 曲线计算 TB-BLER：曲线范围内在相邻 SINR 数据点之间线性反解；目标 BLER 超出正数采样范围时，排除 BLER=0 点，在 `log10(TB-BLER)` 与 SINR 坐标中使用对应端点最近的两个有效点做线性尾部外推。目标 BLER=0% 和 100% 不参与反解。

## 输出

- `data/nr-bler/sinr_tb_bler_curves.csv`：完整曲线数据。
- `data/nr-bler/sinr_tb_bler_10pct.csv`：10% TB-BLER 对应 SINR。
- `data/nr-bler/generation_metadata.json`：资源配置、来源 commit 和生成口径。
- `scripts/generate_nr_tb_bler.py`：可重复运行的解析和生成脚本。
- `src/data/nrNs3Curves.ts`：由同一官方 ns-3 提取脚本生成的原始 PDSCH Table 1/2 CB 曲线，供运行时按实际 code-block size 选择。

5G-LENA NR 当前官方模型提供 PDSCH Table 1/2；Sionna 官方 BLER 表提供 PDSCH Table 1–4 和 PUSCH Table 1–2。两者的结果应视为各自 PHY abstraction 模型的结果，不应直接当作同一个误码模型的数值等价物。
