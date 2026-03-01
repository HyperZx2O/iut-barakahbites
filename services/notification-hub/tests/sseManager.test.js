const sseManager = require('../src/sseManager');

afterAll(() => {
  sseManager.stop();
  sseManager.reset();
});

describe('SSE Manager', () => {
  test('adds and removes client correctly', () => {
    const mockRes = { write: jest.fn() };
    sseManager.addClient('student1', mockRes);
    expect(sseManager.clients.get('student1')).toContain(mockRes);
    sseManager.removeClient('student1', mockRes);
    expect(sseManager.clients.has('student1')).toBe(false);
  });

  test('broadcast sends formatted event to all clients', () => {
    const mockRes1 = { write: jest.fn() };
    const mockRes2 = { write: jest.fn() };
    sseManager.addClient('student2', mockRes1);
    sseManager.addClient('student2', mockRes2);
    const payload = { orderId: '123', status: 'ready' };
    sseManager.broadcast('student2', payload);
    const expected = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
    expect(mockRes1.write).toHaveBeenCalledWith(expected);
    expect(mockRes2.write).toHaveBeenCalledWith(expected);
    // Cleanup
    sseManager.removeClient('student2', mockRes1);
    sseManager.removeClient('student2', mockRes2);
  });
});
