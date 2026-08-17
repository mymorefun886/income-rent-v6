// Script to update admin user credentials
import { createClient } from '@libsql/client';
import { resolve } from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = resolve(process.cwd(), 'storage/rental.db');
console.log('[Update User] DB path:', DB_PATH);

async function updateUser() {
  const client = createClient({ url: `file:${DB_PATH}` });

  const newUsername = 'morefun886';
  const newPassword = 'Mf848886';

  // Check if user exists
  const existing = await client.execute({
    sql: 'SELECT id, username FROM users WHERE role = ?',
    args: ['admin'],
  });

  if (existing.rows.length === 0) {
    console.log('[Update User] No admin user found, creating...');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const id = crypto.randomUUID();
    await client.execute({
      sql: 'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      args: [id, newUsername, passwordHash, 'admin'],
    });
    console.log(`[Update User] Created admin user: ${newUsername}`);
  } else {
    const userId = existing.rows[0].id;
    const oldUsername = existing.rows[0].username;
    console.log(`[Update User] Updating user "${oldUsername}" -> "${newUsername}"`);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await client.execute({
      sql: 'UPDATE users SET username = ?, password_hash = ? WHERE id = ?',
      args: [newUsername, passwordHash, userId],
    });
    console.log(`[Update User] Updated credentials for user: ${newUsername}`);
  }

  // If new username differs from old, check for conflicts
  const conflictCheck = await client.execute({
    sql: 'SELECT id FROM users WHERE username = ?',
    args: [newUsername],
  });

  if (conflictCheck.rows.length > 1) {
    console.warn('[Update User] Warning: Multiple users with same username detected');
  }

  console.log('[Update User] Done!');
  console.log(`[Update User] Username: ${newUsername}`);
  console.log(`[Update User] Password: ${newPassword}`);

  await client.close();
}

import { randomUUID as crypto_randomUUID } from 'crypto';
// Use randomUUID from crypto
const crypto = { randomUUID: crypto_randomUUID };

updateUser().catch(err => {
  console.error('[Update User] Error:', err);
  process.exit(1);
});
