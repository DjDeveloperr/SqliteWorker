import { DB } from "https://deno.land/x/sqlite/mod.ts";

declare let onmessage: (evt: MessageEvent) => any;
declare let postMessage: (data: any) => any;

let db: DB | undefined;

onmessage = (evt: MessageEvent) => {
  try {
    const { cmd, data, nonce } = evt.data;
    const send = (cmd: string, data: any) => postMessage({ cmd, data, nonce });
    switch (cmd) {
      case "OPEN":
        if (db !== undefined) db.close();
        db = new DB(data.file);
        send("ON_OPEN", data);
        send("CALLBACK", true);
        break;

      case "CLOSE":
        if (db === undefined) send("CALLBACK", "DB not opened");
        else {
          db.close();
          db = undefined;
          send("CALLBACK", "done");
        }
        break;

      case "QUERY":
        if (db === undefined) send("CALLBACK", "DB not opened");
        else {
          const res = db.query(data.sql, data.params ?? []);
          send("CALLBACK", [...res.asObjects()]);
        }
        break;

      case "GET_CHANGES":
        if (db === undefined) send("CALLBACK", "DB not opened");
        else {
          send("CALLBACK", db.changes);
        }
        break;

      case "GET_TOTAL_CHANGES":
        if (db === undefined) send("CALLBACK", "DB not opened");
        else {
          send("CALLBACK", db.totalChanges);
        }
        break;

      case "GET_LAST_INSERT_ROW_ID":
        if (db === undefined) send("CALLBACK", "DB not opened");
        else {
          send("CALLBACK", db.lastInsertRowId);
        }
        break;

      default:
        send("CALLBACK", "Unknown Command: " + cmd);
        break;
    }
  } catch (e) {
    const nonce = evt?.data?.nonce;
    postMessage({
      cmd: nonce ? "CALLBACK" : "ERROR",
      error: true,
      data: { msg: e.message },
      nonce,
    });
  }
};
