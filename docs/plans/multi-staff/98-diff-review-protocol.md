# 98 — Diff Review Protocol (Multi-Staff Epic)

> **Operator notes (Davide) — §A is for you. Everything from §B onward is written FOR the reviewer session and is directly executable as a prompt.**

---

## A. Operator notes (Davide)

**When.** After the implementing session stops at its test gate and reports the diff, and BEFORE you commit. Do your own 60-second pass first: `git status` (file list vs the prompt's In/Out-of-scope) and `git diff --stat` (size vs the prompt's "Expected diff size"). Then launch the review.

**Where.** A **fresh Claude Code session in the same worktree** (the uncommitted diff must be present). Never reuse the implementing session — a session reviewing its own work grades itself too generously. Never review by pasting a diff into a claude.ai chat: without the repo, the reviewer cannot grep construction sites, check annotations elsewhere, or catch out-of-scope drift — exactly the bug class this protocol exists for.

**Model / effort for the review session.** Same tier as the implementation, minimum Sonnet 4.6 @ high. Mandatory Opus 4.8 for: **02 (xhigh), 06 (xhigh or max), 10 (max), 13 (xhigh)**. Reviews draw from the same subscription pool but typically cost a small fraction of the implementation session (diff + targeted greps + one test run). Do not spend Fable window on reviews.

**Kickoff message (adapt NN):**

```
Read @docs/plans/multi-staff/98-diff-review-protocol.md and act as the reviewer it
describes, for prompt NN. Inputs: @docs/plans/multi-staff/00-audit-report.md and
@docs/plans/multi-staff/NN-<filename>.md. Review the uncommitted working tree.
```

**On APPROVE / APPROVE WITH NOTES:** read every note, then proceed with your normal loop — gates, migrations (read every SQL line yourself: they run on production by your hand), iPad smoke, manual commit. The commit is always yours.

**On REQUEST CHANGES:** never let the reviewer fix anything. Two cases:

1. Findings reveal the **prompt/report was wrong** → update `00`/`NN` first (99-guide rules), then rerun the prompt in a fresh session.
2. Findings are **implementation slips** → fresh session, attach `00` + `NN` + the review file, instruction: _"Apply ONLY the fixes listed in the review. Nothing else."_ Then re-review (lighter tier is fine).

**For prompts 06 and 10 only:** before committing, paste the review file content into the architecture chat for a second opinion.

**Always yours regardless of verdict:** SQL migrations read line by line; Out-of-scope files confirmed untouched; the commit.

---

## B. Reviewer role & hard rules

You are an **independent, read-only reviewer**. You did not write this diff. Assume nothing the implementing session claimed; verify everything against the two input documents (`00-audit-report.md` + the prompt file) and the repository itself.

- **Allowed:** `git status`, `git diff [--stat]`, `git log`, reading any repo file, grep/find, `./mvnw -q test-compile`, `./mvnw -q test`, `npm run build`.
- **Forbidden:** editing, creating, or deleting ANY file except your review report; `git add/commit/stash/checkout/restore`; fixing issues you find; running the app; touching any database.
- **Output:** write `docs/plans/multi-staff/reviews/NN-review.md` (create the folder if missing) AND print its content. One page maximum. No praise padding — a clean category gets one line: "checked, clean".

## C. Review checklist (execute in order)

1. **Scope conformance.** Every path in `git status` must belong to the prompt's "In scope"; every "Out of scope" item must be untouched. Any stray file = HIGH finding, even if the change looks harmless.
2. **Preconditions & STOP rules.** Re-execute the prompt's verifiable preconditions yourself (grep counts, merged-prerequisite checks, migration numbering vs the repo). If any STOP condition was true and the session proceeded anyway → verdict is REQUEST CHANGES regardless of code quality.
3. **Step & acceptance walk.** Map each ordered step and each acceptance criterion to concrete evidence in the diff/tests. "Claimed in the session summary" is not evidence.
4. **Epic invariants.**
   - **I1:** every new conditional surface keys off the single active-staff gate helper — grep the diff for ad-hoc `>= 2` / `activeCount` logic outside it.
   - **Additive-only APIs:** no changed or removed params/fields, no repurposed columns.
   - **R7:** `package_credits` and the package-link machinery untouched unless the prompt says otherwise.
   - **Transactions:** `@Transactional` / SERIALIZABLE annotations byte-identical outside the prompt's stated targets — grep the diff for `Transactional|SERIALIZABLE`; no new `REQUIRES_NEW` reachable via self-invocation.
   - **Money quarantine:** Stripe/webhook/refund files untouched except in prompt 10.
5. **Landmines sweep — backend.** Any touched positional record ⇒ grep ALL its construction sites, including tests. No astral/emoji characters in `@Query` strings. New reads of LAZY associations happen inside transactions (`open-in-view=false`). Migrations: guarded (`DO $$ ... RAISE`), idempotent, rollback note at top, version = next free in the repo, snake_case plural names. New queries covered by an existing or new index.
6. **Landmines sweep — frontend (04/07/08/09/11).** Overlays/drawers/toasts via `createPortal(document.body)`; `svh` not `vh`/`dvh`; `data-lenis-prevent` on new horizontally scrollable areas; no localStorage/sessionStorage; no new npm dependencies; no leftover `console.log`.
7. **Test quality.** For each new test, ask: what mutation would make it fail? Flag tautological tests. Characterization tests (prompt 06) must reference only pre-existing behavior/fixtures, and must be shown green on the pre-refactor code (evidence: the session's ordered-step trail). Suite count grew as the prompt requires. If the diff goes anywhere near BookingService settlement or Report files: `ReportRevenueReconciliationTest` untouched and green.
8. **Security (02, and any prompt touching authorization).** Diff every `@PreAuthorize`/authority check against the 00 §2.2 permission matrix, row by row. Flag any endpoint whose effective audience widened beyond the matrix — widening is HIGH even when convenient.
9. **Gates.** Run `./mvnw -q test-compile && ./mvnw -q test` (and `npm run build` if FE files changed). Paste the tail (test count, failures) into the review.

## D. Verdict format

```
# Review — Prompt NN — <APPROVE | APPROVE WITH NOTES | REQUEST CHANGES>

| severity | file:line | issue | suggested fix |
|---|---|---|---|
| HIGH/MED/LOW | ... | ... | ... |

Gates: <test-compile / tests / build output tail>
Rationale: <one paragraph — why this verdict>
```

Severity guide: HIGH = scope violation, STOP-rule breach, invariant breach, money-path or security exposure, migration defect. MED = correctness risk with a fence (test gap, missed construction site in tests, perf smell). LOW = style, naming, minor cleanup.
