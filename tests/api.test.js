// Integration tests: run against the real local database (npm test). Creates uniquely named users and cleans up.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.BCRYPT_ROUNDS = '4';
const config = require('../src/config');
config.assertSecure();
const app = require('../src/app');
const { sequelize } = require('../src/models');
const run = (sql, bind) => sequelize.query(sql, { bind });

let server; let base;
const tag = Math.random().toString(36).slice(2, 8);
const users = {}; // alice, bob, admin -> { id, token }
const state = {};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

before(async () => {
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  await run('DELETE FROM users WHERE username LIKE $1', [`%_${tag}`]);
  await new Promise((r) => server.close(r));
  await sequelize.close();
});

const reg = (name) => api('POST', '/auth/register', { body: { username: `${name}_${tag}`, email: `${name}_${tag}@test.dev`, password: 'Passw0rd123' } });

test('health check', async () => {
  const r = await api('GET', '/health');
  assert.equal(r.status, 200);
});

test('registration: success, duplicate, weak password', async () => {
  for (const n of ['alice', 'bob', 'root']) {
    const r = await reg(n);
    assert.equal(r.status, 201);
    assert.ok(r.body.data.token);
    assert.equal(r.body.data.user.role, 'user');
    assert.equal(r.body.data.user.password_hash, undefined);
    users[n] = { id: r.body.data.user.id, token: r.body.data.token };
  }
  assert.equal((await reg('alice')).status, 409);
  const weak = await api('POST', '/auth/register', { body: { username: `weak_${tag}`, email: `weak_${tag}@test.dev`, password: 'short' } });
  assert.equal(weak.status, 400);
});

test('login: correct, wrong password, unknown user', async () => {
  const ok = await api('POST', '/auth/login', { body: { identifier: `alice_${tag}@test.dev`, password: 'Passw0rd123' } });
  assert.equal(ok.status, 200);
  assert.equal((await api('POST', '/auth/login', { body: { identifier: `alice_${tag}`, password: 'wrong-pass1' } })).status, 401);
  assert.equal((await api('POST', '/auth/login', { body: { identifier: 'nobody_here', password: 'Passw0rd123' } })).status, 401);
  assert.equal((await api('GET', '/auth/me', { token: users.alice.token })).body.data.user.username, `alice_${tag}`);
  assert.equal((await api('GET', '/auth/me', { token: 'garbage' })).status, 401);
});

test('posts: auth required to create; drafts are private; published are public', async () => {
  assert.equal((await api('POST', '/posts', { body: { title: 'Nope nope', content: 'x' } })).status, 401);
  const c = await api('POST', '/posts', { token: users.alice.token, body: { title: 'My first post', content: 'Hello **world**' } });
  assert.equal(c.status, 201);
  assert.equal(c.body.data.status, 'draft');
  state.post = c.body.data;
  assert.equal((await api('GET', `/posts/${state.post.slug}`)).status, 404, 'anonymous cannot read draft');
  assert.equal((await api('GET', `/posts/${state.post.slug}`, { token: users.bob.token })).status, 404, 'other user cannot read draft');
  assert.equal((await api('GET', `/posts/${state.post.id}`, { token: users.alice.token })).status, 200, 'author can read draft');

  const pub = await api('PATCH', `/posts/${state.post.id}`, { token: users.alice.token, body: { status: 'published' } });
  assert.equal(pub.status, 200);
  assert.ok(pub.body.data.publishedAt);
  assert.equal((await api('GET', `/posts/${state.post.slug}`)).status, 200, 'anonymous can read published by slug');
  const list = await api('GET', `/posts?author=alice_${tag}`);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].content, undefined, 'list omits full content');
  assert.equal(list.body.pagination.total, 1);
});

test('authorization: only owner/admin can edit or delete', async () => {
  assert.equal((await api('PATCH', `/posts/${state.post.id}`, { token: users.bob.token, body: { title: 'Hacked title' } })).status, 403);
  assert.equal((await api('DELETE', `/posts/${state.post.id}`, { token: users.bob.token })).status, 403);
  const edit = await api('PATCH', `/posts/${state.post.id}`, { token: users.alice.token, body: { title: 'Edited title' } });
  assert.equal(edit.body.data.title, 'Edited title');
});

test('input sanitising strips HTML', async () => {
  const r = await api('POST', '/posts', { token: users.alice.token, body: { title: 'XSS <script>alert(1)</script> test', content: 'hi <img src=x onerror=alert(1)> there & more' } });
  assert.equal(r.status, 201);
  assert.ok(!/<|onerror/.test(r.body.data.title + r.body.data.content.replace('& more', '')));
  assert.ok(r.body.data.content.includes('& more'));
});

test('likes: anonymous blocked, idempotent like, unlike', async () => {
  const id = state.post.id;
  assert.equal((await api('POST', `/posts/${id}/like`)).status, 401);
  assert.equal((await api('POST', `/posts/${id}/like`, { token: users.bob.token })).body.data.likeCount, 1);
  assert.equal((await api('POST', `/posts/${id}/like`, { token: users.bob.token })).body.data.likeCount, 1);
  const seen = await api('GET', `/posts/${id}`, { token: users.bob.token });
  assert.equal(seen.body.data.likedByMe, true);
  assert.equal(seen.body.data.counts.likes, 1);
  assert.equal((await api('DELETE', `/posts/${id}/like`, { token: users.bob.token })).body.data.likeCount, 0);
});

test('comments and threaded replies', async () => {
  const id = state.post.id;
  assert.equal((await api('POST', `/posts/${id}/comments`, { body: { content: 'anon' } })).status, 401);
  const c = await api('POST', `/posts/${id}/comments`, { token: users.bob.token, body: { content: 'Nice post!' } });
  assert.equal(c.status, 201);
  state.comment = c.body.data;
  const r = await api('POST', `/posts/${id}/comments`, { token: users.alice.token, body: { content: 'Thanks!', parentId: c.body.data.id } });
  assert.equal(r.status, 201);
  const tree = await api('GET', `/posts/${id}/comments`);
  assert.equal(tree.body.data.length, 1);
  assert.equal(tree.body.data[0].replies.length, 1);
  assert.equal(tree.body.data[0].replies[0].content, 'Thanks!');
  assert.equal((await api('POST', `/posts/${id}/comments`, { token: users.bob.token, body: { content: 'x', parentId: '00000000-0000-4000-8000-000000000000' } })).status, 400);
  // edit / delete permissions
  assert.equal((await api('PATCH', `/comments/${c.body.data.id}`, { token: users.alice.token, body: { content: 'hijack' } })).status, 403);
  assert.equal((await api('PATCH', `/comments/${c.body.data.id}`, { token: users.bob.token, body: { content: 'Nice post, edited' } })).status, 200);
  // owner delete of a comment that has replies keeps the thread (soft delete)
  await api('DELETE', `/comments/${c.body.data.id}`, { token: users.bob.token });
  const after = await api('GET', `/posts/${id}/comments`);
  assert.equal(after.body.data[0].content, null);
  assert.equal(after.body.data[0].replies.length, 1);
});

test('share: requires login, records count, returns links', async () => {
  const id = state.post.id;
  assert.equal((await api('POST', `/posts/${id}/share`, { body: {} })).status, 401);
  const s = await api('POST', `/posts/${id}/share`, { token: users.bob.token, body: { platform: 'twitter' } });
  assert.equal(s.status, 201);
  assert.equal(s.body.data.shareCount, 1);
  assert.ok(s.body.data.shareUrl.endsWith(state.post.slug));
  assert.equal((await api('POST', `/posts/${id}/share`, { token: users.bob.token, body: { platform: 'myspace' } })).status, 400);
});

test('admin: forbidden for normal users; moderation, suspension, audit log', async () => {
  assert.equal((await api('GET', '/admin/stats', { token: users.alice.token })).status, 403);
  assert.equal((await api('GET', '/admin/stats')).status, 401);
  await run("UPDATE users SET role = 'admin' WHERE id = $1", [users.root.id]);
  const t = users.root.token;

  const stats = await api('GET', '/admin/stats', { token: t });
  assert.equal(stats.status, 200);
  assert.ok(stats.body.data.users.total >= 3);
  assert.ok((await api('GET', `/admin/users?q=alice_${tag}`, { token: t })).body.data.length === 1);

  // hide post -> disappears publicly, alice cannot un-hide it
  assert.equal((await api('PATCH', `/admin/posts/${state.post.id}/status`, { token: t, body: { status: 'hidden' } })).status, 200);
  assert.equal((await api('GET', `/posts/${state.post.slug}`)).status, 404);
  assert.equal((await api('PATCH', `/posts/${state.post.id}`, { token: users.alice.token, body: { status: 'published' } })).status, 403);
  await api('PATCH', `/admin/posts/${state.post.id}/status`, { token: t, body: { status: 'published' } });
  assert.equal((await api('GET', `/posts/${state.post.slug}`)).status, 200);

  // hide comment
  const cl = await api('GET', '/admin/comments?limit=50', { token: t });
  assert.ok(cl.body.data.length >= 2);

  // suspend bob -> existing token is rejected
  assert.equal((await api('PATCH', `/admin/users/${users.bob.id}`, { token: t, body: { status: 'suspended' } })).status, 200);
  assert.equal((await api('POST', `/posts/${state.post.id}/like`, { token: users.bob.token })).status, 403);
  assert.equal((await api('POST', '/auth/login', { body: { identifier: `bob_${tag}`, password: 'Passw0rd123' } })).status, 403);
  // admin cannot modify own account
  assert.equal((await api('PATCH', `/admin/users/${users.root.id}`, { token: t, body: { role: 'user' } })).status, 400);

  const log = await api('GET', '/admin/audit-log', { token: t });
  assert.ok(log.body.data.length >= 3);
  assert.equal((await api('DELETE', `/admin/posts/${state.post.id}`, { token: t })).status, 200);
  assert.equal((await api('GET', `/posts/${state.post.id}`, { token: t })).status, 404);
});

test('password change invalidates old tokens', async () => {
  await new Promise((r) => setTimeout(r, 1100)); // token iat has 1s resolution
  const ch = await api('POST', '/auth/change-password', { token: users.alice.token, body: { currentPassword: 'Passw0rd123', newPassword: 'NewPassw0rd456' } });
  assert.equal(ch.status, 200);
  assert.equal((await api('GET', '/auth/me', { token: users.alice.token })).status, 401);
  assert.equal((await api('GET', '/auth/me', { token: ch.body.data.token })).status, 200);
});
