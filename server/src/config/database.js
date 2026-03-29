const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'chatters',
  password: process.env.POSTGRES_PASSWORD || 'chatters',
  database: process.env.POSTGRES_DB || 'chatters',
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        public_key TEXT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        name TEXT,
        is_group BOOLEAN NOT NULL DEFAULT FALSE,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_members (
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
        PRIMARY KEY (conversation_id, user_id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        iv TEXT,
        is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id)'
    );
  } finally {
    client.release();
  }
}

module.exports = { pool, initializeDatabase };
