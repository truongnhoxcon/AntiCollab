const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'realtime_collab',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Max connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('PostgreSQL database pool connected successfully.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = {
  /**
   * Helper to run queries.
   * @param {string} text - SQL Query
   * @param {Array} params - Query parameters
   */
  query: (text, params) => pool.query(text, params),
  
  /**
   * Get a client from pool for transactions.
   */
  getClient: () => pool.connect(),
  
  pool,
};
