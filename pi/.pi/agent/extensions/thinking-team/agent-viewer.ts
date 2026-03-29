/**
 * Thinking Team — Agent Panels Component
 *
 * Renders colored panels per agent showing real-time activity.
 * Two usage modes:
 *   - Widget mode (setWidget): compact grid above editor, no input capture
 *   - Overlay mode (custom): full-screen scrollable review with keyboard
 *
 * The component holds persistent state so it can be re-rendered at any time.
 */

import type { Component, TUI } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

// ─── Activity Entry ──────────────────────────────────────────────────────────

export interface ActivityEntry {
	agentId: string;
	agentLabel: string;
	type: "status" | "tool_call" | "text" | "thinking" | "done" | "error";
	text: string;
	timestamp: number;
}

// ─── Tool Call Formatting ────────────────────────────────────────────────────

export function formatToolSummary(toolName: string, args: Record<string, any>): string {
	const shorten = (p: string) => {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		return home && p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};
	switch (toolName) {
		case "read": {
			const p = shorten(args.path || args.file_path || "?");
			const o = args.offset, l = args.limit;
			let li = "";
			if (o !== undefined || l !== undefined) { const s = o ?? 1; li = l ? `:${s}-${s + l - 1}` : `:${s}`; }
			return `read ${p}${li}`;
		}
		case "bash": return `$ ${(args.command || "?").slice(0, 50)}`;
		case "edit": return `edit ${shorten(args.path || args.file_path || "?")}`;
		case "write": return `write ${shorten(args.path || args.file_path || "?")} (${(args.content || "").split("\n").length}L)`;
		case "grep": return `grep /${args.pattern || "?"}/ ${shorten(args.path || ".")}`;
		case "find": return `find ${args.pattern || "*"} ${shorten(args.path || ".")}`;
		case "ls": return `ls ${shorten(args.path || ".")}`;
		default: { const j = JSON.stringify(args); return `${toolName} ${j.length > 40 ? j.slice(0, 40) + "…" : j}`; }
	}
}

// ─── Panel Colors (256-color) ────────────────────────────────────────────────

interface PanelColor { fg: number; bg: number; selBg: number; }

const PANEL_COLORS: PanelColor[] = [
	{ fg: 68,  bg: 17, selBg: 25 },  // blue    — Architect
	{ fg: 43,  bg: 23, selBg: 30 },  // cyan    — Business Analyst
	{ fg: 71,  bg: 22, selBg: 28 },  // green   — Developer
	{ fg: 178, bg: 58, selBg: 94 },  // yellow  — QA Engineer
	{ fg: 141, bg: 53, selBg: 62 },  // magenta — Problem Solver
	{ fg: 167, bg: 52, selBg: 88 },  // red     — Tech Stack Analyst
	{ fg: 252, bg: 235, selBg: 240 },// white   — Clear Mind
	{ fg: 252, bg: 235, selBg: 240 },// white   — Synthesizer
];

const R = "\x1b[0m";
function fg256(c: number): string { return `\x1b[38;5;${c}m`; }
function bg256(c: number): string { return `\x1b[48;5;${c}m`; }
function fgBg256(fg: number, bg: number): string { return `\x1b[38;5;${fg}m\x1b[48;5;${bg}m`; }

// ─── Panel State ─────────────────────────────────────────────────────────────

export interface PanelState {
	id: string;
	label: string;
	emoji: string;
	name: string;
	status: "waiting" | "running" | "done" | "error";
	entries: string[];
	scrollOffset: number;
	autoScroll: boolean;
	colorIdx: number;
	startTime: number;
	endTime: number;
	turns: number;
	error?: string;
}

// ─── Agent Panels ────────────────────────────────────────────────────────────

export class AgentPanels implements Component {
	private panels = new Map<string, PanelState>();
	private panelOrder: string[] = [];
	private layout: "grid" | "single" = "grid";
	private singlePanelId = "";
	private tui: TUI | null = null;
	private finished = false;
	private globalStatus = "";
	private renderScheduled = false;

	// Widget vs overlay: different content heights
	widgetContentLines = 5;
	overlayContentLines = 20;

	// ── Setup ──────────────────────────────────────────────────────────────

	setTui(tui: TUI) { this.tui = tui; }

	registerAgent(id: string, label: string, emoji: string, name: string, colorIdx: number): void {
		this.panels.set(id, {
			id, label, emoji, name, status: "waiting", entries: [],
			scrollOffset: 0, autoScroll: true,
			colorIdx: colorIdx % PANEL_COLORS.length,
			startTime: 0, endTime: 0, turns: 0,
		});
	}

	getAllPanels(): PanelState[] { return this.panelOrder.map(id => this.panels.get(id)!).filter(Boolean); }
	isFinished(): boolean { return this.finished; }

	// ── Layout ─────────────────────────────────────────────────────────────

	showGrid(ids: string[]) {
		this.layout = "grid";
		this.panelOrder = [...ids];
		this.scheduleRender();
	}

	showSingle(id: string) {
		this.layout = "single";
		this.singlePanelId = id;
		this.scheduleRender();
	}

	showAllSequential() {
		// Show all panels sequentially in single mode — for overlay review
		this.layout = "single";
		this.singlePanelId = this.panelOrder[0] || "";
	}

	setGlobalStatus(s: string) { this.globalStatus = s; this.scheduleRender(); }
	setFinished() { this.finished = true; this.scheduleRender(); }

	/** Move to next panel in overlay review mode */
	nextPanel(): string | null {
		if (this.panelOrder.length <= 1) return null;
		const idx = this.panelOrder.indexOf(this.singlePanelId);
		const next = (idx + 1) % this.panelOrder.length;
		this.singlePanelId = this.panelOrder[next];
		this.scheduleRender();
		return this.singlePanelId;
	}

	prevPanel(): string | null {
		if (this.panelOrder.length <= 1) return null;
		const idx = this.panelOrder.indexOf(this.singlePanelId);
		const prev = (idx - 1 + this.panelOrder.length) % this.panelOrder.length;
		this.singlePanelId = this.panelOrder[prev];
		this.scheduleRender();
		return this.singlePanelId;
	}

	/** Scroll current panel */
	scrollCurrentUp() {
		const p = this.panels.get(this.singlePanelId);
		if (p) { p.autoScroll = false; p.scrollOffset = Math.max(0, p.scrollOffset - 1); this.scheduleRender(); }
	}
	scrollCurrentDown() {
		const p = this.panels.get(this.singlePanelId);
		if (p) { p.autoScroll = false; p.scrollOffset++; this.scheduleRender(); }
	}
	scrollCurrentBottom() {
		const p = this.panels.get(this.singlePanelId);
		if (p) { p.autoScroll = true; this.scheduleRender(); }
	}

	// ── Event input ────────────────────────────────────────────────────────

	addEntry(agentId: string, type: ActivityEntry["type"], text: string) {
		const panel = this.panels.get(agentId);
		if (!panel) return;

		const now = Date.now();
		if (type === "status" && text === "Starting...") { panel.status = "running"; panel.startTime = now; }
		else if (type === "done") { panel.status = "done"; panel.endTime = now; }
		else if (type === "error") { panel.status = "error"; panel.endTime = now; panel.error = text; }

		const line = this.formatEntryLine(type, text);
		if (line) panel.entries.push(line);
		if (panel.entries.length > 500) panel.entries = panel.entries.slice(-300);

		// Auto-scroll
		const maxContent = this.overlayContentLines;
		const maxOffset = Math.max(0, panel.entries.length - maxContent);
		if (panel.autoScroll) panel.scrollOffset = maxOffset;

		this.scheduleRender();
	}

	private formatEntryLine(type: ActivityEntry["type"], text: string): string {
		switch (type) {
			case "tool_call":   return `→ ${text}`;
			case "text":        return `"${text.split("\n")[0].slice(0, 70)}"`;
			case "thinking":    return `💭 ${text.slice(0, 70)}`;
			case "done":        return `✅ ${text}`;
			case "error":       return `❌ ${text}`;
			case "status":      return text.length > 70 ? text.slice(0, 70) + "…" : text;
			default:            return text;
		}
	}

	// ── Component interface ────────────────────────────────────────────────

	render(width: number): string[] {
		let lines: string[];
		if (this.layout === "grid") lines = this.renderGrid(width);
		else lines = this.renderSingle(width);
		// Safety: clamp every line to terminal width
		return lines.map(l => truncateToWidth(l, width));
	}

	handleInput(_data: string): void { /* handled by host in overlay mode */ }
	invalidate(): void { /* state-driven */ }

	// ── Grid rendering (widget mode) ─────────────────────────────────────

	private renderGrid(width: number): string[] {
		const ids = this.panelOrder;
		if (ids.length === 0) return [fg256(240) + "No agents" + R];

		let cols: number;
		if (width < 60) cols = 1;
		else if (width < 100) cols = 2;
		else cols = 3;

		const rows = Math.ceil(ids.length / cols);
		const gap = 1;
		const totalGaps = Math.max(0, cols - 1) * gap;
		const panelW = Math.floor((width - totalGaps) / cols);
		const contentH = this.widgetContentLines;

		const lines: string[] = [];

		// Status header
		if (this.globalStatus) {
			const statusColor = this.finished ? 46 : 240;
			lines.push(truncateToWidth(fg256(statusColor) + ` 🧠 ${this.globalStatus} ` + R, width));
		}

		for (let row = 0; row < rows; row++) {
			const rowH = contentH + 2; // header + content + bottom border
			for (let li = 0; li < rowH; li++) {
				let line = "";
				for (let col = 0; col < cols; col++) {
					const idx = row * cols + col;
					if (idx >= ids.length) break;
					const panel = this.panels.get(ids[idx]);
					if (!panel) break;
					if (col > 0) line += " ".repeat(gap);
					line += this.renderPanelLine(panel, panelW, li, contentH);
				}
				lines.push(line);
			}
			if (row < rows - 1) lines.push("");
		}

		return lines;
	}

	// ── Single panel rendering (overlay mode) ────────────────────────────

	private renderSingle(width: number): string[] {
		const panel = this.panels.get(this.singlePanelId);
		if (!panel) return [fg256(240) + "No panel" + R];

		const lines: string[] = [];
		const contentH = this.overlayContentLines;
		const color = PANEL_COLORS[panel.colorIdx];

		// Header
		if (this.globalStatus) {
			lines.push(truncateToWidth(fg256(240) + ` ${this.globalStatus} ` + R, width));
			lines.push(fg256(236) + "─".repeat(width) + R);
		}

		// Panel header bar
		const statusIcon = panel.status === "running" ? "⏳"
			: panel.status === "done" ? "✅"
			: panel.status === "error" ? "❌" : "…";
		const elapsed = (panel.status === "running" || panel.status === "done")
			? formatMs(panel.status === "running" ? Date.now() - panel.startTime : panel.endTime - panel.startTime)
			: "";
		const headerText = ` ${panel.emoji}  ${panel.name}  ${statusIcon}  ${elapsed} `;
		const paddedHeader = headerText + " ".repeat(Math.max(0, width - visibleWidth(headerText)));
		lines.push(fgBg256(color.fg, color.bg) + paddedHeader + R);

		// Top border
		lines.push(fg256(color.fg) + "┌" + "─".repeat(width - 2) + "┐" + R);

		// Content
		const maxOffset = Math.max(0, panel.entries.length - contentH);
		if (panel.autoScroll) panel.scrollOffset = maxOffset;
		panel.scrollOffset = Math.min(panel.scrollOffset, maxOffset);

		const visible = panel.entries.slice(panel.scrollOffset, panel.scrollOffset + contentH);
		for (const entry of visible) {
			const truncated = truncateToWidth(entry, width - 4);
			const pad = Math.max(0, width - 4 - visibleWidth(truncated));
			lines.push(fg256(color.fg) + "│" + R + " " + truncated + " ".repeat(pad) + " " + fg256(color.fg) + "│" + R);
		}
		for (let i = visible.length; i < contentH; i++) {
			lines.push(fg256(color.fg) + "│" + R + " ".repeat(width - 2) + fg256(color.fg) + "│" + R);
		}

		// Bottom border
		lines.push(fg256(color.fg) + "└" + "─".repeat(width - 2) + "┘" + R);

		// Navigation hint
		const panelIdx = this.panelOrder.indexOf(this.singlePanelId);
		const totalPanels = this.panelOrder.length;
		if (totalPanels > 1) {
			const nav = `  ←/→ panel ${panelIdx + 1}/${totalPanels}  ·  ↑/↓ scroll  ·  End=bottom  ·  q=close`;
			lines.push(truncateToWidth(fg256(240) + nav + R, width));
		} else {
			lines.push(truncateToWidth(fg256(240) + "  ↑/↓ scroll  ·  End=bottom  ·  q=close" + R, width));
		}

		return lines;
	}

	// ── Panel line (grid mode) ────────────────────────────────────────────

	private renderPanelLine(panel: PanelState, width: number, lineIdx: number, contentH: number): string {
		const color = PANEL_COLORS[panel.colorIdx];

		if (lineIdx === 0) {
			// Header with colored background
			const statusIcon = panel.status === "running" ? "⏳"
				: panel.status === "done" ? "✅"
				: panel.status === "error" ? "❌" : "…";
			const elapsed = (panel.status === "running" || panel.status === "done")
				? formatMs(panel.status === "running" ? Date.now() - panel.startTime : panel.endTime - panel.startTime)
				: "";
			const headerContent = ` ${panel.emoji} ${panel.name} ${statusIcon} ${elapsed} `;
			return fgBg256(color.fg, color.bg) + headerContent + " ".repeat(Math.max(0, width - visibleWidth(headerContent))) + R;
		}

		if (lineIdx === contentH + 1) {
			// Bottom border
			return fg256(color.fg) + "└" + "─".repeat(width - 2) + "┘" + R;
		}

		// Content line
		const maxOffset = Math.max(0, panel.entries.length - contentH);
		if (panel.autoScroll) panel.scrollOffset = maxOffset;
		panel.scrollOffset = Math.min(panel.scrollOffset, maxOffset);

		const entry = panel.entries[panel.scrollOffset + (lineIdx - 1)];
		let line = fg256(color.fg) + "│" + R;
		if (entry) {
			const truncated = truncateToWidth(entry, width - 4);
			const pad = Math.max(0, width - 4 - visibleWidth(truncated));
			line += " " + truncated + " ".repeat(pad) + " ";
		} else {
			line += " ".repeat(width - 2);
		}
		line += fg256(color.fg) + "│" + R;
		return line;
	}

	// ── Render scheduling ─────────────────────────────────────────────────

	private scheduleRender(): void {
		if (this.renderScheduled) return;
		this.renderScheduled = true;
		setTimeout(() => {
			this.renderScheduled = false;
			(this.tui as any)?.requestRender?.();
		}, 200);
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
	return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}
