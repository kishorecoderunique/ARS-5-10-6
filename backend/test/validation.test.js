const test = require('node:test');
const assert = require('node:assert/strict');
const { schemas } = require('../utils/validation');

test('normalizes valid phone numbers to ten digits', () => {
  const result = schemas.login.safeParse({
    body: { phone: '+91 90000 00001', password: 'StrongPass2026!', role: 'admin' },
    params: {},
    query: {}
  });
  assert.equal(result.success, true);
  assert.equal(result.data.body.phone, '9000000001');
});

test('rejects out-of-range coordinates and invalid SOS severity', () => {
  const result = schemas.createSos.safeParse({
    body: {
      victimName: 'Test Caller',
      victimPhone: '9000000001',
      lat: 95,
      lng: 80,
      severity: 'urgent',
      description: 'Emergency assistance required.'
    },
    params: {},
    query: {}
  });
  assert.equal(result.success, false);
});

test('only accepts the next valid SOS status values', () => {
  const valid = schemas.status.safeParse({
    body: { status: 'en_route' },
    params: { id: 'c8751040-d726-4f68-9f2e-0ddf72473cb7' },
    query: {}
  });
  const invalid = schemas.status.safeParse({
    body: { status: 'resolved' },
    params: { id: 'not-a-uuid' },
    query: {}
  });
  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
});

test('accepts only six digit reset OTP values', () => {
  const result = schemas.otpVerify.safeParse({
    body: { phone: '9000000001', otp: '12ab56' },
    params: {},
    query: {}
  });
  assert.equal(result.success, false);
});
