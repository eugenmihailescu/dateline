import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildHookSource } from "../scripts/build-hook.mjs";

test("the page hook is the shared extractor plus the fetch patch", () => {
  const source = buildHookSource();
  const committed = readFileSync(new URL("../src/page/net-hook.js", import.meta.url), "utf8");
  assert.equal(committed, source);
  assert.equal(source.includes("function extractSignals"), true);
  assert.equal(source.includes("export {"), false);
  assert.equal(source.includes("AboutAccountQuery"), true);
  const check = spawnSync(process.execPath, ["--check", fileURLToPath(new URL("../src/page/net-hook.js", import.meta.url))], {
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr);
});
