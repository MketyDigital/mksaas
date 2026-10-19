import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const runtime = await readFile(new URL("../src/runtime.ts", import.meta.url), "utf8");
const intake = runtime.slice(
  runtime.indexOf("export async function handleAssistantTelegramWebhook"),
  runtime.indexOf("export async function processInboundQueue"),
);

test("valid owner recovery links are handled before owner and self-identity suppression", () => {
  const challengeCheck = intake.indexOf("WHERE token_hash=? AND assistant_id=? AND consumed_at IS NULL AND expires_at>?");
  const selfIdentityFilter = intake.indexOf("if (selfIdentity)");
  const ownerFilter = intake.indexOf("if (ownerSender)");
  assert.ok(challengeCheck >= 0, "the one-time link challenge must be validated");
  assert.ok(selfIdentityFilter > challengeCheck, "valid recovery links must bypass self-identity message suppression");
  assert.ok(ownerFilter > challengeCheck, "valid recovery links must bypass workspace owner/admin message suppression");
  assert.match(intake.slice(challengeCheck, ownerFilter), /assistant_id=\? AND consumed_at IS NULL AND expires_at>\?/);
  assert.match(intake.slice(challengeCheck, ownerFilter), /UPDATE telegram_link_challenges SET consumed_at=\?/);
  assert.match(intake.slice(challengeCheck, ownerFilter), /recoveryLinked: true/);
});

test("ordinary owner/admin Telegram messages remain ignored", () => {
  assert.match(intake, /if \(ownerSender\)\s*\{\s*await markWebhook\(env\.DB, assistantId, updateId, "ignored"\);\s*return json\(\{ ok: true, ignoredOwnerSender: true \}\);/);
});
