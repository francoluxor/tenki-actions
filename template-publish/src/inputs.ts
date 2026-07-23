import * as core from "@actions/core";
import { readFile } from "node:fs/promises";
import * as path from "node:path";

export type Mode = "create" | "update" | "build-only" | "publish-only";

export interface Inputs {
  mode: Mode;
  name: string;
  templateId: string;
  image: string;
  visibility: string;
  setupScript: string;
  baseImageId: string;
  tags: string;
  cpu: string;
  memoryMb: string;
  diskSizeGb: string;
  env: string;
  envPrefix: string;
  waitTimeout: string;
  waitDurable: boolean;
  publishRawImage?: boolean;
  configFields: string[];
  baseImageIdSet: boolean;
}

export async function readInputs(): Promise<Inputs> {
  const mode = core.getInput("mode", { required: true }) as Mode;
  const setupScript = await resolveSetupScript();
  const baseImageId = core.getInput("base-image-id");
  const inputs: Inputs = {
    mode,
    name: core.getInput("name"),
    templateId: core.getInput("template-id"),
    image: core.getInput("image"),
    visibility: core.getInput("visibility") || "public",
    setupScript,
    baseImageId: baseImageId || (mode === "create" ? "sandbox" : ""),
    tags: core.getInput("tags"),
    cpu: core.getInput("cpu"),
    memoryMb: core.getInput("memory-mb"),
    diskSizeGb: core.getInput("disk-size-gb"),
    env: core.getInput("env"),
    envPrefix: core.getInput("env-prefix") || "TENKI_TPL_",
    waitTimeout: core.getInput("wait-timeout") || "15m",
    waitDurable: parseBooleanInput(core.getInput("wait-durable"), true),
    publishRawImage: parseOptionalBooleanInput(core.getInput("publish-raw-image")),
    configFields: [],
    baseImageIdSet: baseImageId !== "",
  };
  inputs.configFields = configFields(inputs);
  validate(inputs);
  return inputs;
}

function validate(inputs: Inputs): void {
  const errors: string[] = [];
  if (!["create", "update", "build-only", "publish-only"].includes(inputs.mode)) {
    errors.push(`invalid mode: ${inputs.mode}`);
  }
  if (inputs.mode === "create") {
    if (inputs.templateId) errors.push("incompatible inputs: template-id is not allowed with mode create");
    if (!inputs.name) errors.push("incompatible inputs: name is required with mode create");
    if (!inputs.setupScript) errors.push("incompatible inputs: setup-script or setup-script-path is required with mode create");
  } else if (!inputs.templateId) {
    errors.push(`incompatible inputs: template-id is required with mode ${inputs.mode}`);
  }
  if (inputs.mode === "update" && inputs.configFields.length === 0) {
    errors.push("incompatible inputs: update requires at least one config field");
  }
  if ((inputs.mode === "build-only" || inputs.mode === "publish-only") && inputs.configFields.length > 0) {
    errors.push(`incompatible inputs: config fields are not accepted with mode ${inputs.mode}`);
  }
  if (inputs.mode === "build-only" && inputs.image) {
    errors.push("incompatible inputs: image is not accepted with mode build-only");
  }
  if (inputs.mode === "build-only" && inputs.visibility !== "public") {
    errors.push("incompatible inputs: visibility is not accepted with mode build-only");
  }
  if (!["private", "public"].includes(inputs.visibility)) {
    errors.push(`invalid visibility: ${inputs.visibility}`);
  }
  if (inputs.visibility !== "public" && !inputs.image) {
    errors.push("incompatible inputs: visibility requires image");
  }
  if (inputs.mode === "publish-only" && inputs.publishRawImage !== undefined) {
    errors.push("incompatible inputs: publish-raw-image is not accepted with mode publish-only");
  }
  if (errors.length > 0) {
    for (const error of errors) core.error(error);
    throw new Error(errors[0]);
  }
}

function configFields(inputs: Inputs): string[] {
  const fields: string[] = [];
  if (inputs.setupScript) fields.push("setup-script");
  if (inputs.baseImageIdSet) fields.push("base-image-id");
  if (inputs.tags) fields.push("tags");
  if (inputs.cpu) fields.push("cpu");
  if (inputs.memoryMb) fields.push("memory-mb");
  if (inputs.diskSizeGb) fields.push("disk-size-gb");
  if (inputs.env) fields.push("env");
  return fields;
}

function parseBooleanInput(value: string, defaultValue: boolean): boolean {
  const v = value.trim().toLowerCase();
  if (v === "") return defaultValue;
  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;
  throw new Error(`invalid boolean input: ${value}`);
}

function parseOptionalBooleanInput(value: string): boolean | undefined {
  const v = value.trim();
  if (v === "") return undefined;
  return parseBooleanInput(v, false);
}

async function resolveSetupScript(): Promise<string> {
  const inline = core.getInput("setup-script");
  const scriptPath = core.getInput("setup-script-path");
  if (inline && scriptPath) {
    core.error("incompatible inputs: setup-script and setup-script-path are mutually exclusive");
    throw new Error("incompatible inputs: setup-script and setup-script-path are mutually exclusive");
  }
  if (inline) return inline;
  if (!scriptPath) return "";
  const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const resolved = path.isAbsolute(scriptPath) ? scriptPath : path.join(workspace, scriptPath);
  return readFile(resolved, "utf8");
}
