# Obsidian Vault Lens

[![GitHub release](https://img.shields.io/github/v/release/leo-su-zhan/obsidian-vault-lens)](https://github.com/leo-su-zhan/obsidian-vault-lens/releases)

A plugin for Obsidian that previews **docx / xlsx / pptx / code files** directly in the editor. Supports zoom, inline editing, line numbers, and sheet tabs.

## Features

### 📄 Office Files

| Type | Capabilities |
|---|---|
| **DOCX** | Headings, tables, images, page-break separators, centered/right-aligned text |
| **XLSX** | Font color/size/bold, cell fill colors, merged cells, column widths |
| **PPTX** | Visual rendering with backgrounds, shapes, and text positioning — PDF-like output |

### 💻 Code & Text Files

60+ developer file formats supported with preview and inline editing:

`.txt` `.sql` `.java` `.py` `.js` `.ts` `.jsx` `.tsx` `.json` `.xml` `.yaml` `.yml`
`.properties` `.cfg` `.ini` `.sh` `.bat` `.cmd` `.ps1` `.css` `.html` `.htm`
`.rst` `.tex` `.php` `.rb` `.go` `.rs` `.c` `.cpp` `.h` `.hpp` `.cs`
`.swift` `.kt` `.scala` `.groovy` `.pl` `.pm` `.lua` `.r` `.m` `.mm`
`.gradle` `.toml` `.conf` `.env` `.makefile` `.dockerfile` `.gitignore`
`.vue` `.sass` `.scss` `.less` `.styl` `.coffee` `.dart` `.erl` `.ex` `.exs`

**Line numbers · Edit & save · Ctrl+S shortcut · Zoom 25%–200%**

### 🔍 Common

- **Zoom** — Toolbar +/− buttons or Ctrl+scroll, reset to 1:1
- **Pan** — Drag to pan when zoomed in
- **Edit** — Click ✏️ Edit on any code file, modify, then 💾 Save
- **Sheet tabs** — Switch between XLSX sheets with tab headers

## Installation

### Community Plugin Store (pending review)

Open Obsidian → Settings → Community plugins → Search **Vault Lens** → Install.

### Manual

1. Download the latest release from [Releases](https://github.com/leo-su-zhan/obsidian-vault-lens/releases)
2. Copy `main.js`, `manifest.json`, `styles.css` into `.obsidian/plugins/vault-lens/`
3. Enable it in Obsidian settings

## Development

```bash
git clone https://github.com/leo-su-zhan/obsidian-vault-lens.git
cd obsidian-vault-lens
npm install
npm run dev      # watch mode
npm run build    # production build
```

## License

MIT
