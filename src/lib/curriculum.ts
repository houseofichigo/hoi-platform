export type CurriculumPhase = 'scope' | 'build' | 'govern' | 'scale';
export type ModuleId = 'm01' | 'm02' | 'm03' | 'm04' | 'm05' | 'm06' | 'm07' | 'm08' | 'm09' | 'm10' | 'm11' | 'm12';
export type GateNumber = 1 | 2 | 3;
export type GateRole = 'pre' | 'g1' | 'g2' | 'g3' | 'post1' | 'post2' | 'post3';

export interface ModuleMeta {
  id: ModuleId;
  num: number;
  title: string;
  subtitle: string;
  phase: CurriculumPhase;
  phaseNum: number;
  phaseName: string;
  steps: number;
  prereq: ModuleId | null;
  duration: string;
  estimatedMinutes: number;
  gateRole: GateRole;
  gateNumber: GateNumber | null;
  deliverable: string;
  description: string;
  objectives: string[];
  concepts: { term: string; definition: string }[];
  assignment: string;
  outcome: string;
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'm01', num: 1, title: 'LLM Fundamentals',
    subtitle: 'From tools to systems: what language models do, how they work, where they fail.',
    phase: 'scope', phaseNum: 1, phaseName: 'Scope',
    steps: 2, prereq: null, duration: '1h 20m', estimatedMinutes: 80,
    gateRole: 'pre', gateNumber: null,
    deliverable: 'Working mental model + first observations on hallucination & temperature.',
    description: 'Build a working mental model of LLMs — tokenisation, context windows, temperature, the Tool→System spectrum, and why hallucination is a governance problem.',
    objectives: [
      'Explain LLM mechanics: tokenisation, context windows, temperature',
      'Distinguish between Tool, Assistant, Agent, and System levels',
      'Identify hallucination as a governance problem',
      'Compare model capability tables across providers',
    ],
    concepts: [
      { term: 'Hallucination', definition: 'When an AI model produces output that sounds confident but is factually wrong or invented. Models hallucinate because they predict the next likely word, not the next true word.' },
      { term: 'Temperature', definition: 'Controls randomness. Low (0.1) = predictable and factual. High (0.9) = creative but sometimes off-topic.' },
      { term: 'Top-k & Top-p', definition: "Two ways to limit the model's word choices. Both reduce randomness without going as flat as low temperature." },
    ],
    assignment: 'Run two short prompt experiments — one to provoke a hallucination, one to feel how generation parameters change the same answer.',
    outcome: 'A working mental model of LLM behavior plus your first method note: where confidently-wrong AI would be dangerous in your company.',
  },
  {
    id: 'm02', num: 2, title: 'Data Readiness',
    subtitle: 'Connect, govern, and prepare the data your AI system will use.',
    phase: 'scope', phaseNum: 1, phaseName: 'Scope',
    steps: 4, prereq: 'm01', duration: '1h 15m', estimatedMinutes: 75,
    gateRole: 'pre', gateNumber: null,
    deliverable: 'Three-layer data map: internal · contextual · test data.',
    description: 'Identify internal, contextual and task-specific data sources; apply ownership, lineage, quality and access governance; classify by privacy regime (GDPR, EU AI Act).',
    objectives: [
      'Identify data sources: Internal, Contextual, Task-specific',
      'Apply governance: Ownership, Lineage, Quality, Access',
      'Classify data by privacy regime (GDPR, EU AI Act)',
      'Produce a three-layer data map for the worked example',
    ],
    concepts: [
      { term: 'Internal data', definition: 'Data that lives inside your organisation — the fields your systems of record use.' },
      { term: 'Contextual data', definition: 'External rules and regulations the assistant must respect — laws, mandates, industry-specific requirements.' },
      { term: 'Task-specific data', definition: 'The examples used to test the system — clean cases, edge cases, difficult formats.' },
    ],
    assignment: 'Inventory the internal records, the regulatory and process rules, and a deliberate set of edge-case examples for the worked example.',
    outcome: 'A three-layer data map you can hand to any builder — and a list of the gaps that need filling before Develop.',
  },
  {
    id: 'm03', num: 3, title: 'Prompt Engineering',
    subtitle: 'Structured, reliable, reusable prompts that produce real work.',
    phase: 'scope', phaseNum: 1, phaseName: 'Scope',
    steps: 4, prereq: 'm02', duration: '1h 45m', estimatedMinutes: 105,
    gateRole: 'pre', gateNumber: null,
    deliverable: 'Prompt library: three documented entries — schema search · context deep research · mock data generation.',
    description: 'Distinguish prompt placement (user · system · context · workflow) from task type. Apply the six-element framework. Document three reusable prompts, one per data layer, using the optimizer workflow.',
    objectives: [
      'Distinguish prompt placement from prompt task type',
      'Apply the six-element framework: Task · Role · Context · Constraints · Output format · Examples',
      'Build prompts incrementally — one element at a time — and observe how each removes uncertainty',
      'Document three reusable prompt entries mapped to the three data layers',
      'Identify prompt injection and data-leakage risks for each entry',
    ],
    concepts: [
      { term: 'Placement vs task type', definition: 'Placement (user · system · context · workflow) defines authority. Task type (search · extract · classify · generate · summarise · transform · reason · evaluate · guard) defines behaviour. Decide both before writing any prompt.' },
      { term: 'Six-element framework', definition: 'Task · Role · Context · Constraints · Output format · Examples. Each element removes one kind of uncertainty.' },
      { term: 'Prompt optimizer workflow', definition: 'Draft → optimize → test → revise → document. The optimizer is the six-element framework applied as a checklist to surface what is missing.' },
      { term: 'Prompt as security surface', definition: 'Two risks: prompt injection (untrusted content tries to override instructions) and data leakage (sensitive data sent where it should not go). Mitigated by separating instructions from data, using system prompts for control logic, validating outputs, and limiting sensitive data exposure.' },
    ],
    assignment: 'Write three documented prompt-library entries — schema search, context deep research, mock data generation — one per data layer from M02. Each entry uses the six-element framework, notes one injection risk, and passes the quality-bar checklist.',
    outcome: 'A documented prompt library with one entry per data layer — the knowledge base your assistant in M04 will read from.',
  },
  {
    id: 'm04', num: 4, title: 'AI Assistants & RAG',
    subtitle: 'Configure assistants grounded in your data. Apply Gate 1 as an informal readiness check.',
    phase: 'build', phaseNum: 2, phaseName: 'Develop',
    steps: 5, prereq: 'm03', duration: '2h 10m', estimatedMinutes: 130,
    gateRole: 'g1', gateNumber: 1,
    deliverable: 'Grounded assistant blueprint + three-file knowledge base + five-test evaluation + Gate 1 readiness dossier.',
    description: 'Turn the M03 prompt library into a grounded assistant design. Assemble the schema, rules, and mock-data knowledge base; define RAG governance; run five representative tests; prepare the Gate 1 decision.',
    objectives: [
      'Explain how RAG separates instructions, knowledge, retrieval, and generation',
      'Convert the M03 prompt library into a three-file assistant knowledge base',
      'Design an assistant blueprint: role, system rules, knowledge scope, retrieval behaviour, refusal boundaries',
      'Apply four RAG governance dimensions: indexing, access, retention, change',
      'Evaluate the assistant with five representative query types and prepare Gate 1',
    ],
    concepts: [
      { term: 'Assistant architecture', definition: 'A useful assistant is not just a prompt. It has instructions, knowledge sources, retrieval behaviour, tool boundaries, and evaluation tests.' },
      { term: 'RAG', definition: 'Retrieval-Augmented Generation: the assistant retrieves relevant knowledge at query time, then generates an answer grounded in that retrieved context.' },
      { term: 'Knowledge base', definition: 'The assistant-readable body of evidence: schema knowledge, contextual rules, examples, policies, test cases, and known limitations.' },
      { term: 'Gate 1', definition: 'Informal readiness check after the assistant build: is this safe and useful enough to build the prototype layer on? Continue, continue with constraints, improve, or stop.' },
    ],
    assignment: 'Design a grounded assistant for the worked example. Assemble the three knowledge artifacts, define RAG governance, run five tests, and prepare the Gate 1 decision.',
    outcome: 'Assistant blueprint, knowledge-base pack, five test results, and Gate 1 readiness dossier.',
  },
  {
    id: 'm05', num: 5, title: 'Prototyping with No-Code',
    subtitle: 'Build the application your agent will operate inside.',
    phase: 'build', phaseNum: 2, phaseName: 'Develop',
    steps: 3, prereq: 'm04', duration: '1h 40m', estimatedMinutes: 100,
    gateRole: 'post1', gateNumber: null,
    deliverable: 'Prototype blueprint + no-code build brief + three agent requirement cards.',
    description: 'Design the sandbox prototype your agent will later operate inside. Define the four workflow surfaces, produce a no-code build brief, walk through the prototype, and translate the gaps into M06 agent requirements.',
    objectives: [
      'Explain why a prototype bridges assistant evaluation and agent design',
      'Define the four prototype surfaces: upload, review, approve, audit',
      'Write a no-code build brief using sandbox governance and mock data only',
      'Run a stakeholder walkthrough and record friction points',
      'Translate prototype gaps into three agent requirement cards for M06',
    ],
    concepts: [
      { term: 'Prototype', definition: 'A working interface that demonstrates a workflow, not a production system. It uses mock data, simplified logic, and explicit visual cues.' },
      { term: 'Four surfaces', definition: 'Upload, review, approve, audit: the minimum interface loop for AI-supported invoice processing.' },
      { term: 'Sandbox governance', definition: 'Prototype rules: mock data only, no real PII, no production integrations, no hidden automation, and clear labels when outputs are simulated.' },
      { term: 'Agent requirements', definition: 'The gap between what the prototype fakes and what the real agent must do with tools, memory, approvals, and auditability.' },
    ],
    assignment: 'Design a no-code prototype brief for the invoice OCR workflow. Walk through upload, review, approve, and audit, then document three requirements the M06 agent must satisfy.',
    outcome: 'A prototype build brief and three agent requirement cards grounded in the walkthrough.',
  },
  {
    id: 'm06', num: 6, title: 'AI Agents & Pilot',
    subtitle: 'Build the working agent. Apply Gate 2 as an informal pilot-readiness check.',
    phase: 'build', phaseNum: 2, phaseName: 'Develop',
    steps: 5, prereq: 'm05', duration: '3h 00m', estimatedMinutes: 180,
    gateRole: 'g2', gateNumber: 2,
    deliverable: 'Agent blueprint + integration plan + HITL policy + pilot plan + Gate 2 readiness dossier.',
    description: 'Turn the prototype requirements into an agent design. Define the agent goal, tools, memory, action boundary, MCP-style integration plan, HITL checkpoints, pilot metrics, and Gate 2 readiness.',
    objectives: [
      'Distinguish assistant behaviour from agent action',
      'Design an agent workflow with goals, tools, memory, state, and action limits',
      'Map MCP-style integrations to accounting, document, notification, and audit systems',
      'Define human-in-the-loop checkpoints and escalation rules',
      'Run a controlled pilot plan and prepare Gate 2',
    ],
    concepts: [
      { term: 'AI agent', definition: 'An AI system that can pursue a goal through steps, tool calls, memory, and state. It can take action, so its boundary must be explicit.' },
      { term: 'MCP-style integration', definition: 'A controlled way for an agent to access external systems through named tools, permissions, schemas, logs, and revocation rules.' },
      { term: 'HITL', definition: 'Human-in-the-loop checkpoints where the agent must pause, explain, and request approval before continuing.' },
      { term: 'Pilot boundary', definition: 'The agreed limit for who, what data, what systems, what time window, and what rollback path are included in the pilot.' },
    ],
    assignment: 'Design the invoice OCR agent pilot. Map tools and integrations, define HITL checkpoints, set pilot metrics, and prepare Gate 2.',
    outcome: 'Agent pilot blueprint, integration map, HITL policy, pilot metrics, and Gate 2 readiness dossier.',
  },
  {
    id: 'm07', num: 7, title: 'Tools & Platforms',
    subtitle: 'Choose the AI stack that meets your governance requirements — before it becomes a liability.',
    phase: 'govern', phaseNum: 3, phaseName: 'Govern',
    steps: 4, prereq: 'm06', duration: '2h 00m', estimatedMinutes: 120,
    gateRole: 'post2', gateNumber: null,
    deliverable: 'Pilot stack inventory + governance comparison matrix + Tool Selection ADR + keep/replace decision.',
    description: 'Evaluate whether the pilot stack is acceptable for production governance. Compare two platform options across capability, cost, data residency, training opt-out, MCP/tool support, audit logs, compliance posture, and vendor stability.',
    objectives: [
      'Inventory the pilot stack from M04-M06',
      'Compare two platform options against production governance criteria',
      'Identify gaps in residency, training opt-out, tool access, audit logging, and vendor risk',
      'Write a Tool Selection ADR with alternatives and rationale',
      'Decide whether to keep, replace, or constrain the pilot stack',
    ],
    concepts: [
      { term: 'Tool choice as governance', definition: 'Tool selection determines where data goes, who can access it, what is logged, and how failures are investigated.' },
      { term: 'Governance criteria', definition: 'Data residency, training opt-out, MCP/tool support, audit logs, compliance certifications, vendor stability, cost, and operational fit.' },
      { term: 'ADR', definition: 'Architecture Decision Record: a short decision document naming context, options, decision, rationale, consequences, and review date.' },
      { term: 'Pilot-to-production gap', definition: 'The distance between a tool that works in a controlled pilot and a tool that can survive production governance.' },
    ],
    assignment: 'Inventory the pilot stack, compare two platform options, write a Tool Selection ADR, and decide whether to keep, replace, or constrain the stack.',
    outcome: 'A governance-ready tool decision with comparison matrix, ADR, and production constraints.',
  },
  {
    id: 'm08', num: 8, title: 'Deployment Planning',
    subtitle: 'Architecture decisions, security, and cost modelling for the path to production.',
    phase: 'govern', phaseNum: 3, phaseName: 'Govern',
    steps: 4, prereq: 'm07', duration: '1h 30m', estimatedMinutes: 90,
    gateRole: 'post2', gateNumber: null,
    deliverable: 'Integration & Deployment Plan: architecture, security risks, cost model, rollback, and partner handoff.',
    description: 'Convert the selected stack into a deployment plan. Decide local vs cloud and open vs managed, map data flows, identify top security risks, estimate cost, and define rollback.',
    objectives: [
      'Make deployment architecture choices: local vs cloud, open vs managed',
      'Map data flows across app, assistant, agent, storage, accounting, and audit systems',
      'Identify and mitigate the top three deployment security risks',
      'Estimate cost across tokens, infrastructure, licensing, and operations',
      'Write a partner-ready integration and rollback plan',
    ],
    concepts: [
      { term: 'Architecture decision', definition: 'A consequential technical choice documented with context, alternatives, rationale, consequences, and review date.' },
      { term: 'Data-flow control', definition: 'Knowing where data enters, where it is stored, who can access it, where it leaves, and how it is deleted.' },
      { term: 'Security at scale', definition: 'Authentication, secrets management, signed webhooks, audit logs, least privilege, and incident response.' },
      { term: 'Cost model', definition: 'Expected spend across LLM tokens, OCR/API usage, compute, storage, licensing, support, and human review time.' },
    ],
    assignment: 'Write the integration and deployment plan for the invoice OCR pilot: architecture choice, data flow, top three risks, cost model, rollback, and partner handoff.',
    outcome: 'A 1-2 page Integration & Deployment Plan ready for deployment partners.',
  },
  {
    id: 'm09', num: 9, title: 'AI Portfolio Scoring & Use Case Prioritisation',
    subtitle: 'Apply the formal scoring engine. Gate 3 turns the result into an investment decision.',
    phase: 'govern', phaseNum: 3, phaseName: 'Govern',
    steps: 5, prereq: 'm08', duration: '2h 00m', estimatedMinutes: 120,
    gateRole: 'g3', gateNumber: 3,
    deliverable: 'Scored four-use-case portfolio + automation maps + Gate 3 investment dossier.',
    description: 'Score the worked example and three additional candidates using the eight-pillar engine. Interpret reason codes, map automation steps, rank the portfolio, and prepare Gate 3 investment decisions.',
    objectives: [
      'Apply Capture → Prioritise → Map methodology at portfolio scale',
      'Score four use cases against the eight-pillar engine',
      'Use reason codes to make constraints and blockers explicit',
      'Create step-level automation maps for each candidate',
      'Apply Gate 3 as a formal investment decision across the portfolio',
    ],
    concepts: [
      { term: 'Eight-pillar engine', definition: 'Business Impact, Feasibility, Process Maturity, Risk, AI Suitability, Agent Suitability, Delivery Readiness, and Priority.' },
      { term: 'Reason codes', definition: 'Traceable labels that explain why a use case is blocked, constrained, or preferred.' },
      { term: 'Automation map', definition: 'A step-by-step process view showing what is manual, assisted, automated, or forbidden.' },
      { term: 'Gate 3', definition: 'Formal portfolio investment decision: fund, fund with constraints, defer, or stop.' },
    ],
    assignment: 'Score the invoice OCR worked example and three additional AI candidates. Build automation maps, rank the portfolio, and prepare Gate 3 investment decisions.',
    outcome: 'A scored portfolio with investment recommendation, constraints, and Gate 3 dossier.',
  },
  {
    id: 'm10', num: 10, title: 'Documentation & Adoption',
    subtitle: 'Make the system survivable across teams with playbooks and handoffs.',
    phase: 'scale', phaseNum: 4, phaseName: 'Deploy',
    steps: 3, prereq: 'm09', duration: '1h 30m', estimatedMinutes: 90,
    gateRole: 'post3', gateNumber: null,
    deliverable: 'Documentation Pack: system card · operating playbook · five-stage handoff plan.',
    description: 'Document the AI system at three layers: architecture, decisions, and governance. Write a system card aligned with EU AI Act Article 11, produce a non-engineer operating playbook, and design a five-stage handoff process.',
    objectives: [
      'Document AI at three layers: architecture, decisions, governance',
      'Write a system card aligned with EU AI Act Article 11',
      'Produce an operating playbook for non-engineers',
      'Distinguish tacit knowledge from explicit operating instructions',
      'Design a five-stage handoff: review, shadow, joint, backup, ownership',
    ],
    concepts: [
      { term: 'System card', definition: 'A system card documents the complete AI system in context: purpose, boundaries, data, users, risks, monitoring, and human oversight.' },
      { term: 'EU AI Act documentation', definition: 'High-risk AI documentation patterns: intended purpose, data, validation, monitoring, human oversight, risk controls, and change management.' },
      { term: 'Tacit vs explicit knowledge', definition: 'Tacit knowledge lives in the builder’s head. Explicit knowledge is written so another operator can run, debug, and improve the system.' },
      { term: 'Five-stage handoff', definition: 'Review → Shadow → Joint → Backup → Ownership. Responsibility transfers gradually instead of by ceremony.' },
    ],
    assignment: 'Produce a documentation outline, a system card, a 2-3 page operating playbook for the AP team, and a five-stage handoff plan.',
    outcome: 'A Documentation Pack ready for the operating team.',
  },
  {
    id: 'm11', num: 11, title: 'Monitoring & Quality',
    subtitle: 'Detect drift, calibrate alerts, feed re-scoring decisions back into the portfolio.',
    phase: 'scale', phaseNum: 4, phaseName: 'Deploy',
    steps: 4, prereq: 'm10', duration: '2h 30m', estimatedMinutes: 150,
    gateRole: 'post3', gateNumber: null,
    deliverable: '1-page Monitoring Plan + drift trigger spec + portfolio re-scoring criteria.',
    description: 'Define monitoring metrics across performance, accuracy, drift, and fairness. Calibrate alert thresholds and escalation paths, document drift response, and specify when production signals trigger portfolio re-scoring.',
    objectives: [
      'Define metrics across performance, accuracy, drift, and fairness',
      'Design alert thresholds and escalation paths',
      'Detect and categorise data, concept, and model drift',
      'Write an incident response path for monitoring failures',
      'Trigger portfolio re-scoring on significant drift events',
    ],
    concepts: [
      { term: 'Monitoring categories', definition: 'Four tiers: performance, accuracy, drift, and fairness. A healthy system watches all four.' },
      { term: 'Drift types', definition: 'Data drift changes inputs, concept drift changes meaning, model drift changes behaviour. Each needs a different response.' },
      { term: 'Alert tiers', definition: 'Info, warning, critical, and stop conditions. Alerts must route to a named owner, not a vague team.' },
      { term: 'Re-scoring trigger', definition: 'A production threshold that sends the use case back to the M09 scoring engine because its risk, value, or readiness changed.' },
    ],
    assignment: 'Define metrics for the invoice OCR system, configure alert thresholds, write drift response rules, and identify events that trigger portfolio re-scoring.',
    outcome: 'A 1-page Monitoring Plan with drift triggers, escalation paths, and re-scoring criteria.',
  },
  {
    id: 'm12', num: 12, title: 'AI Strategy & Roadmap',
    subtitle: 'Turn one scored portfolio into a 12-month investment roadmap that an executive sponsor can sign.',
    phase: 'scale', phaseNum: 4, phaseName: 'Deploy',
    steps: 4, prereq: 'm11', duration: '1h 30m', estimatedMinutes: 90,
    gateRole: 'post3', gateNumber: null,
    deliverable: 'AI Strategy Roadmap: 12-month plan + capability gap analysis + executive summary.',
    description: 'Synthesize the scored portfolio from M09 into a sequenced 12-month AI roadmap. Translate technical capability into business outcomes, identify gaps across people/tools/partnerships, design an executive scorecard, and plan the next pilot cycle.',
    objectives: [
      'Synthesize the scored portfolio from M09 into a sequenced 12-month roadmap',
      'Translate technical capability into business outcomes for executive sponsors',
      'Identify capability gaps across people, tools, and partnerships',
      'Design an executive scorecard for AI program health',
      'Plan the next pilot cycle with explicit go/no-go criteria',
    ],
    concepts: [
      { term: 'Portfolio to roadmap', definition: 'The roadmap sequences scored use cases by readiness, dependencies, investment, and organisational capacity.' },
      { term: 'Three horizons', definition: 'Now (0-3 months), Next (3-9 months), Later (9-12 months). The planning frame for AI investment.' },
      { term: 'Capability gaps', definition: 'The missing people, tools, partnerships, governance, or operating routines required to scale.' },
      { term: 'Executive scorecard', definition: 'A one-page view of program health: live systems, pilots, governance status, risk posture, investment, and impact.' },
    ],
    assignment: 'Build a 12-month AI roadmap using the scored portfolio from M09. Include sequencing, capability gaps, investment estimates, executive scorecard, and one-page sponsor summary.',
    outcome: 'AI Strategy Roadmap, capability gap analysis, executive scorecard, and executive summary.',
  },
];

export const PHASES = [
  { num: 1, id: 'scope' as const, name: 'Scope', subtitle: 'Understand. Prepare. Practise.', modules: ['m01', 'm02', 'm03'] as ModuleId[], artifact: 'The Foundation' },
  { num: 2, id: 'build' as const, name: 'Develop', subtitle: 'Assistant. Prototype. Agent.', modules: ['m04', 'm05', 'm06'] as ModuleId[], artifact: 'The System' },
  { num: 3, id: 'govern' as const, name: 'Govern', subtitle: 'Choose. Plan. Score.', modules: ['m07', 'm08', 'm09'] as ModuleId[], artifact: 'The Operating Plan' },
  { num: 4, id: 'scale' as const, name: 'Deploy', subtitle: 'Document. Monitor. Roadmap.', modules: ['m10', 'm11', 'm12'] as ModuleId[], artifact: 'The Handoff Pack' },
];

export const ARTIFACTS = [
  { id: 'foundation', phase: 1, phaseName: 'Scope', title: 'The Foundation', modules: ['m01', 'm02', 'm03'] as ModuleId[] },
  { id: 'system', phase: 2, phaseName: 'Develop', title: 'The System', modules: ['m04', 'm05', 'm06'] as ModuleId[] },
  { id: 'operating_plan', phase: 3, phaseName: 'Govern', title: 'The Operating Plan', modules: ['m07', 'm08', 'm09'] as ModuleId[] },
  { id: 'handoff_pack', phase: 4, phaseName: 'Deploy', title: 'The Handoff Pack', modules: ['m10', 'm11', 'm12'] as ModuleId[] },
];

export function getModule(id: ModuleId): ModuleMeta | undefined {
  return MODULES.find(m => m.id === id);
}
export function getPhase(num: 1 | 2 | 3 | 4) {
  return PHASES.find(p => p.num === num);
}

export function isValidModuleId(id: string): id is ModuleId {
  return MODULES.some((m) => m.id === id);
}
