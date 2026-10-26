# Design

## Context

See `proposal.md` for motivation. Outcome-first planning stores links separately from roadmap membership and capacity ownership. Forecasting and timeline rendering correctly exclude candidates, but the normal create-link-place workflow can leave a sole minimum-required candidate unowned even though the planner has supplied one unambiguous outcome and stream.

Board mutations already return a fully recalculated `BoardState`, and the client guards reads/writes with generations. The scheduling model must retain one work package, one capacity owner, dependency-valid scoped order, and conservative scenario restoration.

## Goals / Non-Goals

**Goals:**

- Complete unambiguous minimum-required assignment atomically regardless of whether linking or outcome placement happens first.
- Preserve explicit choices for ambiguous, optional, deferred, dismissed and shared work.
- Keep accepted Board responses authoritative and immediately visible.
- Distinguish excluded references from included work shared from another owner and expose concise blocker causes.

**Non-Goals:**

- Infer ownership for projects linked to multiple outcomes.
- Automatically include optional-only work or override deliberate deferred/dismissed membership.
- Change forecast arithmetic, capacity conservation, dependency semantics, storage schema or scenario snapshot format.

## Decisions

### 1. Reconcile only candidate minimum-required links with one saved outcome

Add a transaction-local reconciliation helper that selects candidate work whose sole saved outcome link is minimum-required by the target outcome, confirms that outcome is in an active stream, and passes those projects through the existing validated placement path. This reuses dependency ordering, ownership and roadmap invariants instead of issuing direct field updates.

For link edits, reconcile only links newly added by that save. This prevents an unrelated requirement edit from re-including a candidate that a planner deliberately moved back to Needs Assignment. For outcome placement, reconcile when the outcome moves from Needs Assignment into an active stream, completing the prior explicit link choice.

### 2. Keep scenario restoration exact

Scenario activation uses the same link replacement helper before restoring saved package membership. It will opt out of live auto-inclusion so frozen draft membership remains authoritative and no transient inferred placement can reject an otherwise valid restore.

### 3. Continue returning complete recalculated Board state

No new client-side forecast calculation or optimistic geometry is needed. Existing Board writes return `getBoard()` after commit and the client installs that response under its generation guard. Regression tests will verify stream allocation and Extra scope responses alter totals and spans immediately once the project is counted.

### 4. Separate ownership styling from membership wording

The dashed treatment remains the visual contract for non-counted appearances. Visible and accessible text will call an included appearance `Shared`, but call excluded work `Needs assignment`, `Deferred`, or `Dismissed`. Outcome status will append a short cause derived from the existing forecast reasons while preserving the full reason in accessible text.

## Risks / Trade-offs

- [A project is linked to another outcome immediately after auto-inclusion] -> It remains counted once under the first unambiguous owner; later transfer stays explicit.
- [Bulk link saves include several candidates and one violates ordering] -> Use the existing atomic placement validation so the complete link/membership write succeeds or fails together.
- [Scenario loading accidentally changes old membership] -> Explicitly disable reconciliation during snapshot restoration and retain existing scenario tests.
- [Short blocker labels oversimplify evidence] -> Keep the full forecast reason in the control's accessible name/title and project details.

## Migration Plan

This is a mutation and presentation change over existing fields. An idempotent migration passes existing sole minimum-required candidates with assigned outcomes through the same validated reconciliation so already-saved affected work is repaired on upgrade. Rollback restores the prior explicit Include step without reversing valid ownership records created by the migration.
