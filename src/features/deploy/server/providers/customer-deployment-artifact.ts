export interface CustomerDeploymentArtifactModule {
  name: string;
  source: string;
  contentType: 'application/javascript+module' | 'text/javascript+module';
}

export interface CustomerDeploymentArtifact {
  mainModule: string;
  compatibilityDate: string;
  modules: CustomerDeploymentArtifactModule[];
}

const MAX_MODULES = 20;
const MAX_TOTAL_SOURCE_BYTES = 1_048_576;
const MODULE_NAME = /^[A-Za-z0-9._/-]+$/;
const CONTENT_TYPES = new Set(['application/javascript+module', 'text/javascript+module']);

export function parseCustomerDeploymentArtifact(value: unknown): CustomerDeploymentArtifact {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Customer deployment artifact is invalid.');
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.mainModule !== 'string' || !raw.mainModule.trim()) {
    throw new Error('Customer deployment artifact main module is invalid.');
  }
  if (typeof raw.compatibilityDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.compatibilityDate)) {
    throw new Error('Customer deployment artifact compatibility date is invalid.');
  }
  if (!Array.isArray(raw.modules) || raw.modules.length < 1 || raw.modules.length > MAX_MODULES) {
    throw new Error('Customer deployment artifact has an invalid module count.');
  }

  const names = new Set<string>();
  let totalSourceBytes = 0;
  const modules = raw.modules.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Customer deployment artifact module is invalid.');
    }
    const moduleEntry = entry as Record<string, unknown>;
    const name = typeof moduleEntry.name === 'string' ? moduleEntry.name : '';
    const source = typeof moduleEntry.source === 'string' ? moduleEntry.source : '';
    if (!name || name.startsWith('/') || name.includes('..') || !MODULE_NAME.test(name)) {
      throw new Error('Customer deployment artifact contains an invalid module name.');
    }
    if (names.has(name)) throw new Error('Customer deployment artifact contains a duplicate module name.');
    names.add(name);
    if (!source.trim()) throw new Error('Customer deployment artifact contains an empty module.');
    totalSourceBytes += new TextEncoder().encode(source).byteLength;

    const contentType = moduleEntry.contentType == null ? 'application/javascript+module' : moduleEntry.contentType;
    if (typeof contentType !== 'string' || !CONTENT_TYPES.has(contentType)) {
      throw new Error('Customer deployment artifact module content type is invalid.');
    }
    return { name, source, contentType: contentType as CustomerDeploymentArtifactModule['contentType'] };
  });

  if (!names.has(raw.mainModule)) throw new Error('Customer deployment artifact main module is missing from the bundle.');
  if (totalSourceBytes > MAX_TOTAL_SOURCE_BYTES) {
    throw new Error('Customer deployment artifact exceeds the 1 MiB source-size limit.');
  }

  return {
    mainModule: raw.mainModule,
    compatibilityDate: raw.compatibilityDate,
    modules,
  };
}
