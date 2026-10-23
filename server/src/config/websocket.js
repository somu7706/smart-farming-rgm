import { WebSocketServer, WebSocket } from "ws";

class RealtimeSyncManager {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.heartbeatInterval = null;
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server, path: "/ws/sync" });

    this.wss.on("connection", (ws, req) => {
      ws.isAlive = true;
      this.clients.add(ws);
      console.log(`[Sync WebSocket] Client connected from ${req.socket.remoteAddress}. Active clients: ${this.clients.size}`);

      // Handle pong from client
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      // Handle messages (e.g. ping)
      ws.on("message", (message) => {
        try {
          const str = message.toString();
          if (str === "ping" || str.includes('"ping"')) {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          }
        } catch (e) {
          // ignore
        }
      });

      ws.on("close", (code, reason) => {
        this.clients.delete(ws);
        console.log(`[Sync WebSocket] Client disconnected (${code}). Active clients: ${this.clients.size}`);
      });

      ws.on("error", (err) => {
        console.warn(`[Sync WebSocket] Client error: ${err.message}`);
        this.clients.delete(ws);
        try {
          ws.terminate();
        } catch (e) {}
      });

      // Send initial welcome/connected confirmation
      try {
        ws.send(JSON.stringify({ type: "SYNC_CONNECTED", timestamp: Date.now() }));
      } catch (e) {}
    });

    // Keepalive ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      for (const ws of this.clients) {
        if (!ws.isAlive) {
          console.log("[Sync WebSocket] Terminating inactive/stale connection.");
          this.clients.delete(ws);
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }, 30000);

    console.log("[Sync WebSocket] Server initialized on path /ws/sync");
  }

  broadcast(event) {
    if (!this.wss || this.clients.size === 0) return;

    const payload = JSON.stringify({
      type: "SYNC_EVENT",
      ...event,
      timestamp: event.timestamp || Date.now(),
    });

    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (err) {
          console.warn("[Sync WebSocket] Broadcast send error:", err.message);
          this.clients.delete(ws);
        }
      }
    }
  }

  shutdown() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.wss) {
      for (const ws of this.clients) {
        ws.terminate();
      }
      this.wss.close();
    }
  }
}

export const syncManager = new RealtimeSyncManager();

export const broadcastSyncEvent = (event) => {
  syncManager.broadcast(event);
};
