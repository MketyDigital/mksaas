import fs from "node:fs";
import vm from "node:vm";

import ts from "typescript";

const source = fs.readFileSync(new URL("../src/ui.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const commonJsModule = { exports: {} };
vm.runInNewContext(compiled, { module: commonJsModule, exports: commonJsModule.exports, require: () => { throw new Error("Unexpected require"); } });
const { renderCustomerPortal, renderOperatorPortal } = commonJsModule.exports;
if (typeof renderOperatorPortal !== "function") throw new Error("renderOperatorPortal export missing");
if (typeof renderCustomerPortal !== "function") throw new Error("renderCustomerPortal export missing");

const html = renderOperatorPortal([]);
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) throw new Error("Operator page script not found");
const script = match[1];

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
