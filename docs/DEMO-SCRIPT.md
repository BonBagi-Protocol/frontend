# Demo video script (2:00)

Goal: show one **real mainnet** payment from Zingo PC that lands in two members' wallets as two shielded outputs, and show that the public sees none of it. The demo collective has two members (Dex and Hans) split **60/40**: an uneven split shows the split math at work (50/50 would look like simple halving), and at a price of 0.003 ZEC it gives round shares of 0.0018 and 0.0012. The same flow works for any number of members; the sample charter on the pay page shows three.

Narration is in English, calm, about 140 words per minute (the script below is about 184 words, so there is room for pauses). Record at 1920×1080, browser zoom 125% so text is readable.

## Before recording (checklist)

- [ ] Each member (Dex, Hans) creates a **fresh** unified address just for the demo, so the video does not publish addresses used elsewhere.
- [ ] Each member creates a signing key on `/charter.html`; Dex drafts the charter ("Intro to Zcash — 2 mentors", 60/40, minimum 0.0001 ZEC); both sign; save the signed file and the pay link (price 0.003).
- [ ] Zingo PC (2.0.26) funded with a **shielded** balance of at least 0.005 ZEC (price 0.003 ZEC + fee). Do not pay from a transparent balance.
- [ ] Both receiving wallets open and synced (or one screen per member recorded separately). The buyer pays from Zingo PC; Dex's share lands on his separate demo address.
- [ ] Hide or blur: seed phrases, balances, private signing keys, anything personal on screen. Close notifications.
- [ ] Explorer tab ready (a Zcash mainnet block explorer) to look up the transaction ID afterwards.
- [ ] Rehearse once with the sample charter so the clicks are smooth.

## Shots and narration

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:06 | Cold open, the result first: Zingo PC's confirmation listing both recipients, then both wallets showing +0.0018 and +0.0012 | "One payment. Two wallets. Nobody outside can see who got what." |
| 0:06–0:18 | Landing hero: the receipt behind the ice tears into shares, stamped LUNAS (paid) | "Two mentors sell one class. Usually one of them collects and pays the other later: a treasurer everyone must trust, and payouts anyone can watch on a transparent chain. BonBagi turns one Zcash shielded payment into every member's share." |
| 0:18–0:36 | `/charter.html` step 4 *Check*: paste the signed file → *Check signatures* → both "valid" → *Create pay link*, price 0.003 | "First, the collective signs a charter: each member's shielded address and share, signed with their own key. When everyone has signed, we create a pay link. The charter rides in the link itself, and no server ever sees it." |
| 0:36–0:48 | `/pay.html` → *Try a sample charter* → change one share in the JSON → *Check charter* → red "changed after it was signed" banner | "If anyone edits an address or a share, every signature breaks and the buyer's browser refuses to pay." |
| 0:48–1:06 | Open the real pay link → green "Verified … signed by both members" → *Print the receipt* → glass card: 0.003 ZEC, Dex 60% 0.0018, Hans 40% 0.0012, fee ≈ 0.00015 → tap the frosted QR to show it | "The buyer opens the link. Every signature is checked in the browser. The receipt shows exactly who gets what, before the QR appears." |
| 1:06–1:28 | *Copy request* → Zingo PC send / pay URI → confirmation screen listing **both recipients** (hold 3 s) → confirm → sent, tx ID shown | "One request, one wallet, one confirmation. Zingo lists both members. We send." (Cut the waiting time.) |
| 1:28–1:43 | Dex's demo address: +0.0018 with memo `bonbagi:v1 o=… c=… m=1/2`; Hans's wallet: +0.0012, `m=2/2` | "Each member receives their share directly, with an encrypted memo to match the order. Nobody held the money in between." |
| 1:43–1:54 | Explorer: the transaction shows only shielded actions, no addresses, no amounts | "This is what the world sees: a shielded transaction. No addresses, no amounts." |
| 1:54–2:00 | `bonbagi.vercel.app`, repo URL | "BonBagi. One payment. Every share. Nobody's business." |

## After recording

- Keep it under 2:00 (trim the wallet sync and confirmation wait).
- Add on-screen captions for the three key moments: "verified in the browser", "one transaction, two shielded outputs", "public sees nothing".
- Write the transaction ID in `docs/SUBMISSION.md` only if the team agrees; the ID reveals nothing about recipients or amounts.
- Upload (YouTube unlisted or as the form requires) and paste the link into the submission.

## Short cut (75 seconds, for posts and as a backup)

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:08 | Landing hero, the ice closes over the receipt | "One payment to a group, split to every member, and nobody else can see who got what." |
| 0:08–0:25 | Pay link opens → "Verified … signed by both members" → glass card with the shares | "The members signed this split. The buyer's browser checks every signature before showing a single QR." |
| 0:25–0:35 | Sample charter, one share edited → red refusal | "Change one number and the page refuses to pay." |
| 0:35–0:58 | Zingo PC lists both recipients → send → both wallets receive with memos | "One transaction. Each member gets their share directly, with a private memo." |
| 0:58–1:10 | Explorer: shielded actions only | "The public sees a shielded transaction. No names, no amounts." |
| 1:10–1:15 | URL | "BonBagi." |

If the mainnet payment is not available, replace 0:35–0:58 with the testnet run (one transaction, three shielded outputs, memos read by each member) and say "on Zcash testnet".

## Backup if something fails

| Level | What | Ready when |
|---|---|---|
| 0 | Signed demo charter, pay link and funded Zingo PC ready before recording; explorer tab open | the gate test passed once |
| 1 | Sample charter flow (no wallet, no funds) for every in-browser step | always available on the live site |
| 2 | Testnet run as the payment proof (see "Short cut") | Hans's recording of the receiving wallet is on hand |
| 3 | Screenshots of every key screen (`docs/img/`) | already in the repository |
