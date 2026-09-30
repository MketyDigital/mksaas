import { getEditorialDraft, readEditorialDraft, removeEditorialDraft, stageEditorialDraft } from './editorial-drafts';

const insert = jest.fn();
const deleteDraft = jest.fn();
const findFirst = jest.fn();
const select = jest.fn();

jest.mock('@/shared/db', () => ({
  db: {
    insert: (...args: unknown[]) => insert(...args),
    delete: (...args: unknown[]) => deleteDraft(...args),
    query: { platformEditorialDrafts: { findFirst: (...args: unknown[]) => findFirst(...args) } },
    select: (...args: unknown[]) => select(...args),
  },
}));
jest.mock('./authorization', () => ({
  requirePlatformContentAccess: jest.fn(async () => ({})),
  requirePlatformAppExperienceAccess: jest.fn(async () => ({})),
}));

describe('isolated editorial draft storage', () => {
  const key = { area: 'public-site' as const, entityType: 'page' as const, entityKey: 'public-pages' };

  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockReturnValue({ values: () => ({ onConflictDoUpdate: jest.fn(async () => undefined) }) });
    deleteDraft.mockReturnValue({ where: jest.fn(async () => undefined) });
  });

  it('stores and reopens an unfinished draft without mutating published tables', async () => {
    const payload = { pages: [{ slug: 'platform', title: 'New copy' }] };
    await stageEditorialDraft(key, payload, 'operator-id');
    expect(insert).toHaveBeenCalledTimes(1);
    findFirst.mockResolvedValue({ payloadJson: payload });
    await expect(getEditorialDraft('platform-control', key)).resolves.toEqual(payload);
    expect(deleteDraft).not.toHaveBeenCalled();
  });

  it('removes only the staged payload after a successful publication', async () => {
    await removeEditorialDraft(key);
    expect(deleteDraft).toHaveBeenCalledTimes(1);
  });

  it('reads the draft under a row lock when publication supplies its transaction', async () => {
    const payload = { pages: [{ slug: 'platform', title: 'Version being published' }] };
    const limit = jest.fn(async () => [{ payloadJson: payload }]);
    const lock = jest.fn(() => ({ limit }));
    const where = jest.fn(() => ({ for: lock }));
    const from = jest.fn(() => ({ where }));
    const transaction = { select: jest.fn(() => ({ from })) };

    await expect(readEditorialDraft(key, transaction as never)).resolves.toEqual(payload);

    expect(transaction.select).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledWith('update');
  });
});
