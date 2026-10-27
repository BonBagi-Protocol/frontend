# Security

BonBagi handles payment requests and signing keys in the browser. Please report anything that could leak who paid whom, change a share after signing, or move funds to an address no member signed.

- **Report privately:** open a [private security advisory](../../security/advisories/new) on this repository. Do not open a public issue for a vulnerability.
- **Never paste** a seed phrase, spending key, private signing key or a real payment request into an issue, pull request or test file. Use the throw-away keys the tests generate.
- **Scope:** the pay, charter and raw-request pages (CSP, what the page can send or store), the landing page, and the deployment headers. Payment logic: report to BonBagi/core.
- We aim to answer within 72 hours during ZECATHON 2026 and within a week afterwards.
