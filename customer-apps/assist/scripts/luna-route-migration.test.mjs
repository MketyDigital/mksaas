import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const migration = readFileSync(new URL("../migrations/0044_gpt6_luna_primary_remove_sol.sql", import.meta.url), "utf8");

function database(withLuna = true) {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE provider_connections(id TEXT PRIMARY KEY,provider TEXT,default_model TEXT,status TEXT,
      validated_at INTEGER,ownership TEXT,created_at INTEGER,capabilities_json TEXT);
    CREATE TABLE model_route_targets(
      scope_key TEXT,customer_id TEXT,alias TEXT,position INTEGER,provider TEXT,provider_model TEXT,
      provider_connection_id TEXT,enabled INTEGER,input_credits_per_million INTEGER,
      output_credits_per_million INTEGER,image_credits INTEGER,audio_credits_per_minute INTEGER,
      provider_input_cost_micros_per_million INTEGER,provider_output_cost_micros_per_million INTEGER,
      provider_image_cost_micros INTEGER,provider_audio_cost_micros_per_minute INTEGER,
      created_at INTEGER,updated_at INTEGER,reasoning_capabilities_json TEXT,
      reasoning_credits_per_million INTEGER,provider_reasoning_cost_micros_per_million INTEGER,
      PRIMARY KEY(scope_key,position));
    CREATE TABLE model_routes(alias TEXT PRIMARY KEY,provider TEXT,provider_model TEXT,provider_connection_id TEXT,
      fallback_provider TEXT,fallback_model TEXT,fallback_provider_connection_id TEXT,updated_at INTEGER);
    CREATE TABLE customer_model_routes(customer_id TEXT,alias TEXT,provider TEXT,provider_model TEXT,
      provider_connection_id TEXT,fallback_provider TEXT,fallback_model TEXT,fallback_provider_connection_id TEXT,
      updated_at INTEGER,PRIMARY KEY(customer_id,alias));
  `);
  if (withLuna) db.prepare(`INSERT INTO provider_connections VALUES('luna','azure-foundry','gpt-6-luna-1','active',1,'mkety',1,'["text","image"]')`).run();
  const add = db.prepare(`INSERT INTO model_route_targets VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [scope, customer, alias, base] of [
    ["global:mkety-fast", null, "mkety-fast", 0],
    ["customer:c1:mkety-fast", "c1", "mkety-fast", 100],
    ["global:mkety-media-vision", null, "mkety-media-vision", 200],
  ]) {
    add.run(scope,customer,alias,base,"azure-foundry","gpt-5.6-sol-1","sol",1,0,0,0,0,0,0,0,0,1,1,'["standard","high","maximum"]',null,null);
    add.run(scope,customer,alias,base+1,"workers-ai","@cf/qwen/other","workers",1,0,0,0,0,0,0,0,0,1,1,'["standard"]',null,null);
    add.run(scope,customer,alias,base+2,"gemini","gemini-fallback","gemini",1,0,0,0,0,0,0,0,0,1,1,'["standard"]',null,null);
  }
  add.run("global:mkety-media-speech",null,"mkety-media-speech",0,"workers-ai","@cf/openai/whisper","whisper",1,0,0,0,0,0,0,0,0,1,1,'["standard"]',null,null);
  db.prepare("INSERT INTO model_routes VALUES('mkety-fast','azure-foundry','gpt-5.6-sol-1','sol','gemini','gemini-fallback','gemini',1)").run();
  db.prepare("INSERT INTO customer_model_routes VALUES('c1','mkety-fast','azure-foundry','gpt-5.6-sol-1','sol','gemini','gemini-fallback','gemini',1)").run();
  return db;
}

test("migration makes Luna primary and preserves non-Sol fallback order including customer overrides", () => {
  const db = database();
  db.exec(migration);
  for (const scope of ["global:mkety-fast", "customer:c1:mkety-fast", "global:mkety-media-vision"]) {
    const chain = db.prepare("SELECT provider,provider_model FROM model_route_targets WHERE scope_key=? ORDER BY position").all(scope);
    assert.deepEqual(chain.map((row) => row.provider_model), ["gpt-6-luna-1", "@cf/qwen/other", "gemini-fallback"]);
    assert.deepEqual(chain.map((row) => row.provider), ["azure-foundry", "workers-ai", "gemini"]);
  }
  assert.deepEqual(db.prepare("SELECT provider_model FROM model_route_targets WHERE scope_key='global:mkety-media-speech' ORDER BY position").all().map((row) => row.provider_model), ["@cf/openai/whisper"]);
  assert.equal(db.prepare("SELECT count(*) AS n FROM model_route_targets WHERE lower(provider_model) LIKE '%gpt-5.6-sol%'").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM model_routes WHERE lower(provider_model) LIKE '%gpt-5.6-sol%' OR lower(COALESCE(fallback_model,'')) LIKE '%gpt-5.6-sol%'").get().n, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM customer_model_routes WHERE lower(provider_model) LIKE '%gpt-5.6-sol%' OR lower(COALESCE(fallback_model,'')) LIKE '%gpt-5.6-sol%'").get().n, 0);
  const globalRoute = db.prepare("SELECT provider_model,fallback_model FROM model_routes WHERE alias='mkety-fast'").get();
  assert.equal(globalRoute.provider_model, "gpt-6-luna-1");
  assert.equal(globalRoute.fallback_model, "@cf/qwen/other");
  const customerRoute = db.prepare("SELECT provider_model,fallback_model FROM customer_model_routes WHERE customer_id='c1' AND alias='mkety-fast'").get();
  assert.equal(customerRoute.provider_model, "gpt-6-luna-1");
  assert.equal(customerRoute.fallback_model, "@cf/qwen/other");
});

test("migration leaves existing routes untouched unless a validated Luna deployment exists", () => {
  const db = database(false);
  assert.doesNotThrow(() => db.exec(migration));
  assert.equal(db.prepare("SELECT count(*) AS n FROM model_route_targets WHERE provider_model='gpt-5.6-sol-1'").get().n, 3);
  assert.equal(db.prepare("SELECT count(*) AS n FROM model_route_targets WHERE provider_model='gpt-6-luna-1'").get().n, 0);
});
