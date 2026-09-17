/** @jest-environment node */

import { evaluateHttpProbe } from './public-assistant-production-diagnostic';

describe('public assistant production diagnostic', () => {
  it('passes only when the probed endpoint returns HTTP 200', () => {
    expect(evaluateHttpProbe('200')).toEqual({ ok: true, httpCode: 200 });
  });

  it.each(['000', '404', '500', '503'])('fails closed for HTTP %s', (code) => {
    expect(evaluateHttpProbe(code)).toEqual({ ok: false, httpCode: Number(code) });
  });

  it('fails closed for malformed status values', () => {
    expect(evaluateHttpProbe('not-a-status')).toEqual({ ok: false, httpCode: null });
  });
});
