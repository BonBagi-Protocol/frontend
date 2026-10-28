# Plan (deadline 28 Oct 2026 23:59 UTC = Thu 29 Oct 06:59 WIB)

## Day 1 gate (go / no-go)
- [x] Build one ZIP-321 URI with 3 recipients (team-owned addresses, tiny amounts) and memo per output — `gate.html`.
- [ ] Pay it from Zingo PC (2.0.26 pre-release) on Ironwood mainnet. Pass = one tx, 3 correct amounts, each recipient sees their share, and Zingo PC shows ALL recipients before confirm. Backup wallet: Zkool. Do not use Zodl (iOS rejects multi-recipient URIs; Android issue #2217 shows only the first recipient).

## Requirements (status 18 Oct: all built and tested; see docs/THREAT-MODEL.md)
- Canonical charter + Ed25519 signatures from every member; verified client-side; reject on any change.
- Minimum amount per member (avoid dust / note bloat under ZIP-317 fees).
- Deterministic zatoshi rounding for uneven splits.
- Rotate recipient addresses per product/period; never log or publish raw URIs/address lists.
- Memo per output: order ID + charter hash (no personal data).
- Static pay page (no scanning backend needed).

## Built
- [x] Core library + tests (ZIP-321, split, memo, charter, request, pay links).
- [x] Charter page: keys, draft, sign, check, create pay link.
- [x] Pay page: charter from link fragment / paste / file, verify, receipt, request + QR; refuses partly signed charters.
- [x] Privacy hygiene: strict CSP (no network), no storage, no logs, no referrer; threat model.
- [x] Demo script and submission text (docs/DEMO-SCRIPT.md, docs/SUBMISSION.md).
- [ ] Real three-recipient mainnet payment from Zingo PC (day-1 gate) and video.
- [x] Testnet dry run of the full flow (Hans, 18 Oct): charter signed by 3 keys → `buildPaymentRequest` → one ZIP-321 request paid with zcash-devtool. One tx (`485623f7…f520`, testnet block 4514615), 3 Ironwood outputs 0.0012 / 0.0009 / 0.0009 TAZ + change, each memo read as text by the receiving wallet, fee 0.0002 TAZ = `estimateFeeZat(3)` (ZIP-317 holds on Ironwood). Does not replace the mainnet gate.

## Progress log
- **18 Oct · Hans** — reviewed #4, #5, #6 and ran the testnet dry run above.
  - #4: keep the 0.0001 ZEC default floor (2× the ~5,000 zat cost of spending one note; collectives can raise it via `minShareZat`). Added split tests: 50 members, 3-way remainder ties, supply cap, charter override (39/39 pass).
  - #5: memo format confirmed in a real wallet (testnet). Recheck on Zingo PC during the mainnet gate, then close.
  - #6: audit clean (no console/storage/cookie/network APIs in `src/`, no external refs in HTML, no inline scripts in `dist/`, no real addresses or URIs in git history, live headers confirmed). Phone check pending with #3.
  - Open: Dave (@agadape) is not yet a repo collaborator or org member.
  - #7: threat model tightened — CSP cannot block top-level navigation, pay-link price is not signed, fragment stays in browser history/sync, clipboard exposure, downloaded key file. Pay and charter pages now show a 32-hex (128-bit) fingerprint for identity checks; memos keep 16 hex for reconciliation.
  - #3: mobile check (headless Chrome at 320 / 360 / 390 px, live site): no horizontal scroll, no console errors or CSP violations, sample → receipt → QR and the tamper banner all work. Cosmetic notes in the issue. Real-device check still to do.
- **19 Oct · Hans** — #4 and #6 closed after #10 merged. Rechecked v2 (cd75952) at 320 / 360 / 390 px: no horizontal scroll once the stamp animation settles, console clean, tamper banner and full-screen QR work.
  - Mainnet gate prep: fresh receiving address and signing key ready; Hans sends them to Dex directly (not in the repo).
  - Orchard-only unified addresses receive into Ironwood (seen on testnet) and are 106 instead of 213 characters: the 3-member request drops from ~1,034 to ~713 characters and the QR from 109 to 89 modules. Suggest everyone uses one for the demo.

## Later (not MVP)
- Pad the transaction with dummy outputs so the action count does not reveal the number of members.
- Referrer/affiliate share as a charter member, via a pay page hosted by the referrer (not in MVP).
- Charter drafted by an AI agent from the seller–affiliate chat; both parties review and sign. Privacy check needed first: the chat must not leak to a third-party model provider in a way that breaks the threat model.

## Split (owner 40%, others 30% each)
- Dex: owner, charter + pay page, demo video
- Hans: split math (#4), memo (#5), privacy hygiene (#6), testnet dry run; next: mainnet gate receiving wallet (#1), sign the real charter (#2), receiving wallet in the demo (#8), phone review (#3), threat model review (#7)
- Dave: device testing and UI feedback (light mode on low-end devices; the cash-register idea for the pay page)
