---
# ohwawd-mw2q
title: Plan unified outcome sidebar implementation
status: completed
type: task
priority: normal
created_at: 2026-10-25T17:01:56Z
updated_at: 2026-10-25T17:07:08Z
---

Incorporate the approved UX review into OpenSpec change redesign-outcome-catalog, document the interaction design, and decompose remaining implementation into linked Beans.

References: docs/outcomes-ux-review.md; openspec/changes/redesign-outcome-catalog/proposal.md; openspec/changes/redesign-outcome-catalog/design.md; openspec/changes/redesign-outcome-catalog/specs/outcome-catalog/spec.md.

- [x] Revise proposal, design and acceptance scenarios for the approved persistent outcome sidebar
- [x] Align design documentation and create/update bounded implementation Beans with dependencies
- [x] Reconcile the OpenSpec task plan and validate artifact/task coherence

## Summary of Changes

Updated redesign-outcome-catalog proposal, design, requirements and task plan for the accepted persistent Details/Projects sidebar. Documented entry-point simplification, cross-section drafts and scoped saves, atomic creation, complete project links, filtered context, dismissal/focus/mobile behavior and persistence/refresh/late-request handling. Marked the UX review accepted, added planned workflow documentation in docs/product-design.md and shared conventions in docs/ui-ux-conventions.md. Rescoped ohwawd-5eqp, created ohwawd-q087 and ohwawd-xlk3, updated parent ohwawd-2ods and verification ohwawd-vart, and verified the dependency chain through beans show/list --ready. Existing query/browse completion remains unchanged. openspec validate redesign-outcome-catalog --strict and git diff --check passed. All planning artifacts are complete; implementation remains pending with ohwawd-5eqp ready next.
