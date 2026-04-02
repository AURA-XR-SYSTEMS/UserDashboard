# UserDashboard Runtime Bootstrap

## Runtime

- preferred Python entrypoint: not primary for this repo
- virtualenv location:
- preferred Node/package-manager entrypoint: `npm run <script>`
- local ports:
  - dev server script: `3000`

## GitHub Auth

- preferred auth tool: `gh`
- auth verification command: `gh auth status`
- PR workflow command: `gh pr create`

## Escalation Notes

- expected git escalation points: git add/commit/push may require sandbox escalation
- expected network escalation points: pushes, fetches, installs, and auth checks may require escalation
- expected Docker escalation points: not primary for this repo today
