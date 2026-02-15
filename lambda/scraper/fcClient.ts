/**
 * FEELCYCLE API クライアント（Lambda用）
 *
 * lib/feelcycle-api.ts + lib/crypto.ts からポートした認証・予約機能
 */

import { createDecipheriv, createHmac } from 'crypto';

const BASE_URL = 'https://m.feelcycle.com';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'X-Requested-With': 'XMLHttpRequest',
};

export interface FcSession {
  laravelSession: string;
  xsrfToken: string;
  csrfToken: string;
}

export interface SeatMapBike {
  status: number; // 1=reserved, 2=available
}

// ── 暗号化 ──

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY is not set');
  return createHmac('sha256', 'feelhub-encryption').update(key).digest();
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ── Cookie ──

function parseCookies(res: Response): string[] {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie();
    if (cookies.length > 0) return cookies;
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*(?:XSRF-TOKEN|laravel_session)=)/i).map(s => s.trim());
}

function extractCookieValues(cookies: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const cookie of cookies) {
    const match = cookie.match(/^([^=]+)=([^;]+)/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function buildCookieHeader(session: FcSession): string {
  return `XSRF-TOKEN=${encodeURIComponent(session.xsrfToken)}; laravel_session=${session.laravelSession}`;
}

function buildHeaders(session: FcSession): Record<string, string> {
  return {
    ...COMMON_HEADERS,
    'X-XSRF-TOKEN': session.xsrfToken,
    'X-CSRF-TOKEN': session.csrfToken,
    'Cookie': buildCookieHeader(session),
    'Accept': 'application/json',
    'Referer': `${BASE_URL}/reserved/top`,
  };
}

// ── 認証 ──

export async function login(email: string, password: string): Promise<FcSession> {
  // Step 1: CSRFトークン取得
  const initRes = await fetch(`${BASE_URL}/`, {
    redirect: 'manual',
    headers: COMMON_HEADERS,
  });
  const initCookies = extractCookieValues(parseCookies(initRes));
  let xsrfToken = decodeURIComponent(initCookies['XSRF-TOKEN'] || '');
  let laravelSession = initCookies['laravel_session'] || '';
  if (!xsrfToken || !laravelSession) {
    throw new Error('CSRFトークンの取得に失敗しました');
  }

  // Step 2: ログイン
  const loginRes = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      ...COMMON_HEADERS,
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': xsrfToken,
      'Cookie': `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; laravel_session=${laravelSession}`,
    },
    body: JSON.stringify({ mail_address: email, login_pass: password, auto_login: 0 }),
  });
  const loginCookies = extractCookieValues(parseCookies(loginRes));
  if (loginCookies['laravel_session']) laravelSession = loginCookies['laravel_session'];
  if (loginCookies['XSRF-TOKEN']) xsrfToken = decodeURIComponent(loginCookies['XSRF-TOKEN']);

  if (loginRes.status === 200) {
    const body = await loginRes.json().catch(() => null);
    if (!body || body.result_code !== 0) {
      const msg = body?.message || 'IDもしくはパスワードが異なります。';
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  } else if (loginRes.status !== 302) {
    throw new Error(`ログインに失敗しました (${loginRes.status})`);
  }

  // Step 3: mypage から csrf-token 取得
  const cookieHeader = `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; laravel_session=${laravelSession}`;
  const pageRes = await fetch(`${BASE_URL}/mypage`, {
    headers: { ...COMMON_HEADERS, 'Cookie': cookieHeader },
  });
  const pageCookies = extractCookieValues(parseCookies(pageRes));
  if (pageCookies['laravel_session']) laravelSession = pageCookies['laravel_session'];
  if (pageCookies['XSRF-TOKEN']) xsrfToken = decodeURIComponent(pageCookies['XSRF-TOKEN']);

  const html = await pageRes.text();
  const csrfMatch = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';
  if (!csrfToken) {
    throw new Error('ログイン後のCSRFトークン取得に失敗しました');
  }

  return { laravelSession, xsrfToken, csrfToken };
}

// ── 座席マップ ──

export async function getSeatMap(
  session: FcSession,
  sidHash: string
): Promise<Record<string, SeatMapBike>> {
  const res = await fetch(`${BASE_URL}/api/reservation/modal/${sidHash}`, {
    headers: buildHeaders(session),
  });
  if (res.status === 401 || res.status === 302 || res.status === 403) {
    throw new Error('SESSION_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(`座席マップ取得失敗 (${res.status})`);
  }
  const data = await res.json();
  const rawBikeStatus = (data.bike_status_list || {}) as Record<string, number>;

  const bikes: Record<string, SeatMapBike> = {};
  for (const [bikeNo, status] of Object.entries(rawBikeStatus)) {
    bikes[bikeNo] = { status: Number(status) };
  }
  return bikes;
}

// ── 予約 ──

export interface ReserveResult {
  resultCode: number;
  message: string;
  raw: Record<string, unknown>;
}

/**
 * 通常レッスン予約 POST /api/reservation/normal
 * S-1ケース: 所属店舗 × 通常レッスン × result_code=0 で成功
 */
export async function reserveLesson(
  session: FcSession,
  sidHash: string,
  sheetNo: string
): Promise<ReserveResult> {
  const res = await fetch(`${BASE_URL}/api/reservation/normal`, {
    method: 'POST',
    headers: {
      ...buildHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sid: sidHash, sheet_no: Number(sheetNo) }),
  });

  if (res.status === 401 || res.status === 302 || res.status === 403) {
    throw new Error('SESSION_EXPIRED');
  }

  const data = await res.json().catch(() => ({ result_code: -1, message: `HTTP ${res.status}` }));
  return {
    resultCode: Number(data.result_code ?? -1),
    message: typeof data.message === 'string' ? data.message : JSON.stringify(data.message ?? ''),
    raw: data,
  };
}
