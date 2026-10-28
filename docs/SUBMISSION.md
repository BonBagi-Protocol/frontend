# Submission

Deadline: **28 Oct 2026 23:59 UTC** (Thu 29 Oct 06:59 WIB). Submit early; editing a draft after submitting withdraws the submission.

| Field | Value |
|---|---|
| Project | BonBagi |
| Track | Shielded Payments |
| Tagline | One payment. Every share. Nobody's business. |
| Demo URL | https://bonbagi.vercel.app (try to cheat the split: https://bonbagi.vercel.app/try) |
| Video | https://bonbagi.vercel.app/demo.mp4 (1:44, with sound and burned-in subtitles) |
| Repository | https://github.com/BonBagi-Protocol/frontend (with https://github.com/BonBagi-Protocol/core and https://github.com/BonBagi-Protocol/watcher) |
| Team | Dex Bennett (owner), Hans, Dave |

## Description (1983 / 2,000 characters)

This text claims only what has happened: the team's testnet run (18 Oct). This submission does not include a mainnet payment.

```text
BonBagi lets a small collective (two mentors, a band, a co-op) get paid with one Zcash shielded payment that is split directly to every member in a single transaction. No treasurer collects the money, no custodian holds it, and no BonBagi server learns who was paid how much.

How it works: members sign a charter (each member's shielded address and share) with their own Ed25519 keys. The seller shares a pay link that carries the signed charter in the URL fragment, which browsers never send to a server. The buyer's browser verifies every signature, shows a receipt (each recipient, exact ZEC amount, total, estimated fee) and builds one ZIP-321 multi-recipient request. A multi-recipient ZIP-321 wallet sends one transaction with one shielded output per member, each with an encrypted memo (order ID + charter fingerprint). Each member can run our open-source watcher with their own viewing key to check their own share locally (via lightwalletd; no BonBagi backend).

Try to cheat it: bonbagi.vercel.app/try moves 10% to the host after signing. The total is still 100%, yet every signature breaks and the page refuses to pay.

Privacy, narrowly: public observers see that a shielded transaction happened, its time, fee and action count, not who paid (from a shielded balance), who was paid, or how much. By design the buyer sees the member list, to check before paying. The pay and charter pages run under a Content-Security-Policy that blocks all script network connections; no cookies, storage, analytics or logs. Transparent addresses are rejected.

What is real: every check runs in the browser (TypeScript, @noble/ed25519, integer zatoshi split, 103 tests in CI); the same kind of request was paid in a team dry run on Zcash testnet (one transaction, three shielded outputs to our own test wallets, each memo read by the receiving wallet). What is a mock: only the sample charter and the demo collective (Mentor A/B) in the video, whose made-up addresses no wallet accepts.
```

Character count checked with `len()` on the exact text above: **1983**.

## Before pressing submit

- [x] Testnet payment proof: tx `485623f7eaf97802d5399faa3610212b39749618fd024d4ad9201f4f31a5f520` (block 4514615), three shielded outputs to our own test wallets, each memo read by the receiving wallet (team dry run, 18 Oct).
- [x] Video uploaded, under 2:00 (1:44, with subtitles): demo collective, the cheat refused, the team testnet dry run on an explorer.
- [ ] Demo URL opens (HTTP 200) on desktop and phone; sample charter flow works.
- [ ] Repository public, README and `docs/THREAT-MODEL.md` up to date, internal planning notes removed from history.
- [ ] Description pasted exactly as above.
