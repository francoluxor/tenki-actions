# TenkiCloud Actions

First-party GitHub Actions for Tenki workflows.

## Actions

- [`setup-cli`](./setup-cli) installs the `tenki` CLI on Linux and macOS runners.
- [`template-build`](./template-build) creates or updates and builds sandbox templates from `.tenki/template.json`.
- [`template-publish`](./template-publish) is deprecated and remains available for legacy setup-script templates.

## Typical template workflow

Use `setup-cli` first, then `template-build`.

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
      - uses: TenkiCloud/actions/setup-cli@v1
        with:
          version: latest
      - uses: TenkiCloud/actions/template-build@v1
        id: template
        env:
          TENKI_API_KEY: ${{ secrets.TENKI_API_KEY }}
        with:
          template: node-api
          workspace-id: ${{ secrets.TENKI_WORKSPACE_ID }}
          project-id: ${{ secrets.TENKI_PROJECT_ID }}
      - run: echo "Built ${{ steps.template.outputs.image }}"
```

## Version pinning

Pin action versions by major tag for patch updates:

```yaml
- uses: TenkiCloud/actions/setup-cli@v1
- uses: TenkiCloud/actions/template-build@v1
```

Pin the CLI independently:

```yaml
- uses: TenkiCloud/actions/setup-cli@v1
  with:
    version: vX.Y.Z
```

## Auth

`template-build` reads `TENKI_API_KEY` or `TENKI_AUTH_TOKEN` from the job environment. Do not pass credentials through `with:`.

Required secrets for most workflows:

- `TENKI_API_KEY` or `TENKI_AUTH_TOKEN`: Tenki API credential.
- `TENKI_PROJECT_ID`: project that owns the template.
- `TENKI_WORKSPACE_ID`: required when the named template does not exist yet.
