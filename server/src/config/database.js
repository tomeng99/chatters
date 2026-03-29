const { Pool } = require('pg');

const poolConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,
  user: process.env.POSTGRES_USER || 'chatters',
  password: process.env.POSTGRES_PASSWORD || 'chatters',
  database: process.env.POSTGRES_DB || 'chatters',
  max: parseInt(process.env.POSTGRES_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECT_TIMEOUT) || 5000,
};

if (process.env.POSTGRES_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

const pool = new Pool(poolConfig);

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
        message_type TEXT NOT NULL DEFAULT 'text',
        file_name TEXT,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Add message_type and file_name columns if they don't exist (migration for existing DBs)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'messages'
            AND column_name = 'message_type'
        ) THEN
          ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'messages'
            AND column_name = 'file_name'
        ) THEN
          ALTER TABLE messages ADD COLUMN file_name TEXT;
        END IF;
      END $$
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS group_keys (
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        nonce TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
        PRIMARY KEY (conversation_id, user_id),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Add encrypted private key columns for cross-device key recovery
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users'
            AND column_name = 'encrypted_private_key'
        ) THEN
          ALTER TABLE users ADD COLUMN encrypted_private_key TEXT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users'
            AND column_name = 'key_salt'
        ) THEN
          ALTER TABLE users ADD COLUMN key_salt TEXT;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users'
            AND column_name = 'key_nonce'
        ) THEN
          ALTER TABLE users ADD COLUMN key_nonce TEXT;
        END IF;
      END $$
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
