const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { extractCatalog } = require('../lib/source-menu-catalog.cjs');
const { configurationData } = require('../lib/nutrition-configuration.cjs');

test('configuration counts and gaps are derived from the DOC occurrences', () => {
  const c = extractCatalog(path.resolve(__dirname, '../../docs/dử liệu chính'));
  const { frequency, spacing } = configurationData(c);
  assert.equal(frequency.length, 7);
  assert.equal(frequency.reduce((sum, r) => sum + r.source.totalOccurrences, 0), 347);
  assert.deepEqual(frequency.find(r => r.code === 'MAIN').source.weeklyCounts.map(w => w.count), [5,5,4,5,5,5,4,5,4,5]);
  assert.equal(spacing.find(r => r.code === 'SNACK_MORNING').minGap, 1);
  assert.equal(spacing.find(r => r.code === 'SNACK_MORNING').noRepeatInSameWeek, false);
  assert.equal(spacing.find(r => r.code === 'MAIN').minGap, 12);
  assert.equal(spacing.find(r => r.code === 'SOUP').minGap, 24);
});

test('changing input occurrences changes the derived limits without inventing a policy', () => {
  const c = extractCatalog(path.resolve(__dirname, '../../docs/dử liệu chính'));
  const main = c.dishes.find(d => d.categoryCode === 'MAIN');
  main.sources.push({ ...main.sources[0], date: '2025-09-09' });
  const { frequency, spacing } = configurationData(c);
  assert.equal(frequency.find(r => r.code === 'MAIN').max, 6);
  assert.equal(spacing.find(r => r.code === 'MAIN').noRepeatInSameWeek, false);
});
