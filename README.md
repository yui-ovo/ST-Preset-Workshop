# 预设工坊

SillyTavern 预设、世界书、快照、收藏和正则管理扩展。

## 更新：2.98.63

月亮模式改用纯黑底，条目卡片、工具栏和悬浮面板使用不同深浅的灰色。

## 更新：2.98.62

完整模式下，长聊天逐字输出时，浏览器可以更快跳过工坊的毛玻璃样式。手机端只在相关界面变化时检查按钮，打开工坊也会跳过聊天里的文字，直接定位对比窗口。感谢 Sanj333 提交的[首轮性能优化](https://github.com/yui-ovo/ST-Preset-Workshop/pull/2)。

## 安装

启用酒馆助手后，在酒馆扩展中安装本仓库：`https://github.com/yui-ovo/ST-Preset-Workshop.git`。已安装用户直接更新原扩展即可。

## 开发检查

运行 `npm run check` 检查当前版本。`scripts/` 是开发测试与构建工具，插件运行时不会加载这些脚本。

性能回归与浏览器夹具说明见 [DOM 扫描的性能回归](docs/performance-regressions.md)。
