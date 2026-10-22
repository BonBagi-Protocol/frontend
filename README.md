# BonBagi

**One payment. Every share. Nobody's business.**

BonBagi lets a small collective (three mentors running a class, a band, a co-op) get paid with **one Zcash shielded payment that is split directly to every member in a single transaction**. No treasurer collects the money, no custodian holds it, and no server learns who was paid how much.

*Bon* is Indonesian for a receipt or bill; *bagi* means to share or split.

- **Demo:** https://bonbagi.vercel.app
- **Video (2 min):** _(added at submission)_
- **Track:** ZECATHON 2026 · Shielded Payments

## The problem

When several people sell something together, one of them usually receives the whole payment and pays the others later. That person becomes a treasurer everyone has to trust, the money sits in one account, and on a transparent chain anyone can watch the payouts and learn who earns what. Splitting payments with a smart contract or a payment processor brings back an intermediary and a public record.

## How BonBagi works

1. **Members sign a charter.** Each member creates an Ed25519 signing key in their browser. The group drafts one charter: every member's shielded address and share. Every member signs the same canonical bytes. Changing anything afterwards breaks all signatures.
2. **The seller shares a pay link.** The signed charter travels inside the link's `#` fragment, which browsers never send to the server.
3. **The buyer's browser verifies.** The pay page checks every signature locally, then shows a receipt: each recipient, their share, the exact amount in ZEC, the total and an estimated network fee.
4. **One payment.** The page builds a single [ZIP-321](https://zips.z.cash/zip-0321) multi-recipient request (copy, open in wallet, or QR). The buyer's wallet sends one transaction with one shielded output per member, each with an encrypted memo (order ID + charter fingerprint) so members can reconcile.

The page is fully static and client-side. There is no backend, database or account.

## What stays private

| Party | Sees | Does not see |
|---|---|---|
| Public chain observer | A shielded transaction happened; its fee and number of shielded actions (≈ members + change) | Who paid, who was paid, amounts, memos |
| Buyer | Every member's label, address, share and amount (by design, so they can check before paying) | Members' balances or other payments |
| Each member | Their own amount and memo; the charter they signed | The buyer's identity, other buyers' payments |
| Page host | Requests for static files (IP, time) | The charter, addresses, prices or payment requests |

The claim is deliberately narrow: BonBagi adds no privacy of its own; it avoids removing the privacy Zcash already provides. Known limits (visible action count, buyer sees the member list, signatures prove agreement but not identity, address reuse) are listed in **[docs/THREAT-MODEL.md](docs/THREAT-MODEL.md)**.

Enforced in code, not just promised:
- Strict Content-Security-Policy with `connect-src 'none'`: the page cannot make network requests, load third-party scripts, fonts or images.
- No cookies, no `localStorage`, no logging of addresses or payment requests.
- Transparent addresses are rejected; every share is shielded.
- Deterministic zatoshi split (largest-remainder, ties to the first member) and a minimum per member to avoid dust.

## Try it

- **Pay page** (`/`): press *Try a sample charter* to load a charter signed by three throw-away keys with made-up testnet addresses (wallets reject them, so the sample cannot move funds). Edit any address or share in the JSON and press *Check charter*: it is rejected.
- **Charter page** (`/charter.html`): create keys, draft, sign one by one, check, then create the pay link.
- **Raw request** (`/gate.html`): build a plain request for two or three recipients to test whether a wallet supports multi-recipient payments.

Wallets: tested target is Zingo PC (2.0.26); backup Zkool. Some mobile wallets show only the first recipient of a multi-recipient request; the pay page warns the buyer to check that every recipient is listed before confirming.

## Develop

```bash
npm ci
npm test         # unit tests (vitest)
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Code layout (`src/core/`, all pure and tested):

| File | Purpose |
|---|---|
| `zip321.ts` | Build and strictly parse ZIP-321 multi-recipient requests |
| `split.ts` | Deterministic zatoshi split, minimum share, percent → basis points |
| `charter.ts` | Canonical JSON, Ed25519 sign/verify, structural validation |
| `request.ts` | Signed charter + price → one payment request (refuses unless fully signed) |
| `paylink.ts` | Charter in the URL fragment, fee estimate, order IDs |
| `memo.ts` | Memo encoding (`bonbagi:v1 o=… c=… m=n/of`) |
| `address.ts` | Light address classification (shielded only) |
| `zatoshi.ts` | Integer zatoshi ↔ decimal ZEC |

Pages: `index.html` + `src/pay-page.ts`, `charter.html` + `src/charter-page.ts`, `gate.html` + `src/gate.ts`. Dependencies: `@noble/ed25519` (Ed25519) and `qrcode-generator`, both bundled; nothing is loaded from a CDN.

## Team

Dex Bennett ([@Stylenecy](https://github.com/Stylenecy), owner) · Hans ([@Shenhan01-sys](https://github.com/Shenhan01-sys)) · Dave ([@agadape](https://github.com/agadape)).

## License

MIT
