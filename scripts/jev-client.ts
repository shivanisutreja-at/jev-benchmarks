import * as dotenv from "dotenv";
dotenv.config();

export interface JevClassificationResult {
  category: string;
  confidence: number;
  probabilities: Record<string, number>;
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  rawResponse: any;
}

export interface JevClientConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

const DEFAULT_MODEL = "~typesafe/jev-latest";
const DEFAULT_DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// Pricing: $0.042 per million input tokens, $0 for output tokens
const JEV_INPUT_TOKEN_PRICE = 0.042 / 1_000_000;

export const CATEGORY_DEFINITIONS: Record<string, string> = {
  PYC: "Payroll & Compliance: Salary delays, payslip access/errors, deductions, tax/TDS, Form 16, FnF settlements, PF/statutory benefits.",
  DTE: "Data Management & Tools: Attendance tracking, biometric/punch records, leave applications & balances, location/team transfers, profile updates.",
  EMP: "Employment Management: Requests for official documentation (experience letters, address proof), company policy/guidelines, portal login/credential/OTP issues, formal employee grievances.",
  ONB: "Onboarding: Pre-joining formalities, offer/appointment letter queries, joining date confirmation, document verification, Day-1 system access.",
  ASR: "Annual Reviews & Compensation: Promotions, appraisal letters, salary increments/hikes, bonuses and incentives.",
  PMS: "Performance Management: Performance review cycles, appraisal ratings, goal-setting and self-assessments.",
  TAL: "Talent & Training: Training programs, certifications, professional development courses.",
};

export const ROUTING_INSTRUCTIONS = `You are the central triage agent for the Helpdesk Support Platform.
Evaluate the conversation and decide which department must take ownership of this ticket.

Departments:
- PYC: Payroll & Compliance
- DTE: Data Management & Tools (attendance, biometric, leave, transfer)
- EMP: Employment Management (letters, policies, portal login, grievances)
- ONB: Onboarding & Day-1 access
- ASR: Annual Reviews, promotions, increments, bonuses
- PMS: Performance reviews, appraisal ratings, goals
- TAL: Talent & Training programs

Tie-Breaker Rules:
1. Root-Cause Rule: If issue B is caused by issue A (e.g., biometric punch failure leading to attendance error which caused a salary deduction), route to the ROOT CAUSE (DTE) who must correct data first.
2. Financial Priority Rule: If independent issues are mentioned and one involves immediate unpaid salary, missing payout, or tax deduction, route to PYC first.
3. Explicit Ask: If the user specifically demands an immediate action (e.g. submit grievance), prioritize that department unless blocked by a prerequisite root cause.`;

/**
 * Calls Jev decision model via OpenRouter Decisions API
 */
export async function classifyWithJev(
  conversationText: string,
  config: JevClientConfig = {},
): Promise<JevClassificationResult> {
  const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Please set it in benchmarks/.env",
    );
  }

  const model = config.model || DEFAULT_MODEL;
  const endpoint = config.baseUrl || DEFAULT_DECISIONS_URL;

  const requestBody = {
    model,
    state: conversationText,
    questions: {
      routing_category: {
        type: "choice",
        instructions: ROUTING_INSTRUCTIONS,
        criteria: CATEGORY_DEFINITIONS,
      },
    },
  };

  const startTime = performance.now();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://efficia.ai",
      "X-Title": "Efficia Helpdesk Routing Benchmark",
    },
    body: JSON.stringify(requestBody),
  });

  const endTime = performance.now();
  const latencyMs = Math.round((endTime - startTime) * 100) / 100;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter Jev API error (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();

  // Parse OpenRouter Jev decision output
  // OpenRouter Decisions API returns: { answers: { routing_category: { choice, probabilities, confidence } } }
  const decision =
    data.answers?.routing_category ||
    data.decisions?.routing_category ||
    data.questions?.routing_category ||
    data.routing_category ||
    data;

  const chosenCategory =
    decision.choice ||
    decision.selected ||
    decision.value ||
    decision.answer ||
    Object.keys(decision.probabilities || {})[0] ||
    "UNC";

  const confidence = decision.confidence ?? decision.probability ?? 1.0;
  const probabilities = decision.probabilities || decision.distribution || {};

  const inputTokens =
    data.usage?.prompt_tokens ?? Math.ceil(conversationText.length / 4);
  const costUsd = Number((inputTokens * JEV_INPUT_TOKEN_PRICE).toFixed(8));

  return {
    category: chosenCategory,
    confidence,
    probabilities,
    latencyMs,
    inputTokens,
    costUsd,
    rawResponse: data,
  };
}
