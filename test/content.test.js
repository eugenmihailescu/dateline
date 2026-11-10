import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { buildContentSource } from "../scripts/build-content.mjs";

test("the page script is one classic file and answers before storage loads", () => {
  const source = buildContentSource();
  const committed = readFileSync(new URL("../src/page/content.js", import.meta.url), "utf8");
  assert.equal(committed, source);
  assert.equal(/^\s*import\b/m.test(source), false);
  assert.equal(/^\s*export\b/m.test(source), false);
  assert.equal(source.includes("import("), false);
  assert.equal(source.includes("web_accessible"), false);

  const startFn = source.slice(source.indexOf("function start()"), source.indexOf("async function boot()"));
  const listenerAt = startFn.indexOf("chrome.runtime.onMessage.addListener(onExtensionMessage)");
  const bootAt = startFn.indexOf("boot().catch");
  assert.equal(listenerAt > 0 && listenerAt < bootAt, true);
  const bootFn = source.slice(source.indexOf("async function boot()"), source.indexOf("function rebuildIndex("));
  assert.equal(bootFn.includes("addListener(onExtensionMessage)"), false);

  const check = spawnSync(process.execPath, ["--check", fileURLToPath(new URL("../src/page/content.js", import.meta.url))], {
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr);

  const listeners = [];
  const context = vm.createContext({
    console,
    chrome: {
      runtime: {
        onMessage: {
          addListener(fn) {
            listeners.push(fn);
          },
        },
      },
    },
    document: {
      body: null,
      addEventListener() {},
    },
  });
  vm.runInContext(source, context, { filename: "content.js" });
  assert.equal(listeners.length, 1);
  let response;
  listeners[0]({ type: "dateline:stats" }, {}, (value) => {
    response = value;
  });
  assert.equal(response.enabled, true);
  assert.equal(response.scored, 0);
  assert.equal(response.unresolved, 0);
  assert.equal(response.pending, 0);
  assert.equal(response.loggedOut, false);
});
