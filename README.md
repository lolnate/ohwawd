# Oh, WAWD!

**What are we doing, and when can we do it?**

Oh, WAWD! is a shared planning space for product and engineering. Linear remains the source of projects, issues, and execution status. Oh, WAWD! connects that work to desired outcomes, delivery targets, dependencies, team capacity, and explicit scope tradeoffs.

The first product surface is the **Sequencing Board**: five parallel planning streams, a separate deferred shelf, a target-aware capacity forecast, and saved planning scenarios. The initial design is in [docs/product-design.md](docs/product-design.md), with exact forecast and scenario rules in [docs/scheduling-contract.md](docs/scheduling-contract.md).

The supplied Atlantis HTML planner was reviewed as a reference. It lives outside this repository and is not part of the application or its source data.

## Run the private proof

This repository contains the three-slice private product proof: a single-owner React/Next.js app with read-only Linear import for one team, durable PostgreSQL storage, outcomes linked to imported projects, a five-stream sequencing board, and versioned decision scenarios. It creates one stable work package per project; linking a project to multiple outcomes does not create duplicate demand.

Requirements: Node.js 20.9 or newer and PostgreSQL 16 (or Docker Compose). The development database can be started with `docker compose up -d db`. Create `.env.local` from `.env.example` and set a random session secret of at least 32 characters and a stable 32-byte encryption key encoded as base64. For example, `openssl rand -base64 32` generates an encryption key. Run `npm run set-owner-password` in a terminal; it prompts for the owner password without echoing it and saves a salted hash in `.env.local`. Any password characters work without quoting or escaping. Restart the server after changing these settings. Keep `.env.local` private and back up the encryption key along with the database; changing it makes the saved Linear key unreadable.

```sh
npm install
npm run set-owner-password
npm run dev
```

Open `http://localhost:3000`, sign in, enter a Linear API key, check access, choose one team, preview its projects, and import. The preview includes all project states. You can create an outcome before importing, then link each imported project as minimum-required or optional. Search and status-filter the imported list, or hide irrelevant projects from planning lists; hiding is reversible and preserves existing outcome links. Completed projects remain available. Subsequent imports for the same team can use the saved server-side key, deduplicate projects, issues, and cycles by Linear ID, preserve outcome links and local visibility choices, and flag projects absent from the latest import for review. A different team requires a new workspace; this proof does not merge teams.

The board places newly imported selected packages on **Needs assignment**. It reads the connected team's cycle numbers, dates, timezone, and cadence from Linear; there is no local cycle-date editor. Choose a provisional baseline with a reason (or use the median of at least three comparable completed Linear cycles), set reserve, and allocate at most 100% across the five streams. The visible calendar lets you select a date in one or several upcoming Linear cycles, then apply availability or reserve exceptions to those cycle IDs. You can refresh cycles with the saved Linear key without reimporting every project. The current partial cycle is context only. If Linear has not created a future cycle, the forecast stops at the last imported cycle instead of inventing dates; increase the team's upcoming cycle count in Linear and refresh to extend the calendar.

Assign packages, prioritize them, choose optional preferred and hard earliest Linear cycles, and add local dependencies. Linear project dependencies are imported as read-only constraints; a waiver needs a visible reason. **Deferred** packages consume no future capacity. Pausing in-progress Linear work here is a planning assumption and must be carried out separately in Linear. Minimum-required outcome links determine the first delivery cycle, including dependency closure; optional links affect that date only when they block required work. The board shows unknown estimates, provisional allowances, cross-team exclusions, target gaps, and a cycle-by-cycle capacity explanation. Existing relative cycle exceptions and start preferences are mapped to imported Linear cycle IDs when possible; settings beyond the imported calendar are kept for review.

The key is sent to the Node server over the app connection and stored only as AES-256-GCM ciphertext in PostgreSQL. Use HTTPS if accessing the app outside localhost, and keep the proof behind private network access. The app never writes to Linear. It uses the [Linear TypeScript SDK](https://linear.app/developers/sdk) for paginated reads; the SDK rejects GraphQL responses containing errors, including partial responses. There is one owner password and no invited users or public sharing.

Use Decision scenarios to save the current board as a named draft. Draft saves use optimistic versions, source refreshes mark existing drafts stale, and rebasing records the source-driven forecast delta. Load a draft to restore its planning controls, publish a reviewed draft with an author and rationale, designate a published revision as the baseline, and compare drafts or revisions side by side. Published revisions contain frozen source and forecast snapshots and are not changed by later imports.

Run `npm test` for import persistence, forecast contract, and scenario lifecycle examples; run `npm run typecheck` for TypeScript and `npm run build` for a production build. `npm run start` serves the built app. Database tables are created on first authenticated use.

Public sharing, configurable stream count, multi-team forecasting, and project decomposition remain beyond the private proof.
