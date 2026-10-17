# BonBagi

**One payment, every share, nobody's business.**

BonBagi lets a small collective (e.g. three mentors running one online class) get paid with a single Zcash shielded payment that is split directly to every member, in one transaction, with no treasurer and no custodian.

1. Members sign a **charter**: each member's shielded address + percentage (Ed25519, canonical format; any change invalidates the signatures).
2. The pay page verifies the charter **in the buyer's browser** and builds one ZIP-321 multi-recipient payment request; the buyer sees every recipient, amount, total and fee before the QR appears.
3. The buyer pays once from a Zcash wallet → one transaction, N shielded outputs. Each member sees only their own share.

Built for [ZECATHON](https://thezecathon.com) · track Shielded Payments.

## Status
- **Core library** (`src/core/`, tested): ZIP-321 multi-recipient builder + strict parser, deterministic zatoshi split with a minimum share, memo per output, signed charter (canonical JSON + Ed25519, every member must sign).
- **Day-1 gate tool** (`gate.html`): three shielded addresses → one payment request (copy + QR). Next: pay it from Zingo PC on Ironwood mainnet. See `docs/PLAN.md`.
- Pay page: in progress.

## Develop
```bash
npm ci
npm test        # unit tests
npm run dev     # http://localhost:5173/gate.html
npm run build
```

Code layout: `src/core/zip321.ts` (payment requests) · `split.ts` (who gets how much) · `charter.ts` (signed agreement) · `request.ts` (charter + price → request) · `memo.ts` · `address.ts` · `zatoshi.ts`.

## What stays private (honest threat model, draft)
- Public observers cannot see who was paid or how much.
- The buyer does see the recipient list (by design).
- The number of actions in the transaction is public (≈ number of members).
