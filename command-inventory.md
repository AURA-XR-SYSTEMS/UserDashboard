# UserDashboard Command Inventory

## Development

- Install deps: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build`
- Preview build output: `npm run preview`

## Verification

- Current validation: `npm run build`

## Repo Notes

- Dev script uses port `3000`.
- Vite proxies `/api` and `/health` to the configured backend target.
- Treat backend API shape changes as cross-repo work with `UserService`.

## Git Workflow

- Check branch: `git branch --show-current`
- Check status: `git status --short --branch`
- Compare against main: `git fetch origin main`
- Create branch: `git switch -c codex/<short-slug>`
- Push branch: `git push -u origin codex/<short-slug>`
- Open PR: `gh pr create`
