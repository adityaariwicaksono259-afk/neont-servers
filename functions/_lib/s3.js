export async function signS3(accessKey, secretKey, method, urlStr, bodyBuffer, contentType) {
  const url = new URL(urlStr);
  const region = 'us-east-1';
  const service = 's3';
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateShort = date.slice(0, 8);
  
  const buf = bodyBuffer ? new Uint8Array(bodyBuffer) : new Uint8Array(0);
  const hashHex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf))).map(b => b.toString(16).padStart(2, '0')).join('');

  const headers = {
    'host': url.host,
    'x-amz-content-sha256': hashHex,
    'x-amz-date': date,
    'content-type': contentType || 'application/octet-stream'
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  
  const canonicalRequest = [method, url.pathname, url.searchParams.toString(), canonicalHeaders, signedHeaders, hashHex].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', date, `${dateShort}/${region}/${service}/aws4_request`, Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest)))).map(b => b.toString(16).padStart(2, '0')).join('')].join('\n');

  const hmac = async (key, data) => {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  };

  const kDate = await hmac(new TextEncoder().encode('AWS4' + secretKey), dateShort);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = Array.from(await hmac(kSigning, stringToSign)).map(b => b.toString(16).padStart(2, '0')).join('');

  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${dateShort}/${region}/${service}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
