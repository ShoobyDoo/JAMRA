/**
 * Browser transport for JAMRA logging system
 * Stores logs in IndexedDB for web environments
 * Implements circular buffer to prevent unlimited growth
 */

import type { LogTransport, TransportOptions } from "./base";
import type { LogEntry } from "../types";
import { LogLevel } from "../types";

const DB_NAME = "jamra-logs";
const STORE_NAME = "logs";
const MAX_ENTRIES = 1000;

interface BrowserTransportOptions extends TransportOptions {
  maxEntries?: number;
}

interface StoredLogEntry extends LogEntry {
  id?: number;
}

export class BrowserTransport implements LogTransport {
  readonly name = "browser";
  readonly minLevel: LogLevel;
  private readonly maxEntries: number;
  private db?: IDBDatabase;
  private initPromise?: Promise<void>;
  private buffer: LogEntry[] = [];
  private isClosing = false;

  constructor(options: BrowserTransportOptions = {}) {
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.maxEntries = options.maxEntries ?? MAX_ENTRIES;
    this.initPromise = this.initializeDB();
  }

  private async initializeDB(): Promise<void> {
    if (typeof indexedDB === "undefined") {
      // Not in browser environment
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("level", "level", { unique: false });
        }
      };
    });
  }

  log(entry: LogEntry): void {
    if (entry.level < this.minLevel || this.isClosing) {
      return;
    }

    // Buffer the entry and write async
    this.buffer.push(entry);
    void this.writeBuffer();
  }

  private async writeBuffer(): Promise<void> {
    // Wait for DB initialization
    await this.initPromise;

    if (!this.db || this.buffer.length === 0) {
      return;
    }

    const entries = this.buffer.splice(0);

    try {
      const transaction = this.db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      // Add all buffered entries
      for (const entry of entries) {
        store.add({
          ...entry,
          level: entry.level, // Store as number
        });
      }

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      // Trim old entries if we exceeded max
      await this.trimOldEntries();
    } catch (error) {
      // eslint-disable-next-line no-console -- Fallback error logging for transport failures
      console.error("[BrowserTransport] Failed to write logs:", error);
      // Put entries back in buffer to retry
      this.buffer.unshift(...entries);
    }
  }

  private async trimOldEntries(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      // Count total entries
      const countRequest = store.count();
      const count = await new Promise<number>((resolve, reject) => {
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      });

      if (count <= this.maxEntries) {
        return;
      }

      // Delete oldest entries
      const deleteCount = count - this.maxEntries;
      const cursorRequest = store.openCursor();

      let deleted = 0;
      await new Promise<void>((resolve, reject) => {
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (cursor && deleted < deleteCount) {
            cursor.delete();
            deleted++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorRequest.onerror = () => reject(cursorRequest.error);
      });
    } catch (error) {
      // eslint-disable-next-line no-console -- Fallback error logging for transport failures
      console.error("[BrowserTransport] Failed to trim old logs:", error);
    }
  }

  /**
   * Export all logs as a JSON array
   */
  async exportLogs(): Promise<StoredLogEntry[]> {
    await this.initPromise;

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as StoredLogEntry[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all logs
   */
  async clearLogs(): Promise<void> {
    await this.initPromise;

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async flush(): Promise<void> {
    await this.writeBuffer();
  }

  async close(): Promise<void> {
    this.isClosing = true;
    await this.flush();

    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }
}
