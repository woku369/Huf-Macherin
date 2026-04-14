// Service Worker – HufMacherin Foto-Upload
// Offline-Queue via IndexedDB + Background Sync

const CACHE_NAME    = 'hufmacherin-v1';
const STATIC_ASSETS = ['/', '/index.html', '/upload.html', '/manifest.json'];

// ── Install: statische Assets cachen ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: alte Caches loeschen ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: statische Dateien aus Cache, API immer live ───────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API-Anfragen: immer live (kein Cache), bei Fehler: Offline-Meldung
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ success: false, error: 'Offline – kein NAS erreichbar' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Statische Dateien: Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Background Sync: Offline-Queue abarbeiten ─────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'upload-queue') {
    event.waitUntil(flushUploadQueue());
  }
});

async function flushUploadQueue() {
  const db      = await openQueueDb();
  const pending = await getAllPending(db);
  for (const item of pending) {
    try {
      const response = await fetch('/api/upload', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(item.payload)
      });
      if (response.ok) {
        await deleteItem(db, item.id);
        notifyClients({ type: 'UPLOAD_SUCCESS', id: item.id, session: item.payload.datum + '_' + item.payload.pferd });
      }
    } catch {
      // Noch offline – beim naechsten Sync-Event erneut versuchen
    }
  }
}

// ── IndexedDB Hilfsfunktionen ─────────────────────────────────────────────────
function openQueueDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('hufmacherin-queue', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('uploads', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('uploads', 'readonly');
    const req = tx.objectStore('uploads').getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function deleteItem(db, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('uploads', 'readwrite');
    const req = tx.objectStore('uploads').delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

function notifyClients(msg) {
  self.clients.matchAll().then(clients =>
    clients.forEach(c => c.postMessage(msg))
  );
}
