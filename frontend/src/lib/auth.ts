const TOKEN_KEY = "wardrobe_token";
const USER_KEY = "wardrobe_user";

export function saveAuth(token: string, user: { id: string; name: string; email: string }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): { id: string; name: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
