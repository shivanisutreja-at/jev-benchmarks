# Helpdesk Routing Intent Classification Benchmark

A head-to-head benchmarking suite comparing **Jev** (a non-autoregressive "System One" decision model by TypeSafe AI via OpenRouter) against frontier generative LLMs (**GPT-6 Luna**, **DeepSeek** and **Claude Sonnet**) running through Efficia AI agent deployments.

Evaluates models across **250 realistic helpdesk scenarios** on:
- **Decision Speed & Latency** (Mean, P50, P95)
- **Inference Cost** (per token & estimated cost per 10,000 decisions)
- **Accuracy** (Strict Primary Match vs. Relaxed Top-Intent Match on single-intent and multi-intent edge cases)

---

## 🏛️ Architecture

```
              ┌───────────────────────────────────────────────────────────┐
              │                  Benchmark Runner Script                  │
              │               (scripts/benchmark-runner.ts)               │
              └───────────┬───────────────────────────────────┬───────────┘
                          │                                   │
                          │ Efficia REST API                  │ OpenRouter
        ┌─────────────────┼─────────────────┐                 │
        ▼                 ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│Efficia Agent 1│ │Efficia Agent 2│ │Efficia Agent 3│ │   Jev Script  │
│  (gpt-6-luna) │ │   (DeepSeek)  │ │(Claude Sonnet)│ │(~typesafe/jev)│
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        └─────────────────┴────────┬────────┴─────────────────┘
                                   ▼
                   [Latency, Cost & Accuracy Engine]
```

---

## 📋 Evaluated Departments

The triage agent categorizes tickets across 7 core departments:
- **`PYC` (Payroll & Compliance):** Salary delays, payslip errors, deductions, tax/TDS, Form 16, FnF settlements, PF/statutory benefits.
- **`DTE` (Data Management & Tools):** Attendance tracking, biometric/punch records, leave applications & balances, location/team transfers, profile updates.
- **`EMP` (Employment Management):** Official documentation (experience letters, address proof), company policy/guidelines, portal login/OTP issues, formal employee grievances.
- **`ONB` (Onboarding):** Pre-joining formalities, offer/appointment letter queries, joining dates, document verification, Day-1 system access.
- **`ASR` (Annual Reviews & Compensation):** Promotions, appraisal letters, salary increments/hikes, bonuses and incentives.
- **`PMS` (Performance Management):** Performance review cycles, appraisal ratings, goal-setting, self-assessments.
- **`TAL` (Talent & Training):** Training programs, certifications, professional development courses.

### Tie-Breaker Rules (for Multi-Intent Scenarios)
1. **The Root-Cause Rule:** If issue B is caused by issue A (e.g., biometric punch failure leading to attendance error which caused a salary deduction), route to the **ROOT CAUSE (`DTE`)** who must fix data first.
2. **Financial Priority Rule:** If multiple independent issues are mentioned and one involves immediate unpaid salary, missing payout, or tax deduction, route to **`PYC`** first.
3. **The Explicit Ask:** If the user explicitly demands a specific immediate action (e.g. submit grievance), prioritize that department unless blocked by a prerequisite root cause.

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- `npm` or `pnpm`

### 2. Installation
```bash
git clone <your-repo-url>
cd helpdesk-routing-benchmark
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
# OpenRouter API Key for Jev model
OPENROUTER_API_KEY=sk-or-v1-...

# Efficia Backend API Base URL
EFFICIA_API_BASE_URL=https://platform.efficia.io

# Agent 1 (GPT-6 Luna) Configuration
EFFICIA_GPT_DEPLOYMENT_ID=your-gpt-deployment-uuid
EFFICIA_GPT_API_KEY=your-gpt-api-key

# Agent 2 (DeepSeek) Configuration
EFFICIA_DEEPSEEK_DEPLOYMENT_ID=your-deepseek-deployment-uuid
EFFICIA_DEEPSEEK_API_KEY=your-deepseek-api-key

# Agent 3 (Claude Sonnet) Configuration
EFFICIA_CLAUDE_DEPLOYMENT_ID=your-claude-deployment-uuid
EFFICIA_CLAUDE_API_KEY=your-claude-api-key
```

---

## 🧪 Usage

### 1. Generate the 250-Scenario Dataset
Generates 175 single-intent and 75 multi-intent scenarios with ground-truth labels and routing rationales:
```bash
npm run generate:data
```
The dataset is saved to `data/helpdesk-routing-250.json`.

### 2. Test Individual Models
You can verify each model connection independently:

* **Test Jev (System 1 via OpenRouter):**
  ```bash
  npm run test:jev
  ```

* **Test DeepSeek (via Efficia API):**
  ```bash
  npm run test:deepseek
  ```

* **Test GPT-6 Luna (via Efficia API):**
  ```bash
  npm run test:gpt
  ```

* **Test Claude Sonnet (via Efficia API):**
  ```bash
  npm run test:claude
  ```

### 3. Run the Benchmark with Configurable Models

You can run individual models, any alternate combination, or all configured models:

```bash
# Run only Jev
npm run run:benchmark -- --models jev
# Or use the npm shortcut:
npm run benchmark:jev

# Run only OpenAI (GPT-6 Luna)
npm run run:benchmark -- --models openai
npm run benchmark:openai

# Run only DeepSeek
npm run run:benchmark -- --models deepseek
npm run benchmark:deepseek

# Run only Claude Sonnet
npm run run:benchmark -- --models claude
npm run benchmark:claude

# Run alternate combinations:
npm run run:benchmark -- --models jev,deepseek --limit 20
npm run run:benchmark -- --models jev,openai --limit 10
npm run run:benchmark -- --models jev,claude --limit 10

# Boolean flag syntax is also supported:
npm run run:benchmark -- --jev --deepseek --limit 10

# Run all configured models across all 250 scenarios:
npm run run:benchmark
```

Reports are automatically saved to `reports/benchmark-results-[timestamp].json`.

---

## 📊 Output Metrics

At completion, the runner outputs a side-by-side comparison table:

| Metric | Jev (~typesafe/jev-latest) | GPT-6 Luna (Efficia) | DeepSeek (Efficia) | Claude Sonnet (Efficia) |
| :--- | :--- | :--- | :--- | :--- |
| **Strict Acc %** | % matching primary ground truth | % matching primary ground truth | % matching primary ground truth | % matching primary ground truth |
| **Relaxed Acc %** | % matching primary OR secondary | % matching primary OR secondary | % matching primary OR secondary | % matching primary OR secondary |
| **Single-Intent Acc** | % on clear tickets | % on clear tickets | % on clear tickets | % on clear tickets |
| **Multi-Intent Acc** | % on complex edge cases | % on complex edge cases | % on complex edge cases | % on complex edge cases |
| **Avg Latency** | Milliseconds | Milliseconds | Milliseconds | Milliseconds |
| **P95 Latency** | Milliseconds | Milliseconds | Milliseconds | Milliseconds |
| **Total Cost ($)** | Total USD for run | Total USD for run | Total USD for run | Total USD for run |
| **Cost / 10k Decisions** | Projected USD for 10k calls | Projected USD for 10k calls | Projected USD for 10k calls | Projected USD for 10k calls |

---

## 🔒 Security
Never commit `.env` or any real API keys to git. `.gitignore` is pre-configured to ignore all `.env` files.
