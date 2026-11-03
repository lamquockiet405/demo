const { test } = require('node:test');
const assert = require('node:assert/strict');
const { repairText, repairValue } = require('../lib/repair-vietnamese.cjs');

test('repairs OEM Vietnamese names and mixed correct/corrupted text', () => {
  assert.equal(repairText('L├¬ Ho├ái Nam'), 'Lê Hoài Nam');
  assert.equal(repairText('Người lập: L├¬ Ho├ái Nam'), 'Người lập: Lê Hoài Nam');
});
test('repairs Windows mojibake, repeated encoding, arrows and emoji', () => {
  assert.equal(repairText('Thá»±c Ä‘Æ¡n'), 'Thực đơn');
  assert.equal(repairText('â”€â”€ ðŸ“‹'), '── 📋');
  assert.equal(repairText('LÃƒÂª HoÃƒÂ i Nam'), 'Lê Hoài Nam');
});
test('preserves already correct Vietnamese, ASCII, numbers and intentional tree diagrams', () => {
  for (const value of ['Lê Hoài Nam', 'Đỗ Thị Ánh Âu', 'Trứng vịt chiên thịt, cà chua', '├── recipes', 'https://localhost:5174', 'ABC123']) {
    assert.equal(repairText(value), value);
  }
});
test('repairs JSON values without changing field names or scalar types and is idempotent', () => {
  const input = { fullName: 'L├¬ Ho├ái Nam', count: 172, active: true, empty: null, items: ['Thá»±c Ä‘Æ¡n'] };
  const fixed = repairValue(input);
  assert.deepEqual(fixed, { ...input, fullName: 'Lê Hoài Nam', items: ['Thực đơn'] });
  assert.deepEqual(repairValue(fixed), fixed);
});
