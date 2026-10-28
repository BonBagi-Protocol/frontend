# BonBagi threat model

BonBagi is a static web page that turns a signed charter and a price into one ZIP-321 payment request. The buyer's own Zcash wallet builds and sends the transaction. BonBagi never holds funds, keys that can spend, or any server-side state.

**Our claim, stated narrowly:** BonBagi adds no privacy of its own. It lets a collective be paid without *removing* the privacy Zcash shielded transactions already give: there is no treasurer account, no custodian, no server that learns who was paid, and nothing in the payment that public observers can read.

## Who sees what

| Party | Sees | Does not see |
|---|---|---|
| Public chain observer | That a shielded transaction happened, when, its fee, and its number of shielded actions/outputs (about members + 1 for change, padded to at least 2) | Who paid, who was paid, the amounts, the memos, or that it was a BonBagi split |
| Buyer | Every member's label, shielded address, share and amount, and the charter fingerprint. This is by design: the buyer must be able to check where the money goes before paying | Members' balances or any other payment they receive |
| Each member | Their own output: amount and encrypted memo (order ID, charter fingerprint, position). They also know the whole charter, because they signed it | Who the buyer is (unless the buyer says so), or payments other buyers made |
| Whoever hosts the page | Ordinary requests for static files: IP address, time, user agent | The charter, addresses, prices, order IDs or payment requests. The charter rides in the URL fragment (`#c=…`), which browsers never send to the server, and the page makes no network requests at all |
| The channel the pay link is shared on (chat app, email), and the buyer's browser history and sync | Everything inside the link: member labels, addresses and shares. The fragment is not sent to the page host, but it is kept in browser history and in any browser sync service | Any payment made with it |
| The buyer's wallet and its light-wallet server | Whatever that wallet normally sees when sending a transaction | Nothing extra comes from BonBagi |

## What the page guarantees, and how we check it

- **No network calls.** A Content-Security-Policy (`default-src 'none'; connect-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; form-action 'none'; base-uri 'none'; object-src 'none'`) is sent both as an HTTP header and as a `<meta>` tag. The browser blocks any `fetch`, beacon, websocket, third-party script, font or image, even if a bug tried to make one. No CDN, no analytics, no third-party web fonts (our fonts are bundled and served from the same origin). CSP cannot block top-level navigation, so the guarantee is that the code never navigates elsewhere with charter data (the only outgoing links are the `zcash:` request and same-origin pages), not that the browser would stop it.
- **Nothing stored.** No cookies, `localStorage`, `sessionStorage` or IndexedDB. Closing the tab forgets everything.
- **Nothing logged.** The source contains no `console` calls; payment requests and addresses are never printed or sent anywhere.
- **No referrer leak.** `Referrer-Policy: no-referrer`, and browsers never include the fragment in a referrer anyway.
- **Charter integrity.** Each member signs the canonical charter bytes (sorted-key JSON, NFC strings, domain-separated) with Ed25519. The pay page refuses to build a request unless every listed member's signature verifies. Changing any address, share, title or minimum breaks every signature. The price in a pay link (`p=`) is **not** signed: it only pre-fills the form, and the buyer can see and change it. Buyers should confirm the price with the seller.
- **The summary is the request.** The table the buyer reads and the ZIP-321 URI are built from the same array in one function (`request.ts` in [@bonbagi/core](https://github.com/BonBagi-Protocol/core)); the tests parse the URI back and compare it with the table.
- **Shielded only.** Transparent addresses are rejected when drafting the charter and again when building the request, so no share can land somewhere public.
- **Memos carry no personal data.** `bonbagi:v1 o=<order ID> c=<16-hex fingerprint> m=<n>/<of>`. Order IDs are restricted to letters, digits and dashes (max 32), so an email or name with spaces is rejected.

Verified in the browser: the network panel shows only same-origin requests for the page's own files (the fragment never appears in them), and storage and cookies stay empty after a full flow.

## What it does not protect against (known limits)

1. **The number of recipients is roughly public.** A transaction to three members has about four shielded actions. Observers can't tell it apart from any other payment with change and a few outputs, but the action count is visible. A later version could pad with dummy zero-value outputs.
2. **The buyer learns the member list.** That is the point of letting the buyer verify. Collectives that don't want buyers to see their addresses should not use BonBagi.
3. **Signatures prove agreement, not identity.** Anyone can make and sign a charter with their own keys. The signatures prove that every *listed* member agreed to this exact split. To know it is the right collective, the buyer compares the charter fingerprint with the one the seller published, or gets the link from the seller directly. The pay page shows a 32-hex (128-bit) fingerprint for this comparison. The 16-hex value inside memos is only for members to match payments; it is too short to rule out a charter crafted to collide with it.
4. **A malicious host could serve altered code.** The verification runs in JavaScript served by the host; a compromised host could serve a page that skips it. Mitigations: the code is open source and small, the page works from any static host or a local copy, and the buyer's wallet still shows every recipient before confirming.
5. **Address reuse links sales together.** Anyone holding two pay links with the same addresses can tell it is the same collective (not what was paid). Members should use a fresh shielded address for each product or period; a Zcash wallet can derive new unified addresses at no cost.
6. **Paying from a transparent balance reveals the buyer side.** If the buyer's wallet spends transparent funds, the amount leaving that transparent address is public (where it goes and how it is split are still hidden). Pay from a shielded balance.
7. **Wallet support.** Not every wallet handles multi-recipient ZIP-321 requests correctly (some show only the first recipient). The page tells the buyer to check that the wallet lists every recipient before confirming. Tested target: Zingo PC; backup: Zkool.
8. **Address checks are light.** The page checks prefixes, network and character set. The full Unified Address checksum is verified by the wallet when it parses the request.
9. **Signing keys live with members.** The Ed25519 key is shown once and never stored by the page; if a member presses *Download private key*, keeping that file safe is up to them. It cannot spend money; losing it only means that member cannot sign a new charter. A leaked key lets someone sign *as that member*, but cannot change an existing charter without breaking the other members' signatures.
10. **Copied requests sit in the clipboard.** *Copy request* puts every member's address and amount on the clipboard, where clipboard managers or other apps may read it. Use *Open in wallet* or the QR where possible.

## Out of scope

Network-level anonymity of the buyer (use Tor or a trusted light-wallet server), the security of the wallets themselves, and tax or accounting obligations of the collective.
