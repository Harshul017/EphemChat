import { useEffect, useRef, useState } from "react";
import { getMessages } from "../lib/api";
import type { StoredMessage, WsEvent } from "../types";

interface ChatMessageItem extends StoredMessage {
  id: string;
}

interface UseChatSocketResult {
  messages: ChatMessageItem[];
  warning: number | null;
  expired: boolean;
  connected: boolean;
  sendMessage: (text: string) => void;
}

export function useChatSocket(
  roomId: string | undefined,
  token: string | null
): UseChatSocketResult {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [warning, setWarning] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomId || !token) return;
    let cancelled = false;

    // Fetch history and open the socket concurrently, not sequentially —
    // this keeps the connection snappy instead of waiting on REST first.
    getMessages(roomId, token)
      .then((history) => {
        if (cancelled) return;
        const items = history.map((m) => ({ ...m, id: `${m.userId}-${m.ts}` }));
        // Prepend history rather than overwrite, in case a live message
        // already arrived over the socket before this fetch resolved.
        setMessages((prev) => [...items, ...prev]);
      })
      .catch((err) => {
        console.error("Failed to load message history:", err);
      });

    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      let data: WsEvent;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data.type === "message") {
        setMessages((prev) => [
          ...prev,
          { userId: data.userId, name: data.name, text: data.text, ts: data.ts, id: `${data.userId}-${data.ts}` },
        ]);
      } else if (data.type === "room_expiring_soon") {
        setWarning(data.secondsLeft);
      } else if (data.type === "room_expired") {
        setExpired(true);
        ws.close();
      }
    };

    return () => {
      cancelled = true;
      ws.close();
    };
  }, [roomId, token]);

  function sendMessage(text: string) {
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "message", text }));
  }

  return { messages, warning, expired, sendMessage, connected };
}