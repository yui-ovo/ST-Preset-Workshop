# 预设工坊 · page0x00 二改版

当前版本基于作者 [yui-ovo/ST-Preset-Workshop](https://github.com/yui-ovo/ST-Preset-Workshop) 的 **2.98.17**（`da6ecb1f2da2d7b0a9aa966095ab274f13a5d16a`），二改版本 **2.98.17-page0x00.1**。

保留作者完整功能，额外保留中控、四种美化、安卓拖动优化、条幅自适应宽度与文字裁切等必要自定义。安装依赖酒馆助手；请停用重复的旧脚本。

本版接入作者桌面双侧独立正文编辑器、当前快照覆盖／另存、手动全局调整保留，以及未保存实时开关读取。修复新编辑器与二改版融合时的正文字色继承、聊天／输入触发布局读取和卸载清理；冻结材质保持不变。[本版更新](docs/release-2.98.17-page0x00.1.md)、[整合与验证](docs/upstream-integration-20260919.md)。

此前 2.98.12 同步作者收藏批量拖放与快照应用修复：多选收藏一次保存，按可见顺序插入目标位置；应用快照关闭未记录条目，并避免同名条目误匹配。采用作者实现，冻结美化和既有交互优化保持不变。[整合与验证说明](docs/upstream-integration-20260915.md)。旧快照测试已更新为新版实际流程并纳入默认检查：[本版更新介绍](docs/release-2.98.12-page0x00.1.md)。

已验收的 **2.98.2-page0x00.3** 已由 page0x00 提交、推送到 `mine/二改版`（`4cb7eae`）：[简短更新介绍](docs/release-2.98.2-page0x00.3.md)。

作者 2.98.8 更新与日夜／皮肤过渡优化已获用户授权，由 page0x00 发布到 `mine/二改版`：[简短更新介绍](docs/release-2.98.8-page0x00.2.md)。

此前修复：减少大预设切换日夜／跟随主题时的动画开销，修复平板 Chrome 悬浮球吸附越界。[修复与验收说明](docs/theme-dock-repair-20260914.md)。

上一版 **2.98.8-page0x00.3**：缩小悬浮球吸附范围，向内轻拖即可脱离，边缘外观恢复作者窄条样式并跟随皮肤。已由 page0x00 发布到 `mine/二改版`：[更新内容](docs/release-2.98.8-page0x00.3.md)、[说明与验收](docs/floating-dock-20260914.md)。

此前 **2.98.8-page0x00.4**：优化手机日夜／美化切换与双面板比例拖拽，减少样式计算和拖动绘制开销，保留原有功能、材质与过渡效果。由 page0x00 发布到 `mine/二改版`：[简短更新介绍](docs/release-2.98.8-page0x00.4.md)、[本轮说明与验收](docs/phone-performance-20260914.md)。

- [此前作者 2.98.2 更新整合说明](docs/upstream-integration-20260912.md)
- [本地安卓流畅度与显示修复](docs/android-skin-tuning-20260911.md)

- [条幅名称、唯一条目入口与宽度保存修复](docs/banner-contract-20260912.md)

本轮正文颜色、自动宽度事件和真实浏览器验证：[修复与验收说明](docs/banner-body-verification-20260913.md)。
