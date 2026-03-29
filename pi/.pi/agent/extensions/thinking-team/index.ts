/**
 * Thinking Team Extension
 *
 * Orchestrates a team of specialized AI agents to analyze tasks from multiple
 * perspectives before implementation, producing a comprehensive report.
 *
 * UI approach:
 *   - Live agent panels shown as a WIDGET above the editor (user can type freely)
 *   - /think-view opens a scrollable OVERLAY to review activity (closeable, re-openable)
 *   - /think starts the team (non-blocking)
 *
 * Roles: Architect, Business Analyst, Developer, QA Engineer, Problem Solver,
 *        Tech Stack Analyst, Clear Mind (Devil's Advocate)
 *
 * Usage:
 *   /think <task>          — Start the thinking team
 *   /think-view            — Open scrollable overlay to review agent activity
 *   thinking_team tool     — LLM-callable tool (non-interactive)
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import {
	type AgentRole,
	ROLES,
	REPO_CONTEXT_PROMPT,
	buildClearMindPrompt,
	buildSynthesisPrompt,
} from "./prompts.js";
import {
	AgentPanels,
	formatToolSummary,
} from "./agent-viewer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentResult {
	role: AgentRole;
	output: string;
	exitCode: number;
	turns: number;
	durationMs: number;
	error?: string;
}

interface ThinkingTeamReport {
	task: string;
	timestamp: string;
	durationMs: number;
	phase1Results: AgentResult[];
	clearMindResult: AgentResult | null;
	synthesisOutput: string;
	reportPath: string;
}

interface ThinkingTeamDetails {
	phase: "gathering" | "phase1" | "phase2" | "phase3" | "done" | "error";
	currentAgents: string[];
	completedAgents: string[];
	elapsed: number;
	report?: ThinkingTeamReport;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AGENT_TIMEOUT_MS = 5 * 60 * 1000;
const SYNTHESIS_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_CONCURRENCY = 4;
const REPORTS_DIR = ".pi/thinking-reports";
const WIDGET_KEY = "thinking-team";
const STATUS_KEY = "thinking-team";

// ─── Utilities ───────────────────────────────────────────────────────────────

function getPiInvocation(args: string[]): { command: string; args: string[] } {
	const currentScript = process.argv[1];
	if (currentScript && fs.existsSync(currentScript)) {
		return { command: process.execPath, args: [currentScript, ...args] };
	}
	const execName = path.basename(process.execPath).toLowerCase();
	if (!/^(node|bun)(\.exe)?$/.test(execName)) {
		return { command: process.execPath, args };
	}
	return { command: "pi", args };
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
	return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}

function shortPath(filePath: string): string {
	const home = os.homedir();
	return filePath.startsWith(home) ? `~${filePath.slice(home.length)}` : filePath;
}

async function writeTempFile(prefix: string, content: string): Promise<{ dir: string; file: string }> {
	const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `pi-think-${prefix}-`));
	const tmpFile = path.join(tmpDir, "prompt.md");
	await fs.promises.writeFile(tmpFile, content, { encoding: "utf-8", mode: 0o600 });
	return { dir: tmpDir, file: tmpFile };
}

function cleanupTempDir(dir: string) {
	try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ─── Repo Context ────────────────────────────────────────────────────────────

async function gatherRepoContext(cwd: string): Promise<string> {
	const parts: string[] = [];
	const { exec } = await import("node:child_process");

	try {
		const tree = await new Promise<string>((resolve) => {
			exec(
				"find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/__pycache__/*' -not -path '*/.next/*' -not -path '*/target/*' -not -path '*/build/*' -not -path '*/.pi/*' | head -200",
				{ cwd, maxBuffer: 50 * 1024 },
				(error: any, stdout: string) => resolve(error ? "" : stdout),
			);
		});
		if (tree.trim()) parts.push("### File Structure (top 200 files)\n```\n" + tree.trim() + "\n```");
	} catch { /* ignore */ }

	for (const file of ["package.json", "tsconfig.json", "Cargo.toml", "pyproject.toml", "go.mod", "README.md", ".env.example", "docker-compose.yml", "Makefile", "AGENTS.md", "CLAUDE.md"]) {
		try {
			const content = await fs.promises.readFile(path.join(cwd, file), "utf-8");
			const truncated = content.length > 3000 ? content.slice(0, 3000) + "\n... (truncated)" : content;
			parts.push(`### ${file}\n\`\`\`\n${truncated}\n\`\`\``);
		} catch { /* skip */ }
	}

	try {
		const gitInfo = await new Promise<string>((resolve) => {
			exec('git log --oneline -20 2>/dev/null && echo "---BRANCH---" && git branch --show-current 2>/dev/null && echo "---STATUS---" && git status --short 2>/dev/null | head -30',
				{ cwd, maxBuffer: 50 * 1024 }, (error: any, stdout: string) => resolve(error ? "" : stdout));
		});
		if (gitInfo.trim()) parts.push("### Git Info\n```\n" + gitInfo.trim() + "\n```");
	} catch { /* ignore */ }

	return parts.length > 0 ? parts.join("\n\n") : "No context gathered.";
}

// ─── Sub-Agent Spawning ──────────────────────────────────────────────────────

function spawnAndWait(
	invocation: { command: string; args: string[] },
	cwd: string,
	signal: AbortSignal | undefined,
	timeoutMs: number,
	agent: AgentRole,
	panels: AgentPanels | null,
): Promise<{ text: string; stderr: string; exitCode: number; turns: number; aborted: boolean }> {
	return new Promise((resolve) => {
		let aborted = false, stderrOutput = "", buffer = "";
		const assistantTexts: string[] = [];
		let turns = 0;

		const push = (type: "status" | "tool_call" | "text" | "thinking" | "done" | "error", text: string) => {
			panels?.addEntry(agent.id, type, text);
		};

		push("status", "Starting...");

		const proc = spawn(invocation.command, invocation.args, {
			cwd, shell: false, stdio: ["ignore", "pipe", "pipe"],
		});

		const processLine = (line: string) => {
			if (!line.trim()) return;
			let event: any;
			try { event = JSON.parse(line); } catch { return; }

			if (event.type === "message_end" && event.message?.role === "assistant") {
				turns++;
				for (const part of event.message.content) {
					if (part.type === "text" && part.text?.trim()) {
						assistantTexts.push(part.text);
						const first = part.text.split("\n").find(l => l.trim());
						if (first) push("text", first.trim().slice(0, 120));
					} else if (part.type === "toolCall" || part.type === "tool_use") {
						push("tool_call", formatToolSummary(part.name || part.function?.name || "?", part.input || part.arguments || {}));
					} else if (part.type === "thinking" && part.thinking?.trim()) {
						const first = part.thinking.split("\n").find(l => l.trim());
						if (first) push("thinking", first.trim().slice(0, 120));
					}
				}
			}
		};

		proc.stdout.on("data", (data: Buffer) => {
			buffer += data.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";
			for (const l of lines) processLine(l);
		});
		proc.stderr.on("data", (d: Buffer) => { stderrOutput += d.toString(); });

		const timeout = setTimeout(() => {
			proc.kill("SIGTERM");
			setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000);
		}, timeoutMs);

		proc.on("close", (code) => {
			clearTimeout(timeout);
			if (buffer.trim()) processLine(buffer);
			if (aborted) push("error", "Aborted");
			else if (code !== 0) push("error", `Failed (exit ${code})`);
			else push("done", `Completed in ${turns} turn${turns !== 1 ? "s" : ""}`);
			resolve({
				text: assistantTexts.join("\n\n").trim() || (stderrOutput ? `Error: ${stderrOutput.slice(0, 1000)}` : ""),
				stderr: stderrOutput, exitCode: code ?? (aborted ? 1 : 0), turns, aborted,
			});
		});

		proc.on("error", (err) => {
			clearTimeout(timeout);
			push("error", `Failed to spawn: ${err.message}`);
			resolve({ text: `Failed to spawn: ${err.message}`, stderr: stderrOutput, exitCode: 1, turns: 0, aborted });
		});

		if (signal) {
			const kill = () => { aborted = true; proc.kill("SIGTERM"); setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 5000); };
			if (signal.aborted) kill();
			else signal.addEventListener("abort", kill, { once: true });
		}
	});
}

async function runSubAgent(
	cwd: string, role: AgentRole, fullPrompt: string,
	model: string | undefined, thinking: string,
	signal: AbortSignal | undefined, timeoutMs: number,
	panels: AgentPanels | null,
): Promise<AgentResult> {
	const start = Date.now();
	const promptTmp = await writeTempFile(`prompt-${role.id}`, fullPrompt);
	try {
		const args: string[] = ["--mode", "json", "-p", "--no-session"];
		if (model) args.push("--model", model);
		if (role.systemPrompt.trim()) {
			const sysTmp = await writeTempFile(`sys-${role.id}`, role.systemPrompt);
			args.push("--append-system-prompt", sysTmp.file);
		}
		args.push(role.tools.trim() ? `--tools=${role.tools}` : "--no-tools");
		if (thinking !== "off") args.push("--thinking", thinking);
		args.push(`@${promptTmp.file}`);

		const result = await spawnAndWait(getPiInvocation(args), cwd, signal, timeoutMs, role, panels);
		return {
			role, output: result.text, exitCode: result.exitCode, turns: result.turns,
			durationMs: Date.now() - start,
			error: result.aborted ? "Aborted" : result.exitCode !== 0 ? `Exit code ${result.exitCode}` : undefined,
		};
	} finally {
		cleanupTempDir(promptTmp.dir);
	}
}

// ─── Concurrency ─────────────────────────────────────────────────────────────

async function mapWithProgress<TIn, TOut>(
	items: TIn[], concurrency: number,
	onStart: (item: TIn) => void, onDone: (item: TIn, result: TOut) => void,
	fn: (item: TIn) => Promise<TOut>,
): Promise<TOut[]> {
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	await Promise.all(
		new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
			while (true) {
				const i = nextIndex++;
				if (i >= items.length) return;
				const item = items[i];
				onStart(item);
				results[i] = await fn(item);
				onDone(item, results[i]);
			}
		}),
	);
	return results;
}

// ─── Report ──────────────────────────────────────────────────────────────────

function generateReportMarkdown(task: string, p1: AgentResult[], cm: string | null, syn: string): string {
	const lines: string[] = [
		`# Thinking Team Report\n`, `**Task:** ${task}\n`, `**Generated:** ${new Date().toISOString()}\n`,
		`**Team:** ${ROLES.map(r => `${r.emoji} ${r.name}`).join(" | ")} + Clear Mind 🧠\n`, "---\n",
	];
	if (syn) { lines.push("## Executive Summary\n"); const m = syn.match(/## Executive Summary\n([\s\S]*?)(?=\n## |$)/); lines.push((m ? m[1].trim() : syn.slice(0, 2000)) + "\n"); }
	lines.push("---\n## Phase 1: Individual Analysis\n");
	for (const r of p1) lines.push(`### ${r.role.emoji} ${r.role.name}${r.error ? ` ⚠️ (${r.error})` : ` ✓ (${r.turns} turns, ${formatDuration(r.durationMs)})`}\n${r.output || "(no output)"}\n`);
	if (cm) lines.push("---\n## Phase 2: Critical Review (Clear Mind)\n" + cm + "\n");
	if (syn) lines.push("---\n## Phase 3: Full Synthesis\n" + syn + "\n");
	lines.push("---\n*Generated by Thinking Team Extension*\n");
	return lines.join("\n");
}

async function saveReport(content: string, cwd: string): Promise<string> {
	const dir = path.join(cwd, REPORTS_DIR);
	await fs.promises.mkdir(dir, { recursive: true });
	const fp = path.join(dir, `thinking-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`);
	await fs.promises.writeFile(fp, content, { encoding: "utf-8" });
	return fp;
}

// ─── Main Orchestration ──────────────────────────────────────────────────────

async function runThinkingTeam(
	cwd: string, task: string, model: string | undefined, thinking: string,
	signal: AbortSignal | undefined, panels: AgentPanels,
): Promise<ThinkingTeamReport> {
	const totalStart = Date.now();
	const label = (r: AgentRole) => `${r.emoji} ${r.name}`;
	let currentAgents: string[] = [];
	let completedAgents: string[] = [];

	const setStatus = (s: string) => panels.setGlobalStatus(s);

	// Phase 0
	setStatus("📂 Gathering repo context...");
	let repoContext: string;
	try { repoContext = await gatherRepoContext(cwd); } catch { repoContext = "No context."; }
	const taskPrompt = REPO_CONTEXT_PROMPT.replace("{repo_context}", repoContext).replace("{task}", task);

	// Phase 1
	setStatus(`🔬 Phase 1: 0/${ROLES.length} done`);
	panels.showGrid(ROLES.map(r => r.id));

	const phase1Results = await mapWithProgress(
		ROLES, MAX_CONCURRENCY,
		(role: AgentRole) => { currentAgents.push(label(role)); setStatus(`🔬 Phase 1: ${completedAgents.length}/${ROLES.length} — ⏳ ${currentAgents.join(", ")}`); },
		(role: AgentRole, _r: AgentResult) => { currentAgents = currentAgents.filter(a => !a.startsWith(role.emoji)); completedAgents.push(label(role)); setStatus(`🔬 Phase 1: ${completedAgents.length}/${ROLES.length} done`); },
		(role: AgentRole) => runSubAgent(cwd, role, taskPrompt, model, thinking, signal, AGENT_TIMEOUT_MS, panels),
	);

	// Phase 2
	const cmRole: AgentRole = { id: "clear-mind", name: "Clear Mind", emoji: "🧠", tools: "", systemPrompt: "" };
	panels.registerAgent(cmRole.id, `${cmRole.emoji} ${cmRole.name}`, cmRole.emoji, cmRole.name, 6);
	panels.showSingle("clear-mind");
	setStatus("🧠 Phase 2: Clear Mind — critical review");

	const ok = phase1Results.filter(r => !r.error && r.output);
	let clearMindResult: AgentResult | null = null;
	if (ok.length > 0) {
		clearMindResult = await runSubAgent(cwd, cmRole, buildClearMindPrompt(ok, task), model, thinking, signal, SYNTHESIS_TIMEOUT_MS, panels);
	}

	// Phase 3
	const synRole: AgentRole = { id: "synthesizer", name: "Synthesizer", emoji: "📋", tools: "", systemPrompt: "" };
	panels.registerAgent(synRole.id, `${synRole.emoji} ${synRole.name}`, synRole.emoji, synRole.name, 7);
	panels.showSingle("synthesizer");
	setStatus("📋 Phase 3: Synthesizing report");

	const synthesisResult = await runSubAgent(cwd, synRole, buildSynthesisPrompt(ok, clearMindResult?.output ?? "", task), model, thinking, signal, SYNTHESIS_TIMEOUT_MS, panels);

	// Done
	const reportContent = generateReportMarkdown(task, phase1Results, clearMindResult?.output ?? null, synthesisResult.output);
	const reportPath = await saveReport(reportContent, cwd);

	// Show grid with all results for the widget
	panels.showGrid([...ROLES.map(r => r.id), "clear-mind", "synthesizer"]);
	setStatus(`✅ Done in ${formatDuration(Date.now() - totalStart)} → ${shortPath(reportPath)}`);
	panels.setFinished();

	return { task, timestamp: new Date().toISOString(), durationMs: Date.now() - totalStart, phase1Results, clearMindResult, synthesisOutput: synthesisResult.output, reportPath };
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// Persistent panels state — lives across the session
	let panels: AgentPanels | null = null;
	let savedReport: ThinkingTeamReport | null = null;
	let isRunning = false;

	/** Show the widget above editor with live agent panels */
	function showWidget(ctx: any) {
		if (!panels || !ctx.hasUI) return;
		ctx.ui.setWidget(WIDGET_KEY, (tui: any) => {
			panels!.setTui(tui);
			return panels!;
		});
	}

	/** Hide the widget */
	function hideWidget(ctx: any) {
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		ctx.ui.setStatus(STATUS_KEY, undefined);
	}

	// ── /think — start the thinking team (non-blocking) ──
	pi.registerCommand("think", {
		description: "Launch Thinking Team — per-agent analysis with live panels above editor",
		handler: async (args, ctx) => {
			let task = args?.trim();
			if (!task) {
				task = await ctx.ui.input("Thinking Team", "Describe the task or problem to analyze:");
				if (!task) { ctx.ui.notify("Cancelled", "info"); return; }
			}

			if (isRunning) {
				ctx.ui.notify("Thinking Team is already running. Use /think-view to monitor.", "warning");
				return;
			}

			// Create fresh panels
			panels = new AgentPanels();
			ROLES.forEach((role, i) => {
				panels!.registerAgent(role.id, `${role.emoji} ${role.name}`, role.emoji, role.name, i);
			});
			savedReport = null;
			isRunning = true;

			// Show widget
			showWidget(ctx);
			ctx.ui.setStatus(STATUS_KEY, "Thinking Team: starting...");
			ctx.ui.notify("Thinking Team started! Panels above editor. Type freely.", "info");

			// Fire-and-forget — don't block the UI
			runThinkingTeam(ctx.cwd, task, undefined, "high", undefined, panels)
				.then(report => {
					savedReport = report;
					isRunning = false;
					const displayPath = shortPath(report.reportPath);
					const successCount = report.phase1Results.filter(r => !r.error).length;

					pi.sendMessage({
						customType: "thinking-team-result",
						content: `## Thinking Team Report — ${formatDuration(report.durationMs)}\n\n` +
							`**Task:** ${task}\n\n` +
							`**Phase 1:** ${successCount}/${ROLES.length} agents completed\n` +
							`**Phase 2:** Clear Mind ${report.clearMindResult?.error ? "⚠️ had issues" : "✓ completed"}\n` +
							`**Phase 3:** Synthesis ${report.synthesisOutput ? "✓ completed" : "⚠️ failed"}\n\n` +
							`📄 **Full report:** ${displayPath}\n\n` +
							`${report.synthesisOutput ? report.synthesisOutput.slice(0, 3000) + (report.synthesisOutput.length > 3000 ? "\n\n... (see full report)" : "") : "(No synthesis output)"}`,
						display: true,
						details: { reportPath: report.reportPath, duration: report.durationMs },
					});

					ctx.ui.notify(`Thinking Team complete! → ${displayPath}`, "success");
					ctx.ui.setStatus(STATUS_KEY, `Thinking Team: ✅ done`);
				})
				.catch(err => {
					isRunning = false;
					if (panels) panels.setGlobalStatus(`❌ Error: ${err.message}`);
					ctx.ui.notify(`Thinking Team error: ${err.message}`, "error");
					ctx.ui.setStatus(STATUS_KEY, "Thinking Team: ❌ error");
				});
		},
	});

	// ── /think-view — open scrollable overlay to review agent activity ──
	pi.registerCommand("think-view", {
		description: "Open scrollable overlay to review thinking team agent activity",
		handler: async (_args, ctx) => {
			if (!panels) {
				ctx.ui.notify("No thinking team data. Run /think first.", "warning");
				return;
			}

			// Switch to single-panel mode for overlay review
			panels.showAllSequential();

			// Open overlay — user can scroll, switch panels, close
			await ctx.ui.custom<void>((tui, _theme, _keybindings, done) => {
				panels!.setTui(tui);

				return {
					render(width: number): string[] {
						return panels!.render(width);
					},
					handleInput(data: string): void {
						// Arrow keys, page up/down for scrolling
						if (data === "up" || data === "k") { panels!.scrollCurrentUp(); return; }
						if (data === "down" || data === "j") { panels!.scrollCurrentDown(); return; }
						if (data === "pageUp") { for (let i = 0; i < 5; i++) panels!.scrollCurrentUp(); return; }
						if (data === "pageDown") { for (let i = 0; i < 5; i++) panels!.scrollCurrentDown(); return; }
						if (data === "end") { panels!.scrollCurrentBottom(); return; }

						// Left/Right or Tab to switch agent panel
						if (data === "left" || data === "shift+tab") { panels!.prevPanel(); return; }
						if (data === "right" || data === "\t") { panels!.nextPanel(); return; }

						// q or Escape to close
						if (data === "q" || data === "escape") { done(); return; }
					},
					invalidate(): void { /* state-driven */ },
				};
			}, {
				overlay: true,
				overlayOptions: {
					anchor: "center",
					width: "96%",
					maxHeight: "90%",
				},
			});

			// After closing overlay, restore widget view
			if (panels && !panels.isFinished()) {
				// Restore grid layout for widget
				panels.showGrid(panels.getAllPanels().map(p => p.id));
			}
		},
	});

	// ── /think-dismiss — hide the widget ──
	pi.registerCommand("think-dismiss", {
		description: "Dismiss the thinking team widget",
		handler: async (_args, ctx) => {
			hideWidget(ctx);
			ctx.ui.notify("Thinking Team widget dismissed", "info");
		},
	});

	// ── thinking_team tool (LLM-callable, non-interactive) ──
	pi.registerTool({
		name: "thinking_team",
		label: "Thinking Team",
		description: [
			"Launch a Thinking Team of specialized AI agents to analyze a task from multiple perspectives.",
			"Agents: Architect, Business Analyst, Developer, QA Engineer, Problem Solver, Tech Stack Analyst, Clear Mind.",
			"Produces a comprehensive report saved to .pi/thinking-reports/.",
		].join(" "),
		promptSnippet: "Analyze a task with a team of specialized agents for comprehensive pre-implementation analysis",
		promptGuidelines: [
			"Use thinking_team before starting complex implementations, refactors, or architectural changes.",
			"The team explores the codebase and produces a report with findings, risks, and recommendations.",
		],
		parameters: Type.Object({
			task: Type.String({ description: "The task, problem, or feature to analyze comprehensively" }),
			model: Type.Optional(Type.String({ description: "Override model for sub-agents" })),
			thinking: Type.Optional(StringEnum(["off", "minimal", "low", "medium", "high", "xhigh"] as const, {
				description: "Thinking level for sub-agents. Default: 'high'.",
			})),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const toolPanels = new AgentPanels();
			ROLES.forEach((role, i) => {
				toolPanels.registerAgent(role.id, `${role.emoji} ${role.name}`, role.emoji, role.name, i);
			});
			toolPanels.registerAgent("clear-mind", "🧠 Clear Mind", "🧠", "Clear Mind", 6);
			toolPanels.registerAgent("synthesizer", "📋 Synthesizer", "📋", "Synthesizer", 7);

			const report = await runThinkingTeam(ctx.cwd, params.task, params.model, params.thinking ?? "high", signal, toolPanels);
			const displayPath = shortPath(report.reportPath);
			const sc = report.phase1Results.filter(r => !r.error).length;

			return {
				content: [{
					type: "text",
					text: `## Thinking Team Complete (${formatDuration(report.durationMs)})\n\n` +
						`**Task:** ${params.task}\n\n` +
						`- Phase 1: ${sc}/${ROLES.length} agents completed\n` +
						`- Phase 2 (Clear Mind): ${report.clearMindResult?.error ? "⚠️ Issues" : "✓ Complete"}\n` +
						`- Phase 3 (Synthesis): ${report.synthesisOutput ? "✓ Complete" : "⚠️ Failed"}\n\n` +
						`📄 **Full report:** ${displayPath}\n\n` +
						`---\n\n${report.synthesisOutput || "(No synthesis output)"}`,
				}],
				details: {
					phase: "done", reportPath: report.reportPath, durationMs: report.durationMs,
					phase1Results: report.phase1Results.map(r => ({ role: r.role.name, success: !r.error, turns: r.turns, durationMs: r.durationMs })),
				},
			};
		},

		renderCall(args, theme) {
			const preview = args.task?.length > 80 ? `${args.task.slice(0, 80)}...` : (args.task ?? "...");
			return new Text(theme.fg("toolTitle", theme.bold("thinking_team ")) + theme.fg("dim", preview), 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as ThinkingTeamDetails | undefined;
			if (details?.phase === "done" && details.report) {
				const dp = shortPath(details.report.reportPath);
				if (expanded) {
					const c = new Container();
					c.addChild(new Text(theme.fg("success", "✓ Thinking Team Complete") + theme.fg("dim", ` — ${formatDuration(details.report.durationMs)}`), 0, 0));
					c.addChild(new Spacer(1));
					for (const r of details.report.phase1Results)
						c.addChild(new Text(`${r.error ? theme.fg("error", "✗") : theme.fg("success", "✓")} ${r.role.emoji} ${r.role.name} ${theme.fg("dim", `(${r.turns} turns, ${formatDuration(r.durationMs)})`)}`, 0, 0));
					c.addChild(new Spacer(1));
					if (details.report.synthesisOutput) {
						c.addChild(new Text(theme.fg("accent", "Synthesis:"), 0, 0));
						c.addChild(new Markdown(details.report.synthesisOutput.slice(0, 5000), 0, 0, {}));
					}
					c.addChild(new Spacer(1));
					c.addChild(new Text(theme.fg("accent", "📄 Report: ") + theme.fg("toolOutput", dp), 0, 0));
					return c;
				}
				const sc = details.report.phase1Results.filter(r => !r.error).length;
				return new Text(
					theme.fg("success", "✓ Complete") + theme.fg("dim", ` — ${formatDuration(details.report.durationMs)} (${sc}/${ROLES.length})`) +
					`\n${theme.fg("accent", "📄 ")}${theme.fg("toolOutput", dp)}`, 0, 0,
				);
			}
			const t = result.content[0];
			return new Text(t?.type === "text" ? t.text : "(no output)", 0, 0);
		},
	});

	// ── Message renderer ──
	pi.registerMessageRenderer("thinking-team-result", (message, options, theme) => {
		const { expanded } = options;
		let text = theme.fg("accent", theme.bold("🧠 Thinking Team Report\n"));
		if (message.content) {
			if (expanded) return new Markdown(message.content as string, 0, 0, {});
			text += theme.fg("toolOutput", (message.content as string).split("\n").slice(0, 8).join("\n"));
			text += theme.fg("muted", "\n...(Ctrl+O to expand)");
		}
		return new Text(text, 0, 0);
	});
}
