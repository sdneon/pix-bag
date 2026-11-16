// Smoke test for local-server.js with an in-memory AsyncStorage.
// Usage: node test-local-server.js
'use strict';
const fs = require('fs');
const vm = require('vm');
const G = {};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname, 'local-server.js'), 'utf8'), G);
const mem = {};
const S = {
  getItem: k => Promise.resolve(k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = v; return Promise.resolve(); },
  removeItem: k => { delete mem[k]; return Promise.resolve(); },
};
const API = 'https://app.pix.style/api/pix/1.0.0';
async function call(method, path, body) {
  const r = await G.__pixLocal(API + path, { method, body: body ? JSON.stringify(body) : undefined }, S);
  const j = await r.json();
  return { status: r.status, j };
}
const row = Array(16).fill('#ff0000');
const content = { width: 16, height: 20, previewFrameIndex: 0, frames: [{ id: 0, duration: 100, imageData: Array(20).fill(row) }] };
(async () => {
  const a = await call('POST', '/anonymous-membership/auth', { userId: 'u1', secret: 's' });
  const tok = a.j.data.accessToken;
  const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64').toString());
  console.log('auth', a.status, payload.userId === 'u1');
  console.log('put', (await call('PUT', '/project/p1', { name: 'Test', content, category: 'images', userId: 'u1' })).status);
  const list = await call('GET', '/project/?userId=u1');
  console.log('list', list.status, list.j.data.projects.map(p => p.name + '/' + p.category));
  console.log('preview', (G.__pixPrev.p1 || '').slice(0, 40), (G.__pixPrev.p1 || '').length);
  console.log('patch', (await call('PATCH', '/project/p1', { name: 'Renamed' })).status);
  console.log('get', (await call('GET', '/project/p1')).j.data.name);
  console.log('content', (await call('GET', '/project/p1/content')).j.data.frames.length);
  const cl = await call('POST', '/project/p1/clone');
  console.log('clone', cl.status, !!cl.j.data.id);
  console.log('delete', (await call('DELETE', '/project/p1')).status, (await call('GET', '/project/p1')).status);
  console.log('store', (await call('GET', '/store-item/')).j.data);
  console.log('echo', (await call('GET', '/echo')).status);
})();
