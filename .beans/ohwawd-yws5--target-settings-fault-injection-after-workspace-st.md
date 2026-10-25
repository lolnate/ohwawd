---
# ohwawd-yws5
title: Target Settings fault injection after workspace startup reads
status: completed
type: bug
priority: normal
created_at: 2026-10-25T18:42:32Z
updated_at: 2026-10-25T18:44:56Z
---

Final combined browser verification exposed another Settings test using the first GET /api/board as the intended Settings load, allowing a background Board refresh to consume the injected failure. Scope: tests/ui/settings-editors.spec.ts fault-injection targeting only; same root as the stale-read case corrected during archive reconciliation. Completion: gate the injected failure on the visible Settings dialog, retain actual load/retry/rejected-write assertions, and verify the combined 67-case outcome/Settings regression command passes.

## Summary of Changes

Corrected both Settings fault-injection cases to initialize/close Settings and target a GET while its dialog is visible, so background Board startup reads cannot consume the injected failure or stale response. Retained real load/retry, rejected-save and newer-opening assertions. The final combined outcome/catalog/ownership/responsive/theme/Settings run passed all 67 browser cases using eight workers. No runtime Settings behavior changed.
