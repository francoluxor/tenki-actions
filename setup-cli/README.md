# setup-cli

Installs the `tenki` CLI on Linux and macOS runners.

## Usage

Install the latest CLI:

```yaml
name: Tenki CLI

on:
  workflow_dispatch:

jobs:
  tenki:
    runs-on: ubuntu-latest
    steps:
      - uses: LuxorLabs/tenki-actions/setup-cli@v1
        with:
          version: latest
      - run: tenki --version
```

Pin an exact CLI release:

```yaml
- uses: LuxorLabs/tenki-actions/setup-cli@v1
  with:
    version: vX.Y.Z
```

Use the output in later steps:

```yaml
- id: setup-tenki
  uses: LuxorLabs/tenki-actions/setup-cli@v1
- run: echo "Installed ${{ steps.setup-tenki.outputs.tenki-version }}"
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `version` | No | `latest` | CLI version to install. Accepts `latest`, `vX.Y.Z`, or `X.Y.Z`. |

## Outputs

| Output | Description |
| --- | --- |
| `tenki-version` | Resolved CLI version, for example `0.7.0`. Always without a leading `v`. |

## Supported runners

The action supports the platforms currently published by the Tenki CLI production installer:

| Runner OS | Architectures |
| --- | --- |
| Linux | `x64` |
| macOS | `arm64` |

Windows, Linux arm64, and macOS x64 are not supported in v1.

## How it works

The action shells out to the public installer:

```bash
curl -fsSL https://tenki.cloud/install.sh | bash
```

For pinned versions it passes `--version X.Y.Z`. The installer follows the `tenki.cloud` redirect to public GCS, downloads the raw binary, and writes it to `$TENKI_INSTALL_DIR/tenki`.

Pinned versions are cached through `@actions/tool-cache`. `latest` is not cached because it is a moving target. The action adds the install or cached directory to `$PATH`.

No Tenki secret or GitHub token is required to install the CLI. Integrity is HTTPS plus the public GCS bucket, matching the deployed `tenki.cloud/install.sh` behavior.
