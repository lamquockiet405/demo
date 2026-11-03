const cp850 = require('../../database/reference/legacy-codepage.json');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const windows1252 = new TextDecoder('windows-1252');
const maps = [
  Array.from({ length: 256 }, (_, byte) => windows1252.decode(Uint8Array.of(byte))),
  Array.from({ length: 256 }, (_, byte) => String.fromCharCode(byte)),
  Array.from({ length: 256 }, (_, byte) => byte < 128 ? String.fromCharCode(byte) : cp850[byte - 128]),
].map(chars => new Map(chars.map((char, byte) => [char, byte])));

// Only encoding artifacts; ordinary Vietnamese letters and intentional box drawings stay intact.
const suspicious = /\u251c|[\u00c2\u00c3\u00c4\u00c6][\u0080-\uffff]|\u00e1[\u00ba\u00bb]|\u00e2[\u0080-\u00bf\u20ac\u2013\u2014\u2018\u2019\u201c\u201d]|\u00f0\u0178|\u00d4\u00c7|\u00df[\u2550-\u256f]|\u00e3[\u0080-\uffff]/;

function pass(text, mapping, oem) {
  const chars = Array.from(text);
  let result = '';
  for (let index = 0; index < chars.length;) {
    const first = mapping.get(chars[index]);
    if (oem && ![0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xe1, 0xe2, 0xf0].includes(first)) {
      result += chars[index++];
      continue;
    }
    const length = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
    const bytes = chars.slice(index, index + length).map(char => mapping.get(char));
    if (length && bytes.length === length && bytes.slice(1).every(byte => byte >= 0x80 && byte <= 0xbf)) {
      try {
        result += utf8.decode(Uint8Array.from(bytes));
        index += length;
        continue;
      } catch { /* Invalid UTF-8 is not a reversible encoding artifact. */ }
    }
    result += chars[index++];
  }
  return result;
}

function repairText(value) {
  if (typeof value !== 'string' || !suspicious.test(value)) return value;
  let result = value;
  for (let round = 0; round < 4; round++) {
    const previous = result;
    for (const [index, mapping] of maps.entries()) {
      for (let depth = 0; depth < 4; depth++) {
        const next = pass(result, mapping, index === 2);
        if (next === result) break;
        result = next;
      }
    }
    if (result === previous) break;
  }
  return result;
}

function repairValue(value) {
  if (typeof value === 'string') return repairText(value);
  if (Array.isArray(value)) return value.map(repairValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairValue(item)]));
  return value;
}

module.exports = { repairText, repairValue };
