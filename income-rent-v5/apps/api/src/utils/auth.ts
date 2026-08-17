// Authentication utilities
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { users, sessions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me');
const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Password Hashing ──
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── JWT Token Generation ──
export async function generateAccessToken(userId: string, username: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, username, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<{ sub: string; username: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

// ── Refresh Token (Session) ──
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);

  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    token,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function verifySession(token: string): Promise<string | null> {
  const result = await db.query.sessions.findFirst({
    where: eq(sessions.token, token),
  });

  if (!result) return null;

  // Check expiry
  if (new Date() > result.expiresAt) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }

  return result.userId;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

// ── User Management ──
export async function createUser(username: string, password: string, role: string = 'viewer') {
  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    throw new Error('Username already exists');
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  await db.insert(users).values({
    id,
    username,
    passwordHash,
    role,
  });

  return { id, username, role };
}

export async function authenticateUser(username: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

  return user;
}

// ── Default Admin User ──
export async function ensureAdminUser() {
  const existing = await db.query.users.findFirst({
    where: eq(users.role, 'admin'),
  });

  if (!existing) {
    console.log('[Auth] Creating default admin user...');
    await createUser(
      process.env.ADMIN_USERNAME || 'admin',
      process.env.ADMIN_PASSWORD || 'changeme',
      'admin'
    );
    console.log('[Auth] Default admin created (username: admin, password: changeme)');
    console.log('[Auth] ⚠️  Please change the default password after first login!');
  }
}
