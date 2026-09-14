import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../lib/api";

export default function Home() {
  const [roomName, setRoomName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleCreate() {
    setError(null);

    if (!roomName.trim() || !adminName.trim()) {
      setError("Room name and your name are both required.");
      return;
    }

    setLoading(true);
    try {
      const { roomId, token } = await createRoom(roomName, adminName, ttlMinutes * 60);
      localStorage.setItem(`ephemchat:${roomId}:token`, token);
      navigate(`/chat/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 32, textAlign: "center" }}>EPHEM • CHAT</h1>
      <p style={{ textAlign: "center", color: "var(--ghost-cyan)" }}>
        A room that vanishes when the clock runs out.
      </p>

      <div className="maze-panel" style={{ marginTop: 24 }}>
        <label>Room name</label>
        <input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 20 }}
        />

        <label>Your name</label>
        <input
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          style={{ display: "block", width: "100%", marginBottom: 20 }}
        />

        <label>Room lifetime (minutes)</label>
        <input
          type="number"
          min={1}
          max={120}
          value={ttlMinutes}
          onChange={(e) => setTtlMinutes(Number(e.target.value))}
          style={{ display: "block", width: "100%", marginBottom: 20 }}
        />

        {error && (
          <p style={{ color: "var(--ghost-red)", fontSize: 11 }}>{error}</p>
        )}

        <button onClick={handleCreate} disabled={loading} style={{ width: "100%" }}>
          {loading ? "LOADING..." : "START GAME"}
        </button>
      </div>
    </div>
  );
}