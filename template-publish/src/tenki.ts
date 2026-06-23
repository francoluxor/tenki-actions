import * as exec from "@actions/exec";
import * as io from "@actions/io";

export interface TemplateResult {
  template_id: string;
  name?: string;
  workspace_id?: string;
  project_id?: string;
  latest_build_id?: string | null;
  visibility?: string;
}

export interface BuildResult {
  template_id: string;
  template_build_id: string;
  template_build_state: string;
  snapshot_id?: string;
  failure_reason?: string | null;
}

export interface PublishResult {
  artifact_id: string;
  snapshot_id: string;
  image: string;
  template_build_id: string;
  template_build_state: string;
  publication_id?: string;
  template_id: string;
  published_at?: string;
}

export interface SnapshotResult {
  id: string;
  raw_image_available?: boolean;
}

export interface SnapshotDownloadURLResult {
  url: string;
  expires_at?: string;
}

export async function requireTenki(): Promise<void> {
  const found = await io.which("tenki", false);
  if (!found) {
    throw new Error("tenki not found on PATH; add 'TenkiCloud/actions/setup-cli@v1' step before this one");
  }
}

export async function tenkiJSON<T>(args: string[], env: Record<string, string> = {}): Promise<T> {
  let stdout = "";
  let stderr = "";
  const exitCode = await exec.exec("tenki", args, {
    silent: true,
    ignoreReturnCode: true,
    env: { ...process.env, ...env } as Record<string, string>,
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
    const detail = stderr.trim() || stdout.trim() || `tenki exited ${exitCode}`;
    throw new Error(detail);
  }
  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    const lines = stdout
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    const lastJSONLine = [...lines].reverse().find((line) => line.trim().startsWith("{"));
    if (lastJSONLine) {
      return JSON.parse(lastJSONLine) as T;
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to parse tenki JSON output: ${detail} (got ${stdout.length} bytes of non-JSON)`);
  }
}
