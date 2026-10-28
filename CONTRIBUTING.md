# Contributing

1. Pick or open an issue. Backlog items use shared IDs `BB-xx` across BonBagi repositories ([docs/BACKLOG.md](docs/BACKLOG.md)).
2. Branch from `main`, keep pull requests small, and check the page at desktop and 375 px width.
3. `npm run typecheck && npm test && npm run build` must pass; CI runs the same.
4. Privacy rules for every page: no network calls from the pay, charter and raw-request pages (CSP `connect-src 'none'`), no cookies or storage, no logging of addresses or payment requests, fonts and libraries bundled (no CDN).
5. Payment logic belongs in [BonBagi-Protocol/core](https://github.com/BonBagi-Protocol/core), not in page code.
6. Never commit keys, seeds or real payment requests (see SECURITY.md).
