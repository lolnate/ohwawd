import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CycleCalendar from "../src/app/cycle-calendar";

test("calendar labels a Thanksgiving date with its Linear cycle and selection", () => {
  const markup = renderToStaticMarkup(createElement(CycleCalendar, {
    timezone: "America/New_York", sourceAt: "2026-10-15T18:00:00Z", selectedIds: ["cycle-47"], onToggle: () => {},
    cycles: [
      { id: "cycle-44", number: 44, name: null, startsAt: "2026-10-12T04:00:00Z", endsAt: "2026-10-19T04:00:00Z", selectable: false, adjusted: false },
      { id: "cycle-45", number: 45, name: null, startsAt: "2026-10-19T04:00:00Z", endsAt: "2026-10-26T04:00:00Z", selectable: true, adjusted: false },
      { id: "cycle-47", number: 47, name: null, startsAt: "2026-11-23T05:00:00Z", endsAt: "2026-11-30T05:00:00Z", selectable: true, adjusted: true },
    ],
  }));
  assert.match(markup, /2026-11-26, Linear Cycle 47/);
  assert.match(markup, /aria-pressed="true" aria-label="2026-11-26, Linear Cycle 47"/);
  assert.match(markup, /2026-10-15, Linear Cycle 44/);
  assert.match(markup, /#47/);
});
