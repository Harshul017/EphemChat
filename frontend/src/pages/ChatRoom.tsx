import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getRoomInfo, requestToJoin, getRequestStatus } from "../lib/api";
import { useChatSocket } from "../hooks/useChatSocket";
import { decodeToken } from "../lib/jwt";
import { ApprovalPanel } from "../components/ApprovalPanel";

function ShareLink({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/chat/${roomId}`;

  function handleCopy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <input
        readOnly
        value={link}
        style={{ flex: 1, fontSize: 10 }}
        onClick={(e) => e.currentTarget.select()}
      />
      <button onClick={handleCopy}>{copied ? "COPIED!" : "COPY LINK"}</button>
    </div>
  );
}

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const [token, setToken] = useState<string | null>(() =>
    roomId ? localStorage.getItem(`ephemchat:${roomId}:token`) : null
  );

  const decoded = token ? decodeToken(token) : null;
  const isAdmin = decoded?.role === "admin";

  useEffect(() => {
    if (!roomId) return;

    getRoomInfo(roomId)
      .then((info) => setRoomName(info.roomName))
      .catch((err) => setError(err instanceof Error ? err.message : "Room not found."));
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !pendingRequestId || token) return;

    const interval = setInterval(async () => {
      try {
        const result = await getRequestStatus(roomId, pendingRequestId);
        if (result.status === "approved" && result.token) {
          localStorage.setItem(`ephemchat:${roomId}:token`, result.token);
          setToken(result.token);
        }
      } catch {
        // Room may have expired while waiting — the roomName fetch
        // failure will already surface that elsewhere.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [roomId, pendingRequestId, token]);

  const { messages, warning, expired, sendMessage, connected } = useChatSocket(roomId, token);

  async function handleRequestJoin() {
    if (!roomId || !name.trim()) return;
    try {
      const { requestId } = await requestToJoin(roomId, name);
      setPendingRequestId(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send join request.");
    }
  }

  function handleSend() {
    sendMessage(draft);
    setDraft("");
  }

  if (error) {
    return <p style={{ color: "var(--ghost-red)", padding: 40 }}>{error}</p>;
  }

  if (!roomName) {
    return <p style={{ padding: 40 }}>LOADING ROOM...</p>;
  }

  if (expired) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 16px" }}>
        <h2 style={{ textAlign: "center" }}>GAME OVER</h2>
        <p style={{ textAlign: "center" }}>This room has expired and is no longer available.</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", padding: "0 16px" }}>
        <h2 style={{ fontSize: 20 }}>JOIN "{roomName.toUpperCase()}"</h2>
        <div className="maze-panel" style={{ marginTop: 20 }}>
          {pendingRequestId ? (
            <p style={{ color: "var(--ghost-cyan)" }}>
              Request sent — waiting for the admin to approve you...
            </p>
          ) : (
            <>
              <label>Your name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ display: "block", width: "100%", marginBottom: 20 }}
              />
              <button onClick={handleRequestJoin} style={{ width: "100%" }}>
                REQUEST TO JOIN
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px" }}>
      <h2 style={{ fontSize: 22 }}>{roomName.toUpperCase()}</h2>

      {isAdmin && roomId && <ShareLink roomId={roomId} />}

      <p
        style={{
          fontSize: 10,
          color: connected ? "var(--ghost-cyan)" : "var(--ghost-orange)",
        }}
      >
        {connected ? "● CONNECTED" : "○ CONNECTING..."}
      </p>

      {warning !== null && (
        <p
          style={{
            fontSize: 11,
            color: "#000000",
            background: "var(--ghost-orange)",
            padding: "8px 12px",
            display: "inline-block",
          }}
        >
          ROOM CLOSES IN {warning}s
        </p>
      )}

      {isAdmin && roomId && token && <ApprovalPanel roomId={roomId} adminToken={token} />}

      <div
        className="maze-panel"
        style={{
          height: 340,
          overflowY: "auto",
          marginTop: 12,
          marginBottom: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {messages.map((m) => (
          <div key={m.id}>
            <div style={{ fontSize: 11, color: "var(--pac-yellow)", marginBottom: 4 }}>
              {m.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{m.text}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          style={{ flex: 1 }}
        />
        <button onClick={handleSend}>SEND</button>
      </div>
    </div>
  );
}