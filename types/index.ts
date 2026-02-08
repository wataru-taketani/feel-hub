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
}

// フィルタプリセット
export interface FilterPreset {
  id: string;
  name: string;
  filters: {
    studios: string[];
    programSearch: string;
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
  autoReserve: boolean; // 自動予約するかどうか
}

// ユーザー情報
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// FEELCYCLE認証情報（暗号化して保存）
export interface FeelcycleCredentials {
  id: string;
  userId: string;
  email: string; // 暗号化済み
  password: string; // 暗号化済み
  lineNotifyToken?: string; // LINE通知トークン
  updatedAt: string;
}

// 受講履歴
export interface AttendanceHistory {
  id: string;
  userId: string;
  lessonDate: string;
  programName: string;
  instructor: string;
  studio: string;
  createdAt: string;
}

// プラン情報
export interface MembershipPlan {
  id: string;
  userId: string;
  planName: string; // 例: "マンスリー15"
  monthlyLimit: number; // 月間受講可能数
  currentMonth: string; // YYYY-MM
  usedCount: number; // 当月の受講数
}
