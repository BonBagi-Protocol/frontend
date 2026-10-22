# Demo video script (2:00)

Goal: show one **real mainnet** payment from Zingo PC that lands in two members' wallets as two shielded outputs, and show that the public sees none of it. The demo collective has two members (Dex and Hans) split **60/40**: an uneven split shows the split math at work (50/50 would look like simple halving), and at a price of 0.003 ZEC it gives round shares of 0.0018 and 0.0012. The same flow works for any number of members; the sample charter on the pay page shows three. Narration is in English, calm, about 140 words per minute. Record at 1920×1080, browser zoom 125% so text is readable.

## Before recording (checklist)

- [ ] Each member (Dex, Hans) creates a **fresh** unified address just for the demo, so the video does not publish addresses used elsewhere.
- [ ] Each member creates a signing key on `/charter.html`; Dex drafts the charter ("Intro to Zcash — 2 mentors", 60/40, minimum 0.0001 ZEC); both sign; save the signed file and the pay link.
- [ ] Zingo PC (2.0.26) funded with a **shielded** balance of at least 0.005 ZEC (price 0.003 ZEC + fee). Do not pay from a transparent balance.
- [ ] Both receiving wallets open and synced (or one screen per member recorded separately). The buyer pays from Zingo PC; Dex's share lands on his separate demo address.
- [ ] Hide or blur: seed phrases, balances, private signing keys, anything personal on screen. Close notifications.
- [ ] Explorer tab ready (e.g. a Zcash mainnet block explorer) to look up the transaction ID afterwards.
- [ ] Rehearse once with the sample charter so the clicks are smooth.

## Scenes

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:12 | Pay page hero, the flow diagram (buyer → 1 shielded tx → the members) | "Two mentors sell one class. Today one of them collects the money and pays the others later: a treasurer everyone must trust, and on a transparent chain everyone can watch the payouts. BonBagi fixes that with one Zcash payment." |
| 0:12–0:32 | `/charter.html` → step 4 *Check*: paste the signed file, *Check signatures* → both "valid" → *Create pay link* with price 0.003 | "First, the collective signs a charter: each member's shielded address and share, signed by every member with their own key. Change anything and the signatures break. When everyone has signed, we create a pay link. The charter rides in the part of the link after the hash, which browsers never send to any server." |
| 0:32–0:47 | Pay page, *Try a sample charter*: in the JSON change Mentor A's `"bps": 4000` to `5000` and Mentor B's `3000` to `2000` (still 100%) → *Check charter* → red "Not payable: the charter was changed after it was signed" banner, every signature marked "broken" | "If anyone tampers with an address or a share, the buyer's browser refuses to build a payment." |
| 0:47–1:05 | Open the real pay link → green "Verified … signed by all 2 members" → *Create payment request* → receipt with 0.0018 / 0.0012, total 0.003, fee ≈ 0.00015 | "The buyer opens the link. Every signature is checked locally. The receipt shows exactly who gets what, the total and the network fee, before any QR appears." |
| 1:05–1:30 | *Copy request* → Zingo PC → paste into send / pay URI → confirmation screen listing **both recipients** → confirm → sent, tx ID shown | "One request, one wallet, one confirmation. Zingo shows both recipients. We send." (Cut the waiting time; keep the confirmation screen on screen for 3 seconds.) |
| 1:30–1:45 | The two receiving wallets: each shows its own amount and the memo `bonbagi:v1 o=… c=… m=1/2` | "Each mentor receives their share directly, with an encrypted memo to match the order. Nobody held the money in between." |
| 1:45–1:55 | Explorer: the transaction shows only shielded actions, no addresses, no amounts | "And this is what the world sees: a shielded transaction. No sender, no recipients, no amounts." |
| 1:55–2:00 | Pay page footer, URL, repo | "No server, no custodian, no tracking. BonBagi: one payment, every share, nobody's business." |

## After recording

- Keep it under 2:00 (trim the wallet sync and confirmation wait).
- Add on-screen captions for the three key moments: "verified in the browser", "one transaction, two shielded outputs", "public sees nothing".
- Write the transaction ID in `docs/SUBMISSION.md` only if the team agrees; the ID reveals nothing about recipients or amounts.
- Upload (YouTube unlisted or as the form requires) and paste the link into the submission.
