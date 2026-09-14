interface DecodedToken {
  roomId: string;
  userId: string;
  role: "admin" | "member";
}

export function decodeToken(token: string): DecodedToken | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded as DecodedToken;
  } catch {
    return null;
  }
}