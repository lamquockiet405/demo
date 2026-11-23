const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

let response;
const moduleValue = { exports: {} };
new Function(
  'require', 'module', 'exports',
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '../src/features/payments/api/vnpay.api.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
  ).outputText,
)(
  () => ({ apiClient: { get: async () => ({ data: response }) } }),
  moduleValue,
  moduleValue.exports,
);

const { vnpayApi } = moduleValue.exports;
const validReceipt = {
  receiptNumber: 'BL-1',
  student: { fullName: 'Bé Huy' },
  payer: { fullName: 'Phụ huynh Huy' },
  serviceDetails: { totalAmount: 75000, unitPricePerDay: 15000 },
  paymentInfo: { paymentMethod: 'VNPAY' },
  digitalSignature: { verificationHash: 'abc123' },
};

test('receipt API accepts a real nested receipt', async () => {
  response = { data: validReceipt };
  assert.equal(await vnpayApi.getReceipt(1), validReceipt);
});

test('receipt API rejects malformed data before the modal renders', async () => {
  response = { receiptNumber: 'BL-1', childName: 'Bé Huy' };
  await assert.rejects(() => vnpayApi.getReceipt(1), /biên lai điện tử không hợp lệ/i);
  response = { ...validReceipt, serviceDetails: { totalAmount: null, unitPricePerDay: 15000 } };
  await assert.rejects(() => vnpayApi.getReceipt(1), /biên lai điện tử không hợp lệ/i);
});
