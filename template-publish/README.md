# template-publish

> [!WARNING]
> This action is deprecated. Use [`template-build`](../template-build) with a `.tenki/template.json` specification. `template-publish` remains available for legacy setup-script templates.

Drives sandbox template publishing through the `tenki` CLI. Add `setup-cli` first, or provide `tenki` on `$PATH` yourself.

`template-publish` never calls Tenki backend RPCs directly. It shells out to:

- `tenki sandbox template create --json`
- `tenki sandbox template update --json`
- `tenki sandbox template build --wait --json`
- `tenki sandbox snapshot download-url --file raw-image --json` when a built snapshot has a raw image
- `tenki sandbox registry publish --json` when `image` is set
- `tenki sandbox template publish --json` as the deprecated no-image compatibility path

## Prerequisites

- `tenki` is available on `$PATH`. The recommended setup is `TenkiCloud/actions/setup-cli@v1`.
- `TENKI_AUTH_TOKEN` is set in `env`.
- For `mode: update`, `build-only`, and `publish-only`, you already know the template ID.

## One-time bootstrap (`mode: create`)

Use this once to create the template, build it, and publish the first public version.

```yaml
name: Bootstrap sandbox template

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: TenkiCloud/actions/setup-cli@v1
      - uses: TenkiCloud/actions/template-publish@v1
        id: publish
        env:
          TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NODE_AUTH_TOKEN }}
        with:
          mode: create
          name: ci-template
          setup-script-path: .tenki/setup.sh
          base-image-id: sandbox
          tags: node,ci
          cpu: "4"
          memory-mb: "8192"
          disk-size-gb: "40"
          env: NODE_AUTH_TOKEN
          publish-raw-image: "true"
          image: my-workspace/ci-template:latest
          visibility: public
      - run: echo "Template ${{ steps.publish.outputs.template-id }}"
      - run: echo "Raw image URL ${{ steps.publish.outputs.raw-image-url }}"
```

Save `steps.publish.outputs.template-id` as a repository secret or variable before switching to `mode: update`.

## Per-push update (`mode: update`)

Use this for normal CI publishing after bootstrap. It updates the existing template, builds it, and republishes after the build succeeds.

```yaml
name: Publish sandbox template

on:
  push:
    branches: [main]
    paths:
      - ".tenki/**"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: TenkiCloud/actions/setup-cli@v1
      - uses: TenkiCloud/actions/template-publish@v1
        id: publish
        env:
          TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
        with:
          mode: update
          template-id: ${{ secrets.TENKI_TEMPLATE_ID }}
          setup-script-path: .tenki/setup.sh
```

## Build without publish (`mode: build-only`)

Use this when another job must smoke test before publishing.

```yaml
- uses: TenkiCloud/actions/template-publish@v1
  id: build
  env:
    TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
  with:
    mode: build-only
    template-id: ${{ secrets.TENKI_TEMPLATE_ID }}
```

`artifact-id`, `snapshot-id`, `image`, and deprecated `publication-id` are empty in this mode.

## Publish current successful build (`mode: publish-only`)

Use this after an external smoke test passes.

```yaml
- uses: TenkiCloud/actions/template-publish@v1
  id: publish
  env:
    TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
  with:
    mode: publish-only
    template-id: ${{ secrets.TENKI_TEMPLATE_ID }}
    image: my-workspace/ci-template:latest
```

The Tenki API rejects this mode if the template has no successful latest build.

## Split smoke gate

```yaml
jobs:
  build-template:
    runs-on: ubuntu-latest
    outputs:
      template-build-id: ${{ steps.build.outputs.template-build-id }}
    steps:
      - uses: actions/checkout@v4
      - uses: TenkiCloud/actions/setup-cli@v1
      - uses: TenkiCloud/actions/template-publish@v1
        id: build
        env:
          TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
        with:
          mode: build-only
          template-id: ${{ secrets.TENKI_TEMPLATE_ID }}

  smoke:
    needs: build-template
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/smoke-template.sh "${{ needs.build-template.outputs.template-build-id }}"

  publish-template:
    needs: smoke
    runs-on: ubuntu-latest
    steps:
      - uses: TenkiCloud/actions/setup-cli@v1
      - uses: TenkiCloud/actions/template-publish@v1
        env:
          TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
        with:
          mode: publish-only
          template-id: ${{ secrets.TENKI_TEMPLATE_ID }}
```

## Inputs

| Input | Required | Modes | Description |
| --- | --- | --- | --- |
| `mode` | Yes | all | One of `create`, `update`, `build-only`, `publish-only`. |
| `name` | create | create | Template name for a new template. |
| `template-id` | non-create | update, build-only, publish-only | Existing template ID. Rejected in `create`. |
| `image` | No | create, update, publish-only | Registry image ref `<workspace>/<artifact>[:tag]`. When set, publish uses `tenki sandbox registry publish`. Omit only for legacy template publish compatibility. |
| `visibility` | No | create, update, publish-only | Registry visibility, `public` or `private`. Default `public`. Requires `image` when not `public`. |
| `setup-script` | create if no path | create, update | Inline setup script. Mutually exclusive with `setup-script-path`. |
| `setup-script-path` | create if no inline script | create, update | Path to setup script, relative to `GITHUB_WORKSPACE` unless absolute. |
| `base-image-id` | No | create, update | Base image ID. Defaults to `sandbox` in `create`. Only sent in `update` when explicitly supplied. |
| `tags` | No | create, update | Comma-separated tags, for example `node,ci,public`. |
| `cpu` | No | create, update | CPU cores. |
| `memory-mb` | No | create, update | Memory in MB. |
| `disk-size-gb` | No | create, update | Disk size in GB. |
| `env` | No | create, update | Newline-separated workflow env var names to forward, or `*` to forward vars matching `env-prefix`. |
| `env-prefix` | No | create, update | Prefix used with `env: '*'`. Default `TENKI_TPL_`. |
| `wait-timeout` | No | create, update, build-only | Build wait timeout. Default `15m`. |
| `wait-durable` | No | create, update, build-only | Also wait for snapshot durability before finishing. Default `true`. |
| `publish-raw-image` | No | create, update, build-only | Override whether template builds publish a standalone compressed raw disk image. Empty uses the Tenki default. |

## Outputs

| Output | Description |
| --- | --- |
| `template-id` | Template ID created or operated on. |
| `artifact-id` | Registry artifact ID from publish. Empty in `build-only`. |
| `snapshot-id` | Snapshot ID from build or publish. |
| `raw-image-available` | `true` when the snapshot has a standalone compressed raw disk image. |
| `raw-image-url` | Short-lived download URL for the raw disk image, empty when unavailable. |
| `raw-image-expires-at` | Expiration time for `raw-image-url`. |
| `image` | Published image ref. Empty in `build-only`. |
| `publication-id` | Deprecated alias for `artifact-id`. Empty in `build-only`. |
| `template-build-id` | Build ID from create/update/build-only, or build ID used by publish-only. |
| `template-build-state` | Build state from build modes, for example `succeeded` or `failed`. |

## Env forwarding

Forward selected job env vars into the template env:

```yaml
env:
  TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
with:
  env: NPM_TOKEN
```

Forward every job env var with the default `TENKI_TPL_` prefix:

```yaml
env:
  TENKI_AUTH_TOKEN: ${{ secrets.TENKI_AUTH_TOKEN }}
  TENKI_TPL_REGISTRY_TOKEN: ${{ secrets.REGISTRY_TOKEN }}
with:
  env: "*"
```

Values are masked with `core.setSecret()` before the action invokes `tenki`. Logs include forwarded names, never values.

## Validation and failure behavior

The action validates inputs before invoking `tenki`:

- `create` rejects `template-id`.
- `create` requires `name` and setup script content or path.
- Non-create modes require `template-id`.
- `update` requires at least one config field.
- `build-only` and `publish-only` reject config fields.
- Missing `TENKI_AUTH_TOKEN` fails before any CLI call.
- Missing `tenki` fails with: `tenki not found on PATH; add 'TenkiCloud/actions/setup-cli@v1' step before this one`.

If build fails, the action exits non-zero and does not call publish. Existing publications stay active.

Raw image URLs are presigned and short-lived. Use the output in the same workflow run, or regenerate later with:

```bash
tenki sandbox snapshot download-url "$SNAPSHOT_ID" --file raw-image --json
```
