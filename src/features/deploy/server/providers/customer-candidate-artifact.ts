import type {
  CloudflareCandidateArtifact,
  CloudflareCandidateArtifactSource,
} from './cloudflare-candidate';

const COMPATIBILITY_DATE = '2026-09-19';

export const customerCandidateProofArtifactSource: CloudflareCandidateArtifactSource = {
  async load(context): Promise<CloudflareCandidateArtifact> {
    const payload = JSON.stringify({
      ok: true,
      product: 'Mkety Deploy',
      mode: 'customer-candidate-proof',
      deploymentId: context.deploymentId,
      application: context.application.slug,
      environment: context.environment.slug,
      releaseRef: context.releaseRef ?? null,
      sourceRef: context.sourceRef ?? null,
    });

    return {
      mainModule: 'index.js',
      compatibilityDate: COMPATIBILITY_DATE,
      modules: [
        {
          name: 'index.js',
          source: `export default { async fetch() { return new Response(${JSON.stringify(
            payload,
          )}, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); } };`,
        },
      ],
    };
  },
};
