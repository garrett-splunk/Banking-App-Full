import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload, UserRole } from './types.js';

export function signAccessToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: SignOptions['expiresIn'] = '15m'
): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function signRefreshToken(
  userId: string,
  secret: string,
  expiresIn: SignOptions['expiresIn'] = '7d'
): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, secret, { expiresIn });
}

export function verifyAccessToken(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret) as JwtPayload & { type?: string };
  if (decoded.type === 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
}

export function verifyRefreshToken(token: string, secret: string): { sub: string } {
  const decoded = jwt.verify(token, secret) as { sub: string; type?: string };
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return { sub: decoded.sub };
}

export function createJwtPayload(
  userId: string,
  email: string,
  role: UserRole,
  mfaVerified = false
): JwtPayload {
  return { sub: userId, email, role, mfaVerified };
}
