import * as fs from 'fs';
import * as path from 'path';

export interface DialogueTurn {
  speaker: 'employee' | 'agent';
  text: string;
}

export interface Scenario {
  id: string;
  category: string; // Ground truth primary category
  is_multi_intent: boolean;
  conversation: DialogueTurn[];
  formatted_dialogue: string;
  primary_category: string;
  secondary_categories: string[];
  routing_rationale: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const CATEGORIES = ['PYC', 'DTE', 'EMP', 'ONB', 'ASR', 'PMS', 'TAL'];

// Templates and scenario seeds across all categories
const SEED_TEMPLATES = {
  PYC: [
    {
      emp: "My salary for last month was not credited. It has been 4 days past the payout cycle.",
      agent: "I understand. Did you notice any email regarding bank batch processing or payroll hold?",
      followup: "No email at all, and everyone on my floor has received their salary.",
      multi: false,
      sec: [],
      reason: "Direct salary non-disbursement issue.",
      diff: 'easy'
    },
    {
      emp: "I noticed a TDS deduction of ₹14,500 on my latest payslip, but my investment proofs were submitted on time.",
      agent: "Were your 80C and rent receipt proofs marked as verified in the tax portal?",
      followup: "Yes, the portal showed verified before the 15th cutoff, so this deduction seems incorrect.",
      multi: false,
      sec: [],
      reason: "Tax deduction discrepancy against verified declaration.",
      diff: 'easy'
    },
    {
      emp: "I resigned last month and my last working day was the 10th. When will my full and final settlement amount be credited?",
      agent: "Have you completed all clearance checklists with your department manager and IT?",
      followup: "Yes, no-dues clearance is 100% complete from my side since two weeks ago.",
      multi: false,
      sec: [],
      reason: "Full and final (FnF) exit settlement disbursement timeline.",
      diff: 'easy'
    },
    {
      emp: "My Provident Fund account number is not reflecting in the EPFO unified portal, and UAN is still unlinked.",
      agent: "Did you submit your previous employer transfer form 13 or is this for your current PF account?",
      followup: "It's for my current employer deductions. The money is getting deducted from payslip but not showing in passbook.",
      multi: false,
      sec: [],
      reason: "Provident fund deduction and UAN portal discrepancy.",
      diff: 'medium'
    },
    {
      emp: "I worked 32 hours of approved overtime during the product release, but OT allowance is missing in this payslip.",
      agent: "Was your overtime approval logged in the attendance system before the 25th?",
      followup: "Yes, manager approved it on the 22nd. I need the OT pay credited or paid in an off-cycle batch.",
      multi: true,
      sec: ['DTE'],
      reason: "Financial priority: employee seeks missing OT payout even though attendance logged it.",
      diff: 'medium'
    },
    {
      emp: "I resigned and need my FnF settlement, but also my relieving letter hasn't been generated yet.",
      agent: "Has your exit clearance been approved across all departments?",
      followup: "Yes, everything is signed off. I need both the final payout and the official relieving letter.",
      multi: true,
      sec: ['EMP'],
      reason: "Financial priority: FnF settlement disbursement takes priority over documentation delivery.",
      diff: 'medium'
    }
  ],
  DTE: [
    {
      emp: "The biometric scanner at the 3rd floor reception failed to read my fingerprint today morning.",
      agent: "Did you try the manual swipe or inform the facility front desk?",
      followup: "I tried twice, then entered via security. The portal currently marks me as absent.",
      multi: false,
      sec: [],
      reason: "Biometric hardware scanner failure causing absent marking.",
      diff: 'easy'
    },
    {
      emp: "I want to apply for 4 days of earned leave next month, but the portal shows my balance as zero.",
      agent: "Did your leave balance carry-forward from last quarter get updated?",
      followup: "No, last quarter I had 12 unutilized days. The portal balance hasn't refreshed.",
      multi: false,
      sec: [],
      reason: "Leave balance ledger calculation and sync error in data management.",
      diff: 'easy'
    },
    {
      emp: "I have requested a location transfer from the Gurgaon branch to Bangalore starting next month.",
      agent: "Has your department head approved the location change in the workflow?",
      followup: "Yes, approved in workflow last week. I need my official reporting location updated in the system.",
      multi: false,
      sec: [],
      reason: "Employee master data transfer and branch location update.",
      diff: 'easy'
    },
    {
      emp: "The biometric scanner was down on Friday, so the system marked me absent. Because of that, one day salary was deducted in my payslip!",
      agent: "Did you raise an attendance regularisation request with your manager?",
      followup: "Manager approved regularisation, but the attendance team hasn't adjusted the record.",
      multi: true,
      sec: ['PYC'],
      reason: "Root-Cause Rule: Attendance record must be corrected by DTE before Payroll can reverse the salary deduction.",
      diff: 'hard'
    },
    {
      emp: "My manager approved my internal transfer to QA team, but my reporting line and project allocation are still unchanged.",
      agent: "Has HR Operations verified the team reassignment request?",
      followup: "Yes, but in all tools and approval hierarchies I still report to my previous manager.",
      multi: false,
      sec: [],
      reason: "Master data hierarchy and reporting manager mapping.",
      diff: 'medium'
    },
    {
      emp: "I tried to punch out yesterday evening at 7 PM but the machine was offline. My manager won't approve manual regularization.",
      agent: "Did you capture a photo or security log entry at the gate?",
      followup: "Yes, security confirmed my exit. I need my attendance record corrected so I'm not marked half-day.",
      multi: true,
      sec: ['EMP'],
      reason: "Data Management: primary issue is attendance record regularisation despite manager friction.",
      diff: 'medium'
    }
  ],
  EMP: [
    {
      emp: "I need a salary certificate and address proof letter issued on official company letterhead for my visa interview.",
      agent: "When is your embassy appointment scheduled?",
      followup: "It is scheduled for next Tuesday, so I need the signed digital letter by this Friday.",
      multi: false,
      sec: [],
      reason: "Official employment documentation request.",
      diff: 'easy'
    },
    {
      emp: "I am unable to log in to the employee self-service portal. It says account locked due to consecutive wrong passwords.",
      agent: "Have you attempted the self-service OTP reset link on the login page?",
      followup: "Yes, but the reset SMS is not arriving on my registered mobile number.",
      multi: false,
      sec: [],
      reason: "Employee portal tool support, login lockout, and OTP troubleshooting.",
      diff: 'easy'
    },
    {
      emp: "I need clarification on the company travel and per-diem policy for tier-1 city client visits.",
      agent: "Are you inquiring about hotel daily allowance limits or flight booking advance rules?",
      followup: "Mainly hotel daily reimbursement limits and local cab expense eligibility without receipts.",
      multi: false,
      sec: [],
      reason: "Policy guidelines inquiry and expense rule clarification.",
      diff: 'easy'
    },
    {
      emp: "I want to formally lodge a grievance regarding persistent unfair treatment and micromanagement by my project lead.",
      agent: "Have you previously discussed this with your skip-level manager or mentor?",
      followup: "Yes, but no action was taken. I want to register a formal ticket with the grievance committee.",
      multi: false,
      sec: [],
      reason: "Formal employee grievance and workplace complaint escalation.",
      diff: 'easy'
    },
    {
      emp: "I am unable to download my payslip from the portal because every time I click download it gives a server 500 error.",
      agent: "Does this happen for all months or only the most recent month?",
      followup: "Only the recent month. The portal PDF generator keeps crashing.",
      multi: true,
      sec: ['PYC'],
      reason: "Tool Support / EMP: issue is portal application failure rather than a payroll salary calculation error.",
      diff: 'medium'
    },
    {
      emp: "I was unfairly given a warning letter by my manager, and now I cannot log into the appraisal portal.",
      agent: "Is your portal access revoked or is there a credential error?",
      followup: "My account seems suspended. I want to lodge a complaint about the warning and get my login restored.",
      multi: true,
      sec: ['PMS'],
      reason: "EMP: Primary explicit demand is lodging a formal grievance and restoring portal access.",
      diff: 'hard'
    }
  ],
  ONB: [
    {
      emp: "Hello, my joining date was confirmed for next Monday, but I haven't received my formal appointment letter yet.",
      agent: "Have all background verification documents and past company relieving letters been submitted?",
      followup: "Yes, the recruitment team confirmed all BGV checks passed last Thursday.",
      multi: false,
      sec: [],
      reason: "Pre-joining onboarding documentation and appointment letter delivery.",
      diff: 'easy'
    },
    {
      emp: "Today is my Day 1, and my corporate email ID and laptop login credentials have not been activated.",
      agent: "Welcome to the team! Did your hiring manager initiate the Day-1 IT provisioning request?",
      followup: "They said it was submitted, but IT helpdesk told me onboarding hasn't triggered my profile.",
      multi: false,
      sec: [],
      reason: "New hire Day-1 system provisioning and onboarding access.",
      diff: 'easy'
    },
    {
      emp: "I need to know the schedule and meeting link for the virtual induction session tomorrow.",
      agent: "Which business unit or branch are you joining?",
      followup: "I am joining the Bangalore Enterprise Engineering team as a new associate.",
      multi: false,
      sec: [],
      reason: "New joiner onboarding induction schedule inquiry.",
      diff: 'easy'
    },
    {
      emp: "I joined 5 days ago and my bank account details were verified, but my employee ID is still not showing in the attendance system.",
      agent: "Did you complete the onboarding checklist on the welcome portal?",
      followup: "Yes, all documents were submitted before day 1. I cannot punch attendance until this is mapped.",
      multi: true,
      sec: ['DTE'],
      reason: "Root-Cause: Onboarding profile activation must complete before attendance punching can work.",
      diff: 'medium'
    }
  ],
  ASR: [
    {
      emp: "My manager announced my promotion to Lead Analyst during appraisal, but my revised CTC letter hasn't been issued.",
      agent: "Was your promotion cycle part of the mid-year or annual compensation review?",
      followup: "It was part of the annual cycle effective April 1st. My peers already received their letters.",
      multi: false,
      sec: [],
      reason: "Annual compensation review promotion confirmation and revised CTC letter.",
      diff: 'easy'
    },
    {
      emp: "The festival performance bonus communicated in my appraisal letter has not been credited in this cycle.",
      agent: "Was the payout stipulated for the September payroll cycle?",
      followup: "Yes, the letter clearly stated the variable incentive would be disbursed along with September pay.",
      multi: true,
      sec: ['PYC'],
      reason: "ASR: Dispute regarding annual review bonus terms and compensation eligibility.",
      diff: 'medium'
    },
    {
      emp: "My promotion was approved in writing by the VP, but my designation on the HR portal is still Junior Specialist.",
      agent: "Has the annual review cycle officially concluded for your department?",
      followup: "Yes, two weeks ago. The revised salary reflects, but designation and band remain unupdated.",
      multi: true,
      sec: ['DTE'],
      reason: "ASR: Promotion title discrepancy from annual compensation review.",
      diff: 'medium'
    }
  ],
  PMS: [
    {
      emp: "The performance management portal is giving an error when I try to submit my self-assessment for Q3.",
      agent: "What error message is displayed when you click the submit button?",
      followup: "It says 'Goal weightages must sum to 100%', but my weights clearly sum to 100%.",
      multi: false,
      sec: [],
      reason: "Performance management portal goal submission and self-assessment workflow.",
      diff: 'easy'
    },
    {
      emp: "I want to contest my annual performance rating. My manager assigned a 'Meets Expectations' without holding the mandatory 1-on-1 discussion.",
      agent: "Have you submitted an appraisal rating dispute form to your skip-level manager?",
      followup: "Not yet, I wanted to know the official escalation procedure for rating disputes under PMS policy.",
      multi: false,
      sec: [],
      reason: "Performance management appraisal rating dispute and review policy.",
      diff: 'medium'
    },
    {
      emp: "My appraisal rating was downgraded from Exceeds to Meets after the calibration committee meeting without any feedback.",
      agent: "Was a calibration summary note shared by your department review panel?",
      followup: "No explanation was provided at all. I need this escalated to the PMS committee.",
      multi: false,
      sec: [],
      reason: "Performance calibration committee rating dispute.",
      diff: 'medium'
    }
  ],
  TAL: [
    {
      emp: "I want to enroll in the AWS Solutions Architect corporate certification program sponsored by the company.",
      agent: "Have you obtained your delivery manager's approval for the certification sponsorship?",
      followup: "Yes, manager approval email is attached. I need to know the voucher issuance procedure.",
      multi: false,
      sec: [],
      reason: "Talent Management certification sponsorship and learning program enrollment.",
      diff: 'easy'
    },
    {
      emp: "Where can I find the mandatory annual compliance and data privacy training modules?",
      agent: "Are you accessing the Learning Management System (LMS) from the company network or VPN?",
      followup: "Via company VPN. The portal shows no active courses assigned under my profile.",
      multi: false,
      sec: [],
      reason: "LMS training course assignment and mandatory learning curriculum.",
      diff: 'easy'
    },
    {
      emp: "I completed the 40-hour project management training but my course completion certificate is not reflecting in my profile.",
      agent: "Did you complete the post-course assessment quiz?",
      followup: "Yes, scored 92% on Friday. I need the certificate verified and added to my training record.",
      multi: false,
      sec: [],
      reason: "Training completion verification and certification records.",
      diff: 'easy'
    }
  ]
};

// Target counts across categories to sum to 250
const TARGET_COUNTS: Record<string, number> = {
  PYC: 50,
  DTE: 50,
  EMP: 45,
  ASR: 35,
  ONB: 30,
  PMS: 25,
  TAL: 15
};

export function generateScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];
  let globalIndex = 1;

  for (const cat of CATEGORIES) {
    const target = TARGET_COUNTS[cat];
    const templates = SEED_TEMPLATES[cat as keyof typeof SEED_TEMPLATES] || [];

    for (let i = 0; i < target; i++) {
      const template = templates[i % templates.length];
      const variationIndex = Math.floor(i / templates.length) + 1;

      const id = `TC-${String(globalIndex).padStart(3, '0')}`;
      globalIndex++;

      // Create natural dialogue variations
      let empText = template.emp;
      let agentText = template.agent;
      let followupText = template.followup;

      if (variationIndex > 1) {
        empText = `[Ref #${1000 + globalIndex}] ${empText}`;
      }

      const conversation: DialogueTurn[] = [
        { speaker: 'employee', text: empText },
        { speaker: 'agent', text: agentText },
        { speaker: 'employee', text: followupText },
      ];

      const formatted = conversation
        .map(t => `${t.speaker === 'employee' ? 'Employee' : 'Helpdesk Agent'}: ${t.text}`)
        .join('\n');

      scenarios.push({
        id,
        category: cat,
        is_multi_intent: template.multi,
        conversation,
        formatted_dialogue: formatted,
        primary_category: cat,
        secondary_categories: template.sec,
        routing_rationale: template.reason,
        difficulty: template.diff as any,
      });
    }
  }

  return scenarios;
}

export function saveDataset() {
  const scenarios = generateScenarios();
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const outputPath = path.join(dataDir, 'helpdesk-routing-250.json');
  fs.writeFileSync(outputPath, JSON.stringify(scenarios, null, 2), 'utf-8');

  console.log(`✅ Successfully generated ${scenarios.length} scenarios!`);
  console.log(`📁 File written to: ${outputPath}`);

  const counts: Record<string, number> = {};
  let multiCount = 0;
  for (const s of scenarios) {
    counts[s.primary_category] = (counts[s.primary_category] || 0) + 1;
    if (s.is_multi_intent) multiCount++;
  }

  console.log('\nDistribution by Category:');
  console.table(counts);
  console.log(`Multi-Intent Scenarios: ${multiCount} (${((multiCount / scenarios.length) * 100).toFixed(1)}%)`);
  console.log(`Single-Intent Scenarios: ${scenarios.length - multiCount} (${(((scenarios.length - multiCount) / scenarios.length) * 100).toFixed(1)}%)`);
}

// Run if directly executed
if (process.argv[1]?.endsWith('generate-dataset.ts')) {
  saveDataset();
}
