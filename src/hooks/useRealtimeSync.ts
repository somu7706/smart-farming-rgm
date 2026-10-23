import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SyncEntityType = "farmer_profile" | "product" | "order" | "demand_supply";
export type SyncActionType = "create" | "update" | "delete";

export interface SyncEvent {
  type: string;
  entity: SyncEntityType;
  action: SyncActionType;
  id?: string;
  data?: any;
  timestamp: number;
}

type SyncCallback = (event: SyncEvent) => void;

const getSyncWsUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL || "https://smart-farming-rgm.onrender.com/api";
  const url = new URL(apiUrl, window.location.origin);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${url.host}/ws/sync`;
};

// Global subscriber set to avoid multiple connections across components
const subscribers = new Set<SyncCallback>();

let globalWs: WebSocket | null = null;
let retryCount = 0;
let reconnectTimer: any = null;
let heartbeatTimer: any = null;
let isUnmounting = false;

const notifySubscribers = (event: SyncEvent) => {
  subscribers.forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      console.warn("[RealtimeSync] Subscriber callback error:", e);
    }
  });
};

const connectGlobalWebSocket = () => {
  if (isUnmounting) return;
  if (globalWs && (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = getSyncWsUrl();

  try {
    const ws = new WebSocket(wsUrl);
    globalWs = ws;

    ws.onopen = () => {
      retryCount = 0;
      console.log("[RealtimeSync] Connected to Sync WebSocket:", wsUrl);

      // Start ping heartbeat every 25 seconds
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "SYNC_EVENT") {
          notifySubscribers(msg);
        }
      } catch (err) {
        // ignore non-json
      }
    };

    ws.onerror = (err) => {
      console.warn("[RealtimeSync] WebSocket connection error:", err);
    };

    ws.onclose = (event) => {
      console.log(`[RealtimeSync] WebSocket closed (${event.code}). Scheduling reconnect...`);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      globalWs = null;

      // Exponential backoff with jitter
      if (!isUnmounting) {
        const base = Math.min(15000, 1000 * Math.pow(1.5, retryCount));
        const jitter = Math.random() * 500;
        const delay = Math.round(base + jitter);
        retryCount++;

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          connectGlobalWebSocket();
        }, delay);
      }
    };
  } catch (err) {
    console.warn("[RealtimeSync] Error instantiating WebSocket:", err);
  }
};

// Also listen to Supabase broadcast channel for multi-channel redundancy
let supabaseSyncChannel: any = null;
const initSupabaseSync = () => {
  if (supabaseSyncChannel) return;
  supabaseSyncChannel = supabase
    .channel("agri-realtime-sync")
    .on("broadcast", { event: "sync_event" }, (payload: any) => {
      if (payload.payload) {
        notifySubscribers(payload.payload);
      }
    })
    .subscribe();
};

export const broadcastClientSync = async (event: Omit<SyncEvent, "timestamp">) => {
  const fullEvent: SyncEvent = { ...event, timestamp: Date.now() };

  // 1. Dispatch locally to all subscribers immediately
  notifySubscribers(fullEvent);

  // 2. Broadcast via Supabase broadcast channel
  try {
    if (supabaseSyncChannel) {
      await supabaseSyncChannel.send({
        type: "broadcast",
        event: "sync_event",
        payload: fullEvent,
      });
    }
  } catch (e) {
    console.warn("[RealtimeSync] Supabase broadcast notice:", e);
  }
};

export const useRealtimeSync = (entityFilter?: SyncEntityType, callback?: SyncCallback) => {
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);

  useEffect(() => {
    isUnmounting = false;
    connectGlobalWebSocket();
    initSupabaseSync();

    const handler: SyncCallback = (event) => {
      if (!entityFilter || event.entity === entityFilter) {
        setLastEvent(event);
        if (callback) callback(event);
      }
    };

    subscribers.add(handler);
    return () => {
      subscribers.delete(handler);
    };
  }, [entityFilter, callback]);

  return {
    lastEvent,
    broadcastSync: broadcastClientSync,
  };
};
