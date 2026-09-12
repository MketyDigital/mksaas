export type PublicAssistantErrorDiagnostic = {
  name: string;
  message: string;
  code?: string;
};

function toDiagnostic(error: unknown): PublicAssistantErrorDiagnostic | null {
  if (!(error instanceof Error)) return null;

  const diagnostic: PublicAssistantErrorDiagnostic = {
    name: error.name,
    message: error.message,
  };
  const code = (error as Error & { code?: unknown }).code;
  if (typeof code === 'string') diagnostic.code = code;

  return diagnostic;
}

export function summarizeErrorChain(error: unknown, maxDepth = 3): PublicAssistantErrorDiagnostic[] {
  const diagnostics: PublicAssistantErrorDiagnostic[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current instanceof Error && diagnostics.length < maxDepth && !seen.has(current)) {
    seen.add(current);
    const diagnostic = toDiagnostic(current);
    if (diagnostic) diagnostics.push(diagnostic);
    current = (current as Error & { cause?: unknown }).cause;
  }

  return diagnostics;
}
