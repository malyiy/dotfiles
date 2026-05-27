/**
 * gemini-consult — On-demand Gemini consultation via the official Gemini CLI
 *
 * Uses `gemini -p "question" -o json` in headless mode.
 * Leverages the user's Google subscription (Google One AI Premium).
 * Multi-turn via `--resume <session_id>`.
 *
 * Usage:
 *   - "consult with gemini about <topic>" → pi's LLM invokes the tool
 *   - /consult <question>                 → direct command
 *   - /consult-status                     → check CLI availability
 *
 * Setup:
 *   1. Install gemini CLI: https://github.com/google-gemini/gemini-cli
 *   2. Authenticate: gemini auth login
 *   3. Done — the extension auto-detects the CLI
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { randomUUID } from "node:crypto";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";

import { isGeminiAvailable, sendMessage } from "./gemini.ts";
import { gatherContext, buildPrompt } from "./context.ts";
import type { Consultation, ConsultationResult } from "./types.ts";

// ── In-memory consultation state ───────────────────────────────────────────

const activeConsultations = new Map<string, Consultation>();
const MAX_TURNS = 15;

// ── Tool parameters ────────────────────────────────────────────────────────

const ConsultGeminiParams = Type.Object({
	question: Type.String({
		description: "The specific question or topic to consult Gemini about",
	}),
	consultationId: Type.Optional(
		Type.String({
			description: "ID of an existing consultation to continue. Omit to start new.",
		}),
	),
	focus: Type.Optional(
		StringEnum(["debugging", "architecture", "libraries", "best-practices", "general"] as const, {
			description: "Area of focus (default: general)",
		}),
	),
});

// ── Consultation management ────────────────────────────────────────────────

function getOrCreateConsultation(id?: string): Consultation {
	if (id) {
		const existing = activeConsultations.get(id);
		if (existing) return existing;
	}

	const newId = id || randomUUID().slice(0, 8);
	const c: Consultation = {
		id: newId,
		geminiSessionId: null,
		turnCount: 0,
		createdAt: Date.now(),
		lastResponse: "",
	};
	activeConsultations.set(newId, c);
	return c;
}

function extractTotalTokens(stats: any): number {
	if (!stats?.models) return 0;
	let total = 0;
	for (const model of Object.values(stats.models) as any[]) {
		total += model?.tokens?.total || 0;
	}
	return total;
}

// ── Consultation runner ────────────────────────────────────────────────────

async function runConsultation(
	ctx: any,
	question: string,
	consultationId: string | undefined,
	focus: string | undefined,
	signal: AbortSignal | undefined,
	onUpdate: ((partial: any) => void) | undefined,
): Promise<{ content: Array<{ type: string; text: string }>; details: ConsultationResult }> {
	// 1. Check CLI availability
	const available = await isGeminiAvailable();
	if (!available) {
		return {
			content: [{
				type: "text",
				text: "⚠️ Gemini CLI not found in PATH.\n\nInstall: https://github.com/google-gemini/gemini-cli\nThen run: gemini auth login",
			}],
			details: { consultationId: "", summary: "CLI not found", turnCount: 0, geminiSessionId: "", totalTokens: 0 },
		};
	}

	// 2. Get or create consultation
	const consultation = getOrCreateConsultation(consultationId);

	// 3. Build prompt (with context on first turn)
	let prompt: string;
	if (consultation.turnCount === 0) {
		const sessionContext = gatherContext(ctx, question);
		prompt = buildPrompt(sessionContext);
	} else {
		prompt = question;
	}

	// 4. Send to Gemini
	onUpdate?.({
		content: [{ type: "text", text: `🔍 Consulting Gemini about: ${question}\n⏳ Waiting for response...` }],
	});

	console.error(`\n[gemini-consult] Prompt:\n${prompt.slice(0, 1500)}\n[gemini-consult] Session: ${consultation.geminiSessionId || "new"}\n`);

	const result = await sendMessage({
		prompt,
		resumeSessionId: consultation.geminiSessionId,
		signal,
		cwd: ctx.cwd,
	});

	// Update consultation state
	if (result.session_id && !consultation.geminiSessionId) {
		consultation.geminiSessionId = result.session_id;
	}
	consultation.turnCount++;
	consultation.lastResponse = result.response;

	let fullReport = `## Gemini Consultation (Turn ${consultation.turnCount})\n\n${result.response}`;
	let totalTokens = extractTotalTokens(result.stats);

	onUpdate?.({ content: [{ type: "text", text: fullReport }] });

	// 5. Multi-turn loop (interactive only)
	if (!ctx.hasUI) {
		return {
			content: [{ type: "text", text: fullReport }],
			details: {
				consultationId: consultation.id,
				summary: result.response.slice(0, 500),
				turnCount: consultation.turnCount,
				geminiSessionId: consultation.geminiSessionId || "",
				totalTokens,
			},
		};
	}

	while (consultation.turnCount < MAX_TURNS) {
		const options = ["Ask a follow-up question", "Return findings to pi", "End consultation"];
		const action = await ctx.ui.select(
			`💬 Gemini consultation (turn ${consultation.turnCount}/${MAX_TURNS})`,
			options,
		);

		if (!action || action === "End consultation") break;

		if (action === "Return findings to pi") {
			return {
				content: [{ type: "text", text: fullReport }],
				details: {
					consultationId: consultation.id,
					summary: consultation.lastResponse.slice(0, 500),
					turnCount: consultation.turnCount,
					geminiSessionId: consultation.geminiSessionId || "",
					totalTokens,
				},
			};
		}

		// Follow-up question
		const followUp = await ctx.ui.input(
			`💬 Follow-up (turn ${consultation.turnCount + 1})`,
			"Type your question (or 'pi' to return to pi)...",
		);
		if (!followUp) continue;

		if (followUp.toLowerCase().trim() === "pi") {
			return {
				content: [{ type: "text", text: fullReport }],
				details: {
					consultationId: consultation.id,
					summary: consultation.lastResponse.slice(0, 500),
					turnCount: consultation.turnCount,
					geminiSessionId: consultation.geminiSessionId || "",
					totalTokens,
				},
			};
		}

		onUpdate?.({
			content: [{ type: "text", text: `🔍 Follow-up: ${followUp}\n⏳ Waiting for Gemini...` }],
		});

		try {
			const followResult = await sendMessage({
				prompt: followUp,
				resumeSessionId: consultation.geminiSessionId,
				signal,
				cwd: ctx.cwd,
			});

			consultation.turnCount++;
			consultation.lastResponse = followResult.response;
			totalTokens += extractTotalTokens(followResult.stats);

			fullReport += `\n\n---\n\n## Turn ${consultation.turnCount}\n\n${followResult.response}`;
			onUpdate?.({ content: [{ type: "text", text: fullReport }] });
		} catch (error: any) {
			fullReport += `\n\n⚠️ Gemini error: ${error.message}`;
			onUpdate?.({ content: [{ type: "text", text: fullReport }] });
			continue;
		}
	}

	return {
		content: [{ type: "text", text: fullReport }],
		details: {
			consultationId: consultation.id,
			summary: consultation.lastResponse.slice(0, 500),
			turnCount: consultation.turnCount,
			geminiSessionId: consultation.geminiSessionId || "",
			totalTokens,
		},
	};
}

// ── Extension entry point ──────────────────────────────────────────────────

export default function geminiConsult(pi: ExtensionAPI) {

	pi.registerTool({
		name: "consult_gemini",
		label: "Consult Gemini",
		description:
			"Consult Google Gemini for external expertise with web-search verification. " +
			"Uses your Google subscription through the Gemini CLI. " +
			"Gemini provides verified, up-to-date information with source URLs. " +
			"Use when you need: current best practices, library recommendations, " +
			"debugging approaches, architecture advice, GitHub repo discovery, " +
			"or any topic benefiting from web-verified answers. " +
			"Supports multi-turn conversation. Pass consultationId to continue.",
		promptSnippet: "Consult Google Gemini (with web search) for verified expertise",
		promptGuidelines: [
			"Use consult_gemini when the user says 'consult with gemini', 'ask gemini', or wants web-verified answers.",
			"Use consult_gemini when you need current info about libraries, APIs, or best practices that may have changed.",
			"If consult_gemini returns a consultationId, pass it back to continue the same conversation.",
			"After consult_gemini returns, present findings to the user. Do not silently continue unless explicitly asked.",
		],
		parameters: ConsultGeminiParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			try {
				return await runConsultation(ctx, params.question, params.consultationId, params.focus, signal, onUpdate);
			} catch (error: any) {
				return {
					content: [{ type: "text", text: `❌ Consultation failed: ${error.message}` }],
					details: { consultationId: "", summary: `Error: ${error.message}`, turnCount: 0, geminiSessionId: "", totalTokens: 0 },
				};
			}
		},

		renderCall(args, theme, _context) {
			const question = args.question || "...";
			const preview = question.length > 70 ? `${question.slice(0, 70)}...` : question;
			let text = theme.fg("toolTitle", theme.bold("consult_gemini "));
			if (args.consultationId) text += theme.fg("muted", `[resume:${args.consultationId}] `);
			text += theme.fg("accent", preview);
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as ConsultationResult | undefined;
			if (!details) {
				const t = result.content[0];
				return new Text(t?.type === "text" ? t.text : "(no output)", 0, 0);
			}

			const mdTheme = getMarkdownTheme();

			if (expanded) {
				const container = new Container();
				const turns = `${details.turnCount} turn${details.turnCount !== 1 ? "s" : ""}`;
				const tokens = details.totalTokens > 0 ? ` · ${details.totalTokens.toLocaleString()} tokens` : "";
				container.addChild(new Text(
					theme.fg("success", "✓ ") +
					theme.fg("toolTitle", theme.bold("Gemini Consultation ")) +
					theme.fg("muted", `[${details.consultationId}] ${turns}${tokens}`),
					0, 0,
				));
				container.addChild(new Spacer(1));
				const mainText = result.content[0]?.type === "text" ? result.content[0].text : "";
				if (mainText) container.addChild(new Markdown(mainText, 0, 0, mdTheme));
				return container;
			}

			const turns = `${details.turnCount} turn${details.turnCount !== 1 ? "s" : ""}`;
			let text = theme.fg("success", "✓ ") + theme.fg("toolTitle", theme.bold("Gemini ")) + theme.fg("muted", turns);
			const mainText = result.content[0]?.type === "text" ? result.content[0].text : "";
			if (mainText) {
				const preview = mainText.split("\n").slice(0, 3).join("\n").slice(0, 200);
				text += `\n${theme.fg("dim", preview)}`;
			}
			return new Text(text, 0, 0);
		},
	});

	// ── /consult command ─────────────────────────────────────────────────

	pi.registerCommand("consult", {
		description: "Start a Gemini consultation with web-search grounding",
		handler: async (args, ctx) => {
			const question = args?.trim();
			if (!question) {
				ctx.ui.notify("Usage: /consult <your question>", "warning");
				return;
			}
			const available = await isGeminiAvailable();
			if (!available) {
				ctx.ui.notify("Gemini CLI not found. Install: https://github.com/google-gemini/gemini-cli", "error");
				return;
			}
			pi.sendUserMessage(`Please consult Gemini about: ${question}`);
		},
	});

	// ── /consult-status command ──────────────────────────────────────────

	pi.registerCommand("consult-status", {
		description: "Check Gemini CLI availability and auth status",
		handler: async (_args, ctx) => {
			const available = await isGeminiAvailable();
			if (!available) {
				ctx.ui.notify("❌ Gemini CLI not found in PATH. Install it first.", "warning");
				return;
			}

			// Try a quick query to verify auth
			try {
				const result = await sendMessage({ prompt: "Say OK", cwd: ctx.cwd });
				ctx.ui.notify(`✓ Gemini CLI authenticated (session: ${result.session_id.slice(0, 8)}...)`, "info");
			} catch (error: any) {
				ctx.ui.notify(`⚠️ Gemini CLI found but not authenticated: ${error.message}`, "error");
			}
		},
	});
}
