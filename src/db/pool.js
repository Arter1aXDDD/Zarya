const { Pool } = require("pg");
const { env } = require("../config/env");

const pool = new Pool({
    host: env.pgHost,
    port: env.pgPort,
    database: env.pgDatabase,
    user: env.pgUser,
    password: env.pgPassword,
    ssl: env.pgSslMode === "require" ? true : undefined
});

async function pingDatabase() {
    const client = await pool.connect();

    try {
        await client.query("SELECT 1");
    }
    finally {
        client.release();
    }
}

module.exports = { pool, pingDatabase };
