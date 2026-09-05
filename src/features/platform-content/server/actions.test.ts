import { platformContentDraftActionSchema, platformPublishActionSchema } from './actions';

describe('platform content admin actions', () => {
  it('validates draft save requests with a known content area', () => {
    const parsed = platformContentDraftActionSchema.parse({
      area: 'public-site',
      entityType: 'page',
      entityKey: 'home',
      payload: { title: 'Mkety' },
    });

    expect(parsed.area).toBe('public-site');
    expect(parsed.entityType).toBe('page');
  });

  it('validates publish requests without accepting arbitrary action names', () => {
    const parsed = platformPublishActionSchema.parse({
      area: 'docs',
      entityType: 'docs_article',
      entityKey: 'what-is-mkety',
    });

    expect(parsed.entityType).toBe('docs_article');
  });
});
