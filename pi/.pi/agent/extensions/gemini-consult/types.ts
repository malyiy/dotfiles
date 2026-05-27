/**
 * Shared types for gemini-consult extension
 */

/** Gemini CLI JSON output */
export interface GeminiCliOutput {
	session_id: string;
	response: string;
	stats: {
		models: Record<string, {
			api: { totalRequests: number; totalErrors: number; totalLatencyMs: number };
			tokens: { input: number; prompt: number; candidates: number; total: number; cached: number };
		}>;
	};
}

/** Active consultation state */
export interface Consultation {
	id: string;
	geminiSessionId: string | null;
	turnCount: number;
	createdAt: number;
	lastResponse: string;
}

/** Context gathered from the current pi session */
export interface SessionContext {
	/** What the user is trying to accomplish */
	goal: string;
	/** Relevant tech stack (only what's directly involved) */
	techStack: string[];
	/** Key decisions and outcomes from recent work */
	progress: string[];
	/** The specific question for this consultation */
	question: string;
}

/** Result returned from a consultation */
export interface ConsultationResult {
	consultationId: string;
	summary: string;
	turnCount: number;
	geminiSessionId: string;
	totalTokens: number;
}
