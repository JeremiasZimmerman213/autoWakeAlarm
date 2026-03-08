import type { SessionSnapshot } from "../core/types.js";

export interface SessionStore {
  save(snapshot: SessionSnapshot): Promise<void>;
  load(): Promise<SessionSnapshot | null>;
  clear(): Promise<void>;
}
