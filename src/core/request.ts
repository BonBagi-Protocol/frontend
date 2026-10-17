// From a fully signed charter + a price to one ZIP-321 payment request.

import { verifyCharter, type SignedCharter } from "./charter.ts";
import { bonbagiMemo } from "./memo.ts";
import { splitAmount } from "./split.ts";
import { buildUri } from "./zip321.ts";

export interface ShareLine {
  label: string;
  address: string;
  bps: number;
  amountZat: bigint;
  memo: string;
}

export interface PaymentRequest {
  uri: string;
  charterHash: string;
  totalZat: bigint;
  lines: ShareLine[];
}

export async function buildPaymentRequest(signed: SignedCharter, priceZat: bigint, orderId: string): Promise<PaymentRequest> {
  const { hash, unsigned } = await verifyCharter(signed);
  if (unsigned.length > 0) {
    const names = unsigned.map((i) => signed.charter.members[i]!.label).join(", ");
    throw new Error(`charter is not signed by every member (missing or invalid: ${names}) — refusing to build a payment request`);
  }
  const members = signed.charter.members;
  const amounts = splitAmount(priceZat, members.map((m) => m.bps), BigInt(signed.charter.minShareZat));
  const lines = members.map((m, i) => ({
    label: m.label,
    address: m.address,
    bps: m.bps,
    amountZat: amounts[i]!,
    memo: bonbagiMemo(orderId, hash, i + 1, members.length),
  }));
  const uri = buildUri(lines.map((l) => ({ address: l.address, amountZat: l.amountZat, memo: l.memo, label: l.label })), signed.charter.title);
  return { uri, charterHash: hash, totalZat: priceZat, lines };
}
