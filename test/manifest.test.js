import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HOSTS } from "../src/lib/hosts.js";

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));

test("manifest stays on x.com and uses Manifest V3", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, "Dateline");
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.host_permissions, HOSTS);
  assert.deepEqual(
    manifest.content_scripts.map((script) => script.matches),
    [HOSTS, HOSTS],
  );
  assert.equal(manifest.content_scripts[0].world, "MAIN");
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
  assert.deepEqual(manifest.content_scripts[0].js, ["src/page/net-hook.js"]);
  assert.deepEqual(manifest.content_scripts[1].js, ["src/page/content.js"]);
  assert.deepEqual(manifest.content_scripts[1].css, ["src/page/content.css"]);
  assert.equal(manifest.content_scripts[1].world, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.equal(manifest.background.service_worker, "src/background/service-worker.js");
  assert.equal(manifest.background.type, "module");
});
