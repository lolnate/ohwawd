---
# ohwawd-jm5p
title: Untrack generated Next.js declarations
status: completed
type: task
priority: normal
created_at: 2026-10-26T23:26:15Z
updated_at: 2026-10-26T23:26:30Z
---

Stop tracking Next.js-generated next-env.d.ts and ignore future generated changes.

- [x] Add next-env.d.ts to .gitignore
- [x] Remove next-env.d.ts from the Git index without deleting it locally
- [x] Verify generated types remain available locally

## Summary of Changes

Added next-env.d.ts to .gitignore and removed it from Git tracking while preserving the generated local file. TypeScript validation passes with the local Next.js declarations.
