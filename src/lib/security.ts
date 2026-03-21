import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this-in-production';

/**
 * Хешировать пароль при первом запуске
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Проверить пароль
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Создать JWT токен для аутентификации
 */
export function createToken(userId: string = 'user'): string {
  return jwt.sign(
    {
      userId,
      authenticated: true,
      timestamp: Date.now(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 часа
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

/**
 * Проверить JWT токен
 */
export function verifyToken(token: string): { valid: boolean; userId?: string; error?: string } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return { valid: true, userId: decoded.userId };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

/**
 * Проверить пароль и вернуть токен
 */
export async function authenticate(
  password: string,
  passwordHash: string
): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  try {
    const isValid = await verifyPassword(password, passwordHash);

    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }

    const token = createToken();
    return { success: true, token };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Генерировать encryption key для БД
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Шифровать данные пациентов для БД
 */
export function encryptSensitiveData(data: string, encryptionKey: string): string {
  try {
    if (!encryptionKey || encryptionKey === '') {
      console.warn('⚠️ Encryption key is empty - data will NOT be encrypted!');
      return data;
    }

    const key = Buffer.from(encryptionKey, 'hex');
    if (key.length !== 32) {
      console.warn('⚠️ Encryption key must be 32 bytes (256 bits)');
      return data;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Возвращать IV:encrypted для последующего расшифрования
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return data;
  }
}

/**
 * Расшифровать данные пациентов из БД
 */
export function decryptSensitiveData(encryptedData: string, encryptionKey: string): string {
  try {
    if (!encryptionKey || encryptionKey === '') {
      return encryptedData;
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      return encryptedData;
    }

    const key = Buffer.from(encryptionKey, 'hex');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedData;
  }
}

/**
 * Логировать API запросы для аудита
 */
export interface ApiLog {
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  userId?: string;
  ip: string;
  duration: number;
}

export function logApiCall(
  method: string,
  endpoint: string,
  statusCode: number,
  ip: string,
  duration: number,
  userId?: string
): void {
  if (process.env.LOG_API_CALLS !== 'true') return;

  const log: ApiLog = {
    timestamp: new Date().toISOString(),
    method,
    endpoint,
    statusCode,
    ip: ip || 'unknown',
    duration,
    userId: userId || 'anonymous',
  };

  console.log(`[API_LOG] ${JSON.stringify(log)}`);
}

/**
 * Валидировать пароль (минимальные требования)
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Санитизировать строки (защита от XSS/SQL инъекций)
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  return input
    .slice(0, maxLength)
    .replace(/[<>\"']/g, '')
    .trim();
}

/**
 * Получить сохранённый токен (для фронтенда)
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Сохранить токен после логина (для фронтенда)
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
}

/**
 * Удалить токен при выходе (для фронтенда)
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
}

/**
 * Выполнить запрос с JWT токеном (для фронтенда)
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated. Please login.');
  }

  const headers = {
    ...(options.headers || {}),
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    clearAuthToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  return response;
}
