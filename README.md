# BonBagi

**One payment, every share, nobody's business.**

BonBagi lets a small collective (e.g. three mentors running one online class) get paid with a single Zcash shielded payment that is split directly to every member, in one transaction, with no treasurer and no custodian.

1. Members sign a **charter**: each member's shielded address + percentage (Ed25519, canonical format; any change invalidates the signatures).
2. The pay page verifies the charter **in the buyer's browser** and builds one ZIP-321 multi-recipient payment request; the buyer sees every recipient, amount, total and fee before the QR appears.
3. The buyer pays once from a Zcash wallet → one transaction, N shielded outputs. Each member sees only their own share.

Built for [ZECATHON](https://thezecathon.com) · track Shielded Payments.

## Status
Day 1 — go/no-go gate: one 3-recipient ZIP-321 URI paid from Zingo PC on Ironwood mainnet. See `docs/PLAN.md`.

## What stays private (honest threat model, draft)
- Public observers cannot see who was paid or how much.
- The buyer does see the recipient list (by design).
- The number of actions in the transaction is public (≈ number of members).
