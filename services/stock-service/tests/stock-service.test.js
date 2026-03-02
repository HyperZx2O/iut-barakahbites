const request = require('supertest');
const { Pool } = require('pg');

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://devsprint:devsprint@localhost:54320/cafeteria';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const app = require('../src/app');
const { pool, redisClient } = require('../src/app');

// We use the connected pool and redis client from app.js
let server;

beforeAll(async () => {
    const { initDb } = require('../src/app');
    // Use the same initialization logic as the main app
    try {
        await initDb();
    } catch (err) {
        console.error('Test DB Setup Error:', err);
    }
    server = app.listen(0);
});

beforeEach(async () => {
    // Reset database state and redis before each test
    await pool.query('DELETE FROM processed_orders');
    await pool.query('DELETE FROM stock');

    // Seed the test item
    await pool.query(
        "INSERT INTO stock (item_id, name, quantity, version) VALUES ('item-1', 'Test Item', 10, 1);"
    );

    await redisClient.flushDb();
});

afterAll(async () => {
    if (server) server.close();
    await pool.end();
    redisClient.quit();
});

describe('Stock Service API', () => {
    describe('Stock Checking and Replenishing', () => {
        test('GET /stock/:itemId returns current stock', async () => {
            const res = await request(server).get('/stock/item-1');
            expect(res.statusCode).toBe(200);
            expect(res.body.itemId).toBe('item-1');
            expect(res.body.quantity).toBe(10);
        });

        test('POST /stock/:itemId/replenish adds to stock', async () => {
            const res = await request(server)
                .post('/stock/item-1/replenish')
                .send({ quantity: 5 });

            expect(res.statusCode).toBe(200);
            expect(res.body.remaining).toBe(15);
            expect(res.body.added).toBe(5);
        });
    });

    describe('Stock Decrement (Ordering)', () => {
        test('Normal decrement succeeds and updates DB', async () => {
            const res = await request(server)
                .post('/stock/item-1/decrement')
                .send({ quantity: 2, orderId: 'req-1' });

            expect(res.statusCode).toBe(200);
            expect(res.body.remaining).toBe(8);
            expect(res.body.decremented).toBe(2);

            // Verify DB directly
            const dbCheck = await pool.query("SELECT quantity, version FROM stock WHERE item_id = 'item-1'");
            expect(dbCheck.rows[0].quantity).toBe(8);
            expect(dbCheck.rows[0].version).toBe(2); // Validates optimistic lock
        });

        test('Zero/Insufficient stock returns 409', async () => {
            const res = await request(server)
                .post('/stock/item-1/decrement')
                .send({ quantity: 15, orderId: 'req-2' }); // DB only has 10

            expect(res.statusCode).toBe(409);
            expect(res.body.error).toContain('Insufficient stock');

            // DB shouldn't change
            const dbCheck = await pool.query("SELECT quantity FROM stock WHERE item_id = 'item-1'");
            expect(dbCheck.rows[0].quantity).toBe(10);
        });

        test('Concurrent decrement (optimistic locking) - no over-selling', async () => {
            // Create an item with exactly 1 quantity
            await pool.query(
                "INSERT INTO stock (item_id, name, quantity, version) VALUES ('item-limit', 'Limited', 1, 1);"
            );

            // Fire 5 requests at the exact same time trying to buy 1 item each
            const requests = Array.from({ length: 5 }).map((_, i) =>
                request(server)
                    .post('/stock/item-limit/decrement')
                    .send({ quantity: 1, orderId: `concurrent-req-${i}` })
            );

            const responses = await Promise.all(requests);

            // Count outcomes
            const successes = responses.filter(r => r.statusCode === 200).length;
            const conflicts = responses.filter(r => r.statusCode === 409).length;

            // Only 1 should succeed, the rest should fail (either version conflict or insufficient)
            expect(successes).toBe(1);
            expect(conflicts).toBe(4);

            // Final stock should be 0, not negative
            const dbCheck = await pool.query("SELECT quantity FROM stock WHERE item_id = 'item-limit'");
            expect(dbCheck.rows[0].quantity).toBe(0);
        });

        test('Idempotency - repeating identical orderId does not double-decrement', async () => {
            // First decrement
            const res1 = await request(server)
                .post('/stock/item-1/decrement')
                .send({ quantity: 3, orderId: 'idempotent-order' });

            expect(res1.statusCode).toBe(200);
            expect(res1.body.remaining).toBe(7);

            // Second decrement with SAME orderId (Network retry scenario)
            const res2 = await request(server)
                .post('/stock/item-1/decrement')
                .send({ quantity: 3, orderId: 'idempotent-order' });

            // Request should succeed, but "decremented" is 0 and "remaining" stays 7
            expect(res2.statusCode).toBe(200);
            expect(res2.body.remaining).toBe(7);
            expect(res2.body.decremented).toBe(0); // Identifies cache hit effectively

            // DB should be 7
            const dbCheck = await pool.query("SELECT quantity FROM stock WHERE item_id = 'item-1'");
            expect(dbCheck.rows[0].quantity).toBe(7);
        });
    });
});
