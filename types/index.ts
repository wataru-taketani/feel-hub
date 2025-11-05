/**
 * Feel Hub 型定義
 */

// レッスン情報
export interface Lesson {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  programName: string;
  instructor: string;
  studio: string;
  availableSlots: number;
  totalSlots: number;
  isFull: boolean;
  url: string; // FEELCYCLE予約ページURL
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
