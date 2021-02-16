import { v4 } from "https://deno.land/std@0.87.0/uuid/mod.ts";
import { EventEmitter } from "https://deno.land/x/event@0.2.1/mod.ts";

export type SqliteWorkerEvents = {
  open: [];
  close: [];
  error: [Error];
};

export class SqliteWorker extends EventEmitter<SqliteWorkerEvents> {
  #worker?: Worker;
  #callbacks: Map<string, CallableFunction> = new Map();
  #opened: boolean = false;
  #init: CallableFunction;
  #deinit: CallableFunction;
  file?: string;

  get state(): "open" | "closed" {
    return this.#opened ? "open" : "closed";
  }

  constructor(file?: string) {
    super();
    this.file = file;
    this.#init = () => {
      this.#worker = new Worker(
        new URL("./worker.ts", import.meta.url).toString(),
        {
          type: "module",
          deno: true,
        }
      );
      this.#worker.onmessage = this.onmessage.bind(this);
    };
    this.#deinit = () => {
      if (this.#worker) {
        this.#worker.terminate();
        this.#worker = undefined;
      }
    };
  }

  async open() {
    if (this.#opened) throw new Error("Already opened");
    if (this.#worker === undefined) this.#init();
    await this.postMessage("OPEN", { file: this.file });
    return this;
  }

  async query<T = any>(
    sql: string,
    params: Array<string | number> = []
  ): Promise<T[]> {
    if (this.state !== "open") throw new Error("DB not open");
    return (await this.postMessage("QUERY", { sql, params }, null)) as T[];
  }

  postMessage(cmd: string, data: any = null, timeout: number | null = 10000) {
    if (this.#worker === undefined) throw new Error("Worker not initialized");
    const nonce = v4.generate();
    const promise = new Promise((res, rej) => {
      const timer: number | undefined =
        timeout === null
          ? undefined
          : setTimeout(() => {
              this.#callbacks.delete(nonce);
              rej("Timeout. No response for command: " + cmd);
            }, timeout);

      const cb = (data: any, error: boolean) => {
        if (error) rej(new Error(data.msg));
        if (timer) clearTimeout(timer);
        res(data);
      };

      this.#callbacks.set(nonce, cb);
    });
    this.#worker.postMessage({ cmd, data, nonce });
    return promise;
  }

  onmessage(evt: MessageEvent) {
    const { cmd, data } = evt.data;

    switch (cmd) {
      case "ON_OPEN":
        this.#opened = true;
        this.emit("open");
        break;

      case "CALLBACK":
        if (!evt.data.nonce) break;
        if (this.#callbacks.has(evt.data.nonce)) {
          (this.#callbacks.get(evt.data.nonce) ?? (() => {}))(
            data,
            evt.data.error ?? false
          );
          this.#callbacks.delete(evt.data.nonce);
        }
        break;

      case "ERROR":
        this.emit("error", new Error(data.msg));
        break;

      default:
        break;
    }
  }

  async close() {
    if (!this.#opened) throw new Error("DB not opened");
    await this.postMessage("CLOSE");
    this.emit("close");
    this.#deinit();
    return this;
  }

  async getChanges(): Promise<number> {
    if (this.state !== "open") throw new Error("DB not open");
    return (await this.postMessage("GET_CHANGES")) as number;
  }

  async getTotalChanges(): Promise<number> {
    if (this.state !== "open") throw new Error("DB not open");
    return (await this.postMessage("GET_TOTAL_CHANGES")) as number;
  }

  async getLastInsertRowID(): Promise<number> {
    if (this.state !== "open") throw new Error("DB not open");
    return (await this.postMessage("GET_LAST_INSERT_ROW_ID")) as number;
  }
}
