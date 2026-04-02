# AGENTS.md

Instructions in this file apply to the entire `UserDashboard` repository.

## Workflow

- Read `codex-template.json` first to determine the repo's template version, codexification stage, conformity status, readiness state, and local override state.
- Read `codex-assessment.md` after the manifest to see the current scorecard, evidence, and next promotion target.
- Read `runtime-bootstrap.md` first to determine the repo's runtime and auth conventions.
- Inspect the relevant code paths before editing. Prefer `rg` for search.
- Keep changes minimal and localized to the requested behavior.
- Do not revert user changes you did not make.
- Use `apply_patch` for manual file edits.
- Before starting new work, check whether the current branch has an associated pull request and whether it is already merged.
- If the current branch's PR is merged, switch to `main`, pull the latest `origin/main`, and create a fresh `codex/<short-slug>` branch before making changes.
- Start implementation work from the latest `main`:
  - update local `main` from `origin/main`
  - create a new branch named `codex/<short-slug>`
  - do not make feature or bugfix commits on `main`
- After the requested work is complete and the relevant validation passes, stage the intended files, commit them, push the branch to `origin`, and open a ready-for-review pull request against `main` with `gh`.

## Validation

Run the repo's native checks before responding.

- Preferred local dev entrypoint: `npm run dev`
- Preferred validation: `npm run build`
- Preview build output when needed: `npm run preview`

## Notes

- `UserDashboard` is a Vite-powered multi-page frontend.
- This repo does not currently expose lint, typecheck, or test scripts. Do not document or claim those checks until they actually exist.
- The Vite config proxies `/api` and `/health` to the configured backend target; treat backend contract changes as cross-repo work with `UserService`.
- Treat the commands in [command-inventory.md](/home/codex/workspace/AURA/UserDashboard/command-inventory.md) as the source list for future skills.
- Treat [skill-inventory.md](/home/codex/workspace/AURA/UserDashboard/skill-inventory.md) as the current map of shared foundation skills plus candidate repo-local skills.
- Keep [codex-template.json](/home/codex/workspace/AURA/UserDashboard/codex-template.json) updated when the repo is brought forward to a newer Codex template version or when overrides change materially.
