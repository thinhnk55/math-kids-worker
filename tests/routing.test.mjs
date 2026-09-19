import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.ts';

const mockEnv = {
  JWT_PUBLIC_KEY_PEM: 'MOCK_PEM',
};

test('GET / or /info returns worker info for math-kids-worker', async () => {
  const req = new Request('https://api.hocnhe.com/info', { method: 'GET' });
  const res = await worker.fetch(req, mockEnv);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.name, 'math-kids-worker');
  assert.equal(data.version, '1.0.0');
});

test('OPTIONS request returns CORS headers for valid origin', async () => {
  const req = new Request('https://api.hocnhe.com/v1/courses', {
    method: 'OPTIONS',
    headers: { Origin: 'https://hocnhe.com' },
  });
  const res = await worker.fetch(req, mockEnv);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://hocnhe.com');
});
