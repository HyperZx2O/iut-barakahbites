jest.mock('ioredis', () => require('ioredis-mock'));
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id-123' }),
    })),
    Worker: jest.fn(),
  };
});

const request = require('supertest');
const app = require('../src/index');
const { connection } = require('../src/queue');

describe('Kitchen Queue Service', () => {
  afterAll(async () => {
    // BullMQ/ioredis connections need to be closed to let Jest exit
    await connection.quit();
  });

  it('should return 202 with orderId and IN_KITCHEN status on valid order', async () => {
    const response = await request(app)
      .post('/queue/order')
      .send({ orderId: 'test123', studentId: 'stu1', items: [{ id: 'item1', qty: 1 }] })
      .expect(202);
    expect(response.body.orderId).toBe('test123');
    expect(response.body.status).toBe('IN_KITCHEN');
    expect(response.body.estimatedTime).toBe('3-7 seconds');
  });

  it('should enforce idempotency and return same orderId for duplicate order', async () => {
    const payload = { orderId: 'dup123', studentId: 'stu2', items: [{ id: 'item2', qty: 2 }] };
    const first = await request(app).post('/queue/order').send(payload).expect(202);

    const second = await request(app).post('/queue/order').send(payload).expect(200);
    expect(second.body.orderId).toBe(first.body.orderId);
    expect(second.body.message).toBe('Duplicate order ignored');
  });

  it('should return 400 on missing fields', async () => {
    await request(app)
      .post('/queue/order')
      .send({ orderId: 'test123' })
      .expect(400);
  });
});
