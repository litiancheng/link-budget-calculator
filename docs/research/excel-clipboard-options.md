# Excel 文本复制粘贴方案核实

> 核实日期：2026-09-03
>
> 范围：Vue 3 + 动态场景列的链路预算矩阵；只要求与 Excel 双向交换纯文本，不要求样式、公式、合并单元格或富文本格式。

## 结论

1. Tabulator 是目前最匹配的免费现成控件：官方文档说明它使用 MIT 许可证，可免费用于商业项目，并提供复制、粘贴和单元格范围选择模块。
2. AG Grid Community 不应作为“免费 Excel 风格剪贴板”方案。AG Grid 的 Clipboard 和 Cell Selection 文档标为 Enterprise；Community 可启用浏览器原生文本选择，但这不等同于矩形范围复制粘贴。
3. Handsontable 的免费许可证是非商业用途许可，不适合默认作为公司内部或商业项目的免费依赖。
4. 如果只处理数字和短文本，手写方案并不复杂：在 `copy`/`paste` 事件中交换 `text/plain`，用 Tab 分列、换行分行，再按参数元数据校验和写回状态即可。

## 控件核实

### Tabulator

- [官方许可证](https://www.tabulator.info/docs/6.x/license/) 明确说明 Tabulator 使用 MIT 许可证，可用于商业项目和私有项目，无需付费。
- [官方 Clipboard 文档](https://www.tabulator.info/docs/6.x/clipboard/) 提供 `clipboard:true`，同时开启复制和粘贴；默认文本解析按换行拆行、按 Tab 拆列，适合 Excel 的文本交换。
- [官方范围选择文档](https://www.tabulator.info/docs/6.x/range/) 说明可拖拽、Shift 键扩展选择，并给出范围复制粘贴的配置示例。
- [官方 Vue 3 文档](https://tabulator.info/docs/6.3/vue) 提供 Vue 3 集成和响应式数据示例。

适配建议：将参数行作为 Tabulator 行、场景作为动态列；使用稳定的场景 ID 作为列 field。计算结果仍由 Vue/领域计算模块维护，不要把 Tabulator 行对象当作唯一业务状态源。

### AG Grid Community

- [官方 Community vs Enterprise 对比](https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/) 将 Community 定义为免费 MIT 版本，但把 Clipboard Operations、Range Selection 等能力列为 Enterprise 能力。
- [官方 Clipboard 文档](https://www.ag-grid.com/javascript-data-grid/clipboard/) 将系统剪贴板复制粘贴作为 Enterprise 功能，同时说明 Community 示例只能使用浏览器普通文本选择复制。

因此，AG Grid Community 可以满足单元格文本被用户选中后复制的基础场景，但不能按“免费版已经支持 Excel 矩形区域双向粘贴”来评估。

### Handsontable

- [官方当前非商业许可证](https://handsontable.com/static/licenses/non-commercial/v5/handsontable-non-commercial-license.pdf) 是 Non-Commercial License。若项目属于公司内部工具、交付项目或其他商业使用场景，不能直接假定该免费许可适用。

## 手写方案的边界

浏览器的 [Clipboard API and events 规范](https://www.w3.org/TR/clipboard-apis/) 允许在 `copy` 和 `paste` 的 `ClipboardEvent` 处理器中覆盖默认行为；[ClipboardEvent.clipboardData 文档](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/clipboardData) 说明可以在复制处理器中 `setData("text/plain", ...)`，在粘贴处理器中 `getData("text/plain")`。

推荐的最小实现约定：

- 复制当前选中的矩形区域，输出 TSV：列之间是 `\t`，行之间是 `\r\n`。
- 粘贴从当前活动单元格开始，逐行逐列写入。
- 参数名称列、单位列和计算结果列只读；只接受可编辑输入行。
- 粘贴先完整解析和校验，全部通过后再一次性更新场景状态并触发重算。
- 场景列使用稳定 ID；新增或删除场景只改变列元数据，不改变其他场景的业务数据。

如果调用异步的 `navigator.clipboard.readText()`/`writeText()`，需要注意其浏览器实现通常要求安全上下文（HTTPS）；可参考 [MDN Navigator.clipboard](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/clipboard) 和 [MDN Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText)。在 nginx 仍使用 HTTP 的内网环境中，优先使用用户触发的 `copy`/`paste` 事件并在实际 Chrome 环境测试。

## 针对本项目的建议

- 若希望第一版就具备拖拽选区、Shift 扩展、Ctrl+C/Ctrl+V 等完整交互：选 **Vue 3 + Tabulator**，并锁定版本。
- 若只需要“选中一个矩形、复制成文本、从 Excel 粘贴回矩形”，且矩阵的行列规则由项目自己定义：选 **Vue 3 + 原生 table + 一个 clipboard composable**。基础实现容易，真正需要测试的是选区键盘交互、输入校验和边界情况。
- 不要为了纯文本剪贴板引入 AG Grid Enterprise 或富表格编辑器；也不要把 Handsontable 的非商业许可当作通用免费许可。
