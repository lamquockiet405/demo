const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readWordDoc } = require('./read-word-doc.cjs');

const normalizeName = (name) => name.normalize('NFC').toLocaleLowerCase('vi')
  .replace(/[.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();

// Only explicit spelling variants; different ingredients remain separate dishes.
const aliases = new Map(Object.entries({
  'thịt gà rôti': 'Thịt gà rô ti',
  'thị gà chiên nước mắm': 'Thịt gà chiên nước mắm',
  'gà chiên nước mắm': 'Thịt gà chiên nước mắm',
  'đu đủ': 'Đu đủ chín',
  'thanh long trắng': 'Thanh long',
  'yaourt': 'Yaourt',
  'bánh bông lan chà bong': 'Bánh bông lan chà bông',
  'bánh bông lan thịt chà bong': 'Bánh bông lan thịt chà bông',
  'bánh ngọt kẹp chà bong': 'Bánh ngọt kẹp chà bông',
  'phở bò ngò gai quế': 'Phở bò, ngò gai, quế',
  'phở bò quế ngò gai': 'Phở bò, ngò gai, quế',
  'bánh canh bột xắt cá lóc tôm khô': 'Bánh canh bột xắt tôm khô, cá lóc',
  'nước nha đam hạt chia đường phèn': 'Nha đam, hạt chia, đường phèn',
  'nha đam hạt chia đường phèn': 'Nha đam, hạt chia, đường phèn',
  'canh thịt bằm bắp cải cà rốt': 'Canh bắp cải, cà rốt thịt bằm',
}));

function cleanName(raw) {
  let name = raw.normalize('NFC').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s.;-]+$/g, '');
  return aliases.get(normalizeName(name)) || name;
}

function categoryFor(name, mealType, index, total) {
  if (/^sữa dinh dưỡng$/iu.test(name)) return 'SNACK_MORNING';
  if (mealType === 'AFTERNOON_SNACK') {
    return index === 0 ? 'DRINK' : 'SNACK_AFTERNOON';
  }
  if (/^cơm/iu.test(name)) return 'RICE';
  if (/^canh/iu.test(name)) return 'SOUP';
  return index === total - 1 ? 'DESSERT' : 'MAIN';
}

function extractCatalog(directory) {
  const catalog = new Map();
  const weeks = [];
  const files = fs.readdirSync(directory).filter((name) => /\.doc$/i.test(name) && !name.startsWith('~$'))
    .sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  if (!files.length) throw new Error('No source .doc files');
  let occurrences = 0;
  for (const file of files) {
    const filename = path.join(directory, file);
    const sourceSha256 = crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
    const text = readWordDoc(filename);
    const sections = text.split(/(?=TUẦN\s+\d+\s*:)/u).slice(1);
    if (sections.length !== 2) throw new Error(`Expected two weeks in ${file}`);
    for (const section of sections) {
      const weekNumber = Number(section.match(/^TUẦN\s+(\d+)/u)[1]);
      const cells = section.split('\x07');
      const dates = cells.slice(1, 6).map((cell) => {
        const match = cell.match(/Ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/u);
        if (!match) throw new Error(`Missing date in ${file}, week ${weekNumber}`);
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      });
      const days = dates.map((date) => ({ date, meals: [] }));
      for (const [label, mealType] of [['Phụ Sáng', 'MORNING_SNACK'], ['Chính trưa', 'LUNCH'], ['Xế +', 'AFTERNOON_SNACK']]) {
        const position = cells.findIndex((cell) => cell.trim().startsWith(label));
        if (position < 0) throw new Error(`Missing ${label} in ${file}, week ${weekNumber}`);
        for (let day = 0; day < 5; day++) {
          const rawNames = cells[position + 1 + day].split(/\n\s*-\s*/u).filter((name) => name.trim());
          const names = rawNames.map(cleanName);
          if (mealType === 'MORNING_SNACK' ? names.length !== 1 : mealType === 'LUNCH' ? ![3, 4].includes(names.length) : names.length !== 2) {
            throw new Error(`Unexpected dish count in ${file}, ${dates[day]}, ${mealType}: ${names.length}`);
          }
          const meal = { mealType, dishes: [] };
          names.forEach((name, index) => {
            const key = normalizeName(name);
            const categoryCode = categoryFor(name, mealType, index, names.length);
            if (!catalog.has(key)) catalog.set(key, { key, name, categoryCode, sources: [] });
            const entry = catalog.get(key);
            if (entry.categoryCode !== categoryCode) throw new Error(`Category conflict for ${name}`);
            entry.sources.push({ file, sourceSha256, weekNumber, date: dates[day], mealType, rawName: rawNames[index].trim() });
            meal.dishes.push(key);
            occurrences++;
          });
          days[day].meals.push(meal);
        }
      }
      weeks.push({ weekNumber, sourceFile: file, days });
    }
  }
  return { sourceDirectory: path.relative(process.cwd(), directory).replaceAll('\\', '/'),
    sourceFileCount: files.length, occurrences, duplicateOccurrencesSkipped: occurrences - catalog.size,
    dishes: [...catalog.values()], weeks };
}

module.exports = { normalizeName, cleanName, extractCatalog };
