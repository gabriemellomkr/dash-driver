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
  max: 1,                 // Session pooler (free) = 15 conexões no total; 1 por instância dá folga
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
});

// Supavisor envia db_termination ao fechar conexões do pool — é normal, ignora
pool.on('error', (err) => {
  if (err.message && err.message.includes('db_termination')) return;
  console.error('[pool] unexpected error:', err.message);
});

// Conecta com retry. O Session pooler (free) limita a ~15 clientes; sob rajada
// (ex.: burst de webhooks de pagamento) alguns esbarram no limite. Retentamos com
// backoff até uma conexão liberar, evitando 500 em evento de pagamento.
pool.connectWithRetry = async function (retries = 5, baseDelay = 250) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pool.connect();
    } catch (e) {
      const msg = (e && e.message) || '';
      const transient = /max clients|EMAXCONN|too many|Connection terminated|timeout|ECONNRESET/i.test(msg);
      if (attempt >= retries || !transient) throw e;
      await new Promise(r => setTimeout(r, baseDelay * (attempt + 1) + Math.random() * 200));
    }
  }
};

module.exports = pool;
