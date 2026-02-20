/**
 * Feel Hub 型定義
 */

// チケット種類（アディショナルレッスン）
export type TicketType = 'WHITE' | 'SILVER' | 'GOLD' | 'PLATINUM' | null;

// レッスン情報
export interface Lesson {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM（APIのlesson_endから取得）
  programName: string;
  instructor: string;
  studio: string;
  isFull: boolean;
  isPast: boolean; // レッスン開始時刻がJST現在時刻より前か
  availableSlots: number; // 残席数
  ticketType: TicketType; // アディショナルレッスンのチケット種類（通常レッスンはnull）
  colorCode: string; // プログラム背景色（例: "#FF9933"）
  textColor: string; // プログラムテキスト色（例: "#FFFFFF"）
  sidHash?: string; // 座席マップ取得用ハッシュ
}

// フィルタプリセット（ユーザーごとに1つ、名前なし）
export interface FilterPreset {
  id: string;
  filters: {
    studios: string[];
    programs: string[];
    instructors: string[];
    ticketFilter: 'ALL' | 'NORMAL' | 'ADDITIONAL';
  };
}

// ブックマークエントリ
export interface BookmarkEntry {
  key: string;
  date: string;
  startTime: string;
  programName: string;
  instructor: string;
  studio: string;
  addedAt: number;
}

// キャンセル待ち登録
export interface WaitlistEntry {
  id: string;
  userId: string;
  lessonId: string;
  createdAt: string;
  notified: boolean;
  autoReserve: boolean;
}

// キャンセル待ち登録（レッスン詳細付き）
export interface WaitlistEntryWithLesson extends WaitlistEntry {
  lesson: Lesson;
}

// ユーザープロフィール
export interface UserProfile {
  id: string;
  displayName: string | null;
  homeStore: string | null;
  membershipType: string | null;
  joinedAt: string | null;
}

// 受講履歴レコード
export interface AttendanceRecord {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  storeName: string;
  instructorName: string;
  programName: string;
  sheetNo: string | null;
  ticketName: string | null;
  playlistUrl: string | null;
  cancelFlg: number;
}

// 予約情報
export interface Reservation {
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

// チケット情報
export interface TicketInfo {
  name: string;
  totalCount: number;
  details: { expiresAt: string; count: number }[];
}

// お気に入り席
export interface SeatPreference {
  studio: string;
  seatNumbers: string[];
}
