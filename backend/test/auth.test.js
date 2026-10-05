const test = require('node:test');
const assert = require('node:assert/strict');
const { isLoopbackAddress } = require('../middleware/auth');

test('local demo mode accepts only loopback client addresses', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('192.168.1.10'), false);
  assert.equal(isLoopbackAddress('::ffff:192.168.1.10'), false);
});
