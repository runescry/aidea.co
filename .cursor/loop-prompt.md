# Loop prompt — copy into chat with `/loop`

## Fixed interval (recommended: 45m)

```
/loop 45m Execute one aidea roadmap item:

1. Read ROADMAP.md — pick the highest-priority unchecked item (P0 before P1, etc.).
2. Read AGENTS.md and .cursor/rules/ — use shared helpers; do not duplicate SSE, queue, labels, or save UX.
3. Implement ONLY that single item. Do not start the next checkbox.
4. Run: npm run typecheck && npm test && npm run test:contract && npm run build
5. If all pass: mark [x] in ROADMAP.md and append one line to "## Loop log" (date, item, files).
6. If blocked: leave unchecked; add "BLOCKED: reason" under Loop log; do not expand scope.

Constraints:
- Minimal diff; match existing patterns — no unnecessary code or refactors
- Do NOT commit or push unless the user explicitly asked in this session
- If user asked to commit: only after all four commands above pass locally
- If user asked to push: only after CI is green on the branch (same gates as AGENTS.md)
- Do not restore legacy Dashboard/orchestrator/ActionQueue patterns

Stop after one item. Report: done | blocked | next item name.
```

## Dynamic pacing (agent chooses delay)

```
/loop Execute one aidea roadmap item (same steps as above). After each item, sleep 30–60m before the next wake unless the user interrupts. P0 only until all P0 boxes are checked.
```

## One-shot (no loop)

```
Read ROADMAP.md and AGENTS.md. Implement exactly the next unchecked P0 item. npm run typecheck && npm test && npm run test:contract && npm run build. Update ROADMAP.md. Do not commit unless asked. Summarize in 3 bullets.
```
