import { summarizeErrorChain } from './error-diagnostics';

describe('Public Mkety AI error diagnostics', () => {
  it('captures nested error names, messages, and codes without arbitrary properties', () => {
    const postgresError = Object.assign(new Error('connection terminated unexpectedly'), {
      name: 'PostgresError',
      code: '57P01',
      detail: 'secret detail must not be copied',
    });
    const drizzleError = Object.assign(new Error('Failed query: insert into public_ai_visitors'), {
      cause: postgresError,
      query: 'insert into public_ai_visitors ...',
      params: ['visitor-secret'],
    });

    expect(summarizeErrorChain(drizzleError)).toEqual([
      {
        name: 'Error',
        message: 'Failed query: insert into public_ai_visitors',
      },
      {
        name: 'PostgresError',
        message: 'connection terminated unexpectedly',
        code: '57P01',
      },
    ]);
  });
});
