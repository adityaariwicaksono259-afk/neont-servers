// Middleware Admin — 5 Lapis Keamanan
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // ===== LAPIS 1: Hanya APK NEONT =====
  const clientSecret = request.headers.get('X-Neont-Secret');
  const serverSecret = env.NEONT_APP_SECRET || 'neont_rahasia_123';
  if (clientSecret !== serverSecret) {
    return json({ ok: false, message: 'Akses ditolak: Bukan APK NEONT' }, 403);
  }

  // ===== LAPIS 2: Anti-XSS =====
  const fullUrl = url.pathname + url.search;
  const xssPattern = /<script|javascript:|onerror=|onload=/i;
  if (xssPattern.test(fullUrl)) {
    return json({ ok: false, message: 'Request ditolak: XSS terdeteksi' }, 400);
  }

  // ===== LAPIS 3: Anti-SQLi =====
  const sqliPattern = /(union\s+select|drop\s+table|insert\s+into|--|\/\*|\*\/|;\s*select)/i;
  if (sqliPattern.test(fullUrl)) {
    return json({ ok: false, message: 'Request ditolak: SQLi terdeteksi' }, 400);
  }

  // ===== LAPIS 4: Rate Limit (5 req/menit per IP) =====
  const db = env.NEONT_DB;
  if (db && ip !== 'unknown') {
    const now = Date.now();
    const windowStart = Math.floor(now / 60000) * 60000;
    try {
      await db.prepare('CREATE TABLE IF NOT EXISTS admin_rate_limit (ip TEXT, window_start INTEGER, count INTEGER, PRIMARY KEY (ip, window_start))').run();
      const row = await db.prepare('SELECT count FROM admin_rate_limit WHERE ip = ? AND window_start = ?').bind(ip, windowStart).first();
      const currentCount = row ? row.count : 0;
      if (currentCount >= 5) {
        return json({ ok: false, message: 'Terlalu banyak request. Tunggu 1 menit.' }, 429);
      }
      await db.prepare('INSERT INTO admin_rate_limit (ip, window_start, count) VALUES (?, ?, 1) ON CONFLICT(ip, window_start) DO UPDATE SET count = count + 1').bind(ip, windowStart).run();
    } catch (e) {
      console.error('Rate limit error:', e.message);
    }
  }

  // ===== LAPIS 5: IP Whitelist (Opsional) =====
  // Jika ENV ADMIN_IP_WHITELIST diisi, hanya IP tersebut yang boleh akses
  const whitelist = String(env.ADMIN_IP_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
  if (whitelist.length > 0 && !whitelist.includes(ip)) {
    return json({ ok: false, message: 'IP tidak diizinkan' }, 403);
  }

  // ===== Lolos semua lapis, lanjut ke endpoint =====
  return context.next();
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
