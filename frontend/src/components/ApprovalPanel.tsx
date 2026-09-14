import { useEffect, useState } from "react";
import { getPendingRequests, approveRequest } from "../lib/api";
import type { PendingRequest } from "../lib/api";

export function ApprovalPanel({ roomId, adminToken }: { roomId: string; adminToken: string }) {
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const requests = await getPendingRequests(roomId, adminToken);
        if (!cancelled) setPending(requests);
      } catch {
        // Room may have expired or token invalidated — just stop showing stale data.
      }
    }

    poll();
    const interval = setInterval(poll, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [roomId, adminToken]);

  async function handleApprove(requestId: string) {
    setApprovingId(requestId);
    try {
      await approveRequest(roomId, requestId, adminToken);
      setPending((prev) => prev.filter((r) => r.requestId !== requestId));
    } catch {
      // Leave it in the list — the next poll will reconcile actual state anyway.
    } finally {
      setApprovingId(null);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className="maze-panel" style={{ marginBottom: 16, borderColor: "var(--ghost-orange)" }}>
      <p style={{ color: "var(--ghost-orange)", fontSize: 11, marginTop: 0 }}>
        PENDING REQUESTS ({pending.length})
      </p>
      {pending.map((req) => (
        <div
          key={req.requestId}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}
        >
          <span style={{ fontSize: 12 }}>{req.name.toUpperCase()}</span>
          <button onClick={() => handleApprove(req.requestId)} disabled={approvingId === req.requestId}>
            {approvingId === req.requestId ? "..." : "APPROVE"}
          </button>
        </div>
      ))}
    </div>
  );
}