const { Pool } = require('pg');

// Conexão direta ao Postgres do Supabase Dash Driver (porta 54323 = Supavisor)
// Bypassa Kong completamente — sem bloqueio de IP do Vercel
const pool = new Pool({
  host:     process.env.DB_HOST || '87.99.151.178',
  port:     parseInt(process.env.DB_PORT || '54323'),
  database: process.env.DB_NAME || 'postgres',
  user:     process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'Etb013118.',
  ssl:      { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
