import { signS3 } from '../_lib/s3.js';

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function onRequestPost({ request, env }) {
  const accessKey = env.FILEBASE_ACCESS_KEY;
  const secretKey = env.FILEBASE_SECRET_KEY;
  const bucket = env.FILEBASE_BUCKET;
  const endpoint = env.FILEBASE_ENDPOINT || 'https://s3.filebase.io';

  if (!accessKey || !secretKey || !bucket) {
    return json({ ok: false, message: 'Filebase credential belum diset di Cloudflare' }, 503);
  }

  let form;
  try { form = await request.formData(); } catch(e) { return json({ ok: false, message: 'FormData tidak valid' }, 400); }

  const file = form.get('file');
  const folder = String(form.get('folder') || 'misc').replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'misc';

  if (!file || !(file instanceof File)) return json({ ok: false, message: 'file wajib' }, 400);

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
  const key = `neont/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const url = `${endpoint}/${bucket}/${key}`;

  const buf = await file.arrayBuffer();
  
  try {
    const authHeader = await signS3(accessKey, secretKey, 'PUT', url, buf, file.type);
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'x-amz-content-sha256': Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map(b => b.toString(16).padStart(2, '0')).join(''),
        'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
        'Content-Type': file.type
      },
      body: buf
    });

    if (!res.ok) {
      const txt = await res.text();
      return json({ ok: false, message: 'Upload gagal', detail: txt.slice(0, 200) }, 502);
    }

    return json({ ok: true, url: url, key, size: file.size, type: file.type });
  } catch (e) {
    return json({ ok: false, message: 'Crash: ' + e.message }, 500);
  }
}
