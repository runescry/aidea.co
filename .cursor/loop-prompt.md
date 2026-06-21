# Loop prompt — copy into chat with `/loop`

## Progress updates (required)

The user wants to hear from you **as you go**, not only at the end of a batch.

After **each** ROADMAP item (pass or blocked):

1. **Reply in chat** with a short update (2–4 lines): what finished, gates result, what's next.
2. **Update `ROADMAP.md` → `## Current status`** (one paragraph, latest state).
3. **Append `## Loop log`** (one line per item).

On **wake** (loop tick or user message): start with a one-line status ("Resuming P1 — next: …") before coding.

Do **not** silently chain many items and summarize once at the end.

---

## Fixed interval (recommended: 5m idle fallback)

Use a **short interval as a safety net**, not as the pace between items. In each agent turn, chain ROADMAP items back-to-back until done or blocked. The loop only matters when a turn ends idle (context limit, you closed chat, agent stopped early).

```
/loop 5m Proceed with all build tasks — continue ALL unchecked ROADMAP items (P0 first) until done or blocked; do NOT stop after one item per wake.

1. Read ROADMAP.md — pick the highest-priority unchecked item (**P8** first; P7 is complete).
2. Read docs/PLAN.md — P7+P8 gap closure; layer context and checkboxes for active phase.
3. Read AGENTS.md and .cursor/rules/ — use shared helpers; do not duplicate SSE, queue, labels, or save UX.
4. Skim docs/VISION.md if the item touches domain scope or connectors.
5. Implement every unchecked item in priority order until done or blocked — not just one checkbox per wake unless using the one-shot prompt below.
6. Run: npm run typecheck && npm test && npm run test:contract && npm run build
7. If all pass: mark [x] in ROADMAP.md (and docs/PLAN.md for P7/P8 items), update ## Current status, append ## Loop log, **then message the user** before starting the next item.
8. If blocked: leave unchecked; add "BLOCKED: reason" under Loop log; **message the user** with the blocker; do not expand scope.

Constraints:
- Minimal diff; match existing patterns — no unnecessary code or refactors
- Default workflow: local dev (`npm run dev`); do NOT push or deploy to Vercel unless the user explicitly asks
- Always run typecheck + test + test:contract + build before reporting an item done (even without commit)
- Do NOT commit or push unless the user explicitly asked in this session
- If user asked to commit: only after all four commands above pass locally
- If user asked to push/deploy: only after explicit request **and** local gates pass (CI green if applicable)
- Do not restore legacy Dashboard/orchestrator/ActionQueue patterns

Stop when all targeted items are done or blocked. Report: progress | blocked | next section.
```

## Dynamic pacing (agent chooses delay)

Same steps as above. After finishing a batch, arm a **5m** heartbeat (not 45m) so idle sessions resume quickly. Chain items within the turn; heartbeat only if the turn ended.

## One-shot (no loop)

```
Read ROADMAP.md, docs/PLAN.md (P7+P8), and AGENTS.md. Implement exactly the next unchecked item. npm run typecheck && npm test && npm run test:contract && npm run build. Update ROADMAP.md and docs/PLAN.md when applicable. Do not commit unless asked. Summarize in 3 bullets.
```
