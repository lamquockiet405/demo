const fs = require('node:fs');

// Read Word 97-2003 text through its CFB streams and CLX piece table.
// Unlike scanning binary strings, this preserves the document's text order.
function readWordDoc(filename) {
  const bytes = fs.readFileSync(filename);
  if (bytes.subarray(0, 8).toString('hex') !== 'd0cf11e0a1b11ae1') {
    throw new Error(`Not a Word compound document: ${filename}`);
  }
  const sectorSize = 2 ** bytes.readUInt16LE(30);
  const miniSize = 2 ** bytes.readUInt16LE(32);
  const sector = (id) => bytes.subarray((id + 1) * sectorSize, (id + 2) * sectorSize);
  const ints = (buffer) => Array.from({ length: buffer.length / 4 }, (_, i) => buffer.readUInt32LE(i * 4));
  const difat = ints(bytes.subarray(76, 512)).filter((id) => id < 0xfffffffa);
  let next = bytes.readUInt32LE(68);
  for (let i = 0; i < bytes.readUInt32LE(72); i++) {
    const ids = ints(sector(next));
    difat.push(...ids.slice(0, -1).filter((id) => id < 0xfffffffa));
    next = ids.at(-1);
  }
  const fat = difat.flatMap((id) => ints(sector(id)));
  function chain(start, table, getSector) {
    const parts = [];
    const seen = new Set();
    for (let id = start; id < 0xfffffffa; id = table[id]) {
      if (seen.has(id) || id === undefined) throw new Error('Invalid CFB chain');
      seen.add(id);
      parts.push(getSector(id));
    }
    return Buffer.concat(parts);
  }
  const directory = chain(bytes.readUInt32LE(48), fat, sector);
  const entries = [];
  for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
    const entry = directory.subarray(offset, offset + 128);
    if (!entry[66]) continue;
    entries.push({ name: entry.subarray(0, entry.readUInt16LE(64) - 2).toString('utf16le'),
      type: entry[66], start: entry.readUInt32LE(116), size: Number(entry.readBigUInt64LE(120)) });
  }
  const root = entries.find((entry) => entry.type === 5);
  const miniStream = chain(root.start, fat, sector);
  const miniFat = ints(chain(bytes.readUInt32LE(60), fat, sector));
  function stream(name) {
    const entry = entries.find((item) => item.name === name);
    if (!entry) throw new Error(`Missing stream ${name}`);
    return (entry.size < bytes.readUInt32LE(56)
      ? chain(entry.start, miniFat, (id) => miniStream.subarray(id * miniSize, (id + 1) * miniSize))
      : chain(entry.start, fat, sector)).subarray(0, entry.size);
  }
  const word = stream('WordDocument');
  const table = stream(word.readUInt16LE(10) & 0x200 ? '1Table' : '0Table');
  let offset = 32;
  offset += 2 + word.readUInt16LE(offset) * 2;
  offset += 2 + word.readUInt16LE(offset) * 4;
  const clxOffset = word.readUInt32LE(offset + 2 + 33 * 8);
  let cursor = clxOffset;
  while (table[cursor] === 1) cursor += 3 + table.readUInt16LE(cursor + 1);
  if (table[cursor] !== 2) throw new Error('Word piece table not found');
  const length = table.readUInt32LE(cursor + 1);
  const plc = table.subarray(cursor + 5, cursor + 5 + length);
  const count = (length - 4) / 12;
  const mainLength = word.readUInt32LE(76);
  let result = '';
  for (let i = 0; i < count; i++) {
    const start = plc.readUInt32LE(i * 4);
    const end = Math.min(plc.readUInt32LE((i + 1) * 4), mainLength);
    if (start >= mainLength) break;
    const fc = plc.readUInt32LE((count + 1) * 4 + i * 8 + 2);
    const compressed = Boolean(fc & 0x40000000);
    const position = (fc & 0x3fffffff) / (compressed ? 2 : 1);
    result += word.subarray(position, position + (end - start) * (compressed ? 1 : 2))
      .toString(compressed ? 'latin1' : 'utf16le');
  }
  return result.replace(/\r/g, '\n').replace(/\x0b/g, '\n');
}

module.exports = { readWordDoc };
