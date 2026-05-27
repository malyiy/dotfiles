/**
 * Gemini CLI client
 *
 * Uses the official `gemini` CLI in headless mode (-p) with JSON output.
 * Multi-turn conversations via --resume <session_id>.
 *
 * Requirements:
 *   - gemini CLI installed and authenticated
 *   - Available in PATH
 */

import { spawn } from "node:child_process";
import type { GeminiCliOutput } from "./types.ts";

const GEMINI_BIN = "gemini";
const QUERY_TIMEOUT_MS = 120_000; // 2 min

// ── Check CLI availability ─────────────────────────────────────────────────

let cachedAvailable: boolean | null = null;

export async function isGeminiAvailable(): Promise<boolean> {
	if (cachedAvailable !== null) return cachedAvailable;
	try {
		const result = await runRaw(["--version"], 5000);
		cachedAvailable = result.exitCode === 0;
	} catch {
		cachedAvailable = false;
	}
	return cachedAvailable;
}

// ── Low-level process runner ───────────────────────────────────────────────

interface RawResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

function runRaw(args: string[], timeoutMs: number, cwd?: string, signal?: AbortSignal): Promise<RawResult> {
	return new Promise((resolve, reject) => {
		const proc = spawn(GEMINI_BIN, args, {
			cwd: cwd || process.cwd(),
			env: { ...process.env },
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let settled = false;

		const timer = setTimeout(() => {
			settled = true;
			proc.kill("SIGTERM");
			setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 3000);
			reject(new Error("Gemini query timed out"));
		}, timeoutMs);

		const onAbort = () => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			proc.kill("SIGTERM");
			setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 3000);
			reject(new Error("Gemini query was cancelled"));
		};

		if (signal) {
			if (signal.aborted) { onAbort(); return; }
			signal.addEventListener("abort", onAbort, { once: true });
		}

		proc.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
		proc.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

		proc.on("close", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			resolve({ stdout, stderr, exitCode: code ?? 1 });
		});

		proc.on("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			if ((err as any).code === "ENOENT") {
				reject(new Error("Gemini CLI not found in PATH. Install it first."));
			} else {
				reject(err);
			}
		});
	});
}

// ── Send message ───────────────────────────────────────────────────────────

export interface SendMessageOptions {
	prompt: string;
	resumeSessionId?: string | null;
	signal?: AbortSignal;
	cwd?: string;
}

/**
 * Send a message to Gemini CLI and return the parsed JSON response.
 *
 * Uses `gemini -p "prompt" -o json [--resume <id>]`
 */
export async function sendMessage(options: SendMessageOptions): Promise<GeminiCliOutput> {
	const args = ["-p", options.prompt, "-o", "json"];

	if (options.resumeSessionId) {
		args.push("--resume", options.resumeSessionId);
	}

	let result: RawResult;
	try {
		result = await runRaw(args, QUERY_TIMEOUT_MS, options.cwd, options.signal);
	} catch (error: any) {
		if (error.message?.includes("ENOENT")) {
			throw new Error(
				"Gemini CLI not found. Install: https://github.com/google-gemini/gemini-cli\n" +
				"Then run: gemini auth login",
			);
		}
		throw error;
	}

	if (result.exitCode !== 0) {
		const errMsg = result.stderr || result.stdout;
		throw new Error(`Gemini CLI exited with code ${result.exitCode}: ${errMsg.slice(0, 300)}`);
	}

	// Parse JSON output
	try {
		const jsonStart = result.stdout.indexOf("{");
		if (jsonStart === -1) {
			throw new Error("No JSON in output");
		}
		return JSON.parse(result.stdout.slice(jsonStart));
	} catch {
		// Fallback: return raw text as response
		const text = result.stdout.trim();
		if (text) {
			return { session_id: "", response: text, stats: { models: {} } };
		}
		throw new Error(`Could not parse Gemini output: ${result.stdout.slice(0, 200)}`);
	}
}

// ── Session listing ────────────────────────────────────────────────────────

export async function listSessions(cwd?: string): Promise<Array<{ index: number; title: string; id: string }>> {
	try {
		const result = await runRaw(["--list-sessions"], 10000, cwd);
		const sessions: Array<{ index: number; title: string; id: string }> = [];
		for (const line of result.stdout.split("\n")) {
			const match = line.match(/^\s*(\d+)\.\s+(.+?)\s+\((.+?)\)\s+\[([a-f0-9-]+)\]/);
			if (match) {
				sessions.push({ index: parseInt(match[1]), title: match[2], id: match[4] });
			}
		}
		return sessions;
	} catch {
		return [];
	}
}
