---
# ohwawd-zmix
title: Scope workspace Settings and decompose implementation
status: completed
type: task
priority: normal
created_at: 2026-10-23T14:27:35Z
updated_at: 2026-10-23T14:37:26Z
---

Define the requested Settings experience with OpenSpec and create linked, dependency-aware implementation Beans.

- [x] Review existing navigation, Board panels, relevant specifications, and UI conventions.
- [x] Create and validate the OpenSpec proposal, design, delta specs, and task outline.
- [x] Create linked implementation Beans with acceptance criteria and dependencies.
- [x] Verify artifact and task consistency and summarize the proposed experience.

User selected the centered overlay presentation. Keep stream controls and cycle-wide overrides on Board; preserve contextual week editing and existing planning/scenario semantics.

Artifacts: openspec/changes/add-workspace-settings/{proposal.md,design.md,tasks.md,specs/}. Implementation epic ohwawd-0nj1 contains dependency chain ohwawd-zm8w → ohwawd-7amk → ohwawd-bgm3 → ohwawd-mrzq. Initial strict OpenSpec validation passed.

## Summary of Changes

Created the complete add-workspace-settings OpenSpec proposal, design, four capability delta files, and Bean-linked implementation checklist. Recorded the user-selected centered overlay and shared centered-modal conventions in docs/ui-ux-conventions.md. Created epic ohwawd-0nj1 and four implementation/validation Beans with acceptance criteria and a verified dependency chain. All implementation Beans remain todo; the overlay shell is the only ready child.

Validation: openspec status reports 4/4 planning artifacts complete; openspec validate add-workspace-settings --strict passes; git diff --check passes. Verified Bean parents, persisted blocked_by relationships, and ready-task filtering. Application tests are assigned to implementation because this session changed planning/tracking documentation only.
