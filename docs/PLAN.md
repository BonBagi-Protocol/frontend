# Plan (deadline 28 Oct 2026 23:59 UTC = Thu 29 Oct 06:59 WIB)

## Day 1 gate (go / no-go)
- [ ] Build one ZIP-321 URI with 3 recipients (team-owned addresses, tiny amounts) and memo per output.
- [ ] Pay it from Zingo PC (2.0.26 pre-release) on Ironwood mainnet. Pass = one tx, 3 correct amounts, each recipient sees their share, and Zingo PC shows ALL recipients before confirm. Backup wallet: Zkool. Do not use Zodl (iOS rejects multi-recipient URIs; Android issue #2217 shows only the first recipient).

## Requirements
- Canonical charter + Ed25519 signatures from every member; verified client-side; reject on any change.
- Minimum amount per member (avoid dust / note bloat under ZIP-317 fees).
- Deterministic zatoshi rounding for uneven splits.
- Rotate recipient addresses per product/period; never log or publish raw URIs/address lists.
- Memo per output: order ID + charter hash (no personal data).
- Static pay page (no scanning backend needed).

## Later (not MVP)
- Referrer/affiliate share as a charter member, via a pay page hosted by the referrer (council vote 4–3: not in MVP).

## Split (owner 40%, others 30% each — trio agreement 16 Oct)
- Dex: owner, charter + pay page, demo video
- Hans: ? (backlog to be split)
- Dave: ? (backlog to be split)
