# 链路预算表格 UI 原型

这是一个 throwaway prototype，用来观察 Vue 3 + Tabulator 在链路预算参数矩阵中的显示效果。当前包含场景级自由空间路损反解和结构化诊断，不包含持久化或完整链路预算业务逻辑。

## 启动

```bash
npm install
npm run dev
```

在浏览器打开 Vite 输出的本地地址，根路径 `/` 即为报告布局。

普通参数行的场景值可以双击编辑，Enter 或失焦提交，Esc 取消；参数名称、单位、分组标题和覆盖距离结果保持只读。路损模型、载波频率和路损值通过场景矩阵接缝计算覆盖距离；无效输入会显示模型诊断并清除旧结果。选中表格范围后，可以点击“复制到 Excel”或使用 `Ctrl+C`。复制内容使用纯文本 TSV（列之间为 Tab、行之间为换行），因此粘贴到 Excel 时会自动分列。只拖选正文数值时不附带表头；点击或拖选列标题、明确选中整列时，复制结果才会包含对应表头。

从 Excel 粘贴回网页时，内容从选中范围的左上角开始按 Tab/换行填充；不识别表头。若左上角不是可编辑场景值单元格，则整次粘贴取消；后续不可编辑位置跳过，超出范围的数据忽略。当前原型不包含完整链路预算和持久化。

## GitHub Pages

线上地址：<https://litiancheng.github.io/link-budget-calculator/>

推送到 `main` 后，GitHub Actions 会自动运行测试、构建 Vite 生产包，并将 `dist/` 发布到 GitHub Pages。也可以在仓库的 Actions 页面手动运行部署 workflow。

本地验证生产包：

```bash
npm run build
npm run preview
```

由于线上使用项目站点路径，预览时请打开 Vite 输出地址下的 `/link-budget-calculator/` 路径。
