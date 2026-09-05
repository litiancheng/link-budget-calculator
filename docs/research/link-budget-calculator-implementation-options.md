# 链路预算计算网页实现方案研究

- 研究日期：2026-09-02
- 研究范围：参数配置、即时计算、结果展示；部署主机为性能较差的 Windows 7 + nginx；客户端为 Windows 10 + Chrome；目标是接近现代网页的体验。
- 资料原则：只采用 nginx、浏览器厂商、框架/构建工具官方文档和 Web 标准。文中的“建议/推断”是基于这些资料对本项目约束的工程判断。

## 结论先行

最适合的总体架构是：**单页、客户端计算、静态文件部署**。把链路预算公式实现为浏览器中的纯 JavaScript/TypeScript 模块；Windows 7 主机只负责通过 nginx 提供 `index.html`、CSS、JavaScript 和少量图标/资源。nginx 官方文档提供了静态文件的 `root`/`index` 配置和 `try_files` 路由回退能力；Vite 的生产构建则明确会生成适合静态托管的应用包。因此，在不需要账号、共享数据或服务端计算的前提下，计算过程不必经过 Windows 7 主机（这是基于架构的推断）。

推荐顺序：

1. **首选：Vite + vanilla JavaScript/TypeScript + 原生 HTML/CSS**。在较新的开发机或 CI 上构建，把 `dist/` 复制到 nginx；服务器不运行 Node.js。
2. **若界面明显扩大为复杂组件应用：Vue 3 + Vite**。客户端是 Windows 10 + Chrome，Vue 3 的现代浏览器边界不是当前主要风险；只有在团队已有 Vue 经验或状态/组件数量确实增长时才值得引入。
3. **轻量组件替代：Preact + Vite**。适合动态增删输入项、多个链路场景和复用面板，同时保持较小的浏览器运行时。
4. **若无法在别处构建：直接部署不需要构建的 vanilla 项目**。这牺牲类型检查、打包和自动兼容处理，但最少依赖。
5. **Svelte 5 + Vite** 可以用于未来的复杂组件界面，但对当前“表单 + 结果”页面通常是为未来复杂度提前付费。

Windows 7 本身不是静态文件部署的技术阻碍，但它已经结束支持；nginx 官方也明确说明 Windows 版本不应期待高性能和高可扩展性，且目前只有一个 worker 实际处理工作。对一个资源少、计算在客户端完成的内部工具，这个约束通常可接受；对公网或高并发场景则应迁移主机或增加现代前置层。[Windows 7 生命周期](https://learn.microsoft.com/en-us/lifecycle/products/windows-7)、[nginx for Windows](https://nginx.org/en/docs/windows.html)

## 假设

- 计算所需的输入和公式都可以放在客户端；不要求服务端保存用户方案、账号、审计记录或多用户共享结果。
- 部署主机是性能较差的 Windows 7，已安装 nginx，并能把构建产物复制到网站根目录。
- 构建可以在另一台较新的开发机、虚拟机或 CI 上完成。若这个假设不成立，则采用“无构建 vanilla”路线。
- “现代用户体验”指响应式布局、即时反馈、清晰的输入校验、轻量过渡动画、可保存最近方案；不要求 SSR、复杂路由、3D 或大型数据可视化。
- 客户端可以按 Windows 10 + Chrome 处理，不把 IE11 或 Windows 7 客户端列为首版兼容目标；Chrome 的实际版本仍应在验收时记录。
- 研究不替代主机安全评估；公网暴露、证书、身份认证和数据合规会改变最终方案。

## 1. Windows 7 + nginx：主机端与客户端必须分开判断

| 层面 | 已确认事实 | 对本项目的影响 |
| --- | --- | --- |
| 操作系统生命周期 | Microsoft Lifecycle 标明 Windows 7 支持已结束。[Windows 7 生命周期](https://learn.microsoft.com/en-us/lifecycle/products/windows-7) | 不应把“能运行”理解为“仍受支持”。如果站点面向公网，补丁、证书和供应链风险高于页面本身的 CPU 开销。 |
| nginx Windows 版本 | nginx 官方说明 Windows 版本使用 Win32 API，目前只使用 `select()`/`poll()` 连接处理机制，不应期待高性能和高可扩展性；虽然可以启动多个 worker，但只有一个实际处理工作。[nginx for Windows](https://nginx.org/en/docs/windows.html) | 应把 nginx 仅用于提供少量静态资源，不在 Windows 7 上运行 Node、SSR、API 或数据库。对小型内网工具通常足够，但不要按高并发公网服务设计。 |
| 静态文件服务 | nginx 官方入门文档使用 `root` 提供静态文件、`index` 指定入口；`try_files` 可以按文件存在性选择资源或回退到一个 URI。[nginx Beginner’s Guide](https://nginx.org/en/docs/beginners_guide.html)、[nginx core module](https://nginx.org/en/docs/http/ngx_http_core_module.html)、[nginx index module](https://nginx.org/en/docs/http/ngx_http_index_module.html) | `dist/` 直接复制到 nginx 网站根目录即可。单页应用只有在使用前端路由时才需要 `/index.html` 回退。 |
| 传输与缓存 | nginx 官方提供 gzip 响应压缩、`expires`/缓存相关指令以及预压缩文件模块。[nginx gzip module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html)、[nginx static gzip module](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html) | 可以压缩 JS/CSS/JSON/SVG，并给 Vite 生成的指纹资源设置长缓存；`index.html` 保持短缓存，避免发布后引用旧资源。 |
| 客户端 | 目标是 Windows 10 + Chrome，而不是 Windows 7/IE11。 | 不需要为 IE11 输出 ES5/legacy 包，也不必因为服务器是 Windows 7 而放弃现代 CSS、ES modules 或组件框架；仍应记录实际 Chrome 版本并做验收。 |
| 计算位置 | 页面脚本在访问者的浏览器中执行；这意味着参数输入、公式计算和结果刷新不必请求服务器（这是基于静态客户端架构的推断）。[HTML Scripting](https://html.spec.whatwg.org/multipage/scripting.html) | 将计算模块设计为纯函数，nginx 只承担静态资源传输，能把服务器性能压力降到最低。 |

## 2. 候选实现方案

### 方案 A：Vite + vanilla JavaScript/TypeScript（推荐基线）

结构可以保持很小：

```text
src/
  calculator.ts   # 纯计算、单位转换、边界检查
  ui.ts           # 读取表单、刷新 output、显示错误
  styles.css      # 响应式布局和主题
index.html
```

Vite 官方说明其 build 命令会把代码打包成优化后的生产静态资源；`dist` 可以直接部署到服务器。当前 Vite 文档要求 Node.js 20.19+ 或 22.12+，因此应把 Node/Vite 当作构建机或 CI 的工具，不要把它们作为 Windows 7 的线上运行时。[Vite Getting Started](https://vite.dev/guide/)、[Vite Building for Production](https://vite.dev/guide/build)、[Vite Static Deployment](https://vite.dev/guide/static-deploy.html)

适合本项目的实现方式：

- 公式函数不依赖 DOM；同一组输入可以用单元测试验证，UI 只是把表单值映射到计算函数。
- 使用一个主页面、一个主脚本和一个主 CSS，避免为简单计算引入路由、SSR、后端 API 或大型组件库。
- 在 `index.html` 中使用语义化 `<form>`、`<label>`、`<output>` 和按钮；输出结果、单位和错误状态始终可见。
- 客户端是 Windows 10 + Chrome，可以使用 Vite 当前默认生产目标（Chrome/Edge 111+、Firefox 114+、Safari 16.4+），或在已知 Chrome 版本固定时设置更明确的 `build.target`。Vite 默认只处理语法转换，不自动覆盖所有 polyfill；当前目标浏览器应在验收时记录。[Vite Browser Compatibility](https://vite.dev/guide/build)
- 若必须覆盖更老的浏览器，Vite 官方说明 `@vitejs/plugin-legacy` 可生成 legacy chunks 和相应的 ECMAScript polyfills；同时应检查项目依赖及 CSS，而不能只凭插件名称宣称完整兼容。[Vite Browser Compatibility](https://vite.dev/guide/build)

优点是代码边界清楚、运行时负担小、静态部署简单；缺点是需要一个不在 Windows 7 上的构建环境，并需自行设计组件拆分、表单状态和兼容策略。

### 方案 B：无构建的原生 HTML/CSS/JavaScript

直接部署 `index.html`、`app.js`、`styles.css` 和本地资源，不需要 Node、npm 或构建服务。HTML 标准说明外部 classic script 可以使用 `defer`，在解析完成后执行；同时标准提供 `type="module"` 与 `nomodule` 的现代/旧浏览器分流模式。[HTML `script` element](https://html.spec.whatwg.org/multipage/scripting.html)

这条路线也可以通过以下方式接近现代体验；它主要作为无法在其他机器构建时的备用方案：

- 采用语义化表单、CSS Flexbox/Grid、CSS custom properties、响应式 media queries 和少量 CSS transition。
- 基础 CSS 先提供可用布局，再用 `@supports` 添加增强样式；MDN 说明 `@supports` 可以按浏览器是否支持某个 CSS 声明来应用规则。[MDN `@supports`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40supports)
- 如果未来出现旧客户端，再针对实际浏览器增加基础 CSS 或 legacy 构建；MDN 明确指出 `var(--x, fallback)` 不能修复完全不支持 CSS custom properties 的浏览器，应提供真正的基础声明或构建时降级。[MDN CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)
- 代码可以直接写成 ES5 风格，或使用一台现代机器上的 Babel/压缩工具生成 classic bundle。Babel 官方说明 `@babel/preset-env` 可依据目标环境选择语法转换，并可按目标注入 polyfill；Browserslist 可用于声明目标浏览器。[Babel preset-env](https://babeljs.io/docs/babel-preset-env)

优点是对部署主机最友好、故障面最小；缺点是没有模块化构建、类型检查、自动分包和自动 polyfill，项目变大后维护成本会明显增加。

### 方案 C：Preact + Vite（轻量组件路线）

Preact 官方文档提供两条路线：可以直接在浏览器中使用而不需要构建，也可以使用 Vite；JSX 需要构建步骤，Vite build 完成后会产生可直接部署的 `dist/`。[Preact Getting Started](https://preactjs.com/guide/v10/getting-started/)

Preact 官方还说明其核心使用浏览器标准 `addEventListener`，并以尺寸和性能为理由不实现 React 的 synthetic event system。[Preact Differences to React](https://preactjs.com/guide/v10/differences-to-react/)

浏览器兼容性要按版本锁定：Preact 11.x 的官方支持表从 Edge 12、Chrome 40、Firefox 36、Safari 9 开始；官方同时说明较老浏览器可使用 polyfill，或使用支持 IE11 的 Preact 10.x。[Preact Browser Support](https://preactjs.com/about/browser-support/)

适合：输入项会动态增删、需要多个可复用面板、保存多个链路场景、结果表格存在较多条件渲染，但仍希望客户端包保持克制。对当前“表单 + 结果”规模，Preact 是可选而非必需；若选择它，优先使用本地打包产物，不依赖线上 CDN。

### 方案 D：Vue 3 + Vite 或 Vue CDN

Vue 官方把 Vue 定义为建立在标准 HTML/CSS/JavaScript 之上的声明式、组件化框架，支持从增强静态 HTML 到 SPA 的渐进式采用；Vue SFC 适合使用构建工具的项目。[Vue Introduction](https://vuejs.org/guide/introduction)

Vue 官方还提供两种部署前端方式：用 `npm run build` 生成 `dist/`，或者通过 CDN 使用 global build；CDN 文件也可以下载后自行提供，因此可以把依赖放在 nginx 的同源静态目录中。[Vue Quick Start](https://vuejs.org/guide/quick-start.html)

关键限制是：Vue 3 官方 FAQ 声明它只支持具有原生 ES2016 支持的浏览器，不包括 IE11；Vue 2 已结束支持，不能因为旧浏览器需求而把 Vue 2 当作新的长期基线。[Vue FAQ](https://vuejs.org/about/faq)、[Vue Introduction](https://vuejs.org/guide/introduction)

适合：团队已有 Vue 能力，未来会增加大量动态行、复杂状态、多个视图或可复用组件。当前客户端是 Windows 10 + Chrome，因此 Vue 3 的 IE11 限制不会影响已知目标；对于单一链路预算页面，它仍可能比 vanilla 引入更多运行时和工程依赖。

### 方案 E：Svelte 5 + Vite/SvelteKit 静态输出

Svelte 官方说明它使用 compiler，把 HTML/CSS/JavaScript 组件转换为在浏览器中少做工作的代码。[Svelte Overview](https://svelte.dev/docs/svelte/overview)

但 Svelte 的浏览器边界必须写进决策：官方支持表列出 Svelte 本身最低为 Chrome/Edge 87、Firefox 83、Safari 14，Internet Explorer 不支持；Svelte 5 迁移指南进一步说明它需要现代浏览器，旧的 IE-friendly `legacy` compiler option 已不存在。[Svelte Browser Support](https://svelte.dev/docs/svelte/browser-support)、[Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)

适合：界面最终会变成较复杂的组件系统，团队更喜欢编译器驱动的 UI。当前 Chrome 客户端可以使用它，但对于当前需求，它比 vanilla/Preact 更像“为未来复杂度购买的生产力”，不应因为服务器性能差就误以为它会降低 nginx 的静态文件服务负担。

### 方案 F：服务端应用（Node/ASP.NET/PHP 等）

在当前假设下不推荐。链路预算计算可以由客户端脚本完成，服务器没有必要参与每次计算；加入服务端运行时只会引入安装、进程、补丁、连接和日志等额外面。只有当需求增加账号、中心化方案、权限、审计、共享数据或服务端可信计算时，才值得另行评估服务端架构。

## 3. 轻量而现代的 UI 设计建议

### 表单与计算

用原生 HTML 控件表达领域约束：频率、距离、功率、增益、损耗、带宽等使用带单位的 number/range 控件，配合 `min`、`max`、`step`、`required`；HTML 标准定义了 `type=number` 的数值语义、浮点值校验和 step 约束，表单还提供 `checkValidity()` / `reportValidity()`。[HTML Number state](https://html.spec.whatwg.org/multipage/input.html#number-state-(type=number))、[HTML Constraint validation](https://html.spec.whatwg.org/multipage/forms.html#the-constraint-validation-api)

建议的交互结构：

- 左侧或上方是“链路参数”分组；右侧或下方是“结果摘要”和“逐项预算表”。窄屏时自动堆叠。
- 输入变更后即时刷新结果，但保留一个清晰的“重置”按钮；无效输入时显示字段级错误，不显示 `NaN` 或静默的错误结果。
- 每个数值都显示单位，并在结果中区分 dB、dBm、Hz、km 等；计算模块只接收经过解析的数值和单位。
- 将公式、默认值、显示格式和四舍五入策略集中定义，避免把计算散落在组件事件处理器中。

### 视觉层

- 先用简单的 Flexbox 或 Grid 做布局；不要为卡片、弹窗、表格引入大型 UI 库。
- 用 CSS custom properties 集中维护颜色、间距、圆角和阴影；为旧浏览器先写固定值，再在 `@supports` 中增强。MDN 说明 custom properties 可复用和继承，但不支持它们的浏览器不会被 `var()` fallback 修复。[MDN CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)
- 动画只用于状态反馈，例如结果更新的短暂高亮；用 `@media (prefers-reduced-motion: reduce)` 关闭或减弱非必要运动。该 media feature 是 W3C Media Queries 5 定义的用户偏好机制。[W3C Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/)、[W3C C39 reduced motion](https://www.w3.org/WAI/WCAG21/Techniques/css/C39.html)
- 图标优先使用内联 SVG 或 CSS，避免加载图标字体和外部字体。这个选择是针对 Windows 7 nginx 主机、网络延迟和首屏体积的工程建议，不是框架的强制要求。

### 本地保存与离线

可以把“最近一次输入”和少量命名方案保存到 `localStorage`。Web Storage 按 origin 隔离，`localStorage` 跨浏览器重启保留；但 MDN 说明 Web Storage 是同步 API，因此只保存小型 JSON，并用 try/catch 处理被禁用或配额不足的情况。[WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html)、[MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)

Service Worker 不是首版必需品。若以后需要离线打开，MDN 说明 Service Worker 只在 secure context 可用，通常要求 HTTPS（`http://localhost` 为开发例外），因此要先确认 nginx 的 HTTPS 配置和证书。[MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## 4. 构建与部署流程

### 推荐的 Vite + nginx 流程

1. 在较新的开发机或 CI 安装 Node/Vite，使用 `vanilla` 或 `vanilla-ts` 模板；当前 Vite 要求 Node.js 20.19+ 或 22.12+，所以不要把 Node/Vite 安装为 Windows 7 主机上的线上依赖。[Vite Getting Started](https://vite.dev/guide/)
2. 执行 `npm run build`，得到 `dist/`。Vite 官方说明生产包适合静态托管；`vite preview` 只用于本地预览，不是生产服务器。[Vite Building for Production](https://vite.dev/guide/build)、[Vite Static Deployment](https://vite.dev/guide/static-deploy.html)
3. 将 `dist/` 内容复制到 nginx 的网站根目录，使用 `root` 和 `index index.html` 提供入口。nginx 官方入门文档明确展示了这种静态文件服务方式。[nginx Beginner’s Guide](https://nginx.org/en/docs/beginners_guide.html)、[nginx index module](https://nginx.org/en/docs/http/ngx_http_index_module.html)
4. 本项目首版是单页，不使用前端路由时不需要额外回退；若以后增加 history 路由，在 nginx 中用 `try_files $uri $uri/ /index.html;`，并用实际路径测试刷新和深链接。[nginx core module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
5. 为 JS/CSS/SVG 等文本资源启用 gzip；对 Vite 生成的带 hash 资源设置长缓存，对 `index.html` 保持短缓存。nginx 官方提供 gzip、`expires` 和预压缩文件能力，具体缓存策略应在发布后检查响应头。[nginx gzip module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html)、[nginx static gzip module](https://nginx.org/en/docs/http/ngx_http_gzip_static_module.html)、[nginx request processing](https://nginx.org/en/docs/http/request_processing.html)
6. 发布时先运行 `nginx -t`，通过 `nginx -s reload` 重新加载配置；再验收实际 Chrome 版本、HTTPS、虚拟目录和多用户同时打开页面的情况。[Controlling nginx](https://nginx.org/en/docs/control.html)

### 无构建流程

如果构建环境也只能是 Windows 7，则把生产目录保持为可直接服务的文件：经典 `app.js`、一份 CSS、一份 HTML，以及本地 SVG。通过 `defer` 避免脚本阻塞 HTML 解析；但在已知客户端为 Windows 10 + Chrome 的前提下，无构建主要是部署便利性选择，而不是兼容性要求。[HTML `script` processing](https://html.spec.whatwg.org/multipage/scripting.html)

无构建不是“不能现代化”，而是把现代化限定在 CSS、HTML 和少量 JavaScript 交互上。它适合首个版本，尤其适合先验证链路公式与输入模型；当代码开始需要组件复用或兼容构建时，再迁移到 Vite。

## 5. 浏览器兼容策略

| 客户端基线 | 推荐输出 | 主要注意事项 |
| --- | --- | --- |
| Windows 10 + 当前 Chrome | Vite 默认生产包或 Vite + vanilla/Preact/Vue/Svelte | Vite 当前默认 target 面向 Chrome/Edge 111+、Firefox 114+、Safari 16.4+；记录实际 Chrome 版本并做一次真实环境验收即可。[Vite Build](https://vite.dev/guide/build) |
| Windows 10 + 固定的较旧 Chrome | Vite + vanilla/Preact/Vue，设置明确 target 并测试 | 不要仅按操作系统判断兼容性，应按 Chrome 的实际大版本设置目标；若低于 Vite 的原生 ESM/import.meta 边界，应使用 legacy 构建或回退到 classic bundle。[Vite Build](https://vite.dev/guide/build) |
| 未来需要 IE11 或其他旧浏览器 | 单独的 classic/legacy 输出 | 这不是当前需求。若以后发生，应重新评估 Babel/polyfill、CSS fallback 和 Preact 10.x；不要让首版为尚未提出的 IE11 需求增加复杂度。[Babel preset-env](https://babeljs.io/docs/babel-preset-env)、[Preact Browser Support](https://preactjs.com/about/browser-support/) |
| JavaScript 被禁用或加载失败 | 显示可读的静态说明和公式/单位信息 | HTML 标准鼓励应用在没有脚本时 graceful degradation；但真正的即时链路计算仍需要脚本，因此应明确显示“需要启用 JavaScript”，而不是显示空结果。[HTML Scripting](https://html.spec.whatwg.org/multipage/scripting.html) |

## 6. 决策矩阵

| 方案 | Windows 7 + nginx 主机负担 | Windows 10 + Chrome 适配 | 构建/部署复杂度 | 对当前需求的判断 |
| --- | --- | --- | --- | --- |
| 无构建 vanilla | 最低；仅静态文件 | 好 | 最低部署复杂度，维护保障较少 | **只有构建环境也受限时选择** |
| Vite + vanilla JS/TS | 线上最低；构建只发生在开发机/CI | 好；可使用现代浏览器能力 | 中等，但 `dist` 部署简单 | **默认首选** |
| Preact + Vite | 线上仍为静态文件 | 好；运行时较轻 | 中等；JSX 需要构建 | **组件数量增长时选择** |
| Vue 3 + Vite/CDN | 线上仍为静态文件 | 好；当前客户端不触发 IE11 限制 | 中等到较高；CDN 可免构建但应自托管 | **Vue 团队或复杂表单优先** |
| Svelte 5 + Vite | 线上仍为静态文件 | 好；当前 Chrome 满足其现代浏览器边界 | 中等到较高；编译器带来构建依赖 | **复杂 UI 且团队熟悉 Svelte 时考虑** |
| Node/ASP.NET/PHP 服务端应用 | 需要服务端运行时和进程 | 可用服务端 HTML，但当前需求不需要 | 最高；与 Win7 风险冲突 | **当前需求暂不选** |

矩阵中的“负担”指线上主机是否需要运行应用服务器/运行时，不等同于客户端下载后的浏览器 CPU；“适配”指已知客户端边界，最终仍需在目标 Chrome 上测试。

## 7. 最终建议与决策门

### 建议的第一版

采用 **Vite + vanilla TypeScript（或 vanilla JavaScript）+ 原生 HTML/CSS**：

- `calculator` 模块只处理单位转换、自由空间损耗、增益/损耗求和、接收电平、余量等领域计算；每一步返回带单位和可解释名称的结果。
- `ui` 模块负责读取表单、调用纯函数、更新 `<output>` 和错误消息；不把公式写进模板或事件处理器。
- 视觉上使用响应式双栏/单栏布局、固定主题变量、原生表单控件、少量状态动画和 reduced-motion 分支。
- 资源保持为一个主 JS、一个 CSS、少量内联 SVG；避免外部 CDN、web font 和大型图表库，把首屏请求数控制在很少的数量。这是根据 Windows 7 nginx 的性能/可扩展性边界和实际网络环境作出的工程建议。
- 开发机执行构建，nginx 只发布 `dist`；不要在 Win7 上运行 Vite dev server 或把 `vite preview` 当成生产服务器。[Vite Static Deployment](https://vite.dev/guide/static-deploy.html)、[nginx for Windows](https://nginx.org/en/docs/windows.html)

### 两个必须先确认的门槛

1. **Chrome 基线**：记录部署现场的 Chrome 大版本；如果是当前 Chrome，Vite 默认产物即可，通常不需要 legacy/polyfill 构建。
2. **公网还是内网**：若公网，Windows 7 的生命周期和 nginx Windows 版本的性能/可扩展性限制应视为风险；若只能保留 Win7，应优先使用隔离网络或现代前置层，并准备迁移计划。[Windows 7 Lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-7)、[nginx for Windows](https://nginx.org/en/docs/windows.html)

## 主要一手资料索引

- [Microsoft Windows 7 Lifecycle](https://learn.microsoft.com/en-us/lifecycle/products/windows-7)
- [nginx for Windows](https://nginx.org/en/docs/windows.html)
- [nginx Beginner’s Guide](https://nginx.org/en/docs/beginners_guide.html)
- [nginx core module](https://nginx.org/en/docs/http/ngx_http_core_module.html)
- [nginx index module](https://nginx.org/en/docs/http/ngx_http_index_module.html)
- [nginx gzip module](https://nginx.org/en/docs/http/ngx_http_gzip_module.html)
- [Controlling nginx](https://nginx.org/en/docs/control.html)
- [WHATWG HTML Scripting](https://html.spec.whatwg.org/multipage/scripting.html)
- [WHATWG HTML forms and constraint validation](https://html.spec.whatwg.org/multipage/forms.html#the-constraint-validation-api)
- [WHATWG HTML number input](https://html.spec.whatwg.org/multipage/input.html#number-state-(type=number))
- [WHATWG Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html)
- [MDN `@supports`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40supports)
- [MDN CSS custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)
- [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [MDN Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [W3C Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/)
- [W3C reduced-motion technique](https://www.w3.org/WAI/WCAG21/Techniques/css/C39.html)
- [Vite Getting Started](https://vite.dev/guide/)
- [Vite Building for Production](https://vite.dev/guide/build)
- [Vite Static Deployment](https://vite.dev/guide/static-deploy.html)
- [Babel preset-env](https://babeljs.io/docs/babel-preset-env)
- [Preact Getting Started](https://preactjs.com/guide/v10/getting-started/)
- [Preact Differences to React](https://preactjs.com/guide/v10/differences-to-react/)
- [Preact Browser Support](https://preactjs.com/about/browser-support/)
- [Vue Introduction](https://vuejs.org/guide/introduction)
- [Vue Quick Start](https://vuejs.org/guide/quick-start.html)
- [Vue FAQ](https://vuejs.org/about/faq)
- [Svelte Overview](https://svelte.dev/docs/svelte/overview)
- [Svelte Browser Support](https://svelte.dev/docs/svelte/browser-support)
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
