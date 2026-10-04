import fs from "node:fs";
import vm from "node:vm";

import ts from "typescript";
import { moveRouteTarget } from "../src/route-order.ts";

const source = fs.readFileSync(new URL("../src/ui.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const commonJsModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: commonJsModule,
  exports: commonJsModule.exports,
  require: (id) => {
    if (id === "./route-order") return { moveRouteTarget };
    throw new Error(`Unexpected require: ${id}`);
  },
});
const { renderCustomerPortal, renderOperatorPortal } = commonJsModule.exports;
if (typeof renderOperatorPortal !== "function") throw new Error("renderOperatorPortal export missing");
if (typeof renderCustomerPortal !== "function") throw new Error("renderCustomerPortal export missing");

const html = renderOperatorPortal([]);
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error("Operator page script not found");
const script = match[1];
for (const marker of [
  "data-route-status", "Pause alias", "Resume alias", "Media readiness", "validated, priced target(s)",
  "data-target-make-primary", "data-target-move-up", "data-target-move-down",
  "Review route order before publish", "mRouteCurrent", "mRouteNext", "Publish new route order",
  "moveRouteTarget(targets,from,to)",
  "To reorder provider priority",
]) {
  if (!script.includes(marker)) throw new Error(`Operator model route control missing: ${marker}`);
}
const reorderHandler = script.match(/const moveTarget=\(from,to\)=>\{([\s\S]*?)\};/);
if (!reorderHandler) throw new Error("Local route reorder handler missing");
if (reorderHandler[1].includes("api(")) throw new Error("Reordering a route must not publish before the explicit save action");
if (!script.includes("mSave.onclick=async()=>")) throw new Error("Explicit route publish action missing");

// Syntax check the exact JavaScript shipped to the browser.
new Function(script);

class FakeClassList {
  add() {}
  remove() {}
  toggle() {}
}
class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.innerHTML = "";
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.dataset = {};
    this.onclick = null;
    this.onchange = null;
    this.classList = new FakeClassList();
    this.files = [];
  }
  querySelectorAll() { return []; }
  insertAdjacentHTML() {}
}
const ids = [
  "modal","dialog","metrics","rows","providersBox","modelsBox","healthBox","auditBox",
  "newCustomer","opsLogout","refreshCustomers","refreshModels","refreshProviders","newProvider","refreshOps"
];
const elements = new Map(ids.map((id) => [id, new FakeElement(id)]));
const document = {
  body: new FakeElement("body"),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  },
  querySelectorAll() { return []; },
};
const window = {};
const location = { reload() {}, href: "" };
const fetch = async (path) => ({
  ok: true,
  async json() {
    const p = String(path);
    if (p.includes("/customers")) return { customers: [] };
    if (p.includes("/providers")) return { providers: [] };
    if (p.includes("/models")) return { models: [] };
    if (p.includes("/health")) return { status: "ok", activeCustomers: 0, activeAssistants: 0, webhookErrors24h: 0, overdueReminders: 0, openHandoffs: 0 };
    if (p.includes("/audit")) return { events: [] };
    return {};
  },
});
const alert = () => {};
const setTimeout = (fn) => { if (typeof fn === "function") fn(); return 1; };

const run = new Function("document","window","fetch","location","alert","setTimeout", script);
run(document, window, fetch, location, alert, setTimeout);

for (const id of ["newCustomer","opsLogout","refreshCustomers","refreshModels","refreshProviders","newProvider","refreshOps"]) {
  if (typeof document.getElementById(id).onclick !== "function") {
    throw new Error(`${id} click handler was not bound`);
  }
}

// Exercise the two most important dialog launchers.
document.getElementById("newCustomer").onclick();
if (typeof document.getElementById("nCreate").onclick !== "function") {
  throw new Error("New customer dialog create handler was not bound");
}
document.getElementById("newProvider").onclick();
if (typeof document.getElementById("prSave").onclick !== "function") {
  throw new Error("Provider dialog save handler was not bound");
}

console.log("Operator browser script parses, initializes, and binds primary controls.");


const customerHtml = renderCustomerPortal({
  customerName: "Browser Test",
  hostname: "browser-test.assist.mkety.app",
  email: "owner@example.com",
  role: "owner",
});
const customerMatch = customerHtml.match(/<script>([\s\S]*?)<\/script>/);
if (!customerMatch) throw new Error("Customer page script not found");
const customerScript = customerMatch[1];
new Function(customerScript);
if (!customerScript.includes("const byId=id=>document.getElementById(id);")) throw new Error("Customer API settings lookup helper missing");

const customerIds = ["brand","who","host","nav","logout","modal","dialog","toast","content","topTitle"];
const customerElements = new Map(customerIds.map((id) => [id, new FakeElement(id)]));
const customerDocument = {
  body: new FakeElement("body"),
  documentElement: { style: { setProperty() {} } },
  getElementById(id) {
    if (!customerElements.has(id)) customerElements.set(id, new FakeElement(id));
    return customerElements.get(id);
  },
  querySelectorAll(selector) {
    return selector === "[id]" ? [...customerElements.values()] : [];
  },
};
const customerFetch = async (path) => ({
  ok: true,
  async json() {
    const p = String(path);
    if (p.includes("/assistants")) return { assistants: [] };
    if (p.includes("/knowledge")) return { collections: [] };
    if (p.includes("/usage")) return { credits: { balance: 0 }, plan: {} };
    if (p.includes("/conversations")) return { conversations: [] };
    if (p.includes("/handoffs")) return { handoffs: [] };
    if (p.includes("/reminders")) return { reminders: [] };
    if (p.includes("/keys")) return { keys: [] };
    return {};
  },
});
const oldDocument = globalThis.document;
const oldWindow = globalThis.window;
const oldFetch = globalThis.fetch;
const oldLocation = globalThis.location;
const oldAlert = globalThis.alert;
const oldPrompt = globalThis.prompt;
const oldConfirm = globalThis.confirm;
try {
  globalThis.document = customerDocument;
  globalThis.window = globalThis;
  globalThis.fetch = customerFetch;
  globalThis.location = { reload() {}, href: "" };
  globalThis.alert = () => {};
  globalThis.prompt = () => null;
  globalThis.confirm = () => true;
  new Function(customerScript)();
  if (typeof customerDocument.getElementById("nav").onclick !== "function") throw new Error("Customer navigation handler was not bound");
  if (typeof customerDocument.getElementById("logout").onclick !== "function") throw new Error("Customer logout handler was not bound");
  if (!customerHtml.includes("API Access")) throw new Error("Customer API Access section missing");
  if (!customerHtml.includes("Human Operations")) throw new Error("Customer Human Operations section missing");
  if (!customerHtml.includes("data-pause-conversation")) throw new Error("Human Operations conversation pause control missing");
  if (!customerHtml.includes("pauseConversation:pause?.checked===true")) throw new Error("Human Operations pause choice is not saved");
  if (!customerHtml.includes("data-save-human-ops-permission")) throw new Error("Human Operations actor access controls missing");
  if (!customerHtml.includes("Can send customer-bound replies")) throw new Error("Human Operations reply permission label missing");
  if (!customerScript.includes("/api/human-approvals")) throw new Error("Human approval list and decision handlers missing");
  if (!customerScript.includes("/api/human-operations")) throw new Error("Per-assistant Human Operations opt-in missing");
  if (!customerScript.includes("does not send a message into the customer conversation")) throw new Error("Review creation must stay out of customer conversations");
  if (!customerHtml.includes("https://checkout.flutterwave.com/v3.js")) throw new Error("Flutterwave Inline SDK missing");
  if (!customerHtml.includes("/api/billing/plan/start")) throw new Error("Plan funding checkout missing");
  if (!customerHtml.includes("FlutterwaveCheckout")) throw new Error("Flutterwave Inline launcher missing");
} finally {
  globalThis.document = oldDocument;
  globalThis.window = oldWindow;
  globalThis.fetch = oldFetch;
  globalThis.location = oldLocation;
  globalThis.alert = oldAlert;
  globalThis.prompt = oldPrompt;
  globalThis.confirm = oldConfirm;
}
console.log("Customer browser script parses, initializes, and exposes API Access.");



const indexSource = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
const indexCompiled = ts.transpileModule(indexSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const indexModule = { exports: {} };
vm.runInNewContext(indexCompiled, {
  module: indexModule,
  exports: indexModule.exports,
  require(specifier) {
    if (String(specifier).endsWith("./ui")) return { renderCustomerPortal() { return ""; }, renderOperatorPortal() { return ""; } };
    if (String(specifier).endsWith("./runtime")) return {};
    if (String(specifier).endsWith("./operator-oidc")) return {};
    return {};
  },
  crypto: globalThis.crypto,
  TextEncoder,
  TextDecoder,
  URL,
  Response,
  Headers,
  Blob,
  atob,
  btoa,
  console,
});
const setupPage = indexModule.exports.setupPage;
if (typeof setupPage !== "function") throw new Error("setupPage export missing from index module");
const setupResponse = setupPage({
  customerId: "cus_test",
  customerSlug: "test",
  customerName: "Setup Test",
  hostname: "test.assist.mkety.app",
}, "token_test_123");
const setupHtml = await setupResponse.text();
const setupMatch = setupHtml.match(/<script>([\s\S]*?)<\/script>/);
if (!setupMatch) throw new Error("Setup page script not found");
new Function(setupMatch[1]);
if (!setupHtml.includes("/api/auth/setup/validate?token=")) throw new Error("Setup page preflight validation missing");
if (!setupHtml.includes("setupPassword")) throw new Error("Setup page explicit password input missing");
console.log("Setup page browser script parses and includes token preflight validation.");
