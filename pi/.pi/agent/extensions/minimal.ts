/**
 * Minimal — Custom prompt bar for pi
 *
 * Line 1:
 *   Left:  {path} {git branch + changes}
 *   Right: {tokens %} | {model}
 *
 * Line 2:
 *   One-sentence summary of current thread (auto-generated after 3rd prompt)
 *
 * Colors:
 *   Path:      blue
 *   Git:       white (0 changes), green (<10), orange (10-25), red (>25)
 *   Tokens:    gray (<30%), green (30-50%), orange (50-75%), red (>75%)
 *   Model:     cyan
 *   Summary:   dim/muted
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { applyExtensionDefaults } from "../lib/themeMap.js";

export default function (pi: ExtensionAPI) {
	// ── Git state cache ────────────────────────────────────────────────────

	let gitBranch = "";
	let gitChangedCount = -1; // -1 = not a git repo
	let gitRefreshTimer: ReturnType<typeof setTimeout> | null = null;

	async function refreshGit(cwd: string) {
		try {
			const branch = await pi.exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], { timeout: 3000 });
			if (branch.code !== 0) { gitBranch = ""; gitChangedCount = -1; return; }
			gitBranch = branch.stdout.trim();

			const status = await pi.exec("git", ["status", "--porcelain"], { timeout: 3000 });
			if (status.code !== 0) { gitChangedCount = -1; return; }
			const lines = status.stdout.trim().split("\n").filter((l) => l.trim());
			gitChangedCount = lines.length;
		} catch {
			gitBranch = "";
			gitChangedCount = -1;
		}
	}

	function scheduleGitRefresh(cwd: string) {
		if (gitRefreshTimer) clearTimeout(gitRefreshTimer);
		gitRefreshTimer = setTimeout(() => {
			refreshGit(cwd);
		}, 500);
	}

	// ── Thread summary ─────────────────────────────────────────────────────

	let threadSummary = "";
	let userPromptCount = 0;
	let summarizeTimer: ReturnType<typeof setTimeout> | null = null;

	pi.on("turn_end", async (_event, ctx) => {
		userPromptCount++;
		// Generate summary after 3rd user prompt
		if (userPromptCount === 3 && !threadSummary) {
			// Brief delay to let the conversation settle
			if (summarizeTimer) clearTimeout(summarizeTimer);
			summarizeTimer = setTimeout(() => {
				generateSummary(ctx, 3);
			}, 2000);
		}
	});

	async function generateSummary(ctx: any, promptLimit?: number) {
		// Collect user messages from the conversation
		const branch = ctx.sessionManager.getBranch();
		const userMessages: string[] = [];

		for (const entry of branch) {
			if (entry.type !== "message") continue;
			const msg = entry.message;
			if (msg.role === "user") {
				const text = msg.content?.find((p: any) => p.type === "text")?.text;
				if (text) userMessages.push(text.slice(0, 300));
			}
		}

		if (userMessages.length === 0) return;

		// Optionally limit to first N prompts
		const messages = promptLimit ? userMessages.slice(0, promptLimit) : userMessages;

		// Build prompt for the summarizer
		const transcript = messages.map((m, i) => `Message ${i + 1}: ${m}`).join("\n\n");
		const summarizerPrompt = `You are a conversation summarizer. Based on the user messages below, write ONE short sentence (max 120 chars) describing what this conversation is about from the user's perspective. Focus on the goal, not the mechanics. No quotes, no prefix, just the sentence.\n\n${transcript}`;

		try {
			const result = await pi.exec("pi", ["--no-session", "-p", summarizerPrompt], { timeout: 30000 });
			if (result.code === 0 && result.stdout.trim()) {
				threadSummary = result.stdout.trim().split("\n")[0].slice(0, 150);
			}
		} catch {
			// Silently fail — footer still works, just no summary
		}
	}

	// ── /pf-summary-reload — regenerate summary from first 3 prompts ──────

	pi.registerCommand("pf-summary-reload", {
		description: "Regenerate thread summary based on the first 3 prompts",
		handler: async (_args, ctx) => {
			threadSummary = "";
			await generateSummary(ctx, 3);
			if (threadSummary) {
				ctx.ui.notify(`Summary: ${threadSummary}`, "info");
			} else {
				ctx.ui.notify("Could not generate summary (no user messages found)", "warning");
			}
		},
	});

	// ── Token stats ────────────────────────────────────────────────────────

	function getTokenStats(ctx: any): { used: number; total: number; pct: number } {
		try {
			const usage = ctx.getContextUsage();
			if (usage) {
				const total = usage.contextWindow || ctx.model?.contextWindow || 200000;
				if (usage.percent !== null && usage.percent !== undefined && usage.tokens !== null && usage.tokens !== undefined) {
					return { used: usage.tokens, total, pct: usage.percent };
				}
				// percent is null (post-compaction, no LLM response yet)
				// Show total but no usage
				return { used: 0, total, pct: 0 };
			}
		} catch { /* ignore */ }
		// Final fallback
		const total = ctx.model?.contextWindow || 200000;
		return { used: 0, total, pct: 0 };
	}

	// ── Color helpers (256-color ANSI) ─────────────────────────────────────

	function tokenColor(pct: number): string {
		if (pct < 30) return "\x1b[38;5;245m"; // gray
		if (pct < 50) return "\x1b[38;5;82m";  // green
		if (pct < 75) return "\x1b[38;5;214m"; // orange
		return "\x1b[38;5;196m";                // red
	}

	function gitChangeColor(count: number): string {
		if (count === 0) return "\x1b[38;5;255m"; // white
		if (count < 10) return "\x1b[38;5;82m";   // green
		if (count < 25) return "\x1b[38;5;214m";  // orange
		return "\x1b[38;5;196m";                   // red
	}

	const R = "\x1b[0m";

	function fmtTokens(n: number): string {
		if (n < 1000) return `${n}`;
		if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
		return `${(n / 1_000_000).toFixed(1)}M`;
	}

	function shortPath(p: string): string {
		const home = process.env.HOME || process.env.USERPROFILE || "";
		if (home && p.startsWith(home)) return `~${p.slice(home.length)}`;
		return p;
	}

	// ── Session start — set up footer ──────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		applyExtensionDefaults(import.meta.url, ctx);
		userPromptCount = 0;
		threadSummary = "";

		// Initial git fetch
		await refreshGit(ctx.cwd);

		ctx.ui.setFooter((tui, _theme, footerData) => {
			const unsub = footerData.onBranchChange(() => {
				scheduleGitRefresh(ctx.cwd);
				tui.requestRender();
			});

			return {
				dispose: () => {
					unsub();
					if (gitRefreshTimer) clearTimeout(gitRefreshTimer);
				},
				invalidate() {},
				render(width: number): string[] {
					// ── Line 1 Left: path + git ────────────────────────────
					const pathStr = `\x1b[38;5;69m${shortPath(ctx.cwd)}${R}`;

					let gitStr = "";
					if (gitBranch && gitChangedCount >= 0) {
						const color = gitChangeColor(gitChangedCount);
						gitStr = ` ${color}${gitBranch}${gitChangedCount > 0 ? ` ±${gitChangedCount}` : ""}${R}`;
					} else if (gitBranch) {
						gitStr = ` ${gitBranch}`;
					}

					const left = ` ${pathStr}${gitStr}`;

					// ── Line 1 Right: tokens + model ───────────────────────
					const tokens = getTokenStats(ctx);
					const tc = tokenColor(tokens.pct);
					const pctRounded = Math.round(tokens.pct);
					const tokenStr = `${tc}${fmtTokens(tokens.used)}/${fmtTokens(tokens.total)} ${pctRounded}%${R}`;

					const modelId = ctx.model?.id || "no-model";
					const modelStr = `\x1b[38;5;117m${modelId}${R}`;

					const right = `${tokenStr} │ ${modelStr} `;

					// ── Pad between left and right ─────────────────────────
					const leftW = visibleWidth(left);
					const rightW = visibleWidth(right);
					const pad = " ".repeat(Math.max(1, width - leftW - rightW));
					const line1 = truncateToWidth(left + pad + right, width);

					// ── Line 2: thread summary ─────────────────────────────
					if (threadSummary) {
						const summaryLine = `\x1b[38;5;245m ${threadSummary}${R}`;
						return [line1, truncateToWidth(summaryLine, width)];
					}

					return [line1];
				},
			};
		});
	});

	// Refresh git on tool results (files may have changed)
	pi.on("tool_result", async (_event, ctx) => {
		scheduleGitRefresh(ctx.cwd);
	});

	// Refresh after model change
	pi.on("model_select", async (_event, _ctx) => {
		// Footer re-renders automatically via ctx.model
	});
}
