# Submission

Deadline: **28 Oct 2026 23:59 UTC** (Thu 29 Oct 06:59 WIB). Submit early; editing a draft after submitting withdraws the submission.

| Field | Value |
|---|---|
| Project | BonBagi |
| Track | Shielded Payments |
| Tagline | One payment. Every share. Nobody's business. |
| Demo URL | https://bonbagi.vercel.app |
| Video | _(2-minute video link)_ |
| Repository | https://github.com/BonBagi/frontend (with https://github.com/BonBagi/core) |
| Team | Dex Bennett (owner), Hans, Dave |

## Description (1860 / 2,000 characters)

This text claims only what has happened (testnet run). After the real two-recipient mainnet payment succeeds, change the end of the "What is real" sentence to "…each memo read by its member), and on mainnet from Zingo PC to two members." and recount.

```text
BonBagi lets a small collective (two mentors running a class, a band, a co-op) get paid with one Zcash shielded payment that is split directly to every member in a single transaction. No treasurer collects the money, no custodian holds it, and no server learns who was paid how much.

How it works: members sign a charter (each member's shielded address and share) with their own Ed25519 keys; changing anything breaks every signature. The seller shares a pay link that carries the signed charter in the URL fragment, which browsers never send to a server. The buyer's browser verifies every signature, shows a receipt (each recipient, exact ZEC amount, total, estimated fee) and builds one ZIP-321 multi-recipient request as a link or QR. The buyer's wallet sends one transaction with one shielded output per member, each with an encrypted memo (order ID + charter fingerprint) so members can reconcile.

Privacy, stated narrowly: public observers see that a shielded transaction happened and its action count, but not who paid, who was paid, or how much. The buyer does see the member list and amounts, by design, so they can check before paying. The site is fully static: the pay and charter pages run under a Content-Security-Policy that forbids any network call; there are no cookies, no storage, no analytics and no logs. Transparent addresses are rejected. Our threat model lists the limits honestly (visible action count, signatures prove agreement not identity, address reuse).

Built with TypeScript, Vite and @noble/ed25519, with a deterministic zatoshi split and a minimum share to avoid dust. What is real: every check runs in the browser, the same kind of request was paid on Zcash testnet (one transaction, three shielded outputs, each memo read by its member). What is a mock: only the sample charter, whose made-up addresses no wallet accepts.
```

Character count checked with `len()` on the exact text above: **1860**.

## Before pressing submit

- [ ] Real mainnet payment done (one transaction, two correct shares (60/40), each member sees their memo).
- [ ] Video uploaded, under 2:00, shows the wallet listing all recipients.
- [ ] Demo URL opens (HTTP 200) on desktop and phone; sample charter flow works.
- [ ] Repository public, README and `docs/THREAT-MODEL.md` up to date, internal planning notes removed from history.
- [ ] Description pasted exactly as above.
