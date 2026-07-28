import * as exec from "@actions/exec";
import * as io from "@actions/io";

export interface TemplateBuildResult {
  template_id: string;
  template_build_id: string;
  template_build: number;
  template_build_state: string;
  snapshot_id?: string;
  spec_hash?: string;
  image_digest?: string;
  image_digest_ref?: string;
  failure_reason?: string | null;
}

export class TenkiCommandError<T> extends Error {
  constructor(
    message: string,
    readonly output?: T,
  ) {
    super(message);
    this.name = "TenkiCommandError";
  }
}

export async function requireTenki(): Promise<void> {
  const found = await io.which("tenki", false);
  if (!found) {
    throw new Error("tenki not found on PATH; add 'LuxorLabs/tenki-actions/setup-cli@v1' before this action");
  }
}

export async function tenkiJSON<T>(args: string[]): Promise<T> {
  let stdout = "";
  let stderr = "";
  const exitCode = await exec.exec("tenki", args, {
    silent: true,
    ignoreReturnCode: true,
    env: process.env as Record<string, string>,
    listeners: {
      stdout: (data) => {
        stdout += data.toString();
      },
      stderr: (data) => {
        stderr += data.toString();
      },
    },
  });
  if (exitCode !== 0) {
    throw new TenkiCommandError<T>(
      stderr.trim() || stdout.trim() || `tenki exited ${exitCode}`,
      parseJSON<T>(stdout),
    );
  }
  const parsed = parseJSON<T>(stdout);
  if (parsed !== undefined) return parsed;
  throw new Error(`failed to parse tenki JSON output (got ${stdout.length} bytes of non-JSON)`);
}

function parseJSON<T>(stdout: string): T | undefined {
  try {
    return JSON.parse(stdout) as T;
  } catch {
    return undefined;
  }
}
