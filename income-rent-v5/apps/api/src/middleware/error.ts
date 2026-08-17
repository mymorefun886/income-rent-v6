// Error handling middleware
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

export function errorHandler(err: Error, c: Context) {
  console.error('[Error]', err);

  // Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      success: false,
      error: 'Validation Error',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    }, 400);
  }

  // Hono HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: err.message,
    }, err.status);
  }

  // JWT errors
  if (err.name === 'JwtTokenInvalid' || err.name === 'JwtTokenExpired') {
    return c.json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    }, 401);
  }

  // Default 500
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  }, 500);
}

export function notFoundHandler(c: Context) {
  return c.json({
    success: false,
    error: 'Not Found',
    message: `Route ${c.req.path} not found`,
  }, 404);
}
