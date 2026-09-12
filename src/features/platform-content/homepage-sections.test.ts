import {
  defaultAcademySection,
  defaultEnterpriseSection,
  defaultPlatformOverviewSection,
  defaultSolutionHubSection,
  defaultTrustSection,
} from './defaults';
import {
  academySectionSchema,
  enterpriseSectionSchema,
  platformOverviewSectionSchema,
  solutionHubSectionSchema,
  trustSectionSchema,
} from './schemas';

describe('launch-critical Mkety homepage CMS sections', () => {
  it('validates the platform overview default', () => {
    expect(platformOverviewSectionSchema.parse(defaultPlatformOverviewSection)).toEqual(defaultPlatformOverviewSection);
  });

  it('validates the SolutionHub default', () => {
    expect(solutionHubSectionSchema.parse(defaultSolutionHubSection)).toEqual(defaultSolutionHubSection);
  });

  it('validates the Academy default', () => {
    expect(academySectionSchema.parse(defaultAcademySection)).toEqual(defaultAcademySection);
  });

  it('validates the Enterprise default', () => {
    expect(enterpriseSectionSchema.parse(defaultEnterpriseSection)).toEqual(defaultEnterpriseSection);
  });

  it('validates the trust/readiness default', () => {
    expect(trustSectionSchema.parse(defaultTrustSection)).toEqual(defaultTrustSection);
  });

  it('rejects executable HTML-like content in structured text fields by keeping the payload shape strict', () => {
    expect(() =>
      platformOverviewSectionSchema.parse({
        eyebrow: 'Platform',
        title: 'Mkety',
        description: 'Safe structured copy',
        items: [{ key: 'bad', title: 'Bad', description: '<script>alert(1)</script>', rawHtml: '<script />' }],
      }),
    ).toThrow();
  });
});
