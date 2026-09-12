import { getDefaultLegalPage } from './legal-page-defaults';

describe('Mkety public legal pages', () => {
  it('provides production-safe privacy and terms defaults without invented certifications or retention promises', () => {
    const privacy = getDefaultLegalPage('privacy');
    const terms = getDefaultLegalPage('terms');

    expect(privacy?.headline).toMatch(/privacy/i);
    expect(terms?.headline).toMatch(/terms/i);

    const text = JSON.stringify([privacy, terms]).toLowerCase();
    expect(text).not.toContain('soc 2 certified');
    expect(text).not.toContain('iso 27001 certified');
    expect(text).not.toMatch(/retain(ed)? for \d+ (day|days|year|years)/);
  });
});
