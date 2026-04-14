'use strict';

const http  = require('http');
const fs    = require('fs').promises;
const path  = require('path');
const sharp = require('sharp');

// ── Konfiguration ─────────────────────────────────────────────────────────────
const BASE_PATH      = process.env.APP_BASE || '/volume1/Tenny/HufMacherin App';
const PORT           = parseInt(process.env.APP_PORT || '3004', 10);
const APP_NAME       = 'HufMacherin';
const THUMBNAIL_SIZE = 300;

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

// Path-Traversal-Schutz: PFLICHT bei jedem Dateizugriff
function safePath(base, relative) {
  const full = path.resolve(base, relative);
  const resolved = path.resolve(base);
  if (!full.startsWith(resolved + path.sep) && full !== resolved) {
    const err = new Error('Path traversal blocked');
    err.status = 400;
    throw err;
  }
  return full;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end',  () => resolve(body));
    req.on('error', reject);
  });
}

function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Datenverlustschutz: leeres Array blockiert vorhandene Daten
async function safeWriteJson(filePath, newData) {
  let existing = [];
  try { existing = JSON.parse(await fs.readFile(filePath, 'utf8')); } catch {}
  if (Array.isArray(existing) && existing.length > 0 &&
      Array.isArray(newData)  && newData.length === 0) {
    throw new Error('DATENVERLUST-SCHUTZ: Leeres Array blockiert (' + existing.length + ' Eintraege vorhanden)');
  }
  if (Array.isArray(existing) && existing.length > 10 &&
      Array.isArray(newData)  && newData.length < existing.length * 0.5) {
    console.warn('WARN: ' + path.basename(filePath) + ': ' + existing.length + ' -> ' + newData.length + ' Eintraege');
  }
  // Inkrementelles Backup vor dem Schreiben
  if (Array.isArray(existing) && existing.length > 0) {
    const ts   = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const bdir = path.join(BASE_PATH, 'backups', 'incremental_' + ts);
    await fs.mkdir(bdir, { recursive: true });
    await fs.writeFile(path.join(bdir, path.basename(filePath)), JSON.stringify(existing), 'utf8');
  }
  await fs.writeFile(filePath, JSON.stringify(newData, null, 2), 'utf8');
}

// Datum YYYY-MM-DD
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Sicherheits-Sanitierung von Benutzer-Eingaben (Pferdname, Huf, Seite)
function sanitizeName(str) {
  if (typeof str !== 'string') return 'unbekannt';
  // Nur alphanumerisch, Bindestrich, Unterstrich erlaubt
  return str.trim().replace(/[^a-zA-Z0-9\u00C0-\u017E_-]/g, '_').slice(0, 50);
}

// ── Verzeichnisstruktur anlegen ───────────────────────────────────────────────
const DIRS = [
  '_untagged',
  'images',
  'images/thumbnails',
  'database',
  'backups',
  'logs'
];

async function ensureDirs() {
  for (const d of DIRS) {
    await fs.mkdir(path.join(BASE_PATH, d), { recursive: true });
  }
}

// Foto-Katalog
const CATALOG_PATH = path.join(BASE_PATH, 'database', 'foto-katalog.json');

async function loadCatalog() {
  try { return JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8')); } catch { return []; }
}

// ── Router ────────────────────────────────────────────────────────────────────
async function router(req, res, url) {
  const method  = req.method;
  const pathname = url.pathname;

  // ── GET /api/health ────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/health') {
    return jsonResponse(res, 200, {
      success: true,
      app:     APP_NAME,
      status:  'online',
      port:    PORT,
      basePath: BASE_PATH,
      uptime:  Math.floor(process.uptime()),
      memory:  Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
    });
  }

  // ── POST /api/upload ───────────────────────────────────────────────────
  // Modus 'huf':     { pferd, datum?, huf, seite, dataUrl }
  //   → _untagged/[datum]_[pferd]/[huf]_[seite]_[ts].[ext]
  // Modus 'galerie': { pferd, datum?, modus:'galerie', originalname?, quelle?, dataUrl }
  //   → _untagged/[datum]_[pferd]/galerie_[name]_[ts].[ext]
  if (method === 'POST' && pathname === '/api/upload') {
    const body = JSON.parse(await readBody(req));
    const { pferd, dataUrl } = body;
    const huf    = body.huf    || '';
    const seite  = body.seite  || '';
    const modus  = body.modus  || (huf && seite ? 'huf' : 'galerie');

    if (!pferd || !dataUrl) {
      return jsonResponse(res, 400, { success: false, error: 'pferd und dataUrl sind Pflichtfelder' });
    }
    if (modus === 'huf' && (!huf || !seite)) {
      return jsonResponse(res, 400, { success: false, error: 'Im Modus huf sind huf und seite Pflichtfelder' });
    }

    // MIME-Typ und Extension aus dataUrl ableiten
    const mimeMatch = dataUrl.match(/^data:([^;]+);/);
    const mime      = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const extMap    = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext       = extMap[mime] || 'jpg';

    const datumStr  = sanitizeName(body.datum || todayStr());
    const pferdSafe = sanitizeName(pferd);
    const ts        = Date.now();
    const sessionDir = datumStr + '_' + pferdSafe;

    let filename;
    if (modus === 'huf') {
      const hufSafe   = sanitizeName(huf);
      const seiteSafe = sanitizeName(seite);
      filename = hufSafe + '_' + seiteSafe + '_' + ts + '.jpg';
    } else {
      const origSafe  = sanitizeName(body.originalname || 'foto');
      filename = 'galerie_' + origSafe + '_' + ts + '.' + ext;
    }

    const relSession = path.join('_untagged', sessionDir);
    const relPath    = path.join(relSession, filename);
    const thumbName  = filename.replace(/\.[^.]+$/, '_thumb.jpg');
    const relThumb   = path.join('images', 'thumbnails', sessionDir + '_' + thumbName);

    const absSession = safePath(BASE_PATH, relSession);
    const absPath    = safePath(BASE_PATH, relPath);
    const absThumb   = safePath(BASE_PATH, relThumb);

    await fs.mkdir(absSession, { recursive: true });
    await fs.mkdir(path.dirname(absThumb), { recursive: true });

    const buffer = Buffer.from(dataUrl.replace(/^data:[^;]+;base64,/, ''), 'base64');
    await fs.writeFile(absPath, buffer);

    const meta = await sharp(buffer).metadata();
    await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 80 })
      .toFile(absThumb);

    // Katalog-Eintrag
    const catalog = await loadCatalog();
    catalog.push({
      id:             sessionDir + '_' + ts,
      session:        sessionDir,
      pferd:          pferdSafe,
      datum:          datumStr,
      modus:          modus,
      huf:            modus === 'huf' ? sanitizeName(huf) : null,
      seite:          modus === 'huf' ? sanitizeName(seite) : null,
      quelle:         sanitizeName(body.quelle || ''),
      originalname:   body.originalname || null,
      file_path:      relPath.replace(/\\/g, '/'),
      thumbnail_path: relThumb.replace(/\\/g, '/'),
      uploadedAt:     new Date().toISOString(),
      width:          meta.width,
      height:         meta.height,
      size_bytes:     buffer.length,
      tagged:         false
    });
    await safeWriteJson(CATALOG_PATH, catalog);

    console.log('[UPLOAD][' + modus + '] ' + relPath);
    return jsonResponse(res, 200, {
      success:        true,
      file_path:      relPath.replace(/\\/g, '/'),
      thumbnail_path: relThumb.replace(/\\/g, '/'),
      session:        sessionDir,
      modus:          modus,
      width:          meta.width,
      height:         meta.height,
      size_bytes:     buffer.length
    });
  }

  // ── GET /api/sessions ──────────────────────────────────────────────────
  // Gibt alle _untagged/<session>-Ordner zurück
  if (method === 'GET' && pathname === '/api/sessions') {
    const untaggedDir = path.join(BASE_PATH, '_untagged');
    let entries = [];
    try {
      const names = await fs.readdir(untaggedDir);
      for (const name of names) {
        const stat = await fs.stat(path.join(untaggedDir, name));
        if (stat.isDirectory()) {
          entries.push({ session: name, created: stat.birthtime });
        }
      }
    } catch {}
    entries.sort((a, b) => b.session.localeCompare(a.session));
    return jsonResponse(res, 200, { success: true, sessions: entries });
  }

  // ── GET /api/images?session=... ────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/images') {
    const session = url.searchParams.get('session') || '';
    const sessionSafe = sanitizeName(session);
    const sessionDir  = safePath(BASE_PATH, path.join('_untagged', sessionSafe));
    let files = [];
    try {
      const names = await fs.readdir(sessionDir);
      for (const name of names) {
        if (/\.(jpg|jpeg|png|webp)$/i.test(name)) {
          files.push({
            name,
            file_path:      ('_untagged/' + sessionSafe + '/' + name),
            thumbnail_path: ('images/thumbnails/' + sessionSafe + '_' + name.replace('.jpg', '_thumb.jpg'))
          });
        }
      }
    } catch {}
    return jsonResponse(res, 200, { success: true, session: sessionSafe, images: files });
  }

  // ── GET /api/image?path=... ────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/image') {
    const relImg  = url.searchParams.get('path') || '';
    const absImg  = safePath(BASE_PATH, relImg);
    const buffer  = await fs.readFile(absImg);
    const ext     = path.extname(absImg).toLowerCase();
    const mimes   = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    res.writeHead(200, {
      'Content-Type':  mimes[ext] ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    });
    return res.end(buffer);
  }

  // ── CRUD-Hilfsmethoden ────────────────────────────────────────────────
  // Generischer JSON-DB-Loader
  async function loadDb(name) {
    const p = path.join(BASE_PATH, 'database', name + '.json');
    try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return []; }
  }
  async function saveDb(name, data) {
    const p = path.join(BASE_PATH, 'database', name + '.json');
    await safeWriteJson(p, data);
  }

  // ── GET /api/kunden ────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/kunden') {
    const data = await loadDb('kunden');
    return jsonResponse(res, 200, { success: true, kunden: data });
  }
  // ── POST /api/kunden ──────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/kunden') {
    const body = JSON.parse(await readBody(req));
    if (!body.name) return jsonResponse(res, 400, { success: false, error: 'name ist Pflichtfeld' });
    const kunden = await loadDb('kunden');
    const neu = {
      id:       'ku_' + Date.now(),
      name:     body.name.trim(),
      vorname:  (body.vorname  || '').trim(),
      adresse:  (body.adresse  || '').trim(),
      telefon:  (body.telefon  || '').trim(),
      angelegt: new Date().toISOString()
    };
    kunden.push(neu);
    await saveDb('kunden', kunden);
    console.log('[KUNDEN] neu: ' + neu.id);
    return jsonResponse(res, 200, { success: true, kunde: neu });
  }
  // ── PUT /api/kunden/:id ────────────────────────────────────────────────
  if (method === 'PUT' && /^\/api\/kunden\/ku_\d+$/.test(pathname)) {
    const id     = pathname.split('/').pop();
    const body   = JSON.parse(await readBody(req));
    const kunden = await loadDb('kunden');
    const idx    = kunden.findIndex(k => k.id === id);
    if (idx === -1) return jsonResponse(res, 404, { success: false, error: 'Kunde nicht gefunden' });
    kunden[idx] = Object.assign({}, kunden[idx], {
      name:    (body.name    || kunden[idx].name).trim(),
      vorname: (body.vorname !== undefined ? body.vorname : kunden[idx].vorname).trim(),
      adresse: (body.adresse !== undefined ? body.adresse : kunden[idx].adresse).trim(),
      telefon: (body.telefon !== undefined ? body.telefon : kunden[idx].telefon).trim(),
      geaendert: new Date().toISOString()
    });
    await saveDb('kunden', kunden);
    return jsonResponse(res, 200, { success: true, kunde: kunden[idx] });
  }
  // ── DELETE /api/kunden/:id ─────────────────────────────────────────────
  if (method === 'DELETE' && /^\/api\/kunden\/ku_\d+$/.test(pathname)) {
    const id     = pathname.split('/').pop();
    const pferde = await loadDb('pferde');
    if (pferde.some(p => p.kundeId === id)) {
      return jsonResponse(res, 400, { success: false, error: 'Kunde hat noch Pferde – zuerst Pferde loeschen' });
    }
    const kunden = await loadDb('kunden');
    const gefiltert = kunden.filter(k => k.id !== id);
    if (gefiltert.length === kunden.length) return jsonResponse(res, 404, { success: false, error: 'Kunde nicht gefunden' });
    await saveDb('kunden', gefiltert);
    return jsonResponse(res, 200, { success: true });
  }

  // ── GET /api/pferde ────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/pferde') {
    const data = await loadDb('pferde');
    return jsonResponse(res, 200, { success: true, pferde: data });
  }
  // ── POST /api/pferde ──────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/pferde') {
    const body = JSON.parse(await readBody(req));
    if (!body.name || !body.kundeId) return jsonResponse(res, 400, { success: false, error: 'name und kundeId sind Pflichtfelder' });
    const pferde = await loadDb('pferde');
    const neu = {
      id:           'pf_' + Date.now(),
      name:         body.name.trim(),
      kundeId:      body.kundeId,
      geburtsjahr:  body.geburtsjahr  || null,
      geschlecht:   body.geschlecht   || '',
      bemerkungen:  (body.bemerkungen || '').trim(),
      angelegt:     new Date().toISOString()
    };
    pferde.push(neu);
    await saveDb('pferde', pferde);
    console.log('[PFERDE] neu: ' + neu.id);
    return jsonResponse(res, 200, { success: true, pferd: neu });
  }
  // ── PUT /api/pferde/:id ────────────────────────────────────────────────
  if (method === 'PUT' && /^\/api\/pferde\/pf_\d+$/.test(pathname)) {
    const id     = pathname.split('/').pop();
    const body   = JSON.parse(await readBody(req));
    const pferde = await loadDb('pferde');
    const idx    = pferde.findIndex(p => p.id === id);
    if (idx === -1) return jsonResponse(res, 404, { success: false, error: 'Pferd nicht gefunden' });
    pferde[idx] = Object.assign({}, pferde[idx], {
      name:        (body.name        !== undefined ? body.name        : pferde[idx].name).trim(),
      geburtsjahr: (body.geburtsjahr !== undefined ? body.geburtsjahr : pferde[idx].geburtsjahr),
      geschlecht:  (body.geschlecht  !== undefined ? body.geschlecht  : pferde[idx].geschlecht),
      bemerkungen: (body.bemerkungen !== undefined ? body.bemerkungen : pferde[idx].bemerkungen).trim(),
      geaendert:   new Date().toISOString()
    });
    await saveDb('pferde', pferde);
    return jsonResponse(res, 200, { success: true, pferd: pferde[idx] });
  }
  // ── DELETE /api/pferde/:id ─────────────────────────────────────────────
  if (method === 'DELETE' && /^\/api\/pferde\/pf_\d+$/.test(pathname)) {
    const id      = pathname.split('/').pop();
    const termine = await loadDb('termine');
    if (termine.some(t => t.pferdId === id)) {
      return jsonResponse(res, 400, { success: false, error: 'Pferd hat noch Termine – zuerst Termine loeschen' });
    }
    const pferde    = await loadDb('pferde');
    const gefiltert = pferde.filter(p => p.id !== id);
    if (gefiltert.length === pferde.length) return jsonResponse(res, 404, { success: false, error: 'Pferd nicht gefunden' });
    await saveDb('pferde', gefiltert);
    return jsonResponse(res, 200, { success: true });
  }

  // ── GET /api/termine ───────────────────────────────────────────────────
  // Optional: ?pferdId=pf_xxx  ?von=YYYY-MM-DD  ?bis=YYYY-MM-DD
  if (method === 'GET' && pathname === '/api/termine') {
    let data = await loadDb('termine');
    const pferdId = url.searchParams.get('pferdId');
    const von     = url.searchParams.get('von');
    const bis     = url.searchParams.get('bis');
    if (pferdId) data = data.filter(t => t.pferdId === pferdId);
    if (von)     data = data.filter(t => t.datum >= von);
    if (bis)     data = data.filter(t => t.datum <= bis);
    data.sort((a, b) => a.datum.localeCompare(b.datum) || (a.von || '').localeCompare(b.von || ''));
    return jsonResponse(res, 200, { success: true, termine: data });
  }
  // ── POST /api/termine ─────────────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/termine') {
    const body = JSON.parse(await readBody(req));
    if (!body.pferdId || !body.datum) return jsonResponse(res, 400, { success: false, error: 'pferdId und datum sind Pflichtfelder' });
    const termine = await loadDb('termine');
    const neu = {
      id:          'te_' + Date.now(),
      pferdId:     body.pferdId,
      datum:       body.datum,
      von:         body.von         || '',
      bis:         body.bis         || '',
      status:      body.status      || 'vorreserviert',
      bemerkung:   (body.bemerkung  || '').trim(),
      folgetermin: body.folgetermin || null,
      angelegt:    new Date().toISOString()
    };
    termine.push(neu);
    await saveDb('termine', termine);
    console.log('[TERMINE] neu: ' + neu.id + ' (' + neu.datum + ')');
    return jsonResponse(res, 200, { success: true, termin: neu });
  }
  // ── PUT /api/termine/:id ──────────────────────────────────────────────
  if (method === 'PUT' && /^\/api\/termine\/te_\d+$/.test(pathname)) {
    const id      = pathname.split('/').pop();
    const body    = JSON.parse(await readBody(req));
    const termine = await loadDb('termine');
    const idx     = termine.findIndex(t => t.id === id);
    if (idx === -1) return jsonResponse(res, 404, { success: false, error: 'Termin nicht gefunden' });
    const erlaubteStatus = ['vorreserviert', 'bestaetigt', 'abgeschlossen', 'abgesagt'];
    if (body.status && !erlaubteStatus.includes(body.status)) {
      return jsonResponse(res, 400, { success: false, error: 'Ungültiger Status' });
    }
    termine[idx] = Object.assign({}, termine[idx], {
      datum:       (body.datum      !== undefined ? body.datum      : termine[idx].datum),
      von:         (body.von        !== undefined ? body.von        : termine[idx].von),
      bis:         (body.bis        !== undefined ? body.bis        : termine[idx].bis),
      status:      (body.status     !== undefined ? body.status     : termine[idx].status),
      bemerkung:   (body.bemerkung  !== undefined ? body.bemerkung  : termine[idx].bemerkung),
      folgetermin: (body.folgetermin !== undefined ? body.folgetermin : termine[idx].folgetermin),
      geaendert:   new Date().toISOString()
    });
    await saveDb('termine', termine);
    return jsonResponse(res, 200, { success: true, termin: termine[idx] });
  }
  // ── DELETE /api/termine/:id ───────────────────────────────────────────
  if (method === 'DELETE' && /^\/api\/termine\/te_\d+$/.test(pathname)) {
    const id      = pathname.split('/').pop();
    const termine = await loadDb('termine');
    const gefiltert = termine.filter(t => t.id !== id);
    if (gefiltert.length === termine.length) return jsonResponse(res, 404, { success: false, error: 'Termin nicht gefunden' });
    await saveDb('termine', gefiltert);
    return jsonResponse(res, 200, { success: true });
  }

  // ── Statische Dateien aus public/ ─────────────────────────────────────
  const rel  = url.pathname === '/' ? '/index.html' : url.pathname;
  const abs  = path.resolve(path.join(__dirname, 'public', rel));
  const base = path.resolve(path.join(__dirname, 'public'));
  if (!abs.startsWith(base + path.sep) && abs !== base) {
    res.writeHead(403); return res.end();
  }
  try {
    const data = await fs.readFile(abs);
    const ext2  = path.extname(abs).toLowerCase();
    const mimes = {
      '.html': 'text/html; charset=utf-8',
      '.json': 'application/json',
      '.js':   'application/javascript',
      '.png':  'image/png',
      '.css':  'text/css'
    };
    res.writeHead(200, { 'Content-Type': mimes[ext2] ?? 'application/octet-stream' });
    return res.end(data);
  } catch {
    res.writeHead(404); return res.end('Not found');
  }
}

// ── Server starten ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  try {
    const url = new URL(req.url, 'http://localhost:' + PORT);
    await router(req, res, url);
  } catch (err) {
    const status = err.status || 500;
    console.error('[ERROR]', err.message);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(APP_NAME + ' NAS-Server laeuft auf Port ' + PORT);
  console.log('BASE_PATH: ' + BASE_PATH);
});

ensureDirs().catch(err => console.error('ensureDirs Fehler:', err.message));
