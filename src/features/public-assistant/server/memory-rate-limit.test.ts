const mockLimit = jest.fn();
const mockWhere = jest.fn(() => ({ limit: mockLimit }));
const mockInnerJoin = jest.fn(() => ({ where: mockWhere }));
const mockFrom = jest.fn(() => ({ innerJoin: mockInnerJoin }));
const mockSelect = jest.fn(() => ({ from: mockFrom }));

import { getPublicAIRecentUserMessageCount, PUBLIC_AI_RATE_LIMIT_PER_MINUTE } from './memory';

describe('Public Mkety AI rate-limit lookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLimit.mockResolvedValue(Array.from({ length: PUBLIC_AI_RATE_LIMIT_PER_MINUTE }, (_, i) => ({ id: String(i) })));
  });

  it('uses a bounded recent-message lookup instead of an aggregate query', async () => {
    const database = {
      select: mockSelect,
    } as unknown as Parameters<typeof getPublicAIRecentUserMessageCount>[0];

    const count = await getPublicAIRecentUserMessageCount(
      database,
      '8bcfb6d6-5246-4a55-87d8-a53f7bbcc6df',
      new Date(),
    );

    expect(mockLimit).toHaveBeenCalledWith(PUBLIC_AI_RATE_LIMIT_PER_MINUTE);
    expect(count).toBe(PUBLIC_AI_RATE_LIMIT_PER_MINUTE);
  });
});
