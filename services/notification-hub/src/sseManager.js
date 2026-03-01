// sseManager.js – manages Server‑Sent Events client connections
// Maintains a Map of studentId => Set of response objects
// Provides addClient, removeClient, broadcast, and keep‑alive pings

const KEEP_ALIVE_INTERVAL_MS = 15000; // 15 s

class SSEManager {
  constructor() {
    this.clients = new Map(); // studentId => Set<res>
    this._startKeepAlive();
  }

  _getSet(studentId) {
    let set = this.clients.get(studentId);
    if (!set) {
      set = new Set();
      this.clients.set(studentId, set);
    }
    return set;
  }

  addClient(studentId, res) {
    const set = this._getSet(studentId);
    set.add(res);
  }

  removeClient(studentId, res) {
    const set = this.clients.get(studentId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        this.clients.delete(studentId);
      }
    }
  }

  broadcast(studentId, payload) {
    const set = this.clients.get(studentId);
    if (!set) return;
    const data = JSON.stringify(payload);
    const message = `event: message\ndata: ${data}\n\n`;
    for (const res of set) {
      try {
        res.write(message);
      } catch (e) {
        // If write fails, clean up the client
        this.removeClient(studentId, res);
      }
    }
  }

  _startKeepAlive() {
    this.keepAliveTimer = setInterval(() => {
      const comment = `:keep-alive\n\n`;
      for (const [_, set] of this.clients.entries()) {
        for (const res of set) {
          try { res.write(comment); } catch (_) { /* ignore */ }
        }
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  stop() {
    clearInterval(this.keepAliveTimer);
  }

  reset() {
    this.clients.clear();
  }
}

module.exports = new SSEManager();
