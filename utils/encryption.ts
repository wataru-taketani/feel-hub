import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-for-development-only';

/**
 * 暗号化キーを生成（scryptを使用してENCRYPTION_KEYから32バイトの鍵を導出）
 */
function getKey(): Buffer {
  // scryptを使用して32バイトの鍵を導出
  return scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

/**
 * FEELCYCLE認証情報を暗号化
 *
 * @param text - 暗号化するテキスト
 * @returns 暗号化されたテキスト（iv:encrypted の形式）
 *
 * 注意：この実装はcrypto-jsから変更されています。
 * 既存のcrypto-jsで暗号化されたデータは復号できません。
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(16); // AES-256-CBCには16バイトのIVが必要

  const cipher = createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // IVと暗号化テキストを結合（復号時に必要）
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * FEELCYCLE認証情報を復号化
 *
 * @param ciphertext - 暗号化されたテキスト（iv:encrypted の形式）
 * @returns 復号化されたテキスト
 *
 * 注意：この実装はcrypto-jsから変更されています。
 * crypto-jsで暗号化されたデータは復号できません。
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();

  // IVと暗号化テキストを分離
  const parts = ciphertext.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];

  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
