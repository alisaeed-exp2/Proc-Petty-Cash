import test from "node:test";
import assert from "node:assert/strict";
import { parseZatcaQr } from "./zatca.ts";

function tlv(parts: string[]): string {
  return Buffer.concat(parts.map((p, i) => Buffer.concat([Buffer.from([i + 1, Buffer.byteLength(p)]), Buffer.from(p)]))).toString("base64");
}

test("decodes a ZATCA payload", () => {
  const r = parseZatcaQr(tlv(["شركة الاختبار", "300012345600003", "2026-03-04T10:15:00", "115.00", "15.00"]));
  assert.ok(r);
  assert.equal(r.vendorName, "شركة الاختبار");
  assert.equal(r.vendorVatNo, "300012345600003");
  assert.equal(r.invoiceDate, "2026-03-04");
  assert.equal(r.total, 11500);
  assert.equal(r.vatAmount, 1500);
  assert.equal(r.subtotal, 10000);
});

test("rejects other QR content", () => {
  assert.equal(parseZatcaQr("aHR0cHM6Ly9leGFtcGxlLmNvbQ=="), null);
  assert.equal(parseZatcaQr("!!"), null);
});
