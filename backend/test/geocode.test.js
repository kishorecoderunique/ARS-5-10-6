const test = require('node:test');
const assert = require('node:assert/strict');
const { reverseGeocodeAddress } = require('../services/geocode');

test('uses Nominatim for reverse geocoding and caches successful addresses', async () => {
  const originalFetch = global.fetch;
  let requests = 0;
  global.fetch = async url => {
    requests += 1;
    assert.match(String(url), /nominatim\.openstreetmap\.org\/reverse/);
    assert.match(String(url), /lat=13\.040001/);
    assert.match(String(url), /lon=80\.240002/);
    return Response.json({ display_name: 'A real returned address, Chennai, India' });
  };

  try {
    const config = { geocodingKey: '' };
    const first = await reverseGeocodeAddress(config, 13.040001, 80.240002);
    const second = await reverseGeocodeAddress(config, 13.040001, 80.240002);
    assert.deepEqual(first, {
      address: 'A real returned address, Chennai, India',
      provider: 'openstreetmap'
    });
    assert.deepEqual(second, first);
    assert.equal(requests, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('falls back to Nominatim if Google reverse geocoding fails', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async url => {
    requests.push(String(url));
    if (String(url).includes('maps.googleapis.com')) {
      return new Response('Unavailable', { status: 503 });
    }
    return Response.json({ display_name: 'Returned address, India' });
  };

  try {
    const result = await reverseGeocodeAddress(
      { geocodingKey: 'test-key' },
      13.050003,
      80.250004
    );
    assert.deepEqual(result, {
      address: 'Returned address, India',
      provider: 'openstreetmap'
    });
    assert.equal(requests.length, 2);
    assert.match(requests[0], /maps\.googleapis\.com/);
    assert.match(requests[1], /nominatim\.openstreetmap\.org/);
  } finally {
    global.fetch = originalFetch;
  }
});
