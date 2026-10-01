import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { claimOwnerAccess } from "../src/owner-access.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);
    CREATE TABLE customer_users(customer_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE setup_tokens(id TEXT PRIMARY KEY,customer_id TEXT,user_id TEXT,token_hash TEXT,consumed_at INTEGER,expires_at INTEGER);
    CREATE TABLE sessions(id TEXT PRIMARY KEY,token_hash TEXT,user_id TEXT,customer_id TEXT,expires_at INTEGER,created_at INTEGER,last_seen_at INTEGER);`);
  sqlite.exec(`INSERT INTO users VALUES('usr_1','active');
    INSERT INTO customer_users VALUES('cus_1','usr_1','owner');
    INSERT INTO setup_tokens VALUES('set_1','cus_1','usr_1','hash_1',NULL,2000);`);
  const db = {
    prepare(sql) {
      return { bind(...values) { return { sql, values }; } };
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map(({ sql, values }) => {
          const info = sqlite.prepare(sql).run(...values);
          return { meta: { changes: Number(info.changes) } };
        });
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sqlite, db };
}

const claim = {
  customerId: "cus_1", tokenId: "set_1", tokenHash: "hash_1", userId: "usr_1",
  sessionId: "ses_1", sessionHash: "session_hash", now: 1000, expiresAt: 3600,
};

test("one-time owner claim creates a session and consumes the link", async () => {
  const { sqlite, db } = fixture();
  assert.equal(await claimOwnerAccess(db, claim), true);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
  assert.equal(sqlite.prepare("SELECT consumed_at FROM setup_tokens").get().consumed_at, 1000);
  assert.equal(await claimOwnerAccess(db, { ...claim, sessionId: "ses_2", sessionHash: "other" }), false);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
  sqlite.close();
});

test("invalid or expired owner link never creates a session", async () => {
  const { sqlite, db } = fixture();
  assert.equal(await claimOwnerAccess(db, { ...claim, tokenHash: "wrong" }), false);
  assert.equal(await claimOwnerAccess(db, { ...claim, now: 2001 }), false);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
  assert.equal(sqlite.prepare("SELECT consumed_at FROM setup_tokens").get().consumed_at, null);
  sqlite.close();
});

test("session write failure rolls back link consumption", async () => {
  const { sqlite, db } = fixture();
  sqlite.exec("INSERT INTO sessions VALUES('ses_1','existing','usr_1','cus_1',3600,1000,1000)");
  await assert.rejects(claimOwnerAccess(db, claim));
  assert.equal(sqlite.prepare("SELECT consumed_at FROM setup_tokens").get().consumed_at, null);
  sqlite.close();
});
