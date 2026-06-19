const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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

// Add database schema production migration function
async function runProductionMigration() {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    console.log('[Migration] Checking if database requires schema migration...');
    // Check if 'users' table exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    const usersTableExists = checkResult.rows[0]?.exists;

    if (!usersTableExists) {
      console.log('[Migration] Table "users" does not exist. Running database migration...');
      
      let schemaPath = path.join(__dirname, '..', 'models', 'schema.sql');
      
      if (!fs.existsSync(schemaPath)) {
        schemaPath = path.resolve(process.cwd(), 'apps', 'backend-core', 'src', 'models', 'schema.sql');
      }

      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('[Migration] Database migration schema executed successfully.');
      } else {
        throw new Error(`schema.sql file not found at: ${schemaPath}`);
      }
    } else {
      console.log('[Migration] Database is already initialized. Skipping migration.');
    }
  } catch (error) {
    console.error('[Migration] Database migration failed:', error);
  }
}

// Auto-bootstrap database schema on startup
(async () => {
  if (process.env.NODE_ENV === 'production') {
    await runProductionMigration();
  } else {
    // Local development auto-bootstrap
    try {
      const schemaPath = path.join(__dirname, '..', 'models', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('[Database Bootstrap] PostgreSQL schema initialized/verified successfully.');
      } else {
        console.warn(`[Database Bootstrap] Warning: schema.sql file not found at: ${schemaPath}`);
      }
    } catch (error) {
      console.error('[Database Bootstrap] PostgreSQL schema initialization failed:', error.message);
    }
  }
})();

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

