import {
  activateAiRateCard,
  createAiRateCard,
  disableEnterpriseAiInference,
  reconcilePublishedManagedAiCatalog,
  retireAiRateCard,
  updateAiRuntimePolicy,
  updateAiSolutionTemplate,
  upsertManagedAiModel,
} from '@/features/ai-runtime/server/commercial-admin-actions';
import type { getAiCommercialControlOverview } from '@/features/ai-runtime/server/commercial-admin-queries';
import { PublicAiControlPanel } from '@/features/public-assistant/components/PublicAiControlPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui';

type Overview = Awaited<ReturnType<typeof getAiCommercialControlOverview>>;

function formatUsdMicros(value: bigint) {
  const whole = value / 1_000_000n;
  const cents = ((value % 1_000_000n) * 100n) / 1_000_000n;
  return `${whole.toString()}.${cents.toString().padStart(2, '0')}`;
}

export function AiCommercialControlPanel({
  tenant,
  overview,
}: {
  tenant: string;
  overview: Overview;
}) {
  const activeRateCards = overview.rateCards.filter((item) => item.status === 'active');
  const enabledModels = overview.models.filter((item) => item.enabled);

  return (
    <div className="space-y-6">
      <PublicAiControlPanel tenant={tenant} overview={overview.publicAi} />

      <Card className="rounded-2xl border-primary/20 bg-primary/[0.025]">
        <CardHeader>
          <CardTitle>Cost protection</CardTitle>
          <CardDescription>
            Enterprise AI is prepaid-only. Customer inference cannot spend beyond available credits and applicable hard budgets.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing mode</p>
            <p className="mt-2 font-semibold">Prepaid only</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer inference</p>
            <p className="mt-2 font-semibold">
              {overview.policy.customerInferenceEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Enabled models</p>
            <p className="mt-2 font-semibold">{enabledModels.length}</p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active rate cards</p>
            <p className="mt-2 font-semibold">{activeRateCards.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>30-day cost & pricing floor</CardTitle>
          <CardDescription>
            Internal profitability inputs from recorded provider usage. Provider cost is never exposed to customers; customer pricing still comes from versioned rate cards and approved commercial terms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.profitability.length ? overview.profitability.map((row) => (
            <div className="grid gap-2 rounded-xl border p-4 text-sm md:grid-cols-6" key={`${row.tenantId}:${row.modelAlias}`}>
              <div className="md:col-span-2">
                <p className="font-semibold">{row.tenantName ?? row.tenantId}</p>
                <p className="font-mono text-xs text-muted-foreground">{row.modelAlias}</p>
              </div>
              <div><p className="text-xs text-muted-foreground">Requests</p><p className="font-semibold">{row.requests.toString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Credits charged</p><p className="font-semibold">{row.settledCredits.toString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Provider cost</p><p className="font-semibold">{formatUsdMicros(row.providerCostUsdMicros)}</p></div>
              <div><p className="text-xs text-muted-foreground">Minimum revenue floor</p><p className="font-semibold">{formatUsdMicros(row.minimumRevenueUsdMicros)}</p></div>
            </div>
          )) : (
            <p className="text-sm text-muted-foreground">No settled Enterprise AI provider usage has been recorded in the last 30 days.</p>
          )}
          <p className="text-xs text-muted-foreground">
            The floor uses the current internal 65% gross-margin target plus 15% overhead reserve. It is a planning guardrail, not a customer invoice and not a substitute for plan-level economics.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Safe customer limits</CardTitle>
          <CardDescription>
            These limits protect Mkety and customers from unexpectedly large requests. Changes apply without a code deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateAiRuntimePolicy.bind(null, tenant)} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm font-medium">
              Max request bytes
              <input
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                defaultValue={overview.policy.maxRequestBytes}
                min={1024}
                max={5000000}
                name="maxRequestBytes"
                required
                type="number"
              />
            </label>
            <label className="text-sm font-medium">
              Max messages
              <input
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                defaultValue={overview.policy.maxMessages}
                min={1}
                max={512}
                name="maxMessages"
                required
                type="number"
              />
            </label>
            <label className="text-sm font-medium">
              Max tools
              <input
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                defaultValue={overview.policy.maxTools}
                min={0}
                max={256}
                name="maxTools"
                required
                type="number"
              />
            </label>
            <label className="text-sm font-medium">
              Max output tokens
              <input
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                defaultValue={overview.policy.maxOutputTokens}
                min={1}
                max={131072}
                name="maxOutputTokens"
                required
                type="number"
              />
            </label>
            <label className="text-sm font-medium">
              Reservation seconds
              <input
                className="mt-2 w-full rounded-lg border bg-background px-3 py-2"
                defaultValue={overview.policy.reservationTtlSeconds}
                min={30}
                max={600}
                name="reservationTtlSeconds"
                required
                type="number"
              />
            </label>
            <div className="md:col-span-2 xl:col-span-5">
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Save safe limits
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Managed model catalog</CardTitle>
              <CardDescription>
                Mkety aliases can point to Workers AI, direct frontier APIs, or approved self-hosted OpenAI-compatible endpoints. Customers see the Mkety alias, not the infrastructure source.
              </CardDescription>
            </div>
            <form action={reconcilePublishedManagedAiCatalog.bind(null, tenant)}>
              <button className="rounded-xl border px-4 py-2 text-sm font-semibold">Reconcile published model catalog</button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">Add or update a managed model route</summary>
            <form action={upsertManagedAiModel.bind(null, tenant)} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-sm font-medium">
                Provider
                <select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue="openai" name="providerKey">
                  <option value="workers-ai">Workers AI</option>
                  <option value="openai">OpenAI direct</option>
                  <option value="azure-openai">Azure OpenAI</option>
                  <option value="gemini">Gemini API</option>
                  <option value="vertex">Vertex AI</option>
                  <option value="cloudflare-ai">Cloudflare AI REST</option>
                  <option value="bedrock">AWS Bedrock</option>
                  <option value="openai-compatible">OpenAI-compatible / self-hosted</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Native model ID
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={200} name="nativeModel" placeholder="gpt-5.6-sol or my-vm-model" required />
              </label>
              <label className="text-sm font-medium">
                Customer-facing Mkety alias
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={128} name="alias" placeholder="mkety-smart" required />
              </label>
              <label className="text-sm font-medium">
                Display name
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" maxLength={160} name="displayName" placeholder="Mkety Smart" />
              </label>
              <label className="text-sm font-medium">
                Context tokens
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={128000} min={1024} max={10000000} name="contextTokens" required type="number" />
              </label>
              <label className="text-sm font-medium">
                Max output tokens
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={32768} min={1} max={1000000} name="maxOutputTokens" required type="number" />
              </label>
              <label className="text-sm font-medium">
                Provider input cost · micro-USD / 1M tokens
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" min={1} name="inputUsdMicrosPerMillion" type="number" />
              </label>
              <label className="text-sm font-medium">
                Provider cached-input cost · micro-USD / 1M
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" min={1} name="cachedInputUsdMicrosPerMillion" type="number" />
              </label>
              <label className="text-sm font-medium">
                Provider output cost · micro-USD / 1M tokens
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" min={1} name="outputUsdMicrosPerMillion" type="number" />
              </label>
              <label className="text-sm font-medium">
                Cost verified date
                <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" name="providerCostVerifiedAt" type="date" />
              </label>
              <div className="grid gap-2 text-sm md:col-span-2 xl:col-span-2 sm:grid-cols-5">
                <label className="flex items-center gap-2"><input name="vision" type="checkbox" /> Vision</label>
                <label className="flex items-center gap-2"><input name="tools" type="checkbox" /> Tools</label>
                <label className="flex items-center gap-2"><input name="reasoning" type="checkbox" /> Reasoning</label>
                <label className="flex items-center gap-2"><input name="structuredOutput" type="checkbox" /> Structured output</label>
                <label className="flex items-center gap-2 font-semibold"><input name="enabled" type="checkbox" /> Enable route</label>
              </div>
              <p className="text-xs leading-5 text-muted-foreground md:col-span-2 xl:col-span-3">
                External managed models cannot be enabled until verified input/output provider costs and a verification date are saved. A rate card must also be active before customer use.
              </p>
              <button className="w-fit rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground md:col-span-2 xl:col-span-3">
                Save managed model
              </button>
            </form>
          </details>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Models and commercial readiness</CardTitle>
          <CardDescription>
            A model must be approved, enabled, routed, and have an active rate card before customer inference can be promoted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.models.map((model) => {
            const cards = overview.rateCards.filter((card) => card.modelId === model.id);
            const active = cards.find((card) => card.status === 'active');
            return (
              <div className="rounded-xl border p-4" key={model.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{model.displayName}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{model.nativeModel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-muted px-3 py-1">{model.status}</span>
                    <span className="rounded-full bg-muted px-3 py-1">{model.enabled ? 'enabled' : 'disabled'}</span>
                    <span className="rounded-full bg-muted px-3 py-1">
                      {active ? `rate v${active.version}` : 'no active rate'}
                    </span>
                  </div>
                </div>

                {cards.length ? (
                  <div className="mt-4 grid gap-2">
                    {cards.map((card) => (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm" key={card.id}>
                        <span>
                          v{card.version} · {card.status} · input {card.inputCreditsPerMillion.toString()} · output {card.outputCreditsPerMillion.toString()} credits / 1M tokens
                        </span>
                        <div className="flex gap-2">
                          {card.status === 'draft' ? (
                            <form action={activateAiRateCard.bind(null, tenant, card.id)}>
                              <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Activate</button>
                            </form>
                          ) : null}
                          {card.status === 'active' ? (
                            <form action={retireAiRateCard.bind(null, tenant, card.id)}>
                              <button className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Retire</button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">No rate version has been created for this model.</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <details className="rounded-2xl border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Advanced: create a new rate-card version</summary>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Use this only when commercial rates need to change. Existing historical versions are retained; Mkety never rewrites prior billable usage pricing.
        </p>
        <form action={createAiRateCard.bind(null, tenant)} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm font-medium">
            Model
            <select className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="modelId" required>
              <option value="">Choose model</option>
              {overview.models.map((model) => (
                <option key={model.id} value={model.id}>{model.displayName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Input credits / 1M tokens
            <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" min={1} name="inputCreditsPerMillion" required type="number" />
          </label>
          <label className="text-sm font-medium">
            Cached input credits / 1M
            <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" min={1} name="cachedInputCreditsPerMillion" type="number" />
          </label>
          <label className="text-sm font-medium">
            Output credits / 1M tokens
            <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" min={1} name="outputCreditsPerMillion" required type="number" />
          </label>
          <label className="text-sm font-medium">
            Minimum credits / request
            <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" defaultValue={1} min={1} name="minimumCreditsPerRequest" required type="number" />
          </label>
          <label className="text-sm font-medium">
            Effective from
            <input className="mt-2 w-full rounded-lg border bg-background px-3 py-2" name="effectiveFrom" type="datetime-local" />
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Create draft rate version
            </button>
          </div>
        </form>
      </details>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Business solution cards</CardTitle>
          <CardDescription>
            Change what non-technical customers see first on Mkety AI without changing code. Technical execution and security rules are not editable here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {overview.solutionTemplates.map((template) => (
            <details className="rounded-xl border p-4" key={template.key}>
              <summary className="cursor-pointer font-semibold">{template.title}</summary>
              <form action={updateAiSolutionTemplate.bind(null, tenant, template.key)} className="mt-4 grid gap-3">
                <label className="text-sm font-medium">Title
                  <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={template.title} maxLength={160} name="title" required />
                </label>
                <label className="text-sm font-medium">Simple description
                  <textarea className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={template.shortDescription} name="shortDescription" required rows={3} />
                </label>
                <label className="text-sm font-medium">Business outcomes — one per line
                  <textarea className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={template.outcomes.join('\n')} name="outcomes" required rows={4} />
                </label>
                <label className="text-sm font-medium">Setup steps — one per line
                  <textarea className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={template.setupSteps.join('\n')} name="setupSteps" required rows={4} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">Order
                    <input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" defaultValue={template.sortOrder} min={0} max={10000} name="sortOrder" required type="number" />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
                    <input defaultChecked={template.enabled} name="enabled" type="checkbox" /> Show this solution
                  </label>
                </div>
                <button className="w-fit rounded-lg border px-4 py-2 text-sm font-semibold">Save solution card</button>
              </form>
            </details>
          ))}
        </CardContent>
      </Card>

      {overview.policy.customerInferenceEnabled ? (
        <Card className="rounded-2xl border-destructive/30">
          <CardHeader>
            <CardTitle>Emergency stop</CardTitle>
            <CardDescription>
              Disables new customer Enterprise AI inference while preserving data, configuration, and audit history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={disableEnterpriseAiInference.bind(null, tenant)}>
              <button className="rounded-xl border border-destructive px-4 py-2 text-sm font-semibold text-destructive">
                Disable customer inference
              </button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
