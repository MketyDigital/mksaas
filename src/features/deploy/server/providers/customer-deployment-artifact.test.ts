import {
  parseCustomerDeploymentArtifact,
} from './customer-deployment-artifact';

const valid = {
  mainModule: 'index.js',
  compatibilityDate: '2026-10-23',
  modules: [{ name: 'index.js', source: 'export default { fetch() { return new Response("ok") } }' }],
};

describe('customer deployment artifacts', () => {
  it('accepts a bounded module bundle with an explicit main module', () => {
    expect(parseCustomerDeploymentArtifact(valid)).toEqual({
      ...valid,
      modules: [{ ...valid.modules[0], contentType: 'application/javascript+module' }],
    });
  });

  it('rejects traversal paths, missing entrypoints, and oversized artifacts', () => {
    expect(() => parseCustomerDeploymentArtifact({ ...valid, modules: [{ name: '../index.js', source: 'x' }] })).toThrow(/module name/i);
    expect(() => parseCustomerDeploymentArtifact({ ...valid, mainModule: 'missing.js' })).toThrow(/main module/i);
    expect(() => parseCustomerDeploymentArtifact({ ...valid, modules: [{ name: 'index.js', source: 'x'.repeat(1_048_577) }] })).toThrow(/size limit/i);
  });

  it('rejects non-object, duplicate, empty, and excessive module sets', () => {
    expect(() => parseCustomerDeploymentArtifact(null)).toThrow(/invalid/i);
    expect(() => parseCustomerDeploymentArtifact({ ...valid, modules: [valid.modules[0], valid.modules[0]] })).toThrow(/duplicate/i);
    expect(() => parseCustomerDeploymentArtifact({ ...valid, modules: [{ name: 'index.js', source: '' }] })).toThrow(/empty/i);
    expect(() => parseCustomerDeploymentArtifact({ ...valid, modules: Array.from({ length: 21 }, (_, i) => ({ name: `m${i}.js`, source: 'x' })) })).toThrow(/module count/i);
  });
});
