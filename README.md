# Obsidian File Viewer

[![GitHub release](https://img.shields.io/github/v/release/leo-su-zhan/obsidian-file-viewer)](https://github.com/leo-su-zhan/obsidian-file-viewer/releases)

一个 Obsidian 插件，支持在 Obsidian 内直接预览 **docx / xlsx / pptx / 代码文件** 等常见文件。支持缩放、编辑保存、行号显示、工作表切换。

## 功能

### 📄 办公文件

| 类型 | 特性 |
|---|---|
| **DOCX** | 保留标题/表格/图片，分页虚线分割，居中/右对齐样式 |
| **XLSX** | 保留字体颜色/大小/加粗、单元格填充色、合并单元格、列宽 |
| **PPTX** | 视觉化渲染，保留背景图/文字位置/装饰形状，类似 PDF 导出 |

### 💻 代码/文本文件

支持 60+ 种常见开发文件类型的预览与编辑：

`.txt` `.sql` `.java` `.py` `.js` `.ts` `.jsx` `.tsx` `.json` `.xml` `.yaml` `.yml`
`.properties` `.cfg` `.ini` `.sh` `.bat` `.cmd` `.ps1` `.css` `.html` `.htm`
`.rst` `.tex` `.php` `.rb` `.go` `.rs` `.c` `.cpp` `.h` `.hpp` `.cs`
`.swift` `.kt` `.scala` `.groovy` `.pl` `.pm` `.lua` `.r` `.m` `.mm`
`.gradle` `.toml` `.conf` `.env` `.makefile` `.dockerfile` `.gitignore`
`.vue` `.sass` `.scss` `.less` `.styl` `.coffee` `.dart` `.erl` `.ex` `.exs`

**行号显示 · 编辑并保存 · Ctrl+S 快捷键 · 缩放 25%~200%**

### 🔍 通用特性

- **缩放** — 工具栏 +/− 按钮，Ctrl+滚轮快速缩放，1:1 复位
- **拖拽平移** — 缩放后按住鼠标拖拽查看内容
- **编辑文本** — 对代码文件点击「✏️ 编辑」，修改后点击「💾 保存」
- **工作表切换** — XLSX 多 sheet 场景，点击顶部标签切换

## 安装

### 社区插件市场（待上架）

打开 Obsidian → 设置 → 社区插件 → 搜索 **File Viewer** → 安装启用。

### 手动安装

1. 在 [Releases](https://github.com/leo-su-zhan/obsidian-file-viewer/releases) 下载最新版
2. 将 `main.js`、`manifest.json`、`styles.css` 放入 `.obsidian/plugins/file-viewer/`
3. 在 Obsidian 设置 → 社区插件中启用

## 开发

```bash
git clone https://github.com/leo-su-zhan/obsidian-file-viewer.git
cd obsidian-file-viewer
npm install
npm run dev      # 开发模式（监听）
npm run build    # 生产构建
```

## 许可证

MIT
