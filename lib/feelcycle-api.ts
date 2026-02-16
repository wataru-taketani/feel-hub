/**
 * FEELCYCLE API通信の抽象化
 *
 * m.feelcycle.com のAPI（Laravel製）と通信する。
 * 認証: laravel_session cookie + XSRF-TOKEN cookie + X-CSRF-TOKEN header + X-Requested-With header
 */

const BASE_URL = 'https://m.feelcycle.com';

export interface FeelcycleSession {
  laravelSession: string;
  xsrfToken: string;
  csrfToken: string; // <meta name="csrf-token"> から取得
}

export interface MypageInfo {
  displayName: string;
  homeStore: string;
  membershipType: string;
  totalAttendance: number;
  reservationCount: number;
  ownedTicketCount: number;
  monthlyClubFee: number | null;
  longPlan: { name: string; discountEndDate: string } | null;
}

export interface ReservationInfo {
  date: string;
  startTime: string;
  endTime: string;
  programName: string;
  instructor: string;
  studio: string;
  sheetNo: string;
  ticketName: string;
  bgColor: string;
  textColor: string;
  playlistUrl: string;
  cancelWaitTotal: number;
  cancelWaitPosition: number;
  paymentMethod: number;
}

export interface TicketInfo {
  name: string;
  totalCount: number;
  details: { expiresAt: string; count: number }[];
}

export interface SeatMapBike {
  x: number;
  y: number;
  status: number; // 1=reserved, 2=available
}

export interface SeatMapData {
  bikes: Record<string, SeatMapBike>;
  instructor: { x: number; y: number } | null;
  mapImageUrl: string;
  mapWidth: number;
  mapHeight: number;
  instructorImageUrl: string;
}

export interface HistoryRecord {
  shiftDate: string;
  startTime: string;
  endTime: string;
  storeName: string;
  instructorName: string;
  programName: string;
  sheetNo: string;
  ticketName: string;
  playlistUrl: string;
  cancelFlg: number;
}

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'X-Requested-With': 'XMLHttpRequest',
};

/**
 * レスポンスからSet-Cookieヘッダーを配列で取得
 */
function parseCookies(res: Response): string[] {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie();
    if (cookies.length > 0) return cookies;
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return [];
  return raw.split(/,(?=\s*(?:XSRF-TOKEN|laravel_session)=)/i).map(s => s.trim());
}

/**
 * Set-Cookieヘッダーからcookie名=値を抽出
 */
function extractCookieValues(cookies: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const cookie of cookies) {
    const match = cookie.match(/^([^=]+)=([^;]+)/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

/**
 * HTMLからCSRFトークンを抽出
 */
function extractCsrfTokenFromHtml(html: string): string {
  const match = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
  return match ? match[1] : '';
}

/**
 * FEELCYCLEにログイン
 *
 * 1. GET / → XSRF-TOKEN + laravel_session 取得
 * 2. POST /api/user/login → 認証
 * 3. GET /mypage → 認証済みHTML取得 → <meta csrf-token> 取得
 */
export async function login(email: string, password: string): Promise<FeelcycleSession> {
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

  // ログインレスポンスのcookieを更新
  const loginCookies = extractCookieValues(parseCookies(loginRes));
  if (loginCookies['laravel_session']) laravelSession = loginCookies['laravel_session'];
  if (loginCookies['XSRF-TOKEN']) xsrfToken = decodeURIComponent(loginCookies['XSRF-TOKEN']);

  // result_codeチェック（200でもresult_code !== 0なら失敗）
  if (loginRes.status === 200) {
    const body = await loginRes.json().catch(() => null);
    if (!body || body.result_code !== 0) {
      const msg = body?.message || 'IDもしくはパスワードが異なります。';
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  } else if (loginRes.status !== 302) {
    throw new Error(`ログインに失敗しました (${loginRes.status})`);
  }

  // Step 3: ログイン後のHTMLページからCSRFトークンを取得
  const cookieHeader = `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; laravel_session=${laravelSession}`;
  const pageRes = await fetch(`${BASE_URL}/mypage`, {
    headers: { ...COMMON_HEADERS, 'Cookie': cookieHeader },
  });

  // HTMLページのSet-Cookieも反映
  const pageCookies = extractCookieValues(parseCookies(pageRes));
  if (pageCookies['laravel_session']) laravelSession = pageCookies['laravel_session'];
  if (pageCookies['XSRF-TOKEN']) xsrfToken = decodeURIComponent(pageCookies['XSRF-TOKEN']);

  const html = await pageRes.text();
  const csrfToken = extractCsrfTokenFromHtml(html);

  if (!csrfToken) {
    throw new Error('ログイン後のCSRFトークン取得に失敗しました');
  }

  return { laravelSession, xsrfToken, csrfToken };
}

function buildCookieHeader(session: FeelcycleSession): string {
  return `XSRF-TOKEN=${encodeURIComponent(session.xsrfToken)}; laravel_session=${session.laravelSession}`;
}

function buildHeaders(session: FeelcycleSession): Record<string, string> {
  return {
    ...COMMON_HEADERS,
    'X-XSRF-TOKEN': session.xsrfToken,
    'X-CSRF-TOKEN': session.csrfToken,
    'Cookie': buildCookieHeader(session),
    'Accept': 'application/json',
    'Referer': `${BASE_URL}/reserved/top`,
  };
}

/**
 * マイページ生データを取得（/api/user/mypage - POST）
 */
async function fetchMypageRaw(session: FeelcycleSession): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/user/mypage`, {
    method: 'POST',
    headers: buildHeaders(session),
  });

  if (res.status === 401 || res.status === 302 || res.status === 403) {
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    throw new Error(`マイページ取得失敗 (${res.status})`);
  }

  return await res.json();
}

/**
 * マイページ情報を取得
 */
export async function getMypage(session: FeelcycleSession): Promise<MypageInfo> {
  const data = await fetchMypageRaw(session);
  return parseMypageData(data);
}

function parseMypageData(data: Record<string, unknown>): MypageInfo {
  const longPlanRaw = data.long_plan as Record<string, unknown> | null;
  // store は配列 (例: ["銀座（GNZ）"])
  const storeRaw = data.store;
  const homeStore = Array.isArray(storeRaw) ? String(storeRaw[0] || '') : String(storeRaw || '');
  return {
    displayName: String(data.member_name || ''),
    homeStore,
    membershipType: String(data.member_type || data.memtype_name || ''),
    totalAttendance: Number(data.total_attendance_num || 0),
    reservationCount: Number(data.reservation_num || 0),
    ownedTicketCount: Number(data.owned_ticket_num || 0),
    monthlyClubFee: data.monthly_club_fee != null ? Number(data.monthly_club_fee) : null,
    longPlan: longPlanRaw ? {
      name: String(longPlanRaw.name || ''),
      discountEndDate: String(longPlanRaw.discount_end_date || ''),
    } : null,
  };
}

/**
 * マイページ+予約一覧を一括取得（1回のAPI呼び出しで両方返す）
 */
export async function getMypageWithReservations(session: FeelcycleSession): Promise<{
  mypage: MypageInfo;
  reservations: ReservationInfo[];
}> {
  const data = await fetchMypageRaw(session);
  const mypage = parseMypageData(data);

  const rawList = (data.reservation_status || []) as Record<string, unknown>[];
  const reservations: ReservationInfo[] = rawList.map((r) => {
    // teacher_name_list は [{name: "..."}] 形式
    const teachers = (r.teacher_name_list || []) as { name: string }[];
    const instructorName = teachers.map(t => t.name).join(', ');

    return {
      date: String(r.lesson_date || '').replace(/\//g, '-'),
      startTime: String(r.lesson_start_time || '').slice(0, 5),
      endTime: String(r.lesson_end_time || '').slice(0, 5),
      programName: String(r.lesson_name || ''),
      instructor: instructorName,
      studio: String(r.reservation_store || ''),
      sheetNo: String(r.sheet_num || ''),
      ticketName: String(r.ticket_name || ''),
      bgColor: String(r.ibgcol || ''),
      textColor: String(r.itxtcol || ''),
      playlistUrl: String(r.playlist_path || ''),
      cancelWaitTotal: Number(r.cancel_total_num || 0),
      cancelWaitPosition: Number(r.cancel_my_num || 0),
      paymentMethod: Number(r.payment_method || 0),
    };
  });

  return { mypage, reservations };
}

/**
 * YYYYMMDD → YYYY/MM/DD
 */
function formatTicketExpiry(raw: string): string {
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}/${raw.slice(4, 6)}/${raw.slice(6, 8)}`;
  }
  return raw;
}

/**
 * チケット情報を取得（/api/user/mypage/ticket - POST）
 */
export async function getTickets(session: FeelcycleSession): Promise<TicketInfo[]> {
  const res = await fetch(`${BASE_URL}/api/user/mypage/ticket`, {
    method: 'POST',
    headers: buildHeaders(session),
  });

  if (res.status === 401 || res.status === 302) {
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    throw new Error(`チケット取得失敗 (${res.status})`);
  }

  const data = await res.json();
  const list = (data.tickets || []) as Record<string, unknown>[];

  return list.map((t) => {
    const details = (t.detail || []) as { expire: string; lot: number }[];
    return {
      name: String(t.name || ''),
      totalCount: Number(t.lot || 0),
      details: details.map(d => ({
        expiresAt: formatTicketExpiry(String(d.expire || '')),
        count: Number(d.lot || 0),
      })),
    };
  });
}

/**
 * 受講履歴を取得（月指定）
 * targetYm: 'YYYYMM' 形式（ダッシュなし）
 */
export async function getLessonHistory(
  session: FeelcycleSession,
  targetYm: string
): Promise<HistoryRecord[]> {
  // YYYY-MM → YYYYMM に正規化
  const ym = targetYm.replace('-', '');

  const res = await fetch(`${BASE_URL}/api/auth/user/lesson_hist`, {
    method: 'POST',
    headers: { ...buildHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_ym: ym }),
  });

  if (res.status === 401 || res.status === 302) {
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    throw new Error(`受講履歴取得失敗 (${res.status})`);
  }

  const data = await res.json();

  // レスポンスは { "YYYYMM": { "lesson_info": [...] }, ... } 形式
  const monthData = data[ym] as Record<string, unknown> | undefined;
  const list = (monthData?.lesson_info || []) as Record<string, unknown>[];

  return list.map((h) => {
    // instructor_name_list は [{id, name}] 形式の配列
    const instructors = (h.instructor_name_list || []) as { name: string }[];
    const instructorName = Array.isArray(instructors)
      ? instructors.map(t => t.name).join(', ')
      : String(instructors);

    return {
      shiftDate: String(h.shift_date || '').replace(/\//g, '-'),
      startTime: String(h.ls_st || '').slice(0, 5),
      endTime: String(h.ls_et || '').slice(0, 5),
      storeName: String(h.store_name || ''),
      instructorName,
      programName: String(h.iname || ''),
      sheetNo: String(h.sheet_no || ''),
      ticketName: String(h.ticket_name || ''),
      playlistUrl: String(h.playlist_url || ''),
      cancelFlg: Number(h.cancel_flg || 0),
    };
  });
}

/**
 * 座席マップ情報を取得（/api/reservation/modal/{sidHash} - GET）
 */
export interface ReserveResult {
  resultCode: number;
  message: string;
  raw: Record<string, unknown>;
}

/**
 * 通常レッスン予約 POST /api/reservation/normal
 */
export async function reserveLesson(
  session: FeelcycleSession,
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

/**
 * 予約確定（2ステップ目） POST /api/reservation/normal/completion
 * rc=303 の後、チケット消費確認や他店利用案内を経て予約を確定する
 */
export async function reserveCompletion(
  session: FeelcycleSession,
  tmpLessonId: string,
  ticketType?: number
): Promise<ReserveResult> {
  const body: Record<string, unknown> = { tmp_lesson_id: tmpLessonId };
  if (ticketType !== undefined) {
    body.ticket_type = ticketType;
  }

  const res = await fetch(`${BASE_URL}/api/reservation/normal/completion`, {
    method: 'POST',
    headers: {
      ...buildHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

export async function getSeatMap(session: FeelcycleSession, sidHash: string): Promise<SeatMapData> {
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

  // mappting_addr からバイク座標とインストラクター座標を取得
  const mappingAddr = data.mappting_addr || data.mapping_addr || {};
  const bikePositions = (mappingAddr.bikes || {}) as Record<string, { x: number; y: number }>;
  const instructorPos = mappingAddr.instructor as { x: number; y: number } | null;

  // bike_status_list: { "1": 1, "2": 2, ... } — bikeNo → status(1=reserved, 2=available)
  const rawBikeStatus = (data.bike_status_list || {}) as Record<string, number>;

  // バイク番号 → 座標+ステータスのマップを構築
  const bikes: Record<string, SeatMapBike> = {};
  for (const [bikeNo, status] of Object.entries(rawBikeStatus)) {
    const pos = bikePositions[bikeNo];
    if (!pos) continue;
    bikes[bikeNo] = {
      x: Number(pos.x),
      y: Number(pos.y),
      status: Number(status),
    };
  }

  // マップ画像・寸法
  const mapWidth = Number(data.bike_map_width || 26);
  const mapHeight = Number(data.bike_map_height || 17);
  const mapImageUrl = String(data.bike_map_image_path || '');
  const instructorImageUrl = String(data.instructor_image_path || '');

  return {
    bikes,
    instructor: instructorPos ? { x: Number(instructorPos.x), y: Number(instructorPos.y) } : null,
    mapImageUrl,
    mapWidth,
    mapHeight,
    instructorImageUrl,
  };
}
