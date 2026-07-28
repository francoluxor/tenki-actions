# template-build

Creates or updates a sandbox template from `.tenki/template.json`, waits for the build, and returns its immutable registry image ref. Add `setup-cli` first, or provide `tenki` on `$PATH` yourself.

The action runs `tenki template build <name-or-id> --json`. If the named template does not exist, the CLI creates it from the local specification. If it already exists, the CLI updates its definition before building.

## Usage

```yaml
name: Build sandbox template

on:
  push:
    branches: [main]
    paths:
      - ".tenki/template.json"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: LuxorLabs/tenki-actions/setup-cli@v1
      - uses: LuxorLabs/tenki-actions/template-build@v1
        id: template
        env:
          TENKI_API_KEY: ${{ secrets.TENKI_API_KEY }}
          GITHUB_TOKEN: ${{ github.token }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        with:
          template: node-api
          build-secret-env: |
            GITHUB_TOKEN
            NPM_TOKEN
      - run: echo "Built ${{ steps.template.outputs.image }}"
```

The API key determines the Workspace for both existing and newly created templates.

By default the CLI discovers `.tenki/template.json` from the runner workspace. The legacy root `tenki.template.json` path remains discoverable with a deprecation warning. Set `file` for another path. If no specification is found, an existing template can still be rebuilt from its remote definition.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `template` | Yes | Template name or ID. A missing name is created from the discovered or explicit specification. |
| `file` | No | Specification path. Empty uses CLI discovery for `.tenki/template.json` (or the deprecated root `tenki.template.json`). |
| `build-env` | No | Newline-separated env names whose values are stored in the build spec. Do not use for secrets. |
| `build-secret-env` | No | Newline-separated env names forwarded ephemerally for this build. |
| `wait-timeout` | No | Local observation timeout. Default `15m`; `0` disables it. |
| `wait-durable` | No | Wait for the snapshot upload. Default `true`. |
| `publish-raw-image` | No | Override raw disk image publishing. Empty uses the Tenki default. |

The CLI automatically treats non-empty `GIT_TOKEN`, `GH_TOKEN`, and `GITHUB_TOKEN` values as ephemeral build secrets. Listing them in `build-secret-env` is optional.

## Outputs

| Output | Description |
| --- | --- |
| `image` | Immutable registry image digest ref. Alias for `image-digest-ref`. |
| `image-digest-ref` | Immutable registry image digest ref. |
| `image-digest` | Image digest. |
| `template-id` | Template ID. |
| `template-build-id` | Build ID. |
| `template-build` | Template-local build number. |
| `template-build-state` | Final state, normally `succeeded`. |
| `snapshot-id` | Snapshot ID produced by the build. |
| `spec-hash` | Canonical specification hash. |
| `failure-reason` | Failure reason, empty on success. |

Use the immutable output directly in later jobs:

```yaml
- run: tenki sandbox create --image "${{ steps.template.outputs.image }}"
```

## Authentication

Set either `TENKI_API_KEY` or `TENKI_AUTH_TOKEN` in `env`; do not pass credentials through `with:`. `TENKI_AUTH_TOKEN` takes precedence when both are set.
