import type {
  CreateRoomResponse,
  RoomInfo,
  JoinRequestResponse,
  ApproveResponse,
  StoredMessage,
} from "../types";

const BASE_URL = import.meta.env.VITE_BACKEND_URL;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.error === "string" ? body.error : `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function createRoom(
  roomName: string,
  adminName: string,
  ttlSeconds: number,
  warningLeadSeconds?: number
): Promise<CreateRoomResponse> {
  const res = await fetch(`${BASE_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomName, adminName, ttlSeconds, warningLeadSeconds }),
  });
  return handleResponse<CreateRoomResponse>(res);
}

export async function getRoomInfo(roomId: string): Promise<RoomInfo> {
  const res = await fetch(`${BASE_URL}/rooms/${roomId}`);
  return handleResponse<RoomInfo>(res);
}

export async function requestToJoin(roomId: string, name: string): Promise<JoinRequestResponse> {
  const res = await fetch(`${BASE_URL}/rooms/${roomId}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return handleResponse<JoinRequestResponse>(res);
}

export async function approveRequest(
  roomId: string,
  requestId: string,
  adminToken: string
): Promise<ApproveResponse> {
  const res = await fetch(`${BASE_URL}/rooms/${roomId}/requests/${requestId}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return handleResponse<ApproveResponse>(res);
}

export interface RequestStatusResponse {
  status: "pending" | "approved" | "unknown";
  token?: string;
}

export async function getRequestStatus(roomId: string, requestId: string): Promise<RequestStatusResponse> {
  const res = await fetch(`${BASE_URL}/rooms/${roomId}/requests/${requestId}/status`);
  return handleResponse<RequestStatusResponse>(res);
}

export interface PendingRequest {
  requestId: string;
  name: string;
}

export async function getPendingRequests(roomId: string, adminToken: string): Promise<PendingRequest[]> {
  const res = await fetch(`${BASE_URL}/rooms/${roomId}/requests`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return handleResponse<PendingRequest[]>(res);
}

export async function getMessages(roomId: string, token: string): Promise<StoredMessage[]> {
  const res = await fetch(`${BASE_URL}/rooms/${roomId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<StoredMessage[]>(res);
}