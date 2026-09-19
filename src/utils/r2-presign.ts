const REGION = 'auto';
const SERVICE = 's3';
const EXPIRES_IN = 900; // 15 phút

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(parameters: Record<string, string>): string {
  return Object.entries(parameters)
    .map(([name, value]) => [encode(name), encode(value)] as const)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(value: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function hmac(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
}

async function signingKey(secret: string, date: string): Promise<ArrayBuffer> {
  const dateKey = await hmac(new TextEncoder().encode(`AWS4${secret}`), date);
  const regionKey = await hmac(dateKey, REGION);
  const serviceKey = await hmac(regionKey, SERVICE);
  return hmac(serviceKey, 'aws4_request');
}

export interface PresignConfig {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
  config: PresignConfig
): Promise<{ uploadUrl: string; expiresIn: number }> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = `${date}T${now.toISOString().slice(11, 19).replace(/:/g, '')}Z`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${[config.bucket, ...key.split('/')].map(encode).join('/')}`;
  const credential = `${config.accessKeyId}/${date}/${REGION}/${SERVICE}/aws4_request`;
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(EXPIRES_IN),
    'X-Amz-SignedHeaders': 'content-type;host',
  };
  const canonicalRequest = ['PUT', path, canonicalQuery(query), `content-type:${contentType}\nhost:${host}\n`, 'content-type;host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, `${date}/${REGION}/${SERVICE}/aws4_request`, await digest(canonicalRequest)].join('\n');
  const signature = hex(await hmac(await signingKey(config.secretAccessKey, date), stringToSign));
  return { uploadUrl: `https://${host}${path}?${canonicalQuery({ ...query, 'X-Amz-Signature': signature })}`, expiresIn: EXPIRES_IN };
}
