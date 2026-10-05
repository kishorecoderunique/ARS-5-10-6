const test = require('node:test');
const assert = require('node:assert/strict');
const { createApplication } = require('../server');

async function withServer(run) {
  const server = createApplication({ frontendUrl: 'http://localhost:5000' });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('serves the existing login page from the frontend', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/login/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /ARS Control Center/);
  });
});

test('returns JSON for unknown API routes', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { message: 'Route not found' });
  });
});

test('reports unavailable database status through the health endpoint', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);
    const health = await response.json();
    assert.equal(response.status, 503);
    assert.deepEqual(health, {
      ok: false,
      db: 'disconnected',
      message: 'Supabase database is not connected.'
    });
  });
});
