export async function onRequestGet({ request, env }) {
  const db = env.NEONT_DB;
  if (!db) return new Response(JSON.stringify({ ok: false, message: 'DB tidak siap' }), { status: 503, headers: { 'Content-Type': 'application/json' } });

  const url = new URL(request.url);
  let q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  if (q.startsWith('@')) q = q.substring(1);
  if (q.length < 3) return new Response(JSON.stringify({ ok: false, message: 'Minimal 3 karakter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  try {
    const pattern = q + '%';
    const contains = '%' + q + '%';
    const result = await db.prepare(
      `SELECT firebase_uid, user_code, username, display_name, photo_url 
       FROM neont_users 
       WHERE username LIKE ? COLLATE NOCASE OR display_name LIKE ? COLLATE NOCASE 
       LIMIT 30`
    ).bind(pattern, contains).all();

    return new Response(JSON.stringify({ ok: true, users: result.results || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
