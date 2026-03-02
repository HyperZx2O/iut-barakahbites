require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const morgan = require('morgan');

const app = express();
app.use(express.json());

// CORS config
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const { validateEnv } = require('../shared/configValidator');
validateEnv(['REDIS_URL', 'DATABASE_URL']);

const { metricsMiddleware, getMetrics } = require('../shared/metrics');
const { tracingMiddleware } = require('../shared/tracing');
app.use(tracingMiddleware);
app.use(metricsMiddleware);

if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// Environment variables
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://devsprint:devsprint@localhost:54320/cafeteria';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// PostgreSQL pool
const pool = new Pool({ connectionString: DATABASE_URL });

async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS stock (
                item_id VARCHAR PRIMARY KEY,
                name VARCHAR NOT NULL,
                quantity INT NOT NULL DEFAULT 0,
                price INT NOT NULL DEFAULT 0,
                contents JSONB DEFAULT '[]',
                version INT NOT NULL DEFAULT 0
            );
        `);
        // We will alter table if columns are missing for existing databases
        await pool.query(`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price INT NOT NULL DEFAULT 0;`);
        await pool.query(`ALTER TABLE stock ADD COLUMN IF NOT EXISTS contents JSONB DEFAULT '[]';`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS processed_orders (
                order_id VARCHAR PRIMARY KEY,
                item_id VARCHAR,
                quantity INT,
                processed_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // Seed all menu items at 100 stock (resets on restart — safe for demo)
        const seedItems = [
            ['iftar-box-1', 'Box 1', 100, 250, JSON.stringify(['Dates (03 pcs)', 'Banana (01 pc)', 'Muri (01 cup)', 'SMC Electrolyte Drink - Lemon (01 pc)', 'Beef Biriyani (01 pkt)', 'Chicken Fry (01 pc)', 'Payesh (01 cup)'])],
            ['iftar-box-2', 'Box 2', 100, 250, JSON.stringify(['Dates (03 pcs)', 'Orange (01 pc)', 'Muri (01 cup)', 'Murg Polao (01 pkt)', 'Beef Halim (01 pkt)', 'Samucha (01 pc)', 'Labang (01 pc)'])],
            ['jilapi', 'Jilapi', 100, 10, '[]'],
            ['dates', 'Dates', 100, 15, '[]'],
            ['piyaju', 'Piyaju', 100, 10, '[]'],
            ['beguni', 'Beguni', 100, 15, '[]'],
            ['chop', 'Chop', 100, 20, '[]'],
            ['juice', 'Juice', 100, 30, '[]'],
            ['parata', 'Parata', 100, 10, '[]'],
            ['chicken-biriyani', 'Chicken Biriyani', 100, 100, '[]'],
            ['halim', 'Halim', 100, 50, '[]'],
            ['beef-biriyani', 'Beef Biriyani', 100, 150, '[]'],
            ['chola', 'Chola', 100, 20, '[]'],
        ];

        for (const [id, name, qty, price, contents] of seedItems) {
            await pool.query(
                `INSERT INTO stock (item_id, name, quantity, price, contents, version) VALUES ($1, $2, $3, $4, $5, 1)
                 ON CONFLICT (item_id) DO UPDATE SET name = EXCLUDED.name, quantity = EXCLUDED.quantity, price = EXCLUDED.price, contents = EXCLUDED.contents`,
                [id, name, qty, price, contents]
            );
        }

        console.log('Stock Service Database initialized & seeded');
    } catch (err) {
        console.error('Failed to initialize database:', err.message);
    }
}
initDb();

// Redis client
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect().catch((err) => {
    if (process.env.NODE_ENV !== 'test') console.error('Redis error:', err);
});

// Chaos kill flag
let isKilled = false;
const safeRoutes = ['/admin/kill', '/admin/revive', '/health'];
app.use((req, res, next) => {
    if (isKilled && !safeRoutes.includes(req.path)) {
        return res.status(503).json({ error: 'Service is down (chaos mode)' });
    }
    next();
});

// Health endpoint
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        await redisClient.ping();
        res.json({
            status: 'ok',
            service: 'stock-service',
            dependencies: { postgres: 'ok', redis: 'ok' },
            uptime: getMetrics('stock-service').uptime,
            alive: !isKilled
        });
    } catch (e) {
        res.status(503).json({ status: 'degraded', service: 'stock-service', dependencies: { postgres: 'down', redis: 'down' }, alive: !isKilled });
    }
});

app.get('/metrics', (req, res) => {
    res.json(getMetrics('stock-service'));
});

// Get all stock levels
app.get('/stock', async (req, res) => {
    try {
        const result = await pool.query('SELECT item_id, quantity, version, name, price, contents FROM stock');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current stock level
app.get('/stock/:itemId', async (req, res) => {
    const { itemId } = req.params;
    try {
        const result = await pool.query('SELECT quantity FROM stock WHERE item_id=$1', [itemId]);
        if (!result.rowCount) return res.status(404).json({ error: 'Item not found' });
        res.json({ itemId, quantity: result.rows[0].quantity });
    } catch (e) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Decrement stock with optimistic locking and idempotency
app.post('/stock/:itemId/decrement', async (req, res) => {
    const { itemId } = req.params;
    const { quantity = 1, orderId } = req.body;

    if (!orderId) return res.status(400).json({ error: 'orderId required' });
    if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'Positive integer quantity required' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Idempotency check
        const idRes = await client.query('SELECT * FROM processed_orders WHERE order_id=$1', [orderId]);
        if (idRes.rowCount > 0) {
            // Return cached success state without decrementing
            const stockRes = await client.query('SELECT quantity FROM stock WHERE item_id=$1', [itemId]);
            const remaining = stockRes.rowCount ? stockRes.rows[0].quantity : 0;
            await client.query('COMMIT');
            return res.json({ itemId, remaining, decremented: 0 });
        }

        // Optimistic lock loop
        let attempts = 0;
        let updated = false;
        let remaining = 0;

        while (attempts < 3 && !updated) {
            const sel = await client.query('SELECT quantity, version FROM stock WHERE item_id=$1', [itemId]);
            if (!sel.rowCount) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Item not found' });
            }

            const { quantity: curQty, version } = sel.rows[0];
            if (curQty < quantity) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: 'Insufficient stock.' });
            }

            const upd = await client.query(
                'UPDATE stock SET quantity = quantity - $1, version = version + 1 WHERE item_id = $2 AND version = $3',
                [quantity, itemId, version]
            );

            if (upd.rowCount === 1) {
                updated = true;
                remaining = curQty - quantity;
            } else {
                attempts++;
            }
        }

        if (!updated) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Version conflict' });
        }

        // Record processed order to secure idempotency
        await client.query(
            'INSERT INTO processed_orders (order_id, item_id, quantity) VALUES ($1, $2, $3)',
            [orderId, itemId, quantity]
        );

        await client.query('COMMIT');
        res.json({ itemId, remaining, decremented: quantity });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// Replenish stock (admin)
app.post('/stock/:itemId/replenish', async (req, res) => {
    const { itemId } = req.params;
    const { quantity = 0 } = req.body;
    if (!Number.isInteger(quantity) || quantity <= 0) return res.status(400).json({ error: 'Positive quantity required' });
    try {
        const upd = await pool.query(
            'UPDATE stock SET quantity = quantity + $1, version = version + 1 WHERE item_id = $2 RETURNING quantity',
            [quantity, itemId]
        );
        if (!upd.rowCount) {
            // If item doesn't exist, create it
            const insert = await pool.query(
                'INSERT INTO stock (item_id, name, quantity, version) VALUES ($1, $2, $3, 1) RETURNING quantity',
                [itemId, itemId, quantity]
            );
            return res.json({ itemId, added: quantity, remaining: insert.rows[0].quantity });
        }
        res.json({ itemId, added: quantity, remaining: upd.rows[0].quantity });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Set absolute stock quantity
app.post('/stock/:itemId/set', async (req, res) => {
    const { itemId } = req.params;
    const { quantity, name } = req.body;
    if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ error: 'Non-negative integer quantity required' });
    try {
        const upd = await pool.query(
            'UPDATE stock SET quantity = $1, version = version + 1 WHERE item_id = $2 RETURNING quantity, name',
            [quantity, itemId]
        );
        if (!upd.rowCount) return res.status(404).json({ error: 'Item not found' });
        res.json({ itemId, quantity: upd.rows[0].quantity, name: upd.rows[0].name });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Create a new stock item
app.post('/stock', async (req, res) => {
    const { itemId, name, quantity = 0, price, contents } = req.body;
    if (!itemId || !name) return res.status(400).json({ error: 'itemId and name required' });
    if (!Number.isInteger(quantity) || quantity < 0) return res.status(400).json({ error: 'Non-negative integer quantity required' });
    try {
        const result = await pool.query(
            `INSERT INTO stock (item_id, name, quantity, price, contents, version) VALUES ($1, $2, $3, $4, $5, 1)
             ON CONFLICT (item_id) DO UPDATE SET name = EXCLUDED.name, quantity = EXCLUDED.quantity, price = EXCLUDED.price, contents = EXCLUDED.contents
             RETURNING item_id, name, quantity, price, contents`,
            [itemId, name, quantity, price, contents]
        );
        res.status(201).json({ item: result.rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Update item name/metadata
app.patch('/stock/:itemId', async (req, res) => {
    const { itemId } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const upd = await pool.query(
            'UPDATE stock SET name = $1 WHERE item_id = $2 RETURNING item_id, name, quantity',
            [name, itemId]
        );
        if (!upd.rowCount) return res.status(404).json({ error: 'Item not found' });
        res.json({ item: upd.rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin: Delete a stock item
app.delete('/stock/:itemId', async (req, res) => {
    const { itemId } = req.params;
    try {
        const del = await pool.query('DELETE FROM stock WHERE item_id = $1 RETURNING item_id', [itemId]);
        if (!del.rowCount) return res.status(404).json({ error: 'Item not found' });
        res.json({ deleted: itemId });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Admin chaos endpoints
app.post('/admin/kill', (req, res) => {
    isKilled = true;
    res.json({ status: 'killed' });
});
app.post('/admin/revive', (req, res) => {
    isKilled = false;
    res.json({ status: 'alive' });
});

module.exports = app;
module.exports.pool = pool;
module.exports.redisClient = redisClient;
module.exports.initDb = initDb;
