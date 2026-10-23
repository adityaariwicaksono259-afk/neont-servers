// /api/user — CRUD user NEONT di D1
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function genUserCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NT-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function onRequestPost({ request, env }) {
  const db = env.NEONT_DB;
  if (!db) return json({ ok: false, message: 'DB tidak siap' }, 503);

  let body;
  try { body = await request.json(); } catch(e) { return json({ ok: false, message: 'JSON tidak valid' }, 400); }

  const uid = String(body.firebase_uid || '').trim();
  const displayName = String(body.display_name || '').trim().slice(0, 50);
  if (!uid) return json({ ok: false, message: 'firebase_uid wajib' }, 400);

  const existing = await db.prepare('SELECT * FROM neont_users WHERE firebase_uid = ?').bind(uid).first();
  if (existing) return json({ ok: true, user: existing, existed: true });

  const now = Date.now();
  let userCode = genUserCode();
  for (let i = 0; i < 5; i++) {
    const dup = await db.prepare('SELECT 1 FROM neont_users WHERE user_code = ?').bind(userCode).first();
    if (!dup) break;
    userCode = genUserCode();
  }

  await db.prepare(
    'INSERT INTO neont_users (firebase_uid, user_code, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(uid, userCode, displayName || 'User', now, now).run();

  const user = await db.prepare('SELECT * FROM neont_users WHERE firebase_uid = ?').bind(uid).first();
  return json({ ok: true, user, created: true });
}

export async function onRequestGet({ request, env }) {
  const db = env.NEONT_DB;
  if (!db) return json({ ok: false, message: 'DB tidak siap' }, 503);

  const url = new URL(request.url);
  const uid = String(url.searchParams.get('uid') || '').trim();
  const code = String(url.searchParams.get('code') || '').trim();

  if (!uid && !code) return json({ ok: false, message: 'uid atau code wajib' }, 400);

  const user = uid
    ? await db.prepare('SELECT * FROM neont_users WHERE firebase_uid = ?').bind(uid).first()
    : await db.prepare('SELECT * FROM neont_users WHERE user_code = ?').bind(code).first();

  if (!user) return json({ ok: false, message: 'User tidak ditemukan' }, 404);
  return json({ ok: true, user });
}

export async function onRequestPut({ request, env }) {
  const db = env.NEONT_DB;
  if (!db) return json({ ok: false, message: 'DB tidak siap' }, 503);

  let body;
  try { body = await request.json(); } catch(e) { return json({ ok: false, message: 'JSON tidak valid' }, 400); }

  const uid = String(body.firebase_uid || '').trim();
  if (!uid) return json({ ok: false, message: 'firebase_uid wajib' }, 400);

  const existing = await db.prepare('SELECT * FROM neont_users WHERE firebase_uid = ?').bind(uid).first();
  if (!existing) return json({ ok: false, message: 'User belum terdaftar' }, 404);

  const updates = [];
  const values = [];
  if (body.username !== undefined) {
    const uname = String(body.username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 25);
    if (uname) {
      const dup = await db.prepare('SELECT 1 FROM neont_users WHERE username = ? AND firebase_uid != ?').bind(uname, uid).first();
      if (dup) return json({ ok: false, message: 'Username sudah dipakai' }, 409);
      updates.push('username = ?'); values.push(uname);
    }
  }
  if (body.display_name !== undefined) { updates.push('display_name = ?'); values.push(String(body.display_name).slice(0, 50)); }
  if (body.bio !== undefined) { updates.push('bio = ?'); values.push(String(body.bio).slice(0, 200)); }
  if (body.photo_url !== undefined) { updates.push('photo_url = ?'); values.push(String(body.photo_url)); }
  if (body.is_verified !== undefined) { updates.push('is_verified = ?'); values.push(Number(body.is_verified) || 0); }
  if (body.privacy_last_seen !== undefined) { updates.push('privacy_last_seen = ?'); values.push(String(body.privacy_last_seen)); }
  if (body.privacy_profile_photo !== undefined) { updates.push('privacy_profile_photo = ?'); values.push(String(body.privacy_profile_photo)); }
  if (body.privacy_calls !== undefined) { updates.push('privacy_calls = ?'); values.push(String(body.privacy_calls)); }

  if (updates.length === 0) return json({ ok: false, message: 'Tidak ada yang diupdate' }, 400);

  updates.push('updated_at = ?'); values.push(Date.now()); values.push(uid);

  await db.prepare(`UPDATE neont_users SET ${updates.join(', ')} WHERE firebase_uid = ?`).bind(...values).run();
  const user = await db.prepare('SELECT * FROM neont_users WHERE firebase_uid = ?').bind(uid).first();
  return json({ ok: true, user });
}
