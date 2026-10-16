# 博雅学习浮窗源码

正式使用只需构建生成的 `.user.js`，无第三方运行时依赖。

开发环境：Node.js 22 或更高。`npm install` 后执行 `npx playwright install chromium` 安装用于模拟测试的浏览器。

可复制 `config.example.json` 为 `config.json`，调整构建输出目录；不提供配置时输出到本项目的 `dist/`。若使用已安装的 Chrome，可在配置中指定 `browserExecutable` 的绝对路径；否则使用 Playwright 管理的 Chromium。配置错误会在构建或测试开始时显示。

```
npm run build
npm test
npm run test:browser
npm run test:preview
```

`src/core.js` 负责编码、加解密和负载修改；`src/runtime.js` 负责页面请求捕获与生命周期；`src/panel.js` 负责浮窗。所有浏览器测试都使用模拟接口，不连接真实学习平台。`config.json` 包含本机路径，不进入分发包。

`design/index.html` 记录需求、实现决定及验证范围。真实平台登录后的接口兼容性尚待验证；截图与离线演示均为模拟数据。
