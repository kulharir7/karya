// Chat session management

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  lastMessageAt: number;
  messageCount: number;
}

const SESSIONS_KEY = "karya-sessions";
const ACTIVE_KEY = "karya-active-session";

export function getSessions(): Session[] {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch { return []; }
}

export function saveSessions(sessions: Session[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function getActiveSessionId(): string {
  return localStorage.getItem(ACTIVE_KEY) || "default";
}

export function setActiveSessionId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getSessionMessages(sessionId: string) {
  try {
    return JSON.parse(localStorage.getItem(`karya-msgs-${sessionId}`) || "[]");
  } catch { return []; }
}

export function saveSessionMessages(sessionId: string, messages: any[]) {
  localStorage.setItem(`karya-msgs-${sessionId}`, JSON.stringify(messages.slice(-100)));
}

export function deleteSession(sessionId: string) {
  localStorage.removeItem(`karya-msgs-${sessionId}`);
  const sessions = getSessions().filter((s) => s.id !== sessionId);
  saveSessions(sessions);
}

export function createSession(name?: string): Session {
  const id = `session-${Date.now()}`;
  const session: Session = {
    id,
    name: name || `Chat ${getSessions().length + 1}`,
    createdAt: Date.now(),
    lastMessageAt: Date.now(),
    messageCount: 0,
  };
  const sessions = getSessions();
  sessions.unshift(session);
  saveSessions(sessions);
  setActiveSessionId(id);
  return session;
}

export function renameSession(sessionId: string, name: string) {
  const sessions = getSessions().map((s) =>
    s.id === sessionId ? { ...s, name: name.slice(0, 30) } : s
  );
  saveSessions(sessions);
}
