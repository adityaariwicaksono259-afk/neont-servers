// /api/admin/verify-user — Verifikasi user (butuh session token)
export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  const db = env.NEONT_DB;
  if (!db) return json({ ok: false, message: 'DB tidak siap' }, 503);

  // Cek session
  const session = await db.prepare('SELECT * FROM admin_session WHERE token = ? AND expires_at > ?').bind(token, Date.now()).first();
  if (!session) return json({ ok: false, message: 'Session tidak valid. Login ulang.' }, 401);

  let body;
  try { body = await request.json(); } catch(e) { return json({ ok: false }, 400); }

  const username = String(body.username || '').trim();
  const verified = Number(body.is_verified) === 1 ? 1 : 0;
  if (!username) return json({ ok: false, message: 'Username wajib' }, 400);

  // Cari user berdasarkan username
  const user = await db.prepare('SELECT firebase_uid FROM neont_users WHERE username = ?').bind(username).first();
  if (!user) return json({ ok: false, message: 'Username tidak ditemukan' }, 404);

  await db.prepare('UPDATE neont_users SET is_verified = ? WHERE username = ?').bind(verified, username).run();
  return json({ ok: true, message: `User @${username} ${verified === 1 ? 'terverifikasi' : 'unverified'}` });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
