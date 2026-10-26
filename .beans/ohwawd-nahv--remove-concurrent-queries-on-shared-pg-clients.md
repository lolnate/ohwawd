---
# ohwawd-nahv
title: Remove concurrent queries on shared pg clients
status: todo
type: bug
priority: low
created_at: 2026-10-26T11:09:40Z
updated_at: 2026-10-26T11:18:31Z
---

Live Linear refresh and Board verification emit pg's deprecation warning because Promise.all starts multiple client.query calls on one checked-out transaction client (notably saveImport/loadBoard). Serialize queries or use separate pool clients without weakening transaction snapshots.

- [ ] Identify all concurrent query calls sharing one PoolClient.
- [ ] Preserve transaction and repeatable-read semantics while removing concurrency.
- [ ] Add regression coverage and verify no pg deprecation warning during import/Board reads.
