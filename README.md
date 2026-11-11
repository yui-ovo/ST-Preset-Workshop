# 预设工坊

SillyTavern 预设、世界书、快照、收藏和正则管理扩展。

## 更新：2.98.61

完整模式下，酒馆逐字显示回复时，工坊会跳过与自己无关的页面变化，减少后台扫描。桌面端选中或高亮条目时，也会跳过窗口缩放控件的检查。感谢 Sanj333 提交的[性能优化](https://github.com/yui-ovo/ST-Preset-Workshop/pull/2)。

## 安装

启用酒馆助手后，在酒馆扩展中安装本仓库：`https://github.com/yui-ovo/ST-Preset-Workshop.git`。已安装用户直接更新原扩展即可。

## 开发检查

运行 `npm run check` 检查当前版本。`scripts/` 是开发测试与构建工具，插件运行时不会加载这些脚本。

性能回归与浏览器夹具说明见 [DOM 扫描的性能回归](docs/performance-regressions.md)。
