const MASK = '[ĐÃ CHE]';
const normalizedKey = (key) => String(key).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_');

function isSecretKey(key) {
  const name = normalizedKey(key);
  if (/(?:_at|_date|_enabled|_count|_expires|_expiry|_required|_verified)$/.test(name)) return false;
  return /(?:^|_)(?:password|passwd|secret|token|otp|authorization|cookie|api_key|private_key|signing_key|encryption_key|recovery_codes|backup_codes)(?:_|$)/.test(name);
}

function redact(value, stats = { fields: 0 }, key = '') {
  if (value == null) return value;
  if (isSecretKey(key)) { stats.fields++; return MASK; }
  if (Buffer.isBuffer(value)) return { encoding: 'base64', data: value.toString('base64') };
  if (Array.isArray(value)) return value.map((item) => redact(item, stats));
  if (typeof value === 'object') {
    const secretSetting = Object.entries(value).some(([name, item]) =>
      ['key', 'config_key', 'setting_key', 'name'].includes(normalizedKey(name)) && typeof item === 'string' && isSecretKey(item));
    return Object.fromEntries(Object.entries(value).map(([name, item]) => {
      if (secretSetting && ['value', 'config_value', 'setting_value'].includes(normalizedKey(name)) && item != null) {
        stats.fields++;
        return [name, MASK];
      }
      return [name, redact(item, stats, name)];
    }));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const before = stats.fields;
        const safe = redact(JSON.parse(trimmed), stats);
        return stats.fields === before ? value : JSON.stringify(safe);
      } catch { /* Keep ordinary text. */ }
    }
    return value.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, () => { stats.fields++; return `Bearer ${MASK}`; })
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, () => { stats.fields++; return MASK; });
  }
  return value;
}

module.exports = { MASK, isSecretKey, redact };
