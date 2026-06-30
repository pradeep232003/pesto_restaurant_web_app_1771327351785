/*
 * share-sw.js — service worker that intercepts the PWA Share Target POST.
 *
 * When the user picks "Share → Jolly's Kafe" from iOS / Android, the browser
 * POSTs a multipart form to /jkhive/invoices/share (declared in manifest.json).
 * We grab the first file, stash it in IndexedDB, then redirect to the
 * Invoices SPA which finds the stashed blob, uploads it via the normal
 * authenticated /api/admin/invoices/scan endpoint and clears the slot.
 *
 * This keeps auth on the SPA side (uses the existing Bearer token in
 * localStorage) — the service worker never touches credentials.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const IDB_NAME = 'jk-share';
const STORE = 'inbox';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putBlob(blob, name, type) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ blob, name, type, ts: Date.now() }, 'pending');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/jkhive/invoices/share') {
    event.respondWith(handleShare(event.request));
  }
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (file && typeof file !== 'string') {
      await putBlob(file, file.name || 'shared-invoice', file.type || 'image/jpeg');
    }
  } catch (e) {
    // Even if stashing failed, still redirect — the SPA will handle the
    // empty-inbox case gracefully.
  }
  // 303 See Other forces the redirected request to be GET — keeps the SPA
  // routing happy.
  return Response.redirect('/jkhive/invoices?source=share', 303);
}
