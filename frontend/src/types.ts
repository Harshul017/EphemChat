export interface CreateRoomResponse {
  roomId: string;
  token: string;
}

export interface RoomInfo {
  roomId: string;
  roomName: string;
}

export interface JoinRequestResponse {
  requestId: string;
}

export interface ApproveResponse {
  userId: string;
  name: string;
  token: string;
}

export interface StoredMessage {
  userId: string;
  name: string;
  text: string;
  ts: number;
}

export type WsEvent =
  | { type: "user_joined"; userId: string; name: string }
  | { type: "user_left"; userId: string }
  | { type: "message"; userId: string; name: string; text: string; ts: number }
  | { type: "room_expiring_soon"; secondsLeft: number }
  | { type: "room_expired" };