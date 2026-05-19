const { Pool } = require('pg');

// Conexão ao Postgres via Supavisor (porta 54323, tenant: your-tenant-id)
// Bypassa Kong completamente — sem bloqueio de IP do Vercel
const pool = new Pool({
  host:     process.env.DB_HOST     || '87.99.151.178',
  port:     parseInt(process.env.DB_PORT || '54323'),
  database: process.env.DB_NAME     || 'postgres',
  user:     process.env.DB_USER     || 'postgres.your-tenant-id',
  password: process.env.DB_PASS     || 'Etb013118.',
  ssl:      false,
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
