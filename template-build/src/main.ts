import * as core from "@actions/core";
import { readInputs } from "./inputs.js";
import { requireTenki, TenkiCommandError, tenkiJSON, type TemplateBuildResult } from "./tenki.js";

// The CLI forwards these as ephemeral build secrets even when absent from
// build-secret-env, so register them for masking to match.
const AUTO_SECRET_ENV = ["GIT_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"];

async function run(): Promise<void> {
  maskAuth();
  maskAutoDetectedSecrets();
  await requireTenki();

  const inputs = readInputs();
  const args = [
    "template",
    "build",
    inputs.template,
    "--wait-timeout",
    inputs.waitTimeout,
    "--json",
  ];
  if (inputs.file) args.push("--file", inputs.file);
  for (const name of inputs.buildEnv) args.push("--build-env", name);
  for (const name of inputs.buildSecretEnv) args.push("--build-secret-env", name);
  if (inputs.waitDurable) args.push("--wait-durable");
  if (inputs.publishRawImage !== undefined) {
    args.push(`--publish-raw-image=${inputs.publishRawImage ? "true" : "false"}`);
  }

  core.info(`building template ${inputs.template}`);
  let build: TemplateBuildResult;
  try {
    build = await tenkiJSON<TemplateBuildResult>(args);
  } catch (error) {
    if (error instanceof TenkiCommandError && error.output) {
      setOutputs(error.output as TemplateBuildResult);
    }
    throw error;
  }
  setOutputs(build);

  if (build.template_build_state !== "succeeded") {
    throw new Error(build.failure_reason || `template build finished in state ${build.template_build_state}`);
  }
  if (!build.image_digest_ref) {
    throw new Error("template build succeeded without an immutable image digest ref");
  }
}

function maskAuth(): void {
  const token = process.env.TENKI_AUTH_TOKEN?.trim();
  const apiKey = process.env.TENKI_API_KEY?.trim();
  if (!token && !apiKey) {
    throw new Error("missing TENKI_AUTH_TOKEN or TENKI_API_KEY env var");
  }
  if (token) core.setSecret(token);
  if (apiKey) core.setSecret(apiKey);
}

function maskAutoDetectedSecrets(): void {
  // Mask-only, never appended to build-secret-env; non-empty check mirrors the
  // CLI so we register exactly what it forwards.
  for (const name of AUTO_SECRET_ENV) {
    const value = process.env[name];
    if (value) core.setSecret(value);
  }
}

function setOutputs(build: TemplateBuildResult): void {
  core.setOutput("image", build.image_digest_ref ?? "");
  core.setOutput("image-digest-ref", build.image_digest_ref ?? "");
  core.setOutput("image-digest", build.image_digest ?? "");
  core.setOutput("template-id", build.template_id);
  core.setOutput("template-build-id", build.template_build_id);
  core.setOutput("template-build", String(build.template_build));
  core.setOutput("template-build-state", build.template_build_state);
  core.setOutput("snapshot-id", build.snapshot_id ?? "");
  core.setOutput("spec-hash", build.spec_hash ?? "");
  core.setOutput("failure-reason", build.failure_reason ?? "");
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
