import * as core from "@actions/core";
import { collectForwardedEnv } from "./env.js";
import { type BuildResult, type PublishResult, requireTenki, tenkiJSON, type TemplateResult } from "./tenki.js";
import { readInputs, type Inputs } from "./inputs.js";

async function run(): Promise<void> {
  const token = process.env.TENKI_AUTH_TOKEN;
  if (!token?.trim()) {
    core.error("missing TENKI_AUTH_TOKEN env var");
    throw new Error("missing TENKI_AUTH_TOKEN env var");
  }
  core.setSecret(token);

  await requireTenki();
  const inputs = await readInputs();
  const forwarded = collectForwardedEnv(inputs.env, inputs.envPrefix);
  const forwardedArgs = Array.from(forwarded.entries()).flatMap(([name, value]) => ["--env", `${name}=${value}`]);

  let templateId = inputs.templateId;
  let build: BuildResult | undefined;
  let publication: PublishResult | undefined;

  const waitTimeout = inputs.waitTimeout;
  const waitDurable = inputs.waitDurable;

  if (inputs.mode === "create") {
    core.info("creating template");
    const created = await step("create", () =>
      tenkiJSON<TemplateResult>([
        "sandbox",
        "template",
        "create",
        "--workspace",
        inputs.workspaceId,
        "--project",
        inputs.projectId,
        "--name",
        inputs.name,
        "--setup-script",
        inputs.setupScript,
        ...configArgs(inputs),
        ...forwardedArgs,
        "--json",
      ]),
    );
    templateId = created.template_id;
    build = await buildTemplate(templateId, waitTimeout, waitDurable);
    publication = await publishTemplate(templateId, inputs);
  } else if (inputs.mode === "update") {
    core.info("updating template");
    await step("update", () =>
      tenkiJSON<TemplateResult>([
        "sandbox",
        "template",
        "update",
        templateId,
        ...configArgs(inputs),
        ...forwardedArgs,
        "--json",
      ]),
    );
    build = await buildTemplate(templateId, waitTimeout, waitDurable);
    publication = await publishTemplate(templateId, inputs);
  } else if (inputs.mode === "build-only") {
    build = await buildTemplate(templateId, waitTimeout, waitDurable);
  } else {
    publication = await publishTemplate(templateId, inputs);
  }

  core.setOutput("template-id", templateId);
  core.setOutput("artifact-id", publication?.artifact_id ?? publication?.publication_id ?? "");
  core.setOutput("snapshot-id", publication?.snapshot_id ?? "");
  core.setOutput("image", publication?.image ?? "");
  core.setOutput("publication-id", publication?.artifact_id ?? publication?.publication_id ?? "");
  core.setOutput("template-build-id", build?.template_build_id ?? publication?.template_build_id ?? "");
  core.setOutput("template-build-state", build?.template_build_state ?? publication?.template_build_state ?? "");
}

function configArgs(inputs: Inputs): string[] {
  const args: string[] = [];
  if (inputs.baseImageId && (inputs.mode === "create" || inputs.baseImageIdSet)) {
    args.push("--base-image", inputs.baseImageId);
  }
  if (inputs.mode === "update" && inputs.setupScript) args.push("--setup-script", inputs.setupScript);
  if (inputs.tags) args.push("--tags", inputs.tags);
  if (inputs.cpu) args.push("--cpu", inputs.cpu);
  if (inputs.memoryMb) args.push("--memory-mb", inputs.memoryMb);
  if (inputs.diskSizeGb) args.push("--disk-size-gb", inputs.diskSizeGb);
  return args;
}

async function buildTemplate(templateId: string, waitTimeout: string, waitDurable: boolean): Promise<BuildResult> {
  const args = ["sandbox", "template", "build", templateId, "--wait", "--wait-timeout", waitTimeout, "--json"];
  if (waitDurable) args.push("--wait-durable");
  const build = await step("build", () => tenkiJSON<BuildResult>(args));
  if (build.template_build_state === "failed") {
    throw new Error(build.failure_reason ? `template build failed: ${build.failure_reason}` : "template build failed");
  }
  return build;
}

async function publishTemplate(templateId: string, inputs: Inputs): Promise<PublishResult> {
  if (!inputs.image) {
    return step("publish", () => tenkiJSON<PublishResult>(["sandbox", "template", "publish", templateId, "--json"]));
  }
  return step("publish", () =>
    tenkiJSON<PublishResult>([
      "sandbox",
      "registry",
      "publish",
      "--from-template",
      templateId,
      "--image",
      inputs.image,
      "--visibility",
      inputs.visibility,
      "--json",
    ]),
  );
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    core.error(`${name} failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
