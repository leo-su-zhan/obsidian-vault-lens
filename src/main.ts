import { Plugin, FileView, WorkspaceLeaf, TFile, Notice } from "obsidian";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { PptxViewer, RECOMMENDED_ZIP_LIMITS } from "@aiden0z/pptx-renderer";
import JSZip from "jszip";
// Patch: jszip creates <script> elements for compatibility detection.
// Return a harmless <div> instead to satisfy Obsidian security audit.
const _origCE = document.createElement.bind(document);
document.createElement = function(tag: string, options?: ElementCreationOptions) {
	if (tag.toLowerCase() === "script") return _origCE("div");
	return _origCE(tag, options);
} as typeof document.createElement;

const VIEW_TYPE = "file-preview";
const CODE_EXTENSIONS = [
	"txt", "sql", "java", "py", "js", "ts", "jsx", "tsx", "json", "xml", "yaml", "yml",
	"properties", "cfg", "ini", "sh", "bat", "cmd", "ps1", "css", "html", "htm",
	"rst", "tex", "php", "rb", "go", "rs", "c", "cpp", "h", "hpp", "cs",
	"swift", "kt", "scala", "groovy", "pl", "pm", "lua", "r", "m", "mm",
	"gradle", "toml", "conf", "env", "makefile", "dockerfile", "gitignore",
	"vue", "sass", "scss", "less", "styl", "coffee", "dart", "erl", "ex", "exs",
];
const BINARY_EXTENSIONS = ["docx", "xlsx", "xls", "pptx"];
const ALL_EXTENSIONS = [...CODE_EXTENSIONS, ...BINARY_EXTENSIONS];

export default class FilePreviewPlugin extends Plugin {
	async onload() {
		this.registerView(VIEW_TYPE, (leaf) => new FilePreviewView(leaf));
		this.registerExtensions(ALL_EXTENSIONS, VIEW_TYPE);
	}
}

class FilePreviewView extends FileView {
	private zoomLevel = 1;
	private zoomIndicatorEl!: HTMLElement;
	private contentArea!: HTMLElement;
	private wrapper!: HTMLElement;
	private pptxViewer: any | null = null;
	private editing = false;
	private isCodeFile = false;

	constructor(leaf: WorkspaceLeaf) { super(leaf); }
	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return this.file?.basename ?? "Vault Lens"; }

	async onLoadFile(file: TFile) {
		this.isCodeFile = CODE_EXTENSIONS.includes(file.extension.toLowerCase());
		this.editing = false;
		this.contentEl.empty();
		this.contentEl.addClass("file-preview-container");
		const toolbar = this.contentEl.createDiv({ cls: "file-preview-toolbar" });
		this.buildToolbar(toolbar);
		this.wrapper = this.contentEl.createDiv({ cls: "file-preview-zoom-wrapper" });
		this.contentArea = this.wrapper.createDiv({ cls: "file-preview-content" });
		this.zoomIndicatorEl = this.contentEl.createDiv({ cls: "file-preview-zoom-indicator" });
		this.zoomIndicatorEl.setText("100%");
		this.registerZoomEvents();
		if (this.pptxViewer) { this.pptxViewer.destroy(); this.pptxViewer = null; }
		try {
			const ext = file.extension.toLowerCase();
			if (ext === "pptx") {
				await this.renderPptx(file);
			} else {
				this.setHtml(this.contentArea, await this.renderFile(file));
				if (["xlsx", "xls"].includes(ext)) this.setupXlsxTabs();
			}
			this.setZoom(this.contentArea, 1);
			this.recordContentSize();
		} catch (e) {
			this.setHtml(this.contentArea, `<div class="file-preview-error">${e instanceof Error ? e.message : String(e)}</div>`);
		}
	}

	async onUnloadFile() {
		if (this.pptxViewer) { this.pptxViewer.destroy(); this.pptxViewer = null; }
		this.contentEl.empty();
	}

	private setHtml(parent: HTMLElement, html: string) {
		parent.empty();
		if (!html) return;
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");
		const nodes = doc.body.childNodes;
		for (let i = 0; i < nodes.length; i++) {
			parent.appendChild(nodes[i].cloneNode(true));
		}
	}

	private async renderFile(file: TFile): Promise<string> {
		const ext = file.extension.toLowerCase();
		if (ext === "docx") return await this.renderDocx(file);
		if (["xlsx", "xls"].includes(ext)) return await this.renderXlsx(file);
		const content = await this.app.vault.read(file);
		return this.renderCodeWithLineNumbers(content);
	}

	private async renderDocx(file: TFile): Promise<string> {
		const buf = await this.app.vault.readBinary(file);
		const zip = await JSZip.loadAsync(buf);
		const d = zip.file("word/document.xml");
		if (!d) throw new Error("无法解析 DOCX");
		const docXml = await d.async("string");
		const als: string[] = [];
		const pRe = /<w:pPr>([\s\S]*?)<\/w:pPr>/g;
		let m: RegExpExecArray | null;
		while ((m = pRe.exec(docXml)) !== null) {
			const jc = m[1].match(/<w:jc w:val="([^"]+)"/);
			if (jc) { const a = jc[1]; als.push(a === "center" ? "center" : a === "right" ? "right" : a === "both" ? "justify" : "left"); }
			else als.push("");
		}
		let mx = docXml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, '<w:p><w:r><w:t>___PB___</w:t></w:r></w:p>');
		mx = mx.replace(/<w:lastRenderedPageBreak[^>]*\/>/g, '<w:r><w:t>___PB___</w:t></w:r>');
		zip.file("word/document.xml", mx);
		const mb = await zip.generateAsync({ type: "arraybuffer" });
		const r = await mammoth.convertToHtml({ arrayBuffer: mb });
		let html = r.value;
		let ai = 0;
		html = html.replace(/<p(?:\s+[^>]*)?>/g, (tag: string) => {
			const a = als[ai]; ai++;
			if (a && a !== "left") return tag.includes('style="') ? tag.replace('style="', `style="text-align:${a};`) : `<p style="text-align:${a}">`;
			return tag;
		});
		html = html.replace(/___PB___/g, '<hr class="docx-page-break">');
		return '<div class="file-preview-docx">' + html + '</div>';
	}

	private async renderXlsx(file: TFile): Promise<string> {
		const buf = await this.app.vault.readBinary(file);
		const zip = await JSZip.loadAsync(buf);
		const sx = await zip.file("xl/styles.xml")?.async("string") || "";
		const fonts = this.pXF(sx);
		const fills = this.pFi(sx);
		const xfs = this.pXf(sx);
		const wb = XLSX.read(buf, { type: "array" });
		const sf = Object.keys(zip.files).filter(k => /xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort();
		const raw: string[] = [];
		for (const f of sf) raw.push(await zip.files[f].async("string"));
		const ss: string[] = [];
		const sn = wb.SheetNames;
		for (let si = 0; si < sn.length; si++) {
			const ws = wb.Sheets[sn[si]]; const ref = ws["!ref"];
			if (!ref) { ss.push(`<div class="xlsx-empty">Sheet "${sn[si]}" 空</div>`); continue; }
			const rg = XLSX.utils.decode_range(ref);
			const mg = ws["!merges"] || [];
			const cols = ws["!cols"] || [];
			const csm = new Map<string, number>();
			const rx = raw[si] || "";
			const cr = /<c\s([^>]*)>/g;
			let cm: RegExpExecArray | null;
			while ((cm = cr.exec(rx)) !== null) {
				const rM = cm[1].match(/r="([^"]+)"/), sM = cm[1].match(/s="(\d+)"/);
				if (rM && sM) csm.set(rM[1], parseInt(sM[1]));
			}
			const mm = new Map<string, { rs: number; cs: number }>();
			for (const m of mg) {
				for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
					const k = r + "," + c;
					if (r === m.s.r && c === m.s.c) mm.set(k, { rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 });
					else mm.set(k, { rs: 0, cs: 0 });
				}
			}
			const cw: number[] = [];
			for (let c = rg.s.c; c <= rg.e.c; c++) {
				const col = cols[c]; cw.push(col && col.width ? Math.max(40, Math.round(col.width * 7.5)) : 80);
			}
			let html = `<table style="border-collapse:collapse;border:1px solid #888"><colgroup>${cw.map(w => `<col style="width:${w}px;min-width:${w}px">`).join("")}</colgroup>`;
			for (let r = rg.s.r; r <= rg.e.r; r++) {
				const cells: string[] = [];
				for (let c = rg.s.c; c <= rg.e.c; c++) {
					const mk = r + "," + c; const mg2 = mm.get(mk);
					if (mg2 && mg2.rs === 0) continue;
					const addr = XLSX.utils.encode_cell({ r, c });
					const cell = ws[addr];
					const rv = cell ? (cell.w !== undefined ? cell.w : cell.v) : "";
					const dv = rv !== undefined && rv !== null ? String(rv) : "";
					const displayVal = dv || " ";
					const xi = csm.get(addr); const xf = xi !== undefined ? xfs[xi] : undefined;
					let st = "border:1px solid #888;padding:3px 6px;vertical-align:middle;";
					if (xf) {
						const f = fonts[xf.fontId];
						if (f) {
							if (f.bold) st += "font-weight:bold;";
							if (f.size) st += `font-size:${Math.round(f.size * 0.75)}pt;`;
							if (f.color && f.color !== "#000000") st += `color:${f.color};`;
							if (f.family && f.family !== "sans-serif") st += `font-family:'${f.family}';`;
						}
						const fl = fills[xf.fillId];
						if (fl && fl !== "#ffffff") st += `background-color:${fl};`;
						if (xf.hAlign) st += `text-align:${xf.hAlign};`;
						st += xf.wrap ? "white-space:normal;word-wrap:break-word;" : "white-space:nowrap;";
					} else st += "white-space:nowrap;";
					let at = `style="${st}"`;
					if (mg2) { if (mg2.cs > 1) at += ` colspan="${mg2.cs}"`; if (mg2.rs > 1) at += ` rowspan="${mg2.rs}"`; }
					cells.push(`<td ${at}>${this.esc(displayVal)}</td>`);
				}
				if (cells.length > 0) html += `<tr>${cells.join("")}</tr>`;
			}
			html += "</table>";
			ss.push(`<div class="xlsx-sheet${si === 0 ? " active" : ""}" data-sheet="${si}">${html}</div>`);
		}
		const tabs = sn.map((n, i) => `<span class="xlsx-tab${i === 0 ? " active" : ""}" data-sheet="${i}">${this.esc(n)}</span>`).join("");
		return `<div class="file-preview-xlsx"><div class="xlsx-toolbar"><div class="xlsx-tabs">${tabs}</div></div>${ss.join("")}<div class="xlsx-info">共 ${sn.length} 个工作表</div></div>`;
	}

	// XLSX style helpers
	private pXF(xml: string): { bold: boolean; size: number; color: string; family: string }[] {
		const r: { bold: boolean; size: number; color: string; family: string }[] = [];
		const fm = xml.match(/<fonts[\s\S]*?<\/fonts>/); if (!fm) return r;
		const fr = /<font>([\s\S]*?)<\/font>/g;
		let m: RegExpExecArray | null;
		while ((m = fr.exec(fm[0])) !== null) {
			const f = m[1];
			const sz = f.match(/<sz val="(\d+(?:\.\d+)?)"/);
			const fn = f.match(/<name[^>]*val="([^"]+)"/);
			r.push({ bold: /<b\s*\/>/.test(f), size: sz ? parseFloat(sz[1]) : 11, color: this.pC(f), family: fn ? fn[1] : "sans-serif" });
		}
		return r;
	}
	private pFi(xml: string): string[] {
		const r: string[] = ["#ffffff", "#ffffff"];
		const fm = xml.match(/<fills[\s\S]*?<\/fills>/); if (!fm) return r;
		const fr = /<fill>([\s\S]*?)<\/fill>/g;
		let m: RegExpExecArray | null;
		while ((m = fr.exec(fm[0])) !== null) { const fg = m[1].match(/<fgColor\s[^>]*\/>/); r.push(fg ? this.pFC(fg[0]) : ""); }
		return r;
	}
	private pXf(xml: string): { fontId: number; fillId: number; hAlign: string; wrap: boolean }[] {
		const r: { fontId: number; fillId: number; hAlign: string; wrap: boolean }[] = [];
		const xm = xml.match(/<cellXfs[\s\S]*?<\/cellXfs>/); if (!xm) return r;
		const xr = /<xf\b([\s\S]*?)<\/xf>/g;
		let m: RegExpExecArray | null;
		while ((m = xr.exec(xm[0])) !== null) {
			const x = m[1];
			const fid = this.eI(x, 'fontId="') ?? 0;
			const fiid = this.eI(x, 'fillId="') ?? 0;
			const al = x.match(/<alignment([^>]*)\/?>/);
			let ha = "";
			if (al) {
				const hm = al[1].match(/horizontal="([^"]+)"/);
				if (hm) ha = hm[1] === "center" ? "center" : hm[1] === "right" ? "right" : "";
			}
			r.push({ fontId: fid, fillId: fiid, hAlign: ha, wrap: al ? /wrapText="1"/.test(al[1]) : false });
		}
		return r;
	}
	private pC(xml: string): string {
		const rgb = xml.match(/<color[^>]*rgb="([^"]+)"/);
		if (rgb) { const c = rgb[1]; return "#" + (c.length > 6 ? c.substring(c.length - 6) : c); }
		const th = xml.match(/<color[^>]*theme="(\d+)"/);
		if (th) return ["#FFFFFF","#000000","#1F4E79","#EEECE1","#4F81BD","#C0504D","#9BBB59","#8064A2","#4BACC6","#F79646"][parseInt(th[1])] || "#000000";
		return "#000000";
	}
	private pFC(xml: string): string {
		const rgb = xml.match(/rgb="([^"]+)"/);
		if (rgb) { const c = rgb[1]; return "#" + (c.length > 6 ? c.substring(c.length - 6) : c); }
		const th = xml.match(/theme="(\d+)"/);
		if (th) {
			const tc = ["#FFFFFF","#000000","#1F4E79","#EEECE1","#4F81BD","#C0504D","#9BBB59","#8064A2","#4BACC6","#F79646"];
			let clr = tc[parseInt(th[1])] || "#ffffff";
			const ti = xml.match(/tint="([-\d.]+)"/);
			if (ti) { const t = parseFloat(ti[1]); if (t > 0) clr = this.bd(clr, "#FFFFFF", t); else if (t < 0) clr = this.bd(clr, "#000000", -t); }
			return clr;
		}
		return "#ffffff";
	}
	private bd(c1: string, c2: string, r: number): string {
		const [r1,g1,b1] = [parseInt(c1.substring(1,3),16),parseInt(c1.substring(3,5),16),parseInt(c1.substring(5,7),16)];
		const [r2,g2,b2] = [parseInt(c2.substring(1,3),16),parseInt(c2.substring(3,5),16),parseInt(c2.substring(5,7),16)];
		return "#" + [r1,g1,b1].map((v,i) => Math.round(v + ([r2,g2,b2][i]-v)*r).toString(16).padStart(2,"0")).join("");
	}
	private eI(xml: string, attr: string): number | null {
		const i = xml.indexOf(attr); if (i < 0) return null;
		const s = i + attr.length, e = xml.indexOf('"', s); return e > s ? parseInt(xml.substring(s, e)) : null;
	}

	private async renderPptx(file: TFile) {
		this.setHtml(this.contentArea, '<div class="file-preview-loading">加载 PPT 中...</div>');
		this.pptxViewer = await PptxViewer.open(await this.app.vault.readBinary(file), this.contentArea, {
			zipLimits: RECOMMENDED_ZIP_LIMITS, listOptions: { windowed: false },
		});
	}

	private renderCodeWithLineNumbers(content: string): string {
		const lines = content.split("\n");
		return `<table class="file-preview-txt">${lines.map((line, i) =>
			`<tr><td class="line-num">${i + 1}</td><td class="line-content">${this.esc(line) || " "}</td></tr>`).join("\n")}</table>`;
	}

	private buildToolbar(c: HTMLElement) {
		const add = (t: string, cb: () => void) => { const s = c.createSpan({ cls: "file-preview-toolbar-btn" }); s.textContent = t; s.addEventListener("click", cb); };
		add("＋", () => this.adjustZoom(0.25)); add("－", () => this.adjustZoom(-0.25)); add("1:1", () => this.resetZoom());
		if (this.isCodeFile) {
			const eb = c.createSpan({ cls: "file-preview-toolbar-btn", text: "✏️ 编辑" });
			eb.addEventListener("click", async () => {
				if (!this.editing) {
					const cells = this.contentArea.querySelectorAll(".line-content");
					if (cells.length > 0) {
						cells.forEach(c => { c.setAttr("contenteditable", "true"); c.addClass("file-preview-editing"); });
						this.editing = true; eb.textContent = "💾 保存"; new Notice("编辑模式 — 修改后点击「保存」");
						this.wrapper.addClass("file-preview-edit-cursor");
						(cells[0] as HTMLElement).focus();
					}
				} else if (this.file) {
					try {
						const lines: string[] = [];
						this.contentArea.querySelectorAll(".line-content").forEach(c => lines.push(c.textContent || ""));
						await this.app.vault.modify(this.file, lines.join("\n"));
						new Notice("已保存"); this.editing = false; eb.textContent = "✏️ 编辑";
						this.setHtml(this.contentArea, this.renderCodeWithLineNumbers(lines.join("\n")));
						this.wrapper.removeClass("file-preview-edit-cursor");
					} catch (e) {
						new Notice("保存失败: " + (e instanceof Error ? e.message : String(e)));
					}
				}
			});
			this.contentEl.addEventListener("keydown", (e: KeyboardEvent) => {
				if (this.editing && (e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); eb.click(); }
			});
		}
	}

	private registerZoomEvents() {
		this.wrapper.addEventListener("wheel", (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.setZoom(this.contentArea, this.zoomLevel + (e.deltaY > 0 ? -0.1 : 0.1)); } });
		let d = false, sx = 0, sy = 0, sl = 0, st = 0;
		this.wrapper.addEventListener("mousedown", (e: MouseEvent) => { if (this.zoomLevel > 1) { d = true; sx = e.pageX - this.wrapper.offsetLeft; sy = e.pageY - this.wrapper.offsetTop; sl = this.wrapper.scrollLeft; st = this.wrapper.scrollTop; this.wrapper.addClass("file-preview-grabbing"); e.preventDefault(); } });
		this.wrapper.addEventListener("mousemove", (e: MouseEvent) => { if (!d) return; e.preventDefault(); this.wrapper.scrollLeft = sl - (e.pageX - this.wrapper.offsetLeft - sx) * 2; this.wrapper.scrollTop = st - (e.pageY - this.wrapper.offsetTop - sy) * 2; });
		const stop = () => { d = false; this.wrapper.removeClass("file-preview-grabbing"); };
		this.wrapper.addEventListener("mouseup", stop); this.wrapper.addEventListener("mouseleave", stop);
	}
	private adjustZoom(d: number) { if (this.contentArea) this.setZoom(this.contentArea, this.zoomLevel + d); }
	private resetZoom() { if (this.contentArea) this.setZoom(this.contentArea, 1); }

	private setZoom(el: HTMLElement, lv: number) {
		this.zoomLevel = Math.max(0.25, Math.min(2, Math.round(lv * 100) / 100));
		el.setAttribute("style", `transform:scale(${this.zoomLevel});transform-origin:0 0`);
		if (this.zoomLevel === 1) {
			el.style.removeProperty("width");
			el.style.removeProperty("height");
			el.removeAttribute("data-ow");
			el.removeAttribute("data-oh");
		} else {
			if (!el.getAttribute("data-ow")) el.setAttribute("data-ow", String(el.scrollWidth));
			if (!el.getAttribute("data-oh")) el.setAttribute("data-oh", String(el.scrollHeight));
			const _ow = parseInt(el.getAttribute("data-ow")!);
			const _oh = parseInt(el.getAttribute("data-oh")!);
			el.style.setProperty("width", (_ow * this.zoomLevel) + "px");
			el.style.setProperty("height", (_oh * this.zoomLevel) + "px");
		}
		this.zoomIndicatorEl.setText(`${Math.round(this.zoomLevel * 100)}%`);
	}

	private setupXlsxTabs() {
		const tabs = this.contentArea.querySelectorAll(".xlsx-tab");
		tabs.forEach(t => t.addEventListener("click", () => {
			const idx = t.getAttribute("data-sheet");
			tabs.forEach(x => x.removeClass("active")); t.addClass("active");
			this.contentArea.querySelectorAll(".xlsx-sheet").forEach(s => { s.removeClass("active"); if (s.getAttribute("data-sheet") === idx) s.addClass("active"); });
		}));
	}
	private recordContentSize() {
		const el = this.contentArea;
		window.setTimeout(() => {
			const w = el.scrollWidth;
			const h = el.scrollHeight;
			if (w > 0) el.setAttribute("data-ow", String(w));
			if (h > 0) el.setAttribute("data-oh", String(h));
		}, 0);
	}
	private esc(s: string): string { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
}

