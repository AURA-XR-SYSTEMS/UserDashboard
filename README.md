# UserDashboard

Vite-powered multi-page frontend for account, billing, plans, docs, downloads, and related user flows.

## Codex Status

| Signal | Current |
| --- | --- |
| Template line | `single-repo@1.3.0` |
| Codexification stage | `operational` |
| Operational readiness | `passing` |
| Next target | `maintained` |
| Conformity | `conforming` |
| Drift | `overrides` |

```mermaid
flowchart LR
  A[Discovered] --> B[Scaffolded] --> C[Standardized] --> D[Operational] --> E[Maintained]

  classDef done fill:#d9f99d,stroke:#3f6212,color:#1a2e05;
  classDef current fill:#fde68a,stroke:#92400e,color:#451a03,stroke-width:2px;
  class A,B,C done;
  class D current;
```

**Readiness Checks**

| Check | Status |
| --- | --- |
| Manifest current | `pass` |
| Docs current | `pass` |
| Command inventory grounded | `pass` |
| Verification path defined | `pass` |
| Verification path validated | `pass` |
| Shared skill coverage | `pass` |
| Repo-local skill coverage | `deferred` |
| Publish flow current | `pass` |
| Operational smoke | `pass` |

**Remaining Work**

- Keep the current checks passing.
- Review future `CodexEnv` upgrades and promote to `maintained` once the repo stays current through a later template review.
- Resolve or intentionally accept the current build warnings:
  - `default.css` unresolved at build time
  - Vite browser-compatibility warning around `node:module`

**Toolkit Available Now**

- Shared Codex metadata:
  - `AGENTS.md`
  - `codex-template.json`
  - `codex-assessment.md`
- Shared foundation skills:
  - `env-python-entrypoint`
  - `env-github-auth`
  - `git-branch-pr-status`
  - `git-repo-publish`
  - `verify-run-local-default`
- Native repo commands:
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm run preview`

## Local Development

```bash
npm install
npm run dev
```

The dev server uses port `3000`. Vite proxies `/api` and `/health` to the configured backend target.

## Verification

```bash
npm run build
```

Use `npm run preview` when the issue depends on built asset behavior rather than dev-server behavior.
