const request = require('supertest');
const sseManager = require('../src/sseManager');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      ping: () => Promise.resolve('PONG'),
      subscribe: (channel, cb) => cb && cb(null),
      on: () => { },
    };
  });
});

process.env.REDIS_URL = '';
const app = require('../src/index'); // the Express app exported

afterAll(() => {
  sseManager.stop();
  sseManager.reset();
});

describe('Notification Hub API', () => {
  test('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  test('POST /notify validates required fields', async () => {
    const resMissing = await request(app).post('/notify').send({});
    expect(resMissing.statusCode).toBe(400);
    expect(resMissing.body).toHaveProperty('error');
  });
});
