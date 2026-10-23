// /api/admin/verify-otp — Step 2: Verifikasi OTP -> Dapat Session Token
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch(e) { return json({ ok: false }, 400); }

  const otpId = String(body.otp_id || '');
  const otp = String(body.otp || '');

  const db = env.NEONT_DB;
  if (!db) return json({ ok: false, message: 'DB tidak siap' }, 503);

  const row = await db.prepare('SELECT * FROM admin_otp WHERE id = ? AND used = 0').bind(otpId).first();
  if (!row) return json({ ok: false, message: 'OTP tidak valid' }, 401);
  if (row.expires_at < Date.now()) return json({ ok: false, message: 'OTP kedaluwarsa' }, 401);
  if (row.otp !== otp) return json({ ok: false, message: 'OTP salah' }, 401);

  // Tandai OTP sudah digunakan
  await db.prepare('UPDATE admin_otp SET used = 1 WHERE id = ?').bind(otpId).run();

  // Buat session token
  const sessionToken = crypto.randomUUID();
  const sessionExpires = Date.now() + 60 * 60 * 1000; // 1 jam
  await db.prepare('CREATE TABLE IF NOT EXISTS admin_session (token TEXT PRIMARY KEY, expires_at INTEGER)').run();
  await db.prepare('INSERT INTO admin_session (token, expires_at) VALUES (?, ?)').bind(sessionToken, sessionExpires).run();

  return json({ ok: true, token: sessionToken, message: 'Login berhasil' });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
