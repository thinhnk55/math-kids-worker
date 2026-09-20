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
  assert.equal(data.version, '1.0.1');
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

test('validateProfileId behaves as expected', async () => {
  const { validateProfileId } = await import('../src/utils/profile.ts');
  const origin = 'https://hocnhe.com';

  // 1. No profile_id query param: returns ok: true, profileId: null
  const reqNoParam = new Request('https://api.hocnhe.com/v1/courses');
  const resNoParam = validateProfileId(reqNoParam, [1, 2], origin);
  assert.equal(resNoParam.ok, true);
  if (resNoParam.ok) {
    assert.equal(resNoParam.profileId, null);
  }

  // 2. Invalid profile_id: returns 400
  const reqInvalid = new Request('https://api.hocnhe.com/v1/courses?profile_id=abc');
  const resInvalid = validateProfileId(reqInvalid, [1, 2], origin);
  assert.equal(resInvalid.ok, false);
  if (!resInvalid.ok) {
    assert.equal(resInvalid.response.status, 400);
  }

  // 3. profile_id not in JWT profiles: returns 403
  const reqForbidden = new Request('https://api.hocnhe.com/v1/courses?profile_id=3');
  const resForbidden = validateProfileId(reqForbidden, [1, 2], origin);
  assert.equal(resForbidden.ok, false);
  if (!resForbidden.ok) {
    assert.equal(resForbidden.response.status, 403);
  }

  // 4. profile_id in JWT profiles: returns ok: true, profileId: number
  const reqValid = new Request('https://api.hocnhe.com/v1/courses?profile_id=2');
  const resValid = validateProfileId(reqValid, [1, 2], origin);
  assert.equal(resValid.ok, true);
  if (resValid.ok) {
    assert.equal(resValid.profileId, 2);
  }
});

