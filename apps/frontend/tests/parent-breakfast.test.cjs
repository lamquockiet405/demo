const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { api: i18n } = require('./helpers/i18n.cjs').createI18n();

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname,
  '../src/features/payments/pages/ParentSnackPaymentPage.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

function renderPage(invoices, overview = null, searchParams = new URLSearchParams()) {
  // Render the loaded page with API fixtures; network and shared navigation are outside this regression.
  let hook = 0;
  const loadedState = [invoices, overview, false];
  const mockedReact = { ...React, useEffect() {}, useRef: initial => ({ current: initial }), useState(initial) {
    const value = hook < loadedState.length ? loadedState[hook] : initial;
    hook++;
    return [value, () => {}];
  } };
  const moduleValue = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name === 'react') return mockedReact;
    if (name === 'react-router-dom') return {
      useSearchParams: () => [searchParams],
      useNavigate: () => () => {},
    };
    if (name === 'lucide-react') return require(name);
    if (name.endsWith('/i18n/language')) return i18n;
    if (name.endsWith('/i18n/useLanguage')) return { useLanguage: () => ({ language: i18n.getLanguage() }) };
    return new Proxy({}, { get: () => () => null });
  }, moduleValue, moduleValue.exports);
  return renderToStaticMarkup(React.createElement(moduleValue.exports.ParentSnackPaymentPage));
}

const invoice = {
  id: 12, registrationId: 12, invoiceCode: 'INV-12', periodName: 'Gói ăn sáng',
  childName: 'Bé', parentName: 'Phụ huynh', className: 'Mầm 1',
  status: 'PAID', servingDays: null, pricePerDay: null, amount: 350000,
};

test('paid invoice with nullable API pricing renders without crashing', () => {
  const html = renderPage([invoice], null, new URLSearchParams('view=receipts'));
  assert.match(html, /Lịch Sử Giao Dịch &amp; Biên Lai Điện Tử|Gói Dịch Vụ Suất Ăn/);
  assert.match(html, /350\.000 VNĐ/);
  assert.equal((html.match(/Chưa có dữ liệu/g) || []).length, 2);
  assert.match(html, /Xem &amp; Tải Biên Lai Điện Tử/);
});

test('pending invoice with missing total renders and disables payment', () => {
  const html = renderPage([{ ...invoice, status: 'PENDING', amount: null }]);
  assert.match(html, /Chưa có dữ liệu/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Thanh toán qua VNPAY QR/s);
  assert.doesNotMatch(html, /NaN|undefined|0 VNĐ/);
});

test('known pricing and zero remain formatted as real values', () => {
  const html = renderPage([{ ...invoice, status: 'PENDING', servingDays: 20, pricePerDay: 17500, amount: 0 }]);
  assert.match(html, /20 ngày/);
  assert.match(html, /17\.500 đ/);
  assert.match(html, /0 VNĐ/);
  assert.doesNotMatch(html, /Chưa có dữ liệu/);
});

test('published package with unknown fee renders without a payment action enabled', () => {
  const html = renderPage([], { publishedPackages: [{
    periodId: 1, periodName: 'Gói mới', description: '', periodStatus: 'OPEN',
    isPaid: false, canViewSchedule: false, feeAmount: null,
  }] });
  assert.match(html, /Gói mới/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Đăng ký &amp; Thanh toán VNPAY/s);
  assert.match(html, /Chưa có dữ liệu/);
});

test('new packages appear newest first, ahead of historical invoices', () => {
  const pkg = id => ({ periodId: id, periodName: `New package ${id}`, description: '', periodStatus: 'OPEN', isPaid: false, feeAmount: 25000 });
  const html = renderPage([{ ...invoice, status: 'PENDING', periodId: 3 }], { publishedPackages: [pkg(8), pkg(9)] });
  assert.ok(html.indexOf('New package 9') < html.indexOf('New package 8'));
  assert.ok(html.indexOf('New package 8') < html.indexOf('INV-12'));
});

test('registered packages appear once as an invoice', () => {
  const html = renderPage([{ ...invoice, status: 'PENDING', periodId: 3 }], { publishedPackages: [{
    periodId: 3, periodName: 'Already registered package', description: '', periodStatus: 'OPEN', isPaid: true, feeAmount: 350000,
  }] });
  assert.doesNotMatch(html, /Already registered package/);
  assert.match(html, /INV-12/);
});
