// /api/admin/login — Step 1: Password + PIN -> Kirim OTP ke Telegram
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch(e) { return json({ ok: false, message: 'Invalid JSON' }, 400); }

  const password = String(body.password || '');
  const pin = String(body.pin || '');

  // 1. Cek Password & PIN (dari ENV)
  const correctPassword = env.ADMIN_PASSWORD || 'neont_admin_2026';
  const correctPin = env.ADMIN_PIN || '123456';

  if (password !== correctPassword || pin !== correctPin) {
    return json({ ok: false, message: 'Password atau PIN salah' }, 401);
  }

  // 2. Generate OTP 6 digit
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpId = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 menit

  // 3. Simpan OTP di D1
  const db = env.NEONT_DB;
  if (!db) return json({ ok: false, message: 'DB tidak siap' }, 503);
  
  await db.prepare(`CREATE TABLE IF NOT EXISTS admin_otp (
    id TEXT PRIMARY KEY, otp TEXT, expires_at INTEGER, used INTEGER DEFAULT 0
  )`).run();
  
  await db.prepare('INSERT INTO admin_otp (id, otp, expires_at) VALUES (?, ?, ?)').bind(otpId, otp, expiresAt).run();

  // 4. Kirim OTP ke Telegram
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    const text = `🔐 *NEONT Admin OTP*\n\nKode: \`${otp}\`\nBerlaku 5 menit.\n\nJangan berikan kode ini ke siapapun.`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  }

  return json({ ok: true, otp_id: otpId, message: 'OTP dikirim ke Telegram' });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
