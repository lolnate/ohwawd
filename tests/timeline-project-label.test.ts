import assert from "node:assert/strict";
import { test } from "node:test";
import { TIMELINE_LABEL_TOLERANCE_PX, timelineProjectLabelMode } from "../src/lib/timeline-project-label";

test("timeline labels use the full project name when it fits", () => {
  assert.equal(timelineProjectLabelMode(120, 120), "full");
  assert.equal(timelineProjectLabelMode(120 - TIMELINE_LABEL_TOLERANCE_PX, 120), "full");
});

test("timeline labels ellipsize when at least half the project name fits", () => {
  assert.equal(timelineProjectLabelMode(119, 120), "ellipsized");
  assert.equal(timelineProjectLabelMode(60, 120), "ellipsized");
  assert.equal(timelineProjectLabelMode(60 - TIMELINE_LABEL_TOLERANCE_PX, 120), "ellipsized");
});

test("timeline labels fall back to the stable code below the useful-name threshold", () => {
  assert.equal(timelineProjectLabelMode(59 - TIMELINE_LABEL_TOLERANCE_PX, 120), "code");
  assert.equal(timelineProjectLabelMode(-10, 120), "code");
  assert.equal(timelineProjectLabelMode(Number.NaN, 120), "code");
  assert.equal(timelineProjectLabelMode(120, Number.POSITIVE_INFINITY), "code");
});
