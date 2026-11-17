/* =========================================================================
 * YOMIC V2 — TYPE-SAFE WEBVIEW2 <-> C# HOST IPC BRIDGE
 * ========================================================================= */

import { IncomingHostMessage, OutgoingWebMessage } from './types.js';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: number;
}

export class HostBridge {
  private readonly listeners: Array<(msg: IncomingHostMessage) => void> = [];
  private readonly eventHandlers = new Map<string, Array<(payload: any) => void>>();
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private reqCounter = 0;

  constructor() {
    const handleIncoming = (raw: any): void => {
      if (!raw) return;
      let msg: IncomingHostMessage;
      if (typeof raw === 'string') {
        try {
          msg = JSON.parse(raw) as IncomingHostMessage;
        } catch {
          return;
        }
      } else {
        msg = raw as IncomingHostMessage;
      }

      if (!msg || typeof msg.type !== 'string') return;

      // 1. Check if this is an async response to a pending invoke() call
      if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
        const pending = this.pendingRequests.get(msg.requestId)!;
        this.pendingRequests.delete(msg.requestId);
        window.clearTimeout(pending.timer);
        if (msg.ok === false) {
          pending.reject(new Error(msg.error || 'Permintaan backend gagal.'));
        } else {
          pending.resolve(msg.payload);
        }
        return;
      }

      // 2. Dispatch to registered event handlers (e.g. event:downloads-updated)
      const handlers = this.eventHandlers.get(msg.type);
      if (handlers) {
        for (const fn of handlers) {
          try {
            fn(msg.payload ?? msg);
          } catch {
            // Ignore handler error
          }
        }
      }

      // 3. Dispatch to general host listeners
      for (const listener of this.listeners) {
        listener(msg);
      }
    };

    window.__yomicHostReceiver = (payload: IncomingHostMessage): void => {
      handleIncoming(payload);
    };

    if (window.chrome?.webview?.addEventListener) {
      window.chrome.webview.addEventListener('message', (ev) => {
        handleIncoming(ev.data);
      });
    }
  }

  public get isWebViewHost(): boolean {
    return typeof window.chrome?.webview?.postMessage === 'function';
  }

  public onHostMessage(callback: (msg: IncomingHostMessage) => void): void {
    this.listeners.push(callback);
  }

  public on<T = any>(eventType: string, callback: (payload: T) => void): void {
    const list = this.eventHandlers.get(eventType) ?? [];
    list.push(callback);
    this.eventHandlers.set(eventType, list);
  }

  public send(message: OutgoingWebMessage): void {
    try {
      if (window.chrome?.webview?.postMessage) {
        window.chrome.webview.postMessage(JSON.stringify(message));
      }
    } catch {
      // Fallback silently when running outside WebView2 host
    }
  }

  public invoke<T = any>(type: string, payload?: unknown, timeoutMs = 45000): Promise<T> {
    if (!this.isWebViewHost) {
      return Promise.reject(new Error('WebView2 host tidak tersedia.'));
    }

    const requestId = `req-${Date.now()}-${++this.reqCounter}`;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Permintaan ${type} melampaui batas waktu.`));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, { resolve, reject, timer });
      this.send({ type, requestId, payload });
    });
  }

  public setWindowTheme(mode: 'ocean-light' | 'antigravity-dark' | 'reader-dark', subtitle?: string): void {
    this.send({
      type: 'ui:theme-changed',
      mode,
      subtitle
    });
  }

  public toggleFullscreen(forceValue?: boolean): void {
    this.send({
      type: 'ui:toggle-fullscreen',
      value: forceValue
    });
  }

  public openExternalUrl(url: string): void {
    this.send({
      type: 'ui:open-external',
      url
    });
  }

  public openFolder(path?: string): void {
    this.send({
      type: 'ui:open-folder',
      path
    });
  }
}
