import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

test("theme tokens retain readable semantic pairs without network font dependencies", async () => {
  const css = await readFile(new URL("../src/app/theme-tokens.css", import.meta.url), "utf8");
  const token = (name: string) => new RegExp(`--${name}:\\s*(#[A-Fa-f0-9]{6})`).exec(css)?.[1] ?? "";
  assert.match(css, /color-scheme:\s*dark/);
  assert.doesNotMatch(css, /url\(/);
  assert.equal(contrast(token("color-text"), token("color-surface-hover")) >= 4.5, true);
  assert.equal(contrast(token("color-text-muted"), token("color-surface-hover")) >= 4.5, true);
  assert.equal(contrast(token("color-on-accent"), token("color-action")) >= 4.5, true);
  assert.equal(contrast(token("color-focus"), token("color-surface-hover")) >= 3, true);
});
