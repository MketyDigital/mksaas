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

const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require: () => { throw new Error("Unexpected require"); } });
const { renderOperatorPortal } = module.exports;
if (typeof renderOperatorPortal !== "function") throw new Error("renderOperatorPortal export missing");

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
