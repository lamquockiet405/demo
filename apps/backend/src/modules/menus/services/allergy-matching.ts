const normalize = (text: string) => (text || '').normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const contains = (text: string, phrase: string) => (` ${normalize(text)} `).includes(` ${normalize(phrase)} `);
const groups: Record<string, string[]> = {
  SEAFOOD: ['hải sản', 'tôm', 'cua', 'cá', 'mực', 'nghêu', 'hến', 'sò', 'chả cá', 'cá hồi'],
  CRUSTACEAN: ['tôm', 'cua', 'hải sản'],
  MILK: ['sữa', 'yaourt', 'phô mai', 'flan', 'milk'],
  PEANUT: ['đậu phộng', 'lạc', 'bơ đậu phộng'],
  EGG: ['trứng', 'hột gà', 'hột vịt'],
  SOY: ['đậu nành', 'đậu phụ', 'tàu hũ', 'đậu hũ'],
  WHEAT: ['lúa mì', 'bánh mì', 'bánh bao', 'mì sợi', 'hoành thánh'],
  SESAME: ['mè', 'vừng', 'dầu mè'],
  BEEF: ['thịt bò', 'bò', 'beef'],
};
const aliases: Record<string, string> = {
  'hải sản': 'SEAFOOD', 'sữa bò': 'MILK', 'sữa': 'MILK', 'đậu phộng': 'PEANUT',
  'trứng': 'EGG', 'đậu nành': 'SOY', 'lúa mì': 'WHEAT', 'mè vừng': 'SESAME',
  'thịt bò': 'BEEF', 'bò': 'BEEF', 'beef': 'BEEF',
};

export function matchesDeclaredAllergy(
  declaration: { name: string; code?: string; catalogId?: number | null },
  dish: { name: string; ingredients?: string[]; allergenIds?: number[] },
): boolean {
  if (declaration.catalogId && dish.allergenIds?.some(id => Number(id) === Number(declaration.catalogId))) return true;
  const name = normalize(declaration.name);
  if (!name) return false;
  const group = groups[declaration.code] ? declaration.code : aliases[name];
  const phrases = group ? groups[group] : declaration.name.split(/[,;\/]+/).map(normalize).filter(Boolean);
  return [dish.name, ...(dish.ingredients || [])].some(text => {
    // A beef declaration is not a declaration about cow's milk.
    const target = group === 'BEEF' ? normalize(text).replace(/sữa bò/g, '') : text;
    return phrases.some(phrase => contains(target, phrase));
  });
}

export function advisorySeverity(value: string): 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLACTIC' {
  const legacy = { LOW: 'MILD', MEDIUM: 'MODERATE', HIGH: 'SEVERE' };
  const normalized = legacy[value] || value;
  return ['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'].includes(normalized) ? normalized : 'MODERATE';
}
