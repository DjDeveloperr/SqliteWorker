import { SqliteWorker } from "./mod.ts";

const db = new SqliteWorker("db.sqlite");

db.on("open", () => console.log("Opened!"));
db.on("close", () => console.log("Closed!"));

await db.open();

await db.query("DROP TABLE test").catch(() => {});
console.time("Create Table");
await db.query("CREATE TABLE test (f1 TEXT, f2 INTEGER)");
console.timeEnd("Create Table");

console.time("Insert 1");
await db.query("INSERT INTO test(f1, f2) VALUES(?, ?)", ["hello", 6]);
console.timeEnd("Insert 1");
console.time("Insert 2");
await db.query("INSERT INTO test(f1, f2) VALUES(?, ?)", ["world", 9]);
console.timeEnd("Insert 2");

console.log("Changes:", await db.getChanges());
console.log("Total Changes:", await db.getTotalChanges());
console.log("Last Insert Row Id:", await db.getLastInsertRowID());

console.time("Select");
const rows = await db.query("SELECT * FROM test");
console.timeEnd("Select");
console.log("Rows:", rows);

await db.close();
