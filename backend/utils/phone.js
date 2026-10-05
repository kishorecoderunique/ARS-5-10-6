function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

module.exports = { normalizePhone };
