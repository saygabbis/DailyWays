import { createRemoteJWKSet, jwtVerify } from 'jose';

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
let jwks;

function getJwks() {
  if (!supabaseUrl) return null;
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }
  return jwks;
}

/** Verifica access_token do usuário via JWKS (não depende da service_role). */
export async function verifyUserJwt(token) {
  if (!token || !supabaseUrl) return null;
  const keys = getJwks();
  if (!keys) return null;
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `${supabaseUrl}/auth/v1`,
    });
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') return null;
    return {
      id: sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}
