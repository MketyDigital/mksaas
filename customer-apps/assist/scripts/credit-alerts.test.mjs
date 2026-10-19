import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const atoms = (mkredits) => mkredits * 10_000;

function makeDbWithAlertMigration() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE customers(id TEXT PRIMARY KEY);
    CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT,telegram_user_id TEXT,telegram_recovery_assistant_id TEXT);
    CREATE TABLE customer_users(customer_id TEXT,user_id TEXT,role TEXT);
    CREATE TABLE assistants(id TEXT PRIMARY KEY,customer_id TEXT,status TEXT);
    CREATE TABLE assistant_channels(customer_id TEXT,assistant_id TEXT,channel TEXT,status TEXT);
    CREATE TABLE credit_accounts(customer_id TEXT PRIMARY KEY,balance INTEGER NOT NULL);
    CREATE TABLE credit_ledger(id TEXT PRIMARY KEY,customer_id TEXT NOT NULL,delta INTEGER NOT NULL,kind TEXT NOT NULL,balance_after INTEGER NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE commercial_policy(customer_id TEXT PRIMARY KEY,included_credits INTEGER NOT NULL);
    INSERT INTO customers VALUES ('cus_1');
    INSERT INTO credit_accounts VALUES ('cus_1',${atoms(50_000)});
    INSERT INTO commercial_policy VALUES ('cus_1',${atoms(50_000)});
  `);
  const migrationUrl = new URL("../migrations/0047_owner_credit_alerts.sql", import.meta.url);
  assert.equal(existsSync(migrationUrl), true, "owner credit alert migration should exist");
  const migration = readFileSync(migrationUrl, "utf8");
  db.exec(migration);
  return db;
}

function asD1(sqlite) {
  const wrap = (sql, values = []) => ({
    bind(...args) { return wrap(sql, args); },
    async run() { return { meta: sqlite.prepare(sql).run(...values) }; },
    async first() { return sqlite.prepare(sql).get(...values) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
  });
  return { prepare: (sql) => wrap(sql) };
}

function addLedger(db, id, delta, balance, kind = "inference_reserve") {
  db.prepare("INSERT INTO credit_ledger(id,customer_id,delta,kind,balance_after,created_at) VALUES(?,?,?,?,?,?)")
    .run(id, "cus_1", delta, kind, balance, 1000);
}

test("soft warning begins at 20% of monthly MKredit and critical begins at 2,000", async () => {
  const moduleUrl = new URL("../src/billing/credit-alerts.ts", import.meta.url);
  assert.equal(existsSync(moduleUrl), true, "credit alert projection should exist");
  const { creditAlertProjection } = await import(moduleUrl.href);
  assert.equal(creditAlertProjection(atoms(10_001), atoms(50_000)).level, "normal");
  assert.equal(creditAlertProjection(atoms(10_000), atoms(50_000)).level, "soft");
  assert.equal(creditAlertProjection(atoms(2_001), atoms(50_000)).level, "soft");
  assert.equal(creditAlertProjection(atoms(2_000), atoms(50_000)).level, "critical");
  assert.equal(creditAlertProjection(0, atoms(50_000)).level, "critical");
});

test("soft threshold is suppressed when it overlaps the 2,000 MKredit critical threshold", async () => {
  const moduleUrl = new URL("../src/billing/credit-alerts.ts", import.meta.url);
  assert.equal(existsSync(moduleUrl), true, "credit alert projection should exist");
  const { creditAlertProjection } = await import(moduleUrl.href);
  const lowAllocation = creditAlertProjection(atoms(1_500), atoms(5_000));
  assert.equal(lowAllocation.level, "critical");
  assert.equal(lowAllocation.softThresholdMkredits, null);
  assert.equal(creditAlertProjection(atoms(2_001), atoms(5_000)).level, "normal");
  assert.equal(creditAlertProjection(atoms(2_000), atoms(0)).level, "critical");
});

test("ledger crossing enqueues one soft notification outside customer messaging", () => {
  const db = makeDbWithAlertMigration();
  try {
    addLedger(db, "led_soft", -atoms(41_000), atoms(9_000));
    const rows = db.prepare("SELECT alert_level,balance_atoms,status FROM owner_credit_alert_outbox ORDER BY alert_level").all();
    assert.deepEqual(rows.map((r) => [r.alert_level, r.balance_atoms, r.status]), [["soft", atoms(9_000), "pending"]]);
    addLedger(db, "led_same_balance", -atoms(1), atoms(8_999));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM owner_credit_alert_outbox").get().n, 1);
  } finally { db.close(); }
});

test("a single debit crossing both thresholds creates only the critical alert", () => {
  const db = makeDbWithAlertMigration();
  try {
    addLedger(db, "led_both", -atoms(49_000), atoms(1_000));
    assert.deepEqual(db.prepare("SELECT alert_level FROM owner_credit_alert_outbox").all().map((r) => r.alert_level), ["critical"]);
  } finally { db.close(); }
});

test("only a real funding ledger entry above soft re-arms alerts", () => {
  const db = makeDbWithAlertMigration();
  try {
    addLedger(db, "led_critical", -atoms(49_000), atoms(1_000));
    addLedger(db, "led_reservation_release", atoms(20_000), atoms(21_000), "inference_release");
    addLedger(db, "led_again_no_rearm", -atoms(20_000), atoms(1_000));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM owner_credit_alert_outbox WHERE alert_level='critical'").get().n, 1);
    addLedger(db, "led_topup", atoms(30_000), atoms(31_000), "topup");
    addLedger(db, "led_critical_again", -atoms(30_000), atoms(1_000));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM owner_credit_alert_outbox WHERE alert_level='critical'").get().n, 2);
  } finally { db.close(); }
});

test("scheduled delivery sends only to eligible owner/admin linked Telegram accounts and retries without chat jobs", async () => {
  const moduleUrl = new URL("../src/billing/credit-alerts.ts", import.meta.url);
  const { processOwnerCreditAlertOutbox } = await import(moduleUrl.href);
  const sent = [];
  const db = makeDbWithAlertMigration();
  try {
    db.exec(`
      INSERT INTO users(id,status,telegram_user_id,telegram_recovery_assistant_id) VALUES
        ('owner','active','tg_owner','assistant'),('admin','active','tg_admin','assistant'),
        ('member','active','tg_member','assistant'),('disabled','disabled','tg_disabled','assistant');
      INSERT INTO customer_users(customer_id,user_id,role) VALUES
        ('cus_1','owner','owner'),('cus_1','admin','admin'),('cus_1','member','member'),('cus_1','disabled','owner');
      INSERT INTO assistants(id,customer_id,status) VALUES ('assistant','cus_1','active');
      INSERT INTO assistant_channels(customer_id,assistant_id,channel,status) VALUES ('cus_1','assistant','telegram','active');
      INSERT INTO credit_ledger(id,customer_id,delta,kind,balance_after,created_at) VALUES('ledger','cus_1',-1,'inference_reserve',10000000,1000);
      INSERT INTO owner_credit_alert_outbox(id,customer_id,source_ledger_id,alert_level,balance_atoms,threshold_atoms,next_attempt_at,created_at)
        VALUES('event','cus_1','ledger','critical',10000000,20000000,1000,1000);
    `);
    let attempt = 0;
    const deliver = async (recipient) => {
      sent.push(recipient.userId);
      if (recipient.userId === "owner" && attempt++ === 0) return false;
      return true;
    };
    await processOwnerCreditAlertOutbox(asD1(db), deliver, 1000);
    assert.deepEqual(sent.sort(), ["admin", "owner"]);
    assert.equal(db.prepare("SELECT status FROM owner_credit_alert_outbox WHERE id='event'").get().status, "pending");
    assert.equal(db.prepare("SELECT status FROM owner_credit_alert_deliveries WHERE outbox_id='event' AND user_id='admin'").get().status, "sent");
    assert.equal(db.prepare("SELECT status FROM owner_credit_alert_deliveries WHERE outbox_id='event' AND user_id='owner'").get().status, "pending");
    await processOwnerCreditAlertOutbox(asD1(db), deliver, 2000);
    assert.deepEqual(sent.sort(), ["admin", "owner", "owner"]);
    assert.equal(db.prepare("SELECT status FROM owner_credit_alert_outbox WHERE id='event'").get().status, "completed");
  } finally { db.close(); }
});

test("owner alert API, UI, and scheduler stay outside customer conversation flow", () => {
  const index = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../src/runtime.ts", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../src/ui.ts", import.meta.url), "utf8");
  assert.match(index, /processOwnerCreditAlertOutbox/);
  assert.match(index, /creditAlertProjection/);
  assert.match(runtime, /credit_low/);
  assert.match(runtime, /session\.role !== "owner" && session\.role !== "admin"/);
  assert.match(index, /processOwnerCreditAlertOutbox\(env\)\.catch/);
  assert.match(ui, /data-notify-kind="credit_low"/);
  assert.match(ui, /u\.creditAlert/);
  assert.doesNotMatch(runtime.slice(runtime.indexOf("async function processInboundQueue"), runtime.indexOf("async function processReplyQueue")), /processOwnerCreditAlertOutbox|owner_credit_alert_outbox/);
});

test("opted-out owners receive no Telegram low-credit delivery", async () => {
  const moduleUrl = new URL("../src/billing/credit-alerts.ts", import.meta.url);
  const { processOwnerCreditAlertOutbox } = await import(moduleUrl.href);
  const db = makeDbWithAlertMigration();
  try {
    db.exec(`
      INSERT INTO users(id,status,telegram_user_id,telegram_recovery_assistant_id) VALUES ('owner','active','tg_owner','assistant');
      INSERT INTO customer_users(customer_id,user_id,role) VALUES ('cus_1','owner','owner');
      INSERT INTO assistants(id,customer_id,status) VALUES ('assistant','cus_1','active');
      INSERT INTO assistant_channels(customer_id,assistant_id,channel,status) VALUES ('cus_1','assistant','telegram','active');
      INSERT INTO owner_credit_alert_preferences(customer_id,user_id,enabled,updated_at) VALUES ('cus_1','owner',0,1000);
      INSERT INTO credit_ledger(id,customer_id,delta,kind,balance_after,created_at) VALUES('ledger_optout','cus_1',-1,'inference_reserve',10000000,1000);
      INSERT INTO owner_credit_alert_outbox(id,customer_id,source_ledger_id,alert_level,balance_atoms,threshold_atoms,next_attempt_at,created_at)
        VALUES('event_optout','cus_1','ledger_optout','critical',10000000,20000000,1000,1000);
    `);
    let deliveries = 0;
    await processOwnerCreditAlertOutbox(asD1(db), async () => { deliveries++; return true; }, 1000);
    assert.equal(deliveries, 0);
    assert.equal(db.prepare("SELECT status FROM owner_credit_alert_outbox WHERE id='event_optout'").get().status, "completed");
  } finally { db.close(); }
});

test("a queued retry is skipped if the owner opts out before retry delivery", async () => {
  const moduleUrl = new URL("../src/billing/credit-alerts.ts", import.meta.url);
  const { processOwnerCreditAlertOutbox } = await import(moduleUrl.href);
  const db = makeDbWithAlertMigration();
  try {
    db.exec(`
      INSERT INTO users(id,status,telegram_user_id,telegram_recovery_assistant_id) VALUES ('owner','active','tg_owner','assistant');
      INSERT INTO customer_users(customer_id,user_id,role) VALUES ('cus_1','owner','owner');
      INSERT INTO assistants(id,customer_id,status) VALUES ('assistant','cus_1','active');
      INSERT INTO assistant_channels(customer_id,assistant_id,channel,status) VALUES ('cus_1','assistant','telegram','active');
      INSERT INTO credit_ledger(id,customer_id,delta,kind,balance_after,created_at) VALUES('ledger_optout_retry','cus_1',-1,'inference_reserve',10000000,1000);
      INSERT INTO owner_credit_alert_outbox(id,customer_id,source_ledger_id,alert_level,balance_atoms,threshold_atoms,next_attempt_at,created_at)
        VALUES('event_optout_retry','cus_1','ledger_optout_retry','critical',10000000,20000000,1000,1000);
    `);
    let deliveries = 0;
    const failOnce = async () => { deliveries++; return false; };
    await processOwnerCreditAlertOutbox(asD1(db), failOnce, 1000);
    assert.equal(deliveries, 1);
    db.prepare("INSERT INTO owner_credit_alert_preferences(customer_id,user_id,enabled,updated_at) VALUES('cus_1','owner',0,2000)").run();
    await processOwnerCreditAlertOutbox(asD1(db), async () => { deliveries++; return true; }, 2000);
    assert.equal(deliveries, 1, "retry must re-check current preference before sending");
    assert.equal(db.prepare("SELECT status FROM owner_credit_alert_deliveries WHERE outbox_id='event_optout_retry' AND user_id='owner'").get().status, "skipped");
    assert.equal(db.prepare("SELECT status FROM owner_credit_alert_outbox WHERE id='event_optout_retry'").get().status, "completed");
  } finally { db.close(); }
});

test("critical crossing suppresses and disarms soft until a real refill clears both thresholds", () => {
  const db = makeDbWithAlertMigration();
  try {
    addLedger(db, "led_critical_suppress", -atoms(49_000), atoms(1_000));
    addLedger(db, "led_reservation_release_over_soft", atoms(20_000), atoms(21_000), "inference_release");
    addLedger(db, "led_falls_to_soft_again", -atoms(12_000), atoms(9_000));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM owner_credit_alert_outbox WHERE alert_level='soft'").get().n, 0);
    addLedger(db, "led_funding_refill", atoms(30_000), atoms(39_000), "topup");
    addLedger(db, "led_soft_after_refill", -atoms(30_000), atoms(9_000));
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM owner_credit_alert_outbox WHERE alert_level='soft'").get().n, 1);
  } finally { db.close(); }
});
