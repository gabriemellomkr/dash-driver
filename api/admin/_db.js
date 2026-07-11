const { Pool } = require('pg');

// Conexão ao Postgres do Supabase Cloud via Session pooler (porta 5432, IPv4).
// SSL é obrigatório no Cloud.
if (!process.env.DB_HOST || !process.env.DB_PASS || !process.env.DB_USER) {
  throw new Error('Missing required DB environment variables: DB_HOST, DB_USER, DB_PASS');
}

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl:      { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
});

// Supavisor envia db_termination ao fechar conexões do pool — é normal, ignora
pool.on('error', (err) => {
  if (err.message && err.message.includes('db_termination')) return;
  console.error('[pool] unexpected error:', err.message);
});

module.exports = pool;
