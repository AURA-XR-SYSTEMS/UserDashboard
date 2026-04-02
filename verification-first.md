# UserDashboard Verification-First

## Environment

- Dev entrypoint: `npm run dev`
- Build entrypoint: `npm run build`
- Preview entrypoint: `npm run preview`
- Scripted dev port: `3000`
- Vite proxy routes: `/api`, `/health`

## Verification Ladder

1. Inspect the touched page, shared script, or Vite config path.
2. Run `npm run build` for any implementation change.
3. Run `npm run preview` when the issue depends on built asset behavior rather than dev-server behavior.
4. If the change affects proxied API traffic or response assumptions, inspect `UserService` before finishing.

## Notes

- The repo currently has only build-oriented validation, so do not overstate its safety net.
- When stronger scripts such as lint, tests, or type checks are added, this file should be updated immediately.
