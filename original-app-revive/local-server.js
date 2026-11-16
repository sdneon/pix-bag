// In-app stand-in for the dead pix.style API. Prepended to the original JS bundle by
// patch-bundle.js; the bundle's jsonApiFetch calls __pixLocal(url, options, AsyncStorage)
// instead of fetch(). Plain ES5: the app's old JS engine runs this as-is.
(function (G) {
  var PFX = '@pixlocal/';
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function b64(bytes) {
    var s = '', i = 0, n;
    for (; i + 2 < bytes.length; i += 3) {
      n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    if (bytes.length - i === 1) {
      n = bytes[i] << 16;
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + '==';
    } else if (bytes.length - i === 2) {
      n = (bytes[i] << 16) | (bytes[i + 1] << 8);
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
    }
    return s;
  }

  function b64url(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 255);
    return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // Unsigned JWT: the app only decodes it to read userId.
  function fakeToken(userId) {
    return b64url('{"alg":"none","typ":"JWT"}') + '.' +
      b64url(JSON.stringify({ userId: userId, anonymous: true, iat: 1600000000, exp: 4102444800 })) + '.local';
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function hexRgb(h) {
    var n = parseInt(String(h || '#000000').replace('#', ''), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  var CRC = [];
  for (var ci = 0; ci < 256; ci++) {
    var cv = ci;
    for (var ck = 0; ck < 8; ck++) cv = cv & 1 ? 0xedb88320 ^ (cv >>> 1) : cv >>> 1;
    CRC[ci] = cv >>> 0;
  }
  function crc32(bytes, start, end) {
    var c = 0xffffffff;
    for (var i = start; i < end; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function pushU32(out, v) { out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  function chunk(out, type, data) {
    pushU32(out, data.length);
    var start = out.length;
    for (var i = 0; i < 4; i++) out.push(type.charCodeAt(i));
    for (i = 0; i < data.length; i++) out.push(data[i]);
    pushU32(out, crc32(out, start, out.length));
  }

  // RGB PNG (uncompressed deflate) data URI of the project's preview frame.
  // imageData = rows of '#rrggbb'; each pixel is upscaled S times so it stays crisp.
  function previewUri(content) {
    var frames = content && content.frames;
    if (!frames || !frames.length) return null;
    var f = frames[content.previewFrameIndex || 0] || frames[0];
    var img = f && f.imageData;
    if (!img || !img.length) return null;
    var h = img.length, w = img[0].length, S = 4, W = w * S, H = h * S;
    var raw = [];
    for (var Y = 0; Y < H; Y++) {
      raw.push(0); // filter: none
      var rowSrc = img[Math.floor(Y / S)];
      for (var X = 0; X < W; X++) {
        var c = hexRgb(rowSrc[Math.floor(X / S)]);
        raw.push(c[0], c[1], c[2]);
      }
    }
    var z = [0x78, 0x01], a = 1, bsum = 0;
    for (var i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; bsum = (bsum + a) % 65521; }
    for (var p = 0; p < raw.length; p += 65535) {
      var len = Math.min(65535, raw.length - p);
      z.push(p + len >= raw.length ? 1 : 0, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255);
      for (var q = 0; q < len; q++) z.push(raw[p + q]);
    }
    pushU32(z, ((bsum << 16) | a) >>> 0);
    var out = [137, 80, 78, 71, 13, 10, 26, 10], ihdr = [];
    pushU32(ihdr, W); pushU32(ihdr, H); ihdr.push(8, 2, 0, 0, 0);
    chunk(out, 'IHDR', ihdr);
    chunk(out, 'IDAT', z);
    chunk(out, 'IEND', []);
    return 'data:image/png;base64,' + b64(out);
  }

  G.__pixPrev = {};

  function resp(status, body) {
    return { status: status, json: function () { return Promise.resolve(body); } };
  }
  function ok(data) { return resp(200, { data: data || {} }); }
  function fail(status, title) {
    return resp(status, { errors: [{ status: String(status), title: title, detail: title }] });
  }

  function readJson(S, key, dflt) {
    return S.getItem(PFX + key).then(function (s) { return s ? JSON.parse(s) : dflt; });
  }
  function writeJson(S, key, v) { return S.setItem(PFX + key, JSON.stringify(v)); }

  function ensurePreview(S, id) {
    if (G.__pixPrev[id]) return Promise.resolve();
    return readJson(S, 'content/' + id, null).then(function (c) {
      var u = c && previewUri(c);
      if (u) G.__pixPrev[id] = u;
    });
  }

  function saveProject(S, id, fields, isNew) {
    return readJson(S, 'projects', {}).then(function (all) {
      var now = new Date().toISOString();
      var p = all[id] || { id: id, shared: false, creationTime: now };
      if (isNew) p = { id: id, shared: false, creationTime: now };
      if (fields.name !== undefined) p.name = fields.name;
      if (fields.category !== undefined) p.category = fields.category;
      if (fields.userId !== undefined) p.userId = fields.userId;
      if (!p.category) p.category = 'images';
      p.versionId = uuid();
      p.modificationTime = now;
      all[id] = p;
      var jobs = [writeJson(S, 'projects', all)];
      if (fields.content) {
        jobs.push(writeJson(S, 'content/' + id, fields.content));
        var u = previewUri(fields.content);
        if (u) G.__pixPrev[id] = u; else delete G.__pixPrev[id];
      }
      return Promise.all(jobs).then(function () { return p; });
    });
  }

  function handleProject(S, method, seg, body) {
    var id = seg[1];
    if (!id) {
      if (method !== 'GET') return fail(405, 'Not supported offline');
      return readJson(S, 'projects', {}).then(function (all) {
        var list = Object.keys(all).map(function (k) { return all[k]; }).filter(function (p) { return !p.deleted; });
        list.sort(function (a, b) { return a.modificationTime < b.modificationTime ? 1 : -1; });
        return Promise.all(list.map(function (p) { return ensurePreview(S, p.id); }))
          .then(function () { return ok({ projects: list }); });
      });
    }
    var sub = seg[2];
    if (!sub) {
      if (method === 'GET') {
        return readJson(S, 'projects', {}).then(function (all) {
          if (!all[id]) return fail(404, 'Project not found');
          return ensurePreview(S, id).then(function () { return ok(all[id]); });
        });
      }
      if (method === 'PUT') return saveProject(S, id, body, true).then(function () { return ok({}); });
      if (method === 'PATCH') return saveProject(S, id, body, false).then(function () { return ok({}); });
      if (method === 'DELETE') {
        // Soft delete: the project screen refetches and expects { deleted: true }.
        return readJson(S, 'projects', {}).then(function (all) {
          if (all[id]) all[id] = { id: id, name: all[id].name, category: all[id].category, userId: all[id].userId, deleted: true };
          delete G.__pixPrev[id];
          return Promise.all([writeJson(S, 'projects', all), S.removeItem(PFX + 'content/' + id)]);
        }).then(function () { return ok({}); });
      }
    }
    if (sub === 'content' && method === 'GET') {
      return readJson(S, 'content/' + id, null).then(function (c) {
        return c ? ok(c) : fail(404, 'Project content not found');
      });
    }
    if (sub === 'clone' && method === 'POST') {
      return Promise.all([readJson(S, 'projects', {}), readJson(S, 'content/' + id, null)]).then(function (r) {
        var src = r[0][id];
        if (!src) return fail(404, 'Project not found');
        var nid = uuid();
        return saveProject(S, nid, { name: src.name + ' copy', category: src.category, userId: src.userId, content: r[1] }, true)
          .then(function () { return ok({ id: nid }); });
      });
    }
    return fail(503, 'Sharing is not available offline');
  }

  function handle(url, opts, S) {
    var m = /^https?:\/\/[^\/]+\/api\/pix\/[^\/]+(\/[^?]*)/.exec(url);
    if (!m) return fail(503, 'Pix server is offline');
    var seg = m[1].split('/').filter(function (s) { return s; });
    var method = String(opts.method || 'GET').toUpperCase();
    var body = {};
    try { body = opts.body ? JSON.parse(opts.body) : {}; } catch (e) {}

    switch (seg[0]) {
      case 'anonymous-membership':
        if (seg[1] === 'auth') return ok({ accessToken: fakeToken(body.userId) });
        return ok({});
      case 'project':
        return handleProject(S, method, seg, body);
      case 'store-item':
        return seg.length === 1 && method === 'GET' ? ok({ storeItems: [] }) : fail(404, 'Not available offline');
      case 'added-store-item':
        return method === 'GET' ? ok({ addedStoreItems: [] }) : ok({});
      default:
        console.log('[pixlocal] unhandled ' + method + ' ' + m[1]);
        return fail(503, 'Pix server is offline');
    }
  }

  // Previews must be in memory before any screen asks for one (lists come from the app's
  // own cache without calling us), so the first call at startup loads them all.
  var ready = null;
  function preload(S) {
    if (!ready) {
      ready = readJson(S, 'projects', {})
        .then(function (all) {
          return Promise.all(Object.keys(all).filter(function (id) { return !all[id].deleted; })
            .map(function (id) { return ensurePreview(S, id); }));
        })
        .catch(function () {});
    }
    return ready;
  }

  G.__pixLocal = function (url, opts, S) {
    return preload(S)
      .then(function () { return handle(String(url), opts || {}, S); })
      .catch(function (e) { return fail(500, String((e && e.message) || e)); });
  };
})(this);
