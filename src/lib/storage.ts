// Client-side chat history storage

const STORAGE_KEY = "karya-history";
const MAX_HISTORY = 100;

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function saveHistory(messages: StoredMessage[]) {
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable
  }
}

export function loadHistory(): StoredMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
