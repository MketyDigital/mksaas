export type PortalRole = "owner" | "admin" | "member";

export type CustomerScope = {
  customerId: string;
};

export type AssistantScope = CustomerScope & {
  assistantId: string;
};

export type ApiErrorShape = {
  error: string;
  message?: string;
};

export function requireCustomerScope(customerId: unknown): CustomerScope {
  if (typeof customerId !== "string" || !customerId.trim()) throw new Error("customer_scope_required");
  return { customerId: customerId.trim() };
}

export function requireAssistantScope(customerId: unknown, assistantId: unknown): AssistantScope {
  const customer = requireCustomerScope(customerId);
  if (typeof assistantId !== "string" || !assistantId.trim()) throw new Error("assistant_scope_required");
  return { ...customer, assistantId: assistantId.trim() };
}
