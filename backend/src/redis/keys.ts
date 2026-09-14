export const keys = {
  room: (roomId: string) => `room:${roomId}`,
  members: (roomId: string) => `room:${roomId}:members`,
  requests: (roomId: string) => `room:${roomId}:requests`,
  member: (roomId: string, userId: string) => `room:${roomId}:member:${userId}`,
  messages: (roomId: string) => `room:${roomId}:messages`,
};