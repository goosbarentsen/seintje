# CLAUDE.md — Seintje

## What this is
Seintje is a Dutch service that watches over the bank account of someone you love, without it becoming your daily job. Via the regulated PSD2 bank connection (view-only — transferring money is technically impossible, also for us) it learns the elderly person's normal payment pattern and alerts both the senior and a chosen family member when something deviates: the pattern of a scammer, but also the small things — a creeping subscription, a duplicate charge, a pension that didn't arrive. Big alarms for fraud; quiet signals for what creeps. The senior's privacy stays intact: the family member sees no balance and no transactions, only the alert.

**Mission:** prevent fraud against the elderly as much as possible and give families a form of financial care that doesn't exist today. The origin is personal: the founder is authorized (gemachtigd) on his grandfather's account and lives the problem — access without time makes it worse; attention is the scarce good.

**Source of truth:** `/docs/businessplan-seintje.md` is the compass — read it before non-trivial work. `/docs/detectiespecificatie.md` specifies the detection engine. `/docs/dpia-seintje.md` is the data-protection impact assessment (draft, needs lawyer sign-off — see its own open-items list). The operational log (werkdocument) records every decision and its reason. If code or copy conflicts with the business plan, the plan wins; if you think the plan is wrong, raise it as a question to the founder instead of silently deviating.

## Product principles (from the plan — do not violate in any copy or code)
1. **View-only, provably.** The connection can only look, never act. This is both architecture and the core trust message ("meekijken, nooit aankomen").
2. **Two message types, strictly separated.** Fraud patterns → simultaneous ALARM to senior + family (senior gets a reality-check, family gets "bel nu even"). Small things (subscriptions, duplicates, missing income, cost jumps) → quiet INFO signals, bundled, at most weekly, never styled as alarms. Alarm fatigue is a product-killer; the norm is ≤1 unnecessary alarm per family per month.
3. **Guidance after an alarm.** When fraud happens, Seintje tells the family which steps to take (contact the bank's fraud desk, request freezing of the receiving account, report to police). An alert without a next step leaves a family in panic; the handelingsperspectief is part of the product.
4. **Dignity by design.** The senior decides, consents, and can revoke at any time. Family sees the alert, never the data. Multiple trusted family members can watch together — shared subscriptions mean shared use for the brother/sister/daughter/son. This distinguishes Seintje from the bank machtiging (full visibility = privacy cost, and passive) and from bewind (total takeover).
5. **Honest about limits.** No real-time promises (PSD2 polling reality is hours, not minutes — no "live", "direct", "meteen" about alert speed). No detection of cognitive decline (health data under the AVG — a legal and principled boundary). No claimed coverage of abuse by whitelisted family members. Never invent statistics; every number traces to a cited source.

## Audience
Buyer: the adult child, 30–60, digitally capable, worried, price-insensitive (fear + guilt). User: the independently banking senior, 65+, with savings. Positioning: message narrow (the fake bank employee story), product broad (investment/WhatsApp/dating fraud + the small things — the story after the click).

## Current phase and gates (from roadmap §15 — update this block as reality moves)
Pre-revenue, founder solo next to a fulltime job, funded from own means. Site live at seintje-app.nl (waitlist). Sandbox connection with Enable Banking works, tested against real transaction data. Business plan v1.0 written and founder-edited. Detectiespecificatie now v1.2 (R5 known-IBAN severity exception, added 2026-07-19). Interviews paused by founder decision (guide ready in /docs).
- **Backtest on synthetic data: done (2026-07-19).** Both go/no-go norms passed — 0.00 false alarms/family/month (≤1 target) and 8/8 real scam scenarios caught as HARD alarm. Code + dataset live in a separate local/private repo (`~/Developer/seintje-backtest`, not the public site repo — same confidentiality reasoning as `/docs`).
- **Next up:** the spec's own §7 still calls for a backtest on *real* pilot-family transaction data (not synthetic) before go-live — that's the remaining validation step, once pilot families are onboarded.
- **Gate 1 (target ~month 3):** market + tech validation green → BV incorporation, MVP build starts (hired fintech freelancer builds, founder is product owner; no cofounder before traction).
- **Gate 2 (target ~month 6):** pilot norms met → paid launch, first paying customer.
- **Do NOT build** production app code, backend, database, or notification systems before Gate 1 is explicitly passed by the founder. The `/sandbox` exploration tool is the only code allowed pre-gate.

## How to work with the founder
- Execute autonomously: copy, code, structure, research, fixes — do them, explain briefly what and why.
- Ask only **directional** questions, batched (max 2–3 per session): spending money, changing name/price/positioning/target group, anything irreversible, passing a gate, external commitments. Everything else: decide and do.
- **A prompt contains only what the founder asked.** Never smuggle in earlier pending fixes or your own wishes; raise those separately as a flagged question. This rule exists because it went wrong before.
- The founder is learning git/GitHub and web development: explain steps plainly, run git commands yourself.
- End substantial sessions with three short lists: done / founder must do (only what AI physically cannot: accounts, payments, emails, calls) / next.
- Founder reviews on a real phone; his screenshots and judgment are final on visual issues.

## Hard rules
1. **Secrets never in git** — private keys (*.pem), .env, credentials. Verify .gitignore before commits; if a secret is inside the repo, stop and report.
2. **Confidential docs never in a public repo.** The business plan, decision log, and detection spec are competition-sensitive; they belong in the private docs repo, never in the public site repo.
3. **Never change price, product name, target group, or brand positioning on your own** — founder decisions.
4. **No dark patterns, ever.** No fake urgency, no pre-checked boxes, no hidden conditions. Trust is the entire product.
5. **>50% founder ownership is a hard constraint** in anything touching equity, funding, or partnership drafts.

## Language rules (customer-facing Dutch)
- No jargon. Every sentence must be understood in one read by someone without technical knowledge, and say what it means *for them* ("alleen-lezen" → "de app kan alleen meekijken, nooit aan het geld komen").
- Core trust image: the window — you see what happens, but you can't get through it. Core product image: the smoke detector for the bank account.
- Tone: warm, serious, honest. No fairy-tale language, no fear beyond sourced facts. Inclusive: "je vader of moeder" / "je ouder(s)", never only "moeder".
- Internal docs and code may use technical terms freely.

## Technical context
- **Site:** static single-file `/site/index.html` (+ privacy.html), GitHub Pages, domain seintje-app.nl. Single-file, no build step, inline CSS/SVG, only the already-linked Google Fonts. Design system: calm petrol-blue/soft-white; amber ONLY inside the alert visual. WCAG AAA contrast (≥7:1) — measure after every change. Spacing only from the --space-1..9 scale. Forced-dark-mode protection must stay intact. Test 390/768/1280px; tap targets ≥48px; iPhone safe areas.
- **Data:** Enable Banking (Finnish-regulated AISP; we operate under their licence; plan B: Yapily Connect). Build a thin abstraction layer between detection engine and aggregator. EU data residency is a hard requirement (the site promises it). Data minimization is architecture: no credentials (stay at the bank), no permanent transaction archive, share the alarm not the data.
- **Detection:** explainable rules, no black-box AI in v1 — six hard fraud rules, three stacking soft signals, four info rules, all relative to the personal normal. Full spec in /docs. Known constraints: background polling ±4×/day (detection in hours); PSD2 covers payment accounts, savings-account API coverage varies per bank (verify per bank).
- **Sandbox:** `/sandbox` Node.js exploration tool (banks / connect / explore); raw exports in /sandbox/output/ (gitignored) are calibration and backtest data.
