export type ProviderCapability = "text" | "vision" | "audio" | "tools";

export type ByokPolicy = "managed" | "strict_byok" | "explicit_paid_fallback";

export type ProviderRequest = {
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  temperature?: number;
};

export type ProviderUsage = {
  inputUnits: number;
  outputUnits: number;
};

export type ProviderResult = {
  text: string;
  usage: ProviderUsage;
  provider: string;
  model: string;
};
