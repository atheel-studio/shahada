/* أثيل ستوديو: تشغيل التطبيق بدون نت أو بنت ضعيف */
const V = "ath-cert-v1";
const CORE = ["/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/guide.png"];
const LIBS = [
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(async c => {
    await c.addAll(CORE);
    await Promise.all(LIBS.map(u => fetch(u, {mode: "cors"}).then(r => r.ok && c.put(u, r)).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function timeout(ms) { return new Promise((_, no) => setTimeout(() => no(new Error("t")), ms)); }
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  // الصفحة الرئيسية: من النت أول (عشان التحديثات توصل)، ولو ما فيه نت من النسخة المحفوظة
  if (r.mode === "navigate" && u.origin === location.origin && (u.pathname === "/" || u.pathname === "/index.html")) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const net = await Promise.race([fetch(r), timeout(6000)]);
        if (net.ok) c.put("/index.html", net.clone());
        return net;
      } catch (err) {
        return (await c.match("/index.html")) || Response.error();
      }
    })());
    return;
  }
  // مكتبات cdnjs بأرقام إصدارات ثابتة: من المحفوظ أول
  if (u.hostname === "cdnjs.cloudflare.com") {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(r.url);
      if (hit) return hit;
      const net = await fetch(r);
      if (net.ok) c.put(r.url, net.clone());
      return net;
    }));
    return;
  }
  // باقي ملفات الموقع: المحفوظ فوراً، ونحدّثه بالخلفية
  if (u.origin === location.origin) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(r, {ignoreSearch: true});
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
