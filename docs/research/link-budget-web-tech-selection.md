# 链路预算 Web 工具技术选型与 React / Vue 比较

## 问题一：如果想做一个计算链路预算的工具网页，应该使用什么 Web 技术？

### 需求概述

目标是做一个链路预算计算工具网页，界面以表格为主：

- 表格的行代表不同参数；
- 表格的列代表不同场景或不同取值；
- 可以动态增加、删除表格列；
- 每一列中的参数值可以直接修改；
- 修改输入参数后，结果自动重新计算并刷新；
- 用户本人不直接编程，主要由 Codex 完成功能开发和后续维护。

这个工具本质上更接近：

> **可编辑的场景矩阵 + 链路预算计算引擎**

而不是普通网页表单，也不建议直接做成“网页版 Excel”。

---

## 推荐技术栈

首选方案可以使用：

```text
Vue 3
+ TypeScript
+ Vite
+ AG Grid Community
+ Vitest
```

如果更偏向 React 生态，也可以使用：

```text
React
+ TypeScript
+ Vite
+ AG Grid Community
+ Vitest
```

不建议第一版使用：

- Next.js
- 后端服务
- 数据库
- Redux
- Tailwind
- Material UI
- Ant Design
- Supabase
- Firebase
- DuckDB
- WebAssembly
- Web Worker

对于链路预算这种计算量，浏览器端 TypeScript 足够。

---

## 1. 整体架构

最重要的原则是：

> **UI 和计算逻辑严格分离。**

推荐结构：

```text
┌────────────────────────────┐
│          Web UI            │
│     Vue / React + Grid     │
│                            │
│ 参数1 │ 场景A │ 场景B      │
│ 参数2 │  ...  │  ...       │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│       Scenario State       │
│                            │
│ scenarioA                  │
│ scenarioB                  │
│ scenarioC                  │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│   Link Budget Engine       │
│                            │
│ calculateLinkBudget()      │
│ pathLoss()                 │
│ noisePower()               │
│ receivedPower()            │
│ sinr()                     │
│ throughput()               │
└────────────────────────────┘
```

计算引擎应该完全不知道：

- Vue
- React
- AG Grid
- HTML

也就是说，计算部分应该是普通 TypeScript 函数。

例如：

```text
输入：
frequency
bandwidth
txPower
txGain
rxGain
pathLoss
noiseFigure
...

↓

calculateLinkBudget()

↓

输出：
eirp
rxPower
noisePower
snr
margin
throughput
...
```

这样以后即使重新做 UI，也不会影响链路预算公式。

---

## 2. 数据模型应该以 Scenario 为中心

不要按照表格的“行”来存数据，例如：

```text
参数1 → [1, 2, 3]
参数2 → [4, 5, 6]
参数3 → [7, 8, 9]
```

更合理的是：

```text
Scenario A
    frequency = 2000
    bandwidth = 20
    txPower = 46
    txGain = 18

Scenario B
    frequency = 3500
    bandwidth = 100
    txPower = 49
    txGain = 24
```

TypeScript 数据结构可以类似：

```ts
interface Scenario {
    id: string;
    name: string;

    inputs: {
        frequencyMHz: number;
        bandwidthMHz: number;
        txPowerDbm: number;
        txGainDbi: number;
        rxGainDbi: number;
        pathLossDb: number;
        noiseFigureDb: number;
    };
}
```

计算关系：

```text
Scenario
   ↓
calculateLinkBudget()
   ↓
LinkBudgetResult
```

UI 再把多个 Scenario 转置显示成：

| 参数 | 场景 1 | 场景 2 | 场景 3 |
|---|---:|---:|---:|
| 频率 MHz | 2000 | 2000 | 3500 |
| 发射功率 dBm | 46 | 43 | 49 |
| Tx 天线增益 dBi | 18 | 18 | 24 |
| 路损 dB | 130 | 145 | 138 |
| RSRP dBm | -95 | -113 | -87 |
| SINR dB | 15 | 3 | 22 |

---

## 3. 参数定义使用 metadata

参数名称、单位、默认值、是否可编辑等信息，不要散落在 UI 代码中。

可以集中定义：

```text
id: txPowerDbm
name: 发射功率
unit: dBm
group: 发射端
type: number
editable: true
default: 46
```

输出参数：

```text
id: receivedPowerDbm
name: 接收功率
unit: dBm
group: 接收端
type: number
editable: false
```

以后增加参数时，通常只需要：

1. 增加参数定义；
2. 修改计算函数；
3. 增加或修改自动测试。

---

## 4. 为什么推荐 AG Grid Community

这个界面实际上非常适合 Data Grid：

- editable cell；
- 动态增加和删除列；
- 固定第一列；
- 数值编辑器；
- 下拉列表；
- checkbox；
- 调整列宽；
- copy/paste；
- 键盘导航；
- tooltip；
- 条件样式；
- 自定义 cell renderer。

如果只有几十行参数、几个场景，也可以自己用原生 `<table>` 实现。

但如果希望最终成为一个比较专业的工程工具，使用 AG Grid Community 可以减少大量交互代码。

### 一个重要原则

不要让 AG Grid 负责链路预算计算。

不要做成：

```text
ReceivedPower = [TxPower] + [TxGain] - [PathLoss]
```

然后把公式绑定到 Grid。

应该始终保持：

```ts
function calculateLinkBudget(input): Result
```

由独立计算引擎产生结果。

AG Grid 只负责：

- 输入；
- 编辑；
- 显示。

---

## 5. 为什么使用 TypeScript

TypeScript 对链路预算工具非常有价值。

链路预算里会有大量参数：

```text
dBm
dB
MHz
GHz
W
K
dBi
dB/K
```

纯 JavaScript 容易出现：

- 字段名拼错；
- 参数缺失；
- 类型不一致；
- 返回结构被错误修改。

TypeScript 可以提前发现大量结构性错误。

尤其在代码主要由 Codex 编写和修改时，类型系统本身就是重要的约束机制。

---

## 6. 为什么使用 Vite，而不是 Next.js

第一版链路预算工具通常不需要：

- SSR；
- SEO；
- 用户系统；
- Server Components；
- API Server；
- 数据库。

因此 Next.js 会增加不必要的复杂度。

Vite 的结构更简单：

```text
浏览器
   ↓
index.html
   ↓
Vue / React
   ↓
链路预算程序
```

构建后就是静态文件：

```text
dist/
    index.html
    assets/
```

可以放到普通 Web Server 上运行。

---

## 7. 状态管理不需要复杂框架

第一版通常不需要：

- Redux
- MobX
- Zustand
- XState
- Pinia

如果使用 Vue，可以直接使用：

```text
ref
reactive
computed
```

如果使用 React，可以使用：

```text
useState
useReducer
```

项目状态本身比较简单：

```text
Project
 ├─ Scenario 1
 ├─ Scenario 2
 ├─ Scenario 3
 └─ settings
```

---

## 8. 计算结果不要作为独立状态保存

例如用户把：

```text
Tx Power
46 → 43 dBm
```

只应该保存：

```text
txPowerDbm = 43
```

然后自动执行：

```text
Scenario Inputs
      ↓
calculateLinkBudget()
      ↓
Scenario Results
```

不要再额外保存：

```text
eirp
rxPower
snr
margin
```

否则可能出现输入更新了、结果仍然是旧值的问题。

---

## 9. 自动刷新实现很简单

例如：

```text
Tx Power = 46
```

修改为：

```text
Tx Power = 43
```

流程就是：

```text
Grid cell changed
        ↓
更新 Scenario
        ↓
calculateLinkBudget(scenario)
        ↓
重新渲染
        ↓
显示新结果
```

对于：

```text
100 个参数
×
100 个 Scenario
```

普通浏览器端计算一般也没有性能问题。

因此第一版不需要：

- WebAssembly；
- GPU；
- 后端计算；
- Web Worker。

只有以后加入大规模 Monte Carlo、全球卫星仿真、大量干扰计算等任务时，才需要考虑这些技术。

---

## 10. 数据保存

第一版推荐：

```text
localStorage
```

保存当前项目。

同时提供：

```text
导出 JSON
导入 JSON
```

项目文件例如：

```text
link-budget-project.json
```

内部可以包含：

```text
version
projectName
scenarios
settings
```

建议从第一版开始就增加 `version` 字段，方便以后升级文件格式。

---

## 11. 自动测试非常重要

由于用户本人不会直接检查代码，自动测试的重要性反而比普通个人项目更高。

建议使用：

```text
Vitest
```

例如测试：

```text
TxPower   = 46 dBm
TxGain    = 18 dBi
CableLoss = 2 dB

期望：
EIRP = 62 dBm
```

再例如：

```text
kTB @ 290 K, 20 MHz
≈ -100.96 dBm
```

项目应该规定：

> **任何计算公式修改都必须同时增加或修改对应单元测试。**

这样 Codex 每次修改公式以后都可以执行：

```text
pnpm test
```

检查是否破坏已有计算逻辑。

---

## 12. 推荐目录结构

```text
src/
├─ domain/
│  ├─ types.ts
│  ├─ parameters.ts
│  ├─ units.ts
│  ├─ calculateLinkBudget.ts
│  ├─ propagation/
│  │  ├─ fspl.ts
│  │  ├─ uma.ts
│  │  └─ rma.ts
│  └─ __tests__/
│
├─ state/
│  └─ project.ts
│
├─ components/
│  ├─ LinkBudgetGrid.vue
│  ├─ ScenarioHeader.vue
│  └─ Toolbar.vue
│
├─ io/
│  ├─ loadProject.ts
│  └─ saveProject.ts
│
├─ App.vue
└─ main.ts
```

如果使用 React，只需要把组件文件改为 `.tsx`。

未来增加：

```text
38.901 UMa
38.901 UMi
38.901 RMa
36.942 Rural Macro
自由空间路损
ITU-R P.618
大气吸收
雨衰
阴影衰落
```

都可以集中放在 `domain` 中。

---

## 13. CSS 和 UI 框架

第一版建议不要使用：

- Tailwind；
- Material UI；
- Ant Design；
- Bootstrap；
- shadcn/ui。

直接使用：

```text
CSS
```

或：

```text
CSS Modules
```

即可。

因为这个网页主要就是：

```text
Toolbar
+
Grid
+
少量 Dialog
```

没必要增加完整设计系统。

---

## 14. 推荐的硬性架构要求

如果整个项目交给 Codex，应明确要求：

1. UI 和计算引擎严格分离；
2. 所有链路预算公式必须是纯 TypeScript 函数；
3. 计算结果不得作为独立 state 保存，只能从输入参数派生；
4. 每个 Scenario 是独立对象，表格只是 Scenario 的转置视图；
5. 所有重要公式必须有 Vitest 单元测试；
6. 第一版禁止增加后端和数据库；
7. 禁止无必要引入 Redux、Tailwind 等依赖；
8. AG Grid 只负责编辑和显示，不负责链路预算公式；
9. JSON 项目文件必须带 `version`；
10. 输入值和计算结果必须在 UI 上明显区分，结果单元格禁止编辑。

---

# 问题二：为什么推荐 React，而不是 Vue？

最初推荐 React，并不是因为 React 在这个项目里技术上明显优于 Vue。

对于这个链路预算工具：

> **Vue 3 + TypeScript 和 React + TypeScript 都非常合适。**

如果只针对这个具体项目重新选择，甚至可以略微倾向 Vue 3。

---

## 1. 最初偏向 React 的主要原因

### Codex / LLM 对 React 的覆盖更广

React 有非常庞大的：

- GitHub 项目；
- 官方示例；
- Stack Overflow 讨论；
- UI 组件库；
- 测试案例；
- 工程模板。

以后如果需要让 Codex 实现：

- AG Grid 动态列；
- 单元格编辑；
- Dialog；
- 导入导出；
- Undo / Redo；
- 状态管理；
- 性能优化；
- 自动测试；

React 通常更容易找到大量成熟模式。

这对“主要由 AI 编程”的项目有实际价值。

---

## 2. React 的第三方生态更大

很多 Web 库都会优先提供 React 示例。

例如：

```text
Grid
Chart
Dialog
Tree
Editor
Drag & Drop
Visualization
```

React 通常都有成熟集成方案。

如果以后这个工具发展得越来越复杂，React 的生态优势会变得更明显。

---

## 3. 但 Vue 的响应式模型非常适合链路预算

链路预算的核心关系就是：

```text
输入参数
   ↓
自动计算
   ↓
派生结果
```

Vue 的：

```text
ref
reactive
computed
```

非常适合这种模型。

例如：

```ts
const scenario = reactive({
  txPower: 46,
  txGain: 18,
  pathLoss: 130
})

const result = computed(() =>
  calculateLinkBudget(scenario)
)
```

当：

```text
txPower
```

发生变化后：

```text
result
```

会自动重新计算。

React 当然也可以实现，但通常需要更明确地处理 state 和 render 的关系。

---

## 4. Vue 单文件组件更集中

Vue 的单文件组件通常写成：

```text
LinkBudgetGrid.vue

<template>
...
</template>

<script setup lang="ts">
...
</script>

<style>
...
</style>
```

一个组件的：

- HTML；
- TypeScript；
- CSS；

可以放在一个文件中。

对于一个不大的工程工具，这种组织方式比较直观。

同时对于 Codex 来说，一次修改一个组件时，上下文也比较集中。

---

## 5. Vue 的概念复杂度通常更低一些

React 常见工程可能逐渐出现：

```text
component
hook
context
reducer
memo
effect
callback
```

Vue 常见代码通常可以直接表达成：

```text
reactive
computed
watch
component
```

对于链路预算这种业务逻辑明确、UI 相对固定的工程工具，Vue 的代码往往会更直接一些。

---

## 6. React 与 Vue 在这个项目中的比较

| 项目 | React | Vue 3 |
|---|---|---|
| 动态表格 | 很好 | 很好 |
| AG Grid | 很好 | 很好 |
| TypeScript | 很好 | 很好 |
| 自动重新计算 | 好 | 非常自然 |
| 代码简洁程度 | 一般 | 通常更好 |
| 状态管理 | 需要稍微设计 | 较直观 |
| Codex 熟悉程度 | 更高 | 很高 |
| 网上示例数量 | 更多 | 很多 |
| 第三方生态 | 更大 | 足够大 |
| 长期维护 | 很好 | 很好 |
| 用户偶尔阅读代码 | 相对复杂 | 通常更容易读 |
| 链路预算工具适配 | 很合适 | 很合适 |

---

## 7. 针对当前项目的最终选择

如果目标是：

> 大型、长期演进的 Web 产品，未来可能大量使用第三方组件和复杂 UI

可以优先考虑：

```text
React
+ TypeScript
+ Vite
```

如果目标就是目前描述的：

> 单用户、工程计算、表格为主、输入变化后自动重新计算的链路预算工具

则可以略微倾向：

```text
Vue 3
+ TypeScript
+ Vite
+ AG Grid Community
+ Vitest
```

原因不是 Vue 更“高级”，而是它的：

```text
reactive
computed
```

与链路预算这种“输入 → 派生结果”的模型非常贴合，而且代码通常更加直接。

---

## 8. 无论选择 React 还是 Vue，真正重要的是架构

最终应该始终保持：

```text
Vue / React UI
       │
       ▼
Scenario 数据
       │
       ▼
纯 TypeScript 计算库
       │
       ▼
LinkBudgetResult
```

而不要把链路预算公式写进 UI 组件。

例如：

```text
src/
├── domain/
│   ├── link-budget.ts
│   ├── propagation.ts
│   ├── noise.ts
│   └── units.ts
│
├── components/
│   ├── LinkBudgetGrid.vue
│   └── Toolbar.vue
│
├── state/
│   └── project.ts
│
└── App.vue
```

其中：

```text
calculateLinkBudget()
calculateNoisePower()
calculateFspl()
calculateEirp()
```

都应该是普通 TypeScript 代码，不依赖 Vue 或 React。

---

# 结论

针对当前链路预算工具，可以采用：

```text
Vue 3
+ TypeScript
+ Vite
+ AG Grid Community
+ Vitest
```

React 依然是完全合理的选择，主要优势在于：

- 更大的生态；
- 更多示例；
- Codex / LLM 覆盖更广。

Vue 的主要优势则是：

- 响应式模型与工程计算工具天然匹配；
- 代码相对直接；
- 单文件组件更集中；
- 对中小型工具的复杂度更低。

相比 React 和 Vue 的选择，真正重要得多的是：

> **计算引擎与 UI 分离、使用 TypeScript、结果从输入派生、并使用自动测试锁定所有重要公式。**
