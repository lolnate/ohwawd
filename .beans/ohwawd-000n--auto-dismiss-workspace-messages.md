---
# ohwawd-000n
title: Auto-dismiss workspace messages
status: completed
type: bug
priority: normal
created_at: 2026-10-26T14:58:02Z
updated_at: 2026-10-26T15:00:15Z
---

Top-of-screen feedback messages should dismiss automatically after 20 seconds and expose an accessible X control for immediate dismissal.

- [x] Identify shared/top-level message paths and expected accessibility behavior
- [x] Implement timed and manual dismissal
- [x] Add focused regression coverage and run relevant validation
- [x] Document the completed change

## Summary of Changes

Added a reusable dismissible top-level feedback banner for Board and workspace success/error messages. Banners expose an accessible X control, dismiss automatically after 20 seconds, and reset the interval for each new message. Added the shared UX convention and Playwright coverage for manual and timed dismissal; TypeScript, Board UI, and visual-theme checks pass.
