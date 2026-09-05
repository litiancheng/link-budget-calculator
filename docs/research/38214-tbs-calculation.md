# TS 38.214 TBS 计算核对记录

## 来源与范围

本实现以仓库中的 [TS 38.214 V19.4.0（Release 19）](../specs/38214-j40.pdf) 为准：

- 第 36-42 页：5.1.3.1，PDSCH MCS 表 1-4。
- 第 43-46 页：5.1.3.2，PDSCH 的资源元素数、TBS 量化和下行缩放因子。
- 第 261-269 页：6.1.4.1/6.1.4.2，PUSCH MCS 表、资源元素数和对 5.1.3.2 步骤 2-4 的引用。

实现的计算边界是“已确定 MCS 表、MCS 索引、调度资源和传输层数后，计算一个传输块的数值 TBS”。DCI/RRC 信令过程本身不在本函数内推断；调用方必须显式选择规范规定的 MCS 表，并在特殊调度场景中先确定 `N_RE` 所需的有效 PRB、时隙和开销输入。

当前链路预算界面将 `direction`、`mcsIndex`、`numberOfLayers`、`nPrb` 和 `nSymbols` 作为始终显示的基础输入，将 `mcsTable` 和 `nDmrsPrb` 作为默认隐藏的高级输入；`nOhPrb`、`nPrbOutsideBwp`、`numberOfSlots`、`pi2Bpsk` 和 `scalingFactor` 固定为界面默认值。界面默认使用 PDSCH MCS Table 2，并且只允许在 Table 1 与 Table 2 之间选择；底层计算模块仍保留其他规范表，以便独立测试和后续扩展。

## 规范步骤

资源元素数使用 38.214 的共同形式：

```text
N'_RE = N_sc^RB × N_symb^sh − N_DMRS^PRB − N_oh^PRB
N_RE  = min(156, N'_RE) × n_PRB
```

对于 PUSCH 多时隙 TB 处理，调用方可传入时隙数 `N`；对于适用的特殊带宽部分场景，可传入带宽部分外的 PRB 数 `n'_PRB`。实现保留这些中间量，避免把不同调度场景的资源假设隐藏在 TBS 公式中。

使用选定 MCS 表得到 `Q_m` 和 `R` 后：

```text
N_info = S × N_RE × R × Q_m × v
```

其中普通场景 `S=1`；PDSCH 特殊缩放场景允许 `S=1/2` 或 `S=1/4`。

当 `N_info <= 3824`：

```text
n       = max(3, floor(log2(N_info)) − 6)
N'_info = max(24, 2^n × floor(N_info / 2^n))
TBS     = 小 TBS 表中不小于 N'_info 的最小值
```

当 `N_info > 3824`：

```text
n       = floor(log2(N_info − 24)) − 5
N'_info = max(3840, 2^n × round((N_info − 24) / 2^n))
```

这里的 `round` 在并列时向更大的整数取整。随后按目标码率和 `N'_info` 使用 3816、8424 对应的码块分支公式，或者在高码率小于等于 8424 时直接使用 8 比特对齐公式。

## 版本敏感点

小 TBS 表和 MCS 表都是规范表，不应复用旧版本或其他实现中的常量。特别是 V19.4.0 的 Table 5.1.3.2-1 与早期版本常见的列表不同；代码测试覆盖了 3824 分界、3840 起点、低码率码块分支、高码率码块分支和 Release 19 的表项。
