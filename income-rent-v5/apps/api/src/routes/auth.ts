// Auth routes - login, logout, refresh, me
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authenticateUser, generateAccessToken, createSession, verifySession, deleteSession } from '../utils/auth.js';
import { jwt } from 'hono/jwt';

export const authRouter = new Hono();

// ── Schemas ──
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// ── POST /api/auth/login ──
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const { username, password } = c.req.valid('json');

  try {
    const user = await authenticateUser(username, password);

    // Generate tokens
    const accessToken = await generateAccessToken(user.id, user.username, user.role);
    const session = await createSession(user.id);

    return c.json({
      success: true,
      data: {
        accessToken,
        refreshToken: session.token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Invalid credentials',
    }, 401);
  }
});

// ── POST /api/auth/logout ──
authRouter.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await deleteSession(token);
  }

  return c.json({ success: true, message: 'Logged out' });
});

// ── POST /api/auth/refresh ──
authRouter.post('/refresh', async (c) => {
  const body = await c.req.json();
  const refreshToken = body.refreshToken;

  if (!refreshToken) {
    return c.json({ success: false, error: 'Refresh token required' }, 400);
  }

  const userId = await verifySession(refreshToken);
  if (!userId) {
    return c.json({ success: false, error: 'Invalid refresh token' }, 401);
  }

  // Get user info
  const { db } = await import('../db/index.js');
  const { users } = await import('../db/schema.js');
  const { eq } = await import('drizzle-orm');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Generate new access token
  const accessToken = await generateAccessToken(user.id, user.username, user.role);

  return c.json({
    success: true,
    data: { accessToken },
  });
});

// ── GET /api/auth/me ──
authRouter.get('/me', jwt({
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  alg: 'HS256',
}), async (c) => {
  const payload = c.get('jwtPayload');

  return c.json({
    success: true,
    data: {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    },
  });
});

// ── POST /api/auth/change-password ──
authRouter.post('/change-password', jwt({
  secret: process.env.JWT_SECRET || 'dev-secret-change-me',
  alg: 'HS256',
}), async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return c.json({ success: false, error: 'Both passwords required' }, 400);
  }

  const { db } = await import('../db/index.js');
  const { users } = await import('../db/schema.js');
  const { eq } = await import('drizzle-orm');
  const { verifyPassword, hashPassword } = await import('../utils/auth.js');

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub as string),
  });

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return c.json({ success: false, error: 'Current password is incorrect' }, 401);
  }

  const newHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  return c.json({ success: true, message: 'Password changed successfully' });
});
