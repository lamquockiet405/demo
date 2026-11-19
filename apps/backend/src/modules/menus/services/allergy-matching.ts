const normalize = (text: string) =>
  (text || '')
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const contains = (text: string, phrase: string) =>
  ` ${normalize(text)} `.includes(` ${normalize(phrase)} `);

export type Declaration = {
  name: string;
  code?: string;
  catalogId?: number | null;
  description?: string | null;
  keywords?: string[];
};

export type AllergyDish = {
  name: string;
  ingredients?: string[];
  allergenIds?: number[];
  allergenTags?: { allergenId: number; note?: string | null }[];
};

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

/**
 * Tách danh sách từ khóa đối chiếu từ dữ liệu danh mục dị nguyên trong Database
 * (cột `allergens.description` / `keywords`) và tên khai báo của phụ huynh.
 */
function expandDeclarationPhrases(declaration: Declaration): string[] {
  const rawSources: string[] = [declaration.name || ''];
  const code = declaration.code || aliases[normalize(declaration.name)];
  if (code && groups[code]) {
    rawSources.push(...groups[code]);
  }
  if (declaration.description) {
    rawSources.push(declaration.description);
  }
  if (Array.isArray(declaration.keywords)) {
    rawSources.push(...declaration.keywords);
  }

  const tokens = rawSources
    .flatMap((src) => src.split(/[,;\/•·\n()]+|\s+và\s+/i))
    .map(normalize)
    .filter((t) => t && !t.startsWith('dị ứng '));

  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    if (token.startsWith('thịt ') && token.length > 5) {
      expanded.add(token.slice(5).trim());
    }
    if (token === 'sữa bò') {
      expanded.add('sữa');
    }
  }
  return [...expanded].filter(Boolean);
}

export function getAllergyMatchReasons(
  declaration: Declaration,
  dish: AllergyDish,
): string[] {
  const reasons: string[] = [];
  if (
    declaration.catalogId &&
    dish.allergenIds?.some((id) => Number(id) === Number(declaration.catalogId))
  ) {
    const tag = dish.allergenTags?.find(
      (item) => Number(item.allergenId) === Number(declaration.catalogId),
    );
    reasons.push(
      `Nhãn dị nguyên: ${declaration.name}${tag?.note ? ` — ${tag.note}` : ''}`,
    );
  }
  const name = normalize(declaration.name);
  if (!name) return reasons;

  const phrases = expandDeclarationPhrases(declaration);
  const isBeefOnly =
    (declaration.code === 'BEEF' || name === 'thịt bò' || name === 'bò') &&
    !name.includes('sữa');

  const matches = (text: string) => {
    let target = normalize(text);
    // Khai báo dị ứng thịt bò không áp dụng cho sữa bò
    if (isBeefOnly) {
      target = target.replace(/sữa bò/g, '');
    }
    return phrases.some((phrase) => contains(target, phrase));
  };

  if (matches(dish.name)) reasons.push(`Tên món: ${dish.name}`);
  for (const ingredient of dish.ingredients || []) {
    if (matches(ingredient)) reasons.push(`Nguyên liệu: ${ingredient}`);
  }
  return [...new Set(reasons)];
}

export function matchesDeclaredAllergy(
  declaration: Declaration,
  dish: AllergyDish,
): boolean {
  return getAllergyMatchReasons(declaration, dish).length > 0;
}

export function advisorySeverity(
  value: string,
): 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLACTIC' {
  const legacy: Record<string, string> = {
    LOW: 'MILD',
    MEDIUM: 'MODERATE',
    HIGH: 'SEVERE',
  };
  const normalized = legacy[value] || value;
  return ['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'].includes(normalized)
    ? (normalized as 'MILD' | 'MODERATE' | 'SEVERE' | 'ANAPHYLACTIC')
    : 'MODERATE';
}
