/**
 * Lightweight native WebSocket client for QZ Tray thermal & USB printing
 * Connects directly to QZ Tray on localhost:8182 (WSS) or localhost:8181 (WS)
 */

interface QzPromiseHandler {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeout: NodeJS.Timeout;
}

class QzTrayClient {
  private socket: WebSocket | null = null;
  private promiseId = 0;
  private pendingPromises = new Map<string, QzPromiseHandler>();
  private activePrinter: string | null = null;

  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  public getActivePrinter(): string | null {
    return this.activePrinter;
  }

  public setActivePrinter(name: string | null) {
    this.activePrinter = name;
  }

  /**
   * Connect to QZ Tray WebSocket
   * Tries wss://localhost:8182 first, then falls back to ws://localhost:8181
   */
  public async connect(host = "localhost"): Promise<string[]> {
    if (this.isConnected()) {
      return await this.findPrinters();
    }

    const endpoints = [
      `wss://${host}:8182`,
      `ws://${host}:8181`,
      `wss://127.0.0.1:8182`,
      `ws://127.0.0.1:8181`,
    ];

    let lastError: any = null;

    for (const url of endpoints) {
      try {
        await this.tryConnectSocket(url);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!this.isConnected()) {
      throw new Error(
        "Could not connect to QZ Tray. Please ensure the QZ Tray desktop application is installed and running on your computer (https://qz.io/download)."
      );
    }

    // Fetch list of installed printers on this machine
    return await this.findPrinters();
  }

  private tryConnectSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
          try {
            ws.close();
          } catch (e) {}
          reject(new Error(`Timeout connecting to ${url}`));
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.socket = ws;
          this.setupSocketEvents(ws);
          resolve();
        };

        ws.onerror = (event) => {
          clearTimeout(timeout);
          reject(new Error(`WebSocket error on ${url}`));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private setupSocketEvents(ws: WebSocket) {
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const promiseId = message.promise;

        if (promiseId && this.pendingPromises.has(promiseId)) {
          const handler = this.pendingPromises.get(promiseId)!;
          clearTimeout(handler.timeout);
          this.pendingPromises.delete(promiseId);

          if (message.error) {
            handler.reject(new Error(message.error));
          } else {
            handler.resolve(message.result !== undefined ? message.result : message);
          }
        }
      } catch (e) {
        console.warn("QZ Tray message parse error:", e);
      }
    };

    ws.onclose = () => {
      this.socket = null;
      this.pendingPromises.forEach((handler) => {
        clearTimeout(handler.timeout);
        handler.reject(new Error("QZ Tray connection closed"));
      });
      this.pendingPromises.clear();
    };
  }

  private sendCall(call: string, params: any[] = []): Promise<any> {
    if (!this.isConnected()) {
      return Promise.reject(new Error("QZ Tray is not connected"));
    }

    const promiseId = `p_${++this.promiseId}_${Date.now()}`;
    const payload = JSON.stringify({
      call,
      promise: promiseId,
      params,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingPromises.has(promiseId)) {
          this.pendingPromises.delete(promiseId);
          reject(new Error(`QZ Tray call "${call}" timed out after 10 seconds`));
        }
      }, 10000);

      this.pendingPromises.set(promiseId, { resolve, reject, timeout });
      this.socket!.send(payload);
    });
  }

  /**
   * Find list of all installed printers
   */
  public async findPrinters(): Promise<string[]> {
    try {
      const result = await this.sendCall("printers.find", []);
      if (Array.isArray(result)) {
        return result;
      }
      if (typeof result === "string") {
        return [result];
      }
      return [];
    } catch (err: any) {
      console.warn("Failed to find printers via QZ Tray:", err);
      return [];
    }
  }

  /**
   * Print raw ESC/POS byte buffer to selected printer via QZ Tray
   */
  public async printRaw(printerName: string, rawBytes: Uint8Array): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error("QZ Tray is not connected");
    }

    if (!printerName) {
      throw new Error("Please select a target printer name for QZ Tray");
    }

    // Convert bytes to Base64
    let binary = "";
    const len = rawBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(rawBytes[i]);
    }
    const base64Data = btoa(binary);

    const printConfig = {
      printer: printerName,
    };

    const printData = [
      {
        type: "raw",
        format: "command",
        flavor: "base64",
        data: base64Data,
      },
    ];

    await this.sendCall("print", [printConfig, printData]);
    return true;
  }

  /**
   * Disconnect from QZ Tray
   */
  public disconnect() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch (e) {}
    }
    this.socket = null;
    this.activePrinter = null;
  }
}

export const qzTray = new QzTrayClient();
