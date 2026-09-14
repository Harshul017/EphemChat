import { useEffect, useState } from "react";
import { getRoomMembers, removeMember } from "../lib/api";
import type { RoomMember } from "../lib/api";

export function MemberList({ roomId, adminToken }: { roomId: string; adminToken: string }) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const list = await getRoomMembers(roomId, adminToken);
        if (!cancelled) setMembers(list);
      } catch {
        // Room may have expired — nothing to show, next render handles it.
      }
    }

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, adminToken]);

  async function handleKick(userId: string) {
    setRemovingId(userId);
    try {
      await removeMember(roomId, userId, adminToken);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch {
      // Next poll will reconcile actual state either way.
    } finally {
      setRemovingId(null);
    }
  }

  if (members.length === 0) return null;

  return (
    <div className="maze-panel" style={{ marginBottom: 16 }}>
      <p style={{ color: "var(--ghost-cyan)", fontSize: 11, marginTop: 0 }}>
        MEMBERS ({members.length})
      </p>
      {members.map((m) => (
        <div
          key={m.userId}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}
        >
          <span style={{ fontSize: 12 }}>
            {m.name.toUpperCase()} {m.isAdmin && <span style={{ color: "var(--pac-yellow)" }}>(ADMIN)</span>}
          </span>
          {!m.isAdmin && (
            <button onClick={() => handleKick(m.userId)} disabled={removingId === m.userId}>
              {removingId === m.userId ? "..." : "KICK"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}