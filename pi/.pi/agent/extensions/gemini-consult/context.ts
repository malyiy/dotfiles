/**
 * Context gathering from the current pi session
 *
 * Extracts signal, not noise. Gemini needs:
 *   - What's the goal? (from the user's original request)
 *   - What's the tech stack? (only what's relevant)
 *   - What's been tried and decided so far? (outcomes, not mechanics)
 *   - What's the specific question?
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SessionContext } from "./types.ts";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

// ── Text extraction ────────────────────────────────────────────────────────

function extractTextFromContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((part: any) => part.type === "text" && part.text)
			.map((part: any) => part.text)
			.join("\n");
	}
	return "";
}

// ── Tech stack detection (focused) ─────────────────────────────────────────

/**
 * Detect only the tech stack that's directly relevant to the problem.
 * No version dumps, no dependency lists — just the framework/language identity.
 */
function detectTechStack(cwd: string): string[] {
	const stack: string[] = [];

	// Primary language/framework
	if (existsSync(resolve(cwd, "package.json"))) {
		try {
			const pkg = JSON.parse(execSync(`cat "${resolve(cwd, "package.json")}"`, { encoding: "utf8", timeout: 2000 }));
			// Detect framework from deps, not list every dep
			const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
			if (allDeps["next"]) stack.push("Next.js");
			else if (allDeps["nuxt"]) stack.push("Nuxt");
			else if (allDeps["svelte"] || allDeps["@sveltejs/kit"]) stack.push("SvelteKit");
			else if (allDeps["react"]) stack.push("React");
			else if (allDeps["vue"]) stack.push("Vue");
			else if (allDeps["@angular/core"]) stack.push("Angular");
			else if (allDeps["express"] || allDeps["fastify"] || allDeps["hono"]) stack.push("Node.js backend");
			else stack.push("Node.js/JavaScript");

			// Key infrastructure
			if (allDeps["typescript"] || allDeps["@types/node"]) stack.push("TypeScript");
			if (allDeps["tailwindcss"]) stack.push("Tailwind");
			if (allDeps["prisma"] || allDeps["@prisma/client"]) stack.push("Prisma");
			if (allDeps["drizzle-orm"]) stack.push("Drizzle");
			if (allDeps["trpc"] || allDeps["@trpc/server"]) stack.push("tRPC");
		} catch {
			stack.push("Node.js/JavaScript");
		}
	}
	if (existsSync(resolve(cwd, "Cargo.toml"))) stack.push("Rust");
	if (existsSync(resolve(cwd, "go.mod"))) stack.push("Go");
	if (existsSync(resolve(cwd, "pyproject.toml")) || existsSync(resolve(cwd, "requirements.txt"))) stack.push("Python");
	if (existsSync(resolve(cwd, "Gemfile"))) stack.push("Ruby");

	// Runtime versions — only the primary one
	if (stack.some((s) => s.includes("Node") || s.includes("React") || s.includes("Next"))) {
		try {
			const v = execSync("node --version 2>/dev/null", { encoding: "utf8", timeout: 2000 }).trim();
			if (v) stack.push(`Node ${v}`);
		} catch { /* skip */ }
	}

	return stack;
}

// ── Progress extraction ────────────────────────────────────────────────────

/**
 * Extract the narrative from recent work: decisions made, approaches tried,
 * outcomes reached. NOT the raw tool calls.
 *
 * Strategy:
 *   - Take the last N assistant text responses (skip tool calls)
 *   - Each response is a summary of what was decided/done
 *   - Truncate to key points, not full output
 */
function extractProgress(entries: any[]): string[] {
	const progress: string[] = [];
	const MAX_ITEMS = 5;

	// Walk entries chronologically, collect assistant text responses
	const assistantTexts: string[] = [];
	for (const entry of entries) {
		if (entry.type !== "message" || entry.message?.role !== "assistant") continue;
		const content = entry.message.content;
		if (!Array.isArray(content)) continue;

		// Extract only the meaningful text (not tool calls)
		const textParts: string[] = [];
		for (const part of content) {
			if (part.type === "text" && part.text && part.text.trim().length > 20) {
				textParts.push(part.text.trim());
			}
		}

		if (textParts.length > 0) {
			assistantTexts.push(textParts.join("\n"));
		}
	}

	// Take the last N and compress each to its key point
	const recent = assistantTexts.slice(-MAX_ITEMS);
	for (const text of recent) {
		progress.push(compressToKeyPoint(text));
	}

	return progress;
}

/**
 * Compress a possibly long assistant response into its key decision/point.
 * Heuristic: take the first meaningful sentence or two, or the conclusion.
 */
function compressToKeyPoint(text: string, maxLen = 300): string {
	if (text.length <= maxLen) return text;

	// Try to find the conclusion/summary — often at the end
	const lines = text.split("\n").filter((l) => l.trim().length > 0);

	// If it's a structured response, grab the first line (usually the decision)
	// and the last meaningful line (usually the conclusion)
	if (lines.length <= 3) {
		return text.slice(0, maxLen);
	}

	// Take first line (the action/decision) and last line (the outcome)
	const first = lines[0];
	const last = lines[lines.length - 1];

	const compressed = `${first}\n[...]\n${last}`;
	if (compressed.length <= maxLen) return compressed;

	// Last resort: truncate from the beginning
	return text.slice(0, maxLen - 3) + "...";
}

// ── Goal extraction ────────────────────────────────────────────────────────

/**
 * Extract the user's goal from the session.
 * This is the first substantive user message — what they're trying to accomplish.
 */
function extractGoal(entries: any[]): string {
	for (const entry of entries) {
		if (entry.type !== "message" || entry.message?.role !== "user") continue;
		const text = extractTextFromContent(entry.message.content);
		if (text && text.trim().length > 5) {
			// Truncate to a reasonable goal description
			return text.trim().length > 500 ? text.trim().slice(0, 500) + "..." : text.trim();
		}
	}
	return "";
}

// ── Main context gatherer ─────────────────────────────────────────────────

export function gatherContext(ctx: ExtensionContext, question: string): SessionContext {
	const entries = ctx.sessionManager.getBranch();

	return {
		goal: extractGoal(entries),
		techStack: detectTechStack(ctx.cwd),
		progress: extractProgress(entries),
		question,
	};
}

/**
 * Build a concise, focused prompt for Gemini.
 * No fluff, no repetition — just the context Gemini needs to be helpful.
 */
export function buildPrompt(context: SessionContext): string {
	const sections: string[] = [];

	sections.push(context.question);

	// Add context only if there's useful information
	const contextParts: string[] = [];

	if (context.goal) {
		contextParts.push(`Goal: ${context.goal}`);
	}

	if (context.techStack.length > 0) {
		contextParts.push(`Stack: ${context.techStack.join(", ")}`);
	}

	if (context.progress.length > 0) {
		const progressStr = context.progress
			.map((p, i) => `${i + 1}. ${p}`)
			.join("\n");
		contextParts.push(`What we've done so far:\n${progressStr}`);
	}

	// Only prepend context if we have it
	if (contextParts.length > 0) {
		return `${contextParts.join("\n\n")}\n\n${sections[0]}`;
	}

	return sections[0];
}
