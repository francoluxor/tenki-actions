import * as core from "@actions/core";

export interface Inputs {
  template: string;
  projectId: string;
  workspaceId: string;
  file: string;
  buildEnv: string[];
  buildSecretEnv: string[];
  waitTimeout: string;
  waitDurable: boolean;
  publishRawImage?: boolean;
}

export function readInputs(): Inputs {
  const inputs: Inputs = {
    template: core.getInput("template", { required: true }),
    projectId: core.getInput("project-id", { required: true }),
    workspaceId: core.getInput("workspace-id"),
    file: core.getInput("file"),
    buildEnv: uniqueMultilineInput("build-env"),
    buildSecretEnv: uniqueMultilineInput("build-secret-env"),
    waitTimeout: core.getInput("wait-timeout") || "15m",
    waitDurable: parseBooleanInput(core.getInput("wait-durable"), true),
    publishRawImage: parseOptionalBooleanInput(core.getInput("publish-raw-image")),
  };

  for (const name of [...inputs.buildEnv, ...inputs.buildSecretEnv]) {
    validateEnvName(name);
    if (!(name in process.env)) {
      throw new Error(`environment variable ${JSON.stringify(name)} is not set`);
    }
  }
  for (const name of inputs.buildEnv) {
    if (/(token|secret|password|private[_-]?key)/i.test(name)) {
      core.warning(`build-env ${name} is stored in the build spec; use build-secret-env for secrets`);
    }
  }
  for (const name of inputs.buildSecretEnv) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`build secret environment variable ${JSON.stringify(name)} is empty`);
    }
    core.setSecret(value);
  }

  return inputs;
}

function uniqueMultilineInput(name: string): string[] {
  return [...new Set(core.getMultilineInput(name).map((value) => value.trim()).filter(Boolean))];
}

function validateEnvName(name: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`invalid environment variable name: ${name}`);
  }
}

function parseBooleanInput(value: string, defaultValue: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  throw new Error(`invalid boolean input: ${value}`);
}

function parseOptionalBooleanInput(value: string): boolean | undefined {
  if (!value.trim()) return undefined;
  return parseBooleanInput(value, false);
}
