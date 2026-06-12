# UserDashboard

Vite-powered multi-page frontend for account, billing, plans, docs, downloads, and related user flows.

## Codex Status

`single-repo@1.4.1` • Stage: `operational` • Readiness: `passing` • Next: `maintained`

`discovered > scaffolded > standardized > [operational] > maintained`

Remaining work: keep the current checks passing, then review the repo on a later `CodexEnv` upgrade to promote it to `maintained`.

Toolkit: shared foundation skills plus native verification commands are available now. See `codex-assessment.md`, `skill-inventory.md`, and `command-inventory.md` for detail.

## Local Development

```bash
npm install
npm run dev
```

The dev server uses port `3000`. Vite proxies `/api` and `/health` to the configured backend target.

## Billing

The dashboard starts Aura Membership through the UserService hosted Stripe
Checkout endpoint:

```text
POST /api/subscriptions/checkout
```

Billing management redirects through:

```text
POST /api/subscriptions/portal
```

The frontend no longer embeds Stripe Elements or credit purchase flows. UserService
owns Stripe secret configuration, Price lookup, Checkout Session creation, Billing
Portal Session creation, and webhook-driven subscription state.

## Verification

```bash
npm run build
```

Use `npm run preview` when the issue depends on built asset behavior rather than dev-server behavior.
