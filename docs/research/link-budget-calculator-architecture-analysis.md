
# 链路预算计算器架构分析

- 研究日期：2026-09-05
- 研究对象：D:/code/javascript/link-budget-calculator
- 报告范围：当前静态显示实现、后续真实链路预算计算、动态场景集合，以及从现有 Vue 3 + Tabulator 原型平滑迁移到目标架构的路径。
- 资料原则：本报告直接读取仓库源码、根上下文、AGENTS.md、docs/adr/ 和 docs/research/。本轮没有新增外部检索；已有 research 文档中引用的外部资料均按仓库内报告作为来源使用，未采用外部二手文章。

文中的仓库事实在段末标注来源路径和行号；“判断”与“建议”是基于这些事实形成的架构结论。报告沿用 CONTEXT.md 中的“场景值”“可更新场景值单元格”“静态参数矩阵”“报告布局”等词汇。这个做法符合仓库的领域文档规则。[来源：AGENTS.md:15-17；docs/agents/domain.md]

## 结论

当前项目是一个以显示为中心的 UI 原型，还没有形成独立的领域模型、应用状态或计算模块。当前阶段保留静态报告布局、四个示例场景、编辑交互和 TSV 交换是合理的；但后续加入真实计算以及场景列新增、删除、重命名之前，必须先把 Tabulator 从业务状态源降为显示和交互适配器。

目标架构应以有序的场景集合为中心。每个场景拥有稳定 ID、用户输入和名称；参数行由独立的参数元数据定义；表格只是把“参数行 × 场景集合”转置成 Tabulator 所需的列和行。用户编辑或 Excel 粘贴后，主数据流固定为：

~~~text
用户输入模型
  -> 校验 / 单位归一化
  -> 纯链路预算计算引擎
  -> 派生结果与评估状态
  -> 表格投影
  -> UI
~~~

其中，校验失败的场景不能进入计算引擎，也不能继续显示上一次的旧结果。计算结果、余量和状态都必须从当前输入派生，不能继续作为静态预置值存放在表格行中。

技术上建议继续使用当前已经安装并实现了 TSV 交互的 Vue 3 + Vite + Tabulator，先建立一个清晰的 seam，再按阶段迁移。现有 research 对 AG Grid Community 和 Tabulator 的推荐存在差异：技术选型报告偏向 AG Grid，剪贴板专项报告则认为 Tabulator 更匹配免费 TSV 交换，且当前 package.json 已使用 Tabulator。综合当前已实现的交互，迁移期不应同时更换表格控件和重写数据模型；把表格控件包在适配器后面，未来若出现真实能力缺口再单独评估。[来源：docs/research/link-budget-web-tech-selection.md:24-30,249-292；docs/research/excel-clipboard-options.md:7-28,50-54；package.json:11-19]

## 1. 研究约束与当前阶段

仓库把本项目定义为展示和编辑链路预算参数矩阵、与 Excel 交换表格数据的项目；当前阶段先做静态展示和编辑交互，计算逻辑另行定义。静态参数矩阵保留原型现有参数行和四个场景列，当前不提供新增或删除行、列、场景的操作；编辑内容也暂不校验、计算或单位换算。[来源：CONTEXT.md:3,19-35]

README 将当前工程明确描述为 throwaway prototype，说明目前只有静态文字和数字，没有计算、持久化或业务逻辑；README 同时记录了双击编辑、TSV 复制、Excel 粘贴和只读位置处理规则。[来源：README.md:1-16]

ADR-0001 已接受“固定报告矩阵并采用坐标式 TSV 交换”：当前报告布局固定，参数名称、单位、分组标题和文本结果只读，普通参数行的场景值可编辑；复制是否带表头取决于列标题是否明确选中，粘贴从合法左上角按 Tab/换行填充，不识别表头，不可编辑位置跳过，超出范围忽略。[来源：docs/adr/0001-static-report-matrix-clipboard-boundary.md:1-11]

本次任务新增的目标约束是阶段性的静态范围不能被误解为最终产品边界：后续必须根据用户输入执行链路预算计算，结果不能只是静态预置展示；场景列必须支持新增、删除和重命名。因此，ADR-0001 仍可作为当前阶段的行为合同，但动态场景目标应在进入相应迁移阶段前通过新的 ADR 或对现有 ADR 的修订记录下来。

## 2. 当前实现的结构和数据流

### 2.1 运行时和页面壳

package.json 当前只声明 Vue 3.5.13 和 Tabulator 6.5.0，构建链是 TypeScript 检查加 Vite 构建；脚本只有 dev、build 和 preview，没有 test 脚本，也没有 Vitest 依赖。[来源：package.json:1-20]

main.ts 创建 Vue 应用，挂载 App.vue，并加载 Tabulator 样式和全局 styles.css；vite.config.ts 只配置 Vue 插件；index.html 只提供根节点和 main.ts 入口。因此，现有部署形态是一个 Vite 生成的浏览器端静态应用，当前没有服务端计算入口。[来源：src/main.ts；vite.config.ts；index.html]

App.vue 只导入 TabulatorBudgetTable，并负责报告页侧栏、标题、摘要、导航和表格容器。它没有向表格传递项目状态、场景集合或输入更新回调。页面中 04 个场景、13 个参数项、STATIC 状态和“结构固定”等摘要内容都是模板字面量；导航还引用了 environment 和 notes 锚点，但当前模板没有对应 section。[来源：src/App.vue:1-66]

### 2.2 TabulatorBudgetTable.vue 的职责

当前表格文件同时承担了以下职责：

| 职责 | 当前实现 | 架构判断 |
| --- | --- | --- |
| 场景集合 | 文件内的 scenarios 常量定义 baseline、urban、rural、lab 及标题、副标题 | 场景集合没有应用层所有者，动态操作必须改组件内部实现。[来源：src/components/TabulatorBudgetTable.vue:8-15] |
| 参数和数据 | 文件内的 rows 常量同时保存分组行、参数名称、单位、四个场景值、path-loss、margin 和 status 示例值 | 行定义、输入值和结果示例混在同一个表格 fixture 中。[来源：src/components/TabulatorBudgetTable.vue:17-31] |
| 列定义 | buildColumns 根据当前 scenarios 一次性生成两列冻结结构列和四个场景列 | 列结构由组件内部常量决定；没有从场景集合变化中更新的接口。[来源：src/components/TabulatorBudgetTable.vue:66-105] |
| 可编辑规则 | isEditableScenarioCell 通过 rowType、id === status 和 scenarioFields 判断 | 只读规则是 UI helper 中的硬编码条件，没有参数角色元数据；除 status 外，普通场景行都会被视为可编辑。[来源：src/components/TabulatorBudgetTable.vue:15,41-44,100-102] |
| 格式化 | valueFormatter 对 section、status 和普通值分别返回 HTML 字符串 | 显示格式与值的来源绑定在同一文件，用户输入安全性也被带入 formatter。[来源：src/components/TabulatorBudgetTable.vue:34-64] |
| Tabulator 生命周期 | initTable 在 onMounted 中创建 Tabulator，onBeforeUnmount 中解绑事件并销毁表格 | 组件是命令式表格实例的唯一持有者，但没有 Vue 状态与实例之间的同步层。[来源：src/components/TabulatorBudgetTable.vue:108-135,274-282] |
| 复制 | selectedRangeTsv 读取 Tabulator range、列和数据，并根据列标题 DOM class 决定是否加入表头 | TSV 协议和 Tabulator 选择对象耦合在组件内部。[来源：src/components/TabulatorBudgetTable.vue:137-173] |
| 粘贴 | parseClipboardRows 解析文本，pasteIntoTable 按起始行列遍历并调用 cell.setValue | 粘贴直接修改 Tabulator cell，没有先形成应用层更新计划，也没有统一提交入口。[来源：src/components/TabulatorBudgetTable.vue:219-253] |

当前实际数据流可以表示为：

~~~text
组件内 scenarios / rows 常量
  -> new Tabulator({ data: rows, columns: buildColumns() })
  -> Tabulator row/cell 对象
  -> 双击编辑或 paste 事件调用 cell.setValue
  -> formatter 把 cell value 变成 HTML
  -> copy 读取 Tabulator range，paste 再写回 Tabulator cell
~~~

这个数据流没有经过 Vue 的 reactive、computed、store 或领域函数。Tabulator 行对象因此事实上承担了唯一可变状态源的角色；这与 README 和 CONTEXT.md 所描述的“当前不含计算和业务逻辑”一致，但无法直接支撑下一阶段的自动计算和持久化。[来源：src/App.vue:1-66；src/components/TabulatorBudgetTable.vue:108-135,229-253；README.md:3,14-16；CONTEXT.md:3,27-35]

## 3. 当前模块边界、seam 和耦合

从 codebase-design 的术语看，当前最明显的 seam 位于 TabulatorBudgetTable.vue，但这个模块的接口实际上隐含了太多知识：调用者不只需要知道如何显示表格，还被迫让它知道静态 row schema、scenario field、只读规则、Tabulator range 对象、DOM class、TSV 规则和生命周期。它是一个职责过载的浅模块，修改任一类行为都可能集中到同一个文件。

当前已经存在的可复用 seam 有两个：

1. isEditableScenarioCell 把“某个 cell 能不能更新”集中成了一个函数，后续可以替换为参数元数据和场景地址解析。
2. selectedRangeTsv、parseClipboardRows 和 pasteIntoTable 已经把剪贴板过程分成了若干函数，后续可以把纯 TSV 解析/序列化和 Tabulator 坐标发现拆开。[来源：src/components/TabulatorBudgetTable.vue:41-44,137-173,219-253]

但这两个 seam 目前都停留在组件内部。它们没有清晰的接口来表达：

- 输入更新的场景 ID 和参数 ID；
- 输入值的原始文本、显示单位和归一化数值；
- 校验问题及其对应单元格；
- 计算结果和结果状态；
- 动态场景新增、删除、重命名后的列投影；
- 粘贴完成校验后应一次性提交哪些更新。

已有技术研究给出了更合适的目标分层：Scenario State 保存场景，纯 TypeScript 的 Link Budget Engine 计算，UI/Grid 只负责输入、编辑和显示；参数名称、单位、默认值和是否可编辑等信息集中放在 metadata 中，结果从输入派生，不单独保存。[来源：docs/research/link-budget-web-tech-selection.md:65-142,146-238,402-422,567-614,656-669]

## 4. 主要风险

### 4.1 静态结构会把动态场景锁在组件里（高）

scenarios、scenarioFields、rows 和 buildColumns 都在 TabulatorBudgetTable.vue 内部；Tabulator 只在 onMounted 时用这批常量初始化一次。新增场景不仅要改列定义，还要给每个静态 row 增加新的字段；删除和重命名也没有状态命令或更新接口。[来源：src/components/TabulatorBudgetTable.vue:8-31,66-135,274-282]

如果沿用这条路径，场景列会成为“源码字段”的别名，场景名称会成为列标题，数据会成为多个 row 对象上的动态属性。这样每个新功能都要同时修改 rows、columns、编辑判断、复制表头和摘要文案，矩阵结构就被锁进显示组件。

判断：参数行定义和场景集合必须是两个独立维度。场景新增、删除、重命名只应作用于场景集合；矩阵列由投影模块重新生成，不应要求修改参数行源码。

### 4.2 Tabulator 的可变对象会阻断计算和持久化（高）

当前初始化把 rows 直接交给 Tabulator，粘贴又直接调用 cell.setValue；没有代码把更新转换成 Vue 状态或应用层命令，也没有计算函数监听或读取这些变化。[来源：src/components/TabulatorBudgetTable.vue:108-135,229-253；src/App.vue:1-66]

后续如果在表格 cell 上直接计算，会形成反向耦合：公式需要理解 Tabulator 的 row/cell 对象，持久化又要从控件实例回读，动态列操作还会改变控件内部 schema。测试只能启动 DOM 和表格实例，无法用一组普通输入直接测试计算。

判断：Tabulator 只能是一个 Adapter。它接收投影数据，把用户动作翻译成 application command；状态模块才是输入模型的唯一写入入口。

### 4.3 静态输入、静态结果和可编辑范围混在一起（高）

rows 中的 path-loss、margin 和 status 都是预置值；status 被单独排除编辑，但 margin 和 path-loss 没有被标成结果类型，按当前 editable predicate 会被当成普通可编辑场景值。README 也明确说当前数值只是静态示例且没有计算。[来源：src/components/TabulatorBudgetTable.vue:17-31,41-44；README.md:3,16]

这与新的硬约束直接冲突：结果不能继续是预置值。尤其是 path-loss 到底是用户输入、由频率和距离派生，还是由传播模型派生，当前源码没有给出领域决定；margin 和 status 的计算规则也没有被定义。不能从示例数字反推公式。

判断：目标模型必须把参数角色明确分成 input、derived、section 等类型。计算引擎产生的 path loss、received power、margin、status 等结果只能进入派生评估，不能写回用户输入模型；如果未来允许手工覆盖某个计算量，也要把 override 作为明确的输入字段和规则，而不是复用同一个表格 cell。

### 4.4 原始文本没有经过校验和单位归一化（高）

当前数值编辑器是普通 input，paste 解析后直接把文本交给 cell.setValue；formatValue 只有在值已经是 number 时才做格式化，否则直接转成字符串。当前 CONTEXT.md 明确把“不校验、不计算、不做单位换算”作为本阶段行为。[来源：src/components/TabulatorBudgetTable.vue:34-39,94-103,219-253；CONTEXT.md:21,33]

这在静态体验阶段是有意的，但不能作为计算阶段的输入合同。空字符串、非数字、无穷值、错误单位、范围错误和跨字段不一致都可能进入计算。如果只在公式内部用 Number() 或算术运算强行转换，错误就会变成 NaN、无意义结果或旧结果覆盖。

判断：把用户输入模型和归一化输入分开。校验和单位换算输出结构化 issues；只有完全有效的 NormalizedScenarioInput 才能传给纯计算引擎。无效场景必须在派生评估中保留问题而没有 result。

### 4.5 HTML formatter 存在用户输入注入风险（高）

普通值 formatter 返回包含 formatValue(value) 的 HTML 字符串；status formatter 也把 value 插入 HTML。编辑器和粘贴路径允许用户文本进入 cell，pasteIntoTable 没有过滤就调用 cell.setValue。因此，用户输入的特殊 HTML 可能被当成标记渲染。这是基于当前数据流的安全推断，尚未把它表述为已发生的攻击。[来源：src/components/TabulatorBudgetTable.vue:46-64,229-253]

未来场景重命名同样不能直接把用户名称插入 titleForScenario 返回的 HTML；当前 titleForScenario 将标题和副标题拼接成 HTML，而重命名目标必然会使标题变成用户输入。[来源：src/components/TabulatorBudgetTable.vue:62-64,94-99]

迁移时应使用文本安全的渲染路径，或在唯一 formatter seam 做严格转义；动态场景名、参数名、剪贴板内容和结果状态都不应通过未转义 HTML 插值。

### 4.6 粘贴规则与控件坐标耦合，且当前写入不是原子更新（中高）

复制和粘贴依赖 Tabulator range、列对象、行对象以及列标题的 DOM class；pasteIntoTable 逐个遍历并立即调用 cell.setValue。当前代码没有“解析全部内容—校验全部单元格—一次性提交”的更新计划或回滚边界。[来源：src/components/TabulatorBudgetTable.vue:141-173,208-263]

现有 ADR 和剪贴板研究已经把复制表头、合法左上角、只读跳过、超出范围忽略等规则定义得比较具体；专项研究还建议粘贴先完整解析和校验，全部通过后再一次性更新场景状态并触发重算。[来源：docs/adr/0001-static-report-matrix-clipboard-boundary.md:5-11；docs/research/excel-clipboard-options.md:36-48]

判断：Tabulator 只负责找到选区和起始坐标；TSV parser、矩阵坐标解析、更新计划和应用层提交都应成为可脱离 DOM 测试的模块。动态场景加入后，列顺序变化更需要稳定 scenario ID 和 parameter ID 来避免写错位置。

### 4.7 类型和验证基础不足以保护新计算层（中高）

tsconfig.app.json 开启 strict，但 shims-tabulator.d.ts 将 TabulatorFull 声明为 any，表格配置、range、row、column、cell 等调用因此绕过了类型检查。组件内部还把 table 和大量回调参数标成 any。[来源：tsconfig.app.json；src/shims-tabulator.d.ts:1-5；src/components/TabulatorBudgetTable.vue:6,41,46,66-135]

package.json 没有 test 脚本或 Vitest 依赖。既有技术研究要求重要公式用自动测试锁定，并建议以纯 TypeScript 函数作为计算边界。[来源：package.json:6-20；docs/research/link-budget-web-tech-selection.md:525-563,656-669]

判断：先让 domain、state、projection、TSV 计划使用严格类型，再把 Tabulator 类型缺口限制在 adapter 内部。计算公式测试不应依赖 Vue 或 Tabulator。

### 4.8 页面摘要和样式仍保留原型残留（中）

App.vue 把场景数量和参数数量写死在摘要中；styles.css 同时保留 wide、report、focus 三套 variant 样式以及 prototype-switcher 样式，而当前 App 只渲染 report variant。html 和 body 还被设置为 1120px 的最小宽度。[来源：src/App.vue:7-60；src/styles.css:23-29,75,372,596,984-1048]

这些不是计算正确性问题，但动态场景增多后，静态摘要和固定布局会制造错误反馈；多套未使用样式也会增加维护和构建体积。目标架构中摘要应从场景集合和参数 catalog 派生，布局样式则在报告页面稳定后清理。

### 4.9 部署和首屏资源有现实风险（中）

styles.css 在运行时从 Google Fonts 加载字体；既有部署研究建议针对受限的 Windows 7 + nginx 环境尽量把资源本地化，避免外部 CDN 和 web font 依赖，并在现代机器或 CI 构建后只把静态产物部署到 nginx。[来源：src/styles.css:1；docs/research/link-budget-calculator-implementation-options.md:7-18,43-63,177-187]

本次依据 package.json 的 build 脚本执行了 npm run build，构建成功，但 Vite 输出了 minified chunk 超过 500 kB 的提示。这个观察说明 Tabulator、样式或未来新增依赖需要受到资源预算约束；它不是当前架构必须立即引入代码分割的结论。[来源：package.json:6-9；本次研究中的 npm run build 验证]

## 5. 目标架构

### 5.1 目标原则

1. 场景集合是应用状态的核心，不是表格列的副作用。
2. 参数 catalog 是独立的领域元数据，集中定义参数 ID、名称、分组、显示单位、规范单位、值类型、输入/派生角色和显示格式。
3. 用户输入、归一化输入、计算结果和表格投影是不同的数据形状。
4. 计算引擎只接受已校验、已归一化的输入，返回新建的结果对象；它不导入 Vue、Tabulator、DOM 或剪贴板模块。
5. 结果由输入派生，不作为独立的可变 state 保存，也不允许结果 cell 编辑。
6. Tabulator 适配器拥有控件生命周期和交互转换，但不拥有业务状态。
7. TSV 规则在当前阶段保持不变；要改变表头识别或复制格式时，另行修改 ADR。
8. 每个 seam 都应有小接口和清晰错误模式，使调用者和测试都能通过同一接口验证行为。

### 5.2 建议的领域和状态模型

下面是用于说明边界的模型草图，不是要求一次性照抄的最终类型：

~~~typescript
type ScenarioId = string
type ParameterId = string

interface ParameterDefinition {
  id: ParameterId
  label: string
  group: string
  displayUnit: string
  canonicalUnit: string
  valueType: 'number' | 'text'
  role: 'input' | 'derived'
  format: 'decimal' | 'text' | 'status'
}

interface ScenarioInputModel {
  id: ScenarioId
  name: string
  inputs: Readonly<Record<ParameterId, { raw: string }>>
}

interface UserInputModel {
  schemaVersion: number
  scenarios: readonly ScenarioInputModel[]
}

interface NormalizedScenarioInput {
  scenarioId: ScenarioId
  values: Readonly<Record<ParameterId, number>>
}

interface LinkBudgetResult {
  values: Readonly<Record<ParameterId, number | string>>
}

interface ScenarioEvaluation {
  scenarioId: ScenarioId
  issues: readonly ValidationIssue[]
  result?: LinkBudgetResult
}
~~~

raw 文本留在 UserInputModel 的原因是编辑中的空值或暂时无效文本仍需要显示，并且导入/粘贴错误需要定位到原始 cell；它不代表计算引擎可以接受字符串。validateAndNormalize 应把 raw 文本按 ParameterDefinition 解析、校验、转换到 canonicalUnit，并返回结构化 issues 或 NormalizedScenarioInput。

具体的规范单位、公式输入和结果字段仍需另行形成领域决定。当前静态 rows 只有示例频率、功率、增益、损耗、距离和灵敏度等字段，CONTEXT.md 明确没有定义计算逻辑；不能直接把示例行当作完整的链路预算输入合同。[来源：src/components/TabulatorBudgetTable.vue:17-31；CONTEXT.md:3；docs/research/link-budget-web-tech-selection.md:214-238,402-422]

### 5.3 目标模块和接口

建议的目录可以是：

~~~text
src/
  domain/
    model.ts
    parameters.ts
    units.ts
    validation.ts
    calculate-link-budget.ts
    result-status.ts
  state/
    project-store.ts
    scenario-commands.ts
  presentation/
    matrix-projection.ts
    cell-address.ts
  adapters/
    tabulator/
      LinkBudgetGrid.vue
      tabulator-adapter.ts
    clipboard/
      tsv.ts
      paste-plan.ts
  persistence/
    project-json.ts
    local-storage.ts
  App.vue
  main.ts
~~~

各模块的职责如下：

| 模块 | 小接口 | 实现应该隐藏的复杂度 | 不应知道的内容 |
| --- | --- | --- | --- |
| domain validation | validateAndNormalize(userInput, catalog) | 字符串解析、范围检查、单位转换、跨字段检查、issues 结构 | Vue、Tabulator、DOM |
| domain calculation | calculateLinkBudget(normalizedInput, formulaConfig) | 自由空间或其他传播模型、功率/增益/损耗求和、噪声、余量和结果状态 | 表格坐标、HTML、剪贴板 |
| state | dispatch(command) / readModel() | 场景 ID、顺序、名称唯一性策略、输入更新、增删改命令 | Tabulator row/cell 对象 |
| matrix projection | projectMatrix(model, evaluations, catalog) | 参数行和场景列的转置、cell role、显示值和编辑地址 | Tabulator 实例生命周期 |
| clipboard | parseTsv、serializeTsv、planPaste | Tab/换行解析、表头复制规则、坐标计划、只读跳过和越界处理 | Vue、DOM class、Tabulator range |
| Tabulator adapter | render(projection)、emitCellEdit、readSelection | Tabulator 初始化、列/行更新、编辑器、选区、键盘事件 | 公式、单位换算、持久化格式 |

calculateLinkBudget 应是最深的模块：调用者只需提供一个明确的 NormalizedScenarioInput 和公式配置，就能获得结构化 LinkBudgetResult。大量公式和模型知识隐藏在实现内部，测试也通过同一小接口进入。state 和 projection 也应保持小接口，让场景操作和矩阵显示能够独立演进。

### 5.4 主数据流

~~~mermaid
flowchart LR
  Edit[用户输入或 Excel 粘贴] --> Adapter[UI / Tabulator / TSV Adapter]
  Adapter --> State[UserInputModel<br/>有序 Scenario 集合]
  State --> Normalize[校验与单位归一化]
  Normalize -->|有 issues| Invalid[无结果的派生评估]
  Normalize -->|有效 normalized input| Engine[纯 calculateLinkBudget]
  Engine --> Derived[LinkBudgetResult<br/>派生余量与状态]
  Invalid --> Projection[Matrix Projection]
  Derived --> Projection
  State --> Projection
  Projection --> UI[报告布局与 Tabulator UI]
  Ops[新增 / 删除 / 重命名场景] --> State
~~~

这里的关键不是某个框架的 reactive 语法，而是数据形状和写入方向：

1. UI 事件只产生 cell address 或 scenario command。
2. state 统一更新 UserInputModel。
3. validateAndNormalize 对每个受影响场景重新产生有效输入或 issues。
4. 只有有效输入进入纯计算引擎。
5. 结果和状态由 evaluation selector/computed 从当前模型派生。
6. projection 把输入、issues 和结果混合为可显示矩阵，再交给 Tabulator。

输入变更后可以只重算受影响场景；场景新增时计算新场景；场景删除时删除对应 evaluation；场景重命名只改变标题元数据，不需要重跑公式。是否对所有场景批量重算是性能实现选择，但不能改变上述数据流。

## 6. 动态场景集合的设计

场景集合建议使用稳定 ID 加有序列表表达。ID 是机器引用，name 是用户可编辑显示文本；不能用 name 作为 ID，也不能在重命名时改变 ID。参数 catalog 保持独立，矩阵列由当前场景列表投影得到。

| 操作 | 对 UserInputModel 的作用 | 对矩阵和结果的作用 |
| --- | --- | --- |
| 新增场景 | 生成唯一 ScenarioId，插入一个 name 和输入集合；可以从默认模板或已有场景复制输入 | 投影增加一列；新场景经过校验和计算后显示结果；不改参数行定义 |
| 重命名场景 | 只更新指定 ScenarioId 的 name | 同一列更新标题；输入、结果、剪贴板坐标和持久化引用保持稳定 |
| 删除场景 | 从有序场景集合移除指定 ScenarioId 及其输入 | 投影移除一列，派生 evaluation 移除；其他场景的 ID 和输入不变 |
| 重排场景 | 只改变有序列表顺序 | 列顺序变化，按当前显示顺序复制；业务数据不迁移到别的场景 |
| 编辑或粘贴场景值 | 通过 ScenarioId + ParameterId 更新 raw 输入 | 重新校验并计算该场景；结果 cell 仍只读 |

当前实现把 scenario id 直接当作列 field，并把每个场景值直接放到每个 row 的同名属性上；这是适合固定 fixture 的显示形状，不适合成为持久化模型。[来源：src/components/TabulatorBudgetTable.vue:8-31,94-105]

迁移后可以继续让 projection 生成 Tabulator 需要的 field，但 field 必须是 adapter 内部映射，不是领域数据结构。一个安全的地址应至少包含 parameterId 和 scenarioId；Tabulator 的 row index、当前列位置和用户名称都不应作为业务引用。这样删除中间场景或重命名场景不会让后续列的数据错位。

当前 TSV 合同是坐标式、粘贴不识别表头。动态场景阶段应继续从合法左上角按当前列顺序填充，列标题变化只影响复制结果中的表头文本；如果未来要支持“按场景名和参数名导入”，那是一个新的导入协议，必须另行设计和记录，不能悄悄改变当前粘贴语义。[来源：CONTEXT.md:15,23,25；docs/adr/0001-static-report-matrix-clipboard-boundary.md:5-11]

## 7. 分阶段迁移建议

### 阶段 0：先确定领域合同，保持界面不变

- 将现有 rows 作为 fixture 读取，整理出 ParameterDefinition、分组行、输入行和候选派生行。
- 明确每个字段的角色：哪些是用户输入，哪些由公式产生；特别先决定 path-loss、margin、status 的来源和计算规则。
- 明确规范单位、允许的文本形式、范围、缺失值策略和 result status 规则。
- 只补类型和文档，不把计算公式临时写进 TabulatorBudgetTable.vue。

退出条件是参数 catalog 和公式输入/输出合同能够被 domain 测试直接使用。当前 CONTEXT.md 说计算逻辑另行定义，因此这一步是必要的决策门，而不是从示例数字猜公式。[来源：CONTEXT.md:3；src/components/TabulatorBudgetTable.vue:17-31]

### 阶段 1：抽取 canonical state 和矩阵投影，保持静态行为

- 新建 state 模块，保存四个场景的稳定 ID、名称和 raw inputs。
- 新建参数 catalog 和 matrix-projection 模块；由 catalog 产生结构行，由场景列表产生列。
- TabulatorBudgetTable.vue 改为接收 projection 或通过一个小的 state interface 读取 projection，并把编辑动作转成 updateInput command。
- 保留当前四场景、固定参数行、双击编辑、只读结构列和当前 TSV 行为；这一阶段不加入计算，符合现有 CONTEXT 和 ADR。

此阶段的成功标准是：删除 Tabulator 实例后，业务输入仍可从 state 读取；替换一个假的 grid adapter，仍可以用同一 updateInput 接口驱动 state。这说明 seam 真的存在。[来源：CONTEXT.md:19-35；docs/adr/0001-static-report-matrix-clipboard-boundary.md:5-11]

### 阶段 2：抽取 TSV 模块并加入动态场景操作

- 把纯文本 parse、serialize、表格地址解析和 paste update plan 移出 Vue 文件。
- 先完成 addScenario、renameScenario、removeScenario，必要时再加 reorderScenario；所有操作通过 state command 完成。
- 由场景集合变化重新生成投影列；Tabulator adapter 负责更新控件列和数据。
- 粘贴先生成完整 update plan，再根据当前阶段规则过滤只读和越界位置；为动态列、重命名、删除中间列增加测试。
- 修复 formatter 的安全渲染，避免新场景名和用户输入继续被拼接为未转义 HTML。

阶段出口是：改变场景集合不需要编辑 parameter rows；重命名不改变 scenario ID；删除一个场景不改变其余场景的输入；复制和粘贴测试不依赖真实 Tabulator DOM。剪贴板实现仍遵循当前 ADR，除非单独修订协议。[来源：docs/research/excel-clipboard-options.md:36-48；docs/adr/0001-static-report-matrix-clipboard-boundary.md:5-11]

### 阶段 3：接入校验和单位归一化

- 实现 validateAndNormalize(userInputModel, catalog)。
- 为每个输入 cell 返回 parse、range、unit 和跨字段问题；问题要带 ScenarioId、ParameterId 和用户可理解的消息。
- 输入无效时显示 raw 文本和错误标记，不调用计算引擎，不保留旧结果冒充当前结果。
- 把 number input、TSV paste 和未来 JSON import 都接到同一个归一化入口。

阶段出口是：同一输入无论来自双击、Excel 粘贴还是文件导入，都会得到相同的 NormalizedScenarioInput 或相同的 issues。浏览器表单可以提供即时提示，但领域校验不能只依赖 HTML constraint validation。[来源：docs/research/link-budget-calculator-implementation-options.md:112-123；CONTEXT.md:21,33]

### 阶段 4：接入纯计算引擎和派生结果

- 实现纯 TypeScript 的 calculateLinkBudget；按已经确定的公式合同拆出 units、propagation、noise、power balance 和 result-status 等内部模块。
- 对每个有效场景计算一个 LinkBudgetResult；结果通过 computed/selector 生成，不写回 UserInputModel。
- 把 path-loss、received power、margin、status 等确认后的派生行从输入模型移除，并在 catalog 中标成 derived、不可编辑。
- 输入改变或场景增删后自动重新评估受影响场景，projection 只显示最新 evaluation。
- 为每个重要公式、单位转换、边界值和状态规则增加纯函数测试，再添加 state/projection/clipboard 的集成测试。

阶段出口是：修改用户输入会改变计算输出；刷新或重新生成表格不会丢失当前 state；同一 NormalizedScenarioInput 在没有 UI 的情况下可以得到稳定结果；页面不会再把静态 PASS、CHECK 或 margin 作为结果源。[来源：docs/research/link-budget-web-tech-selection.md:402-480,525-563,656-669；README.md:3,16]

### 阶段 5：持久化、导入导出和发布加固

- 在 state 模型稳定后加入 schemaVersion、项目 JSON 导入导出和可选的 localStorage。
- 迁移旧 fixture 时只转换用户输入，不把静态结果当成可信结果写入文件。
- 补齐安全渲染、错误恢复、撤销策略、动态场景边界、实际 Chrome 验收和构建资源预算。
- 把 Google Fonts 改为本地资源或系统字体方案，清理未使用的 variant CSS，并根据真实场景数量验证横向滚动和可读性。

已有 research 建议从第一版就保留 JSON version 字段，并认为单用户、无共享和无服务端可信计算时客户端计算加静态部署更简单；这些建议适合在核心计算和状态接口稳定后落地。[来源：docs/research/link-budget-web-tech-selection.md:489-523；docs/research/link-budget-calculator-implementation-options.md:7-18,132-146,177-187]

## 8. 需要明确记录的架构决策

### 8.1 ADR-0001 是当前阶段合同，不是最终动态场景模型

ADR-0001 当前接受固定四场景和固定参数矩阵，这是现阶段产品范围的清晰约束。新的动态场景要求会改变“场景列固定”的长期假设，但不需要破坏当前阶段的 TSV 行为。建议在阶段 2 开始前新增 ADR 或修订 ADR-0001，至少记录稳定场景 ID、场景顺序、删除语义、重命名语义、空场景策略和动态列对复制/粘贴坐标的影响。[来源：docs/adr/0001-static-report-matrix-clipboard-boundary.md:5-11；CONTEXT.md:19,35]

### 8.2 现有两个技术研究需要合并为一个实施决策

link-budget-web-tech-selection.md 以 Vue 3 + TypeScript + Vite + AG Grid Community 为首选，并强调 Scenario State、metadata、纯计算函数和派生结果；excel-clipboard-options.md 则根据 TSV 交换需求把 Tabulator 列为当前最匹配的免费控件，并建议不要把 AG Grid Community 当作免费的完整 Excel 矩形剪贴板方案。[来源：docs/research/link-budget-web-tech-selection.md:24-30,249-292,402-422；docs/research/excel-clipboard-options.md:7-28,36-54]

针对当前仓库的实施决策应是：继续使用已有 Tabulator，先抽取 grid adapter seam；不要在同一阶段切换 AG Grid。未来如果需要更强的虚拟化、键盘、编辑器或列操作能力，再以 matrix projection 接口为替换点比较控件。这样 Tabulator 的选择不会渗透到 domain 和 state。

### 8.3 计算公式必须先有领域合同

当前文档只定义显示和编辑边界，没有定义完整链路预算公式；已有 research 提到自由空间损耗、噪声、接收电平、余量以及未来的传播模型，但这些是实现方向，不是当前项目已接受的计算规范。[来源：CONTEXT.md:3；docs/research/link-budget-web-tech-selection.md:402-422,567-614；docs/research/link-budget-calculator-implementation-options.md:114-123,183-184]

因此，第一批计算实现应先落一组可验证的公式和单位合同，再接入表格。不能因为当前 rows 中已经有 path-loss、margin 和 PASS/CHECK，就把这些静态示例当成规范答案。

## 9. 来源清单和验证

本报告使用的仓库一手资料如下：

- AGENTS.md
- CONTEXT.md
- README.md
- package.json、vite.config.ts、tsconfig.json、tsconfig.app.json、tsconfig.node.json、index.html
- src/main.ts、src/App.vue、src/components/TabulatorBudgetTable.vue、src/styles.css、src/shims-tabulator.d.ts
- docs/agents/domain.md、docs/agents/issue-tracker.md、docs/agents/triage-labels.md
- docs/adr/0001-static-report-matrix-clipboard-boundary.md
- docs/research/link-budget-web-tech-selection.md
- docs/research/link-budget-calculator-implementation-options.md
- docs/research/excel-clipboard-options.md

依据 package.json:6-9 执行了 npm run build，当前构建通过；构建输出了 Vite 关于 minified chunk 超过 500 kB 的提示。这个结果只作为当前基线验证，不改变本报告的目标架构结论。[来源：package.json:6-9；本次研究中的 npm run build 验证]

本报告没有修改上述已有资料，也没有把外部网页的二手观点作为依据。后续实施时，任何公式、单位、状态规则或动态场景协议都应在对应 domain 测试和 ADR 中留下可追溯记录。
