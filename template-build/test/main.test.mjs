import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const actionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("invokes the template build workflow and exports its result", () => {
  const run = runAction({
    template_id: "tpl-123",
    template_build_id: "build-123",
    template_build: 7,
    template_build_state: "succeeded",
    snapshot_id: "snap-123",
    spec_hash: "spec-123",
    image_digest: "sha256:abc",
    image_digest_ref: "node-api@sha256:abc",
    failure_reason: null,
  });

  assert.equal(run.result.status, 0, run.result.stderr || run.result.stdout);
  assert.deepEqual(run.args, [
    "template",
    "build",
    "node-api",
    "--wait-timeout",
    "15m",
    "--json",
    "--build-env",
    "NODE_ENV",
    "--build-secret-env",
    "NPM_TOKEN",
    "--wait-durable",
    "--publish-raw-image=true",
  ]);
  assert.match(run.outputs, /image<<ghadelimiter_[^\n]+\nnode-api@sha256:abc\n/);
  assert.match(run.outputs, /template-id<<ghadelimiter_[^\n]+\ntpl-123\n/);
  assert.match(run.outputs, /template-build<<ghadelimiter_[^\n]+\n7\n/);
  assert.match(run.result.stdout, /::add-mask::api-secret/);
  assert.match(run.result.stdout, /::add-mask::npm-secret/);
});

test("preserves failed build metadata as action outputs", () => {
  const run = runAction(
    {
      template_id: "tpl-123",
      template_build_id: "build-124",
      template_build: 8,
      template_build_state: "failed",
      failure_reason: "install failed",
    },
    1,
  );

  assert.equal(run.result.status, 1);
  assert.match(run.outputs, /template-build-state<<ghadelimiter_[^\n]+\nfailed\n/);
  assert.match(run.outputs, /failure-reason<<ghadelimiter_[^\n]+\ninstall failed\n/);
});

function runAction(json, exitCode = 0) {
  const dir = mkdtempSync(path.join(tmpdir(), "tenki-template-build-test-"));
  const binDir = path.join(dir, "bin");
  const argsFile = path.join(dir, "args");
  const outputFile = path.join(dir, "output");
  mkdirSync(binDir);
  writeFileSync(outputFile, "");

  const fakeTenki = path.join(binDir, "tenki");
  writeFileSync(
    fakeTenki,
    `#!/bin/sh
printf '%s\\n' "$@" > "$TENKI_TEST_ARGS"
printf '%s\\n' "$TENKI_TEST_JSON"
exit "$TENKI_TEST_EXIT"
`,
  );
  chmodSync(fakeTenki, 0o755);

  const result = spawnSync(process.execPath, [path.join(actionDir, "dist/index.js")], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      GITHUB_OUTPUT: outputFile,
      TENKI_API_KEY: "api-secret",
      TENKI_TEST_ARGS: argsFile,
      TENKI_TEST_JSON: JSON.stringify(json),
      TENKI_TEST_EXIT: String(exitCode),
      NODE_ENV: "production",
      NPM_TOKEN: "npm-secret",
      INPUT_TEMPLATE: "node-api",
      "INPUT_BUILD-ENV": "NODE_ENV",
      "INPUT_BUILD-SECRET-ENV": "NPM_TOKEN",
      "INPUT_PUBLISH-RAW-IMAGE": "true",
    },
  });

  return {
    result,
    args: readFileSync(argsFile, "utf8").trim().split("\n"),
    outputs: readFileSync(outputFile, "utf8"),
  };
}
