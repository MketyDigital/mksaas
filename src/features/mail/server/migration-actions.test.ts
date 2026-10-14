/** @jest-environment node */

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));
jest.mock('./archive-import-service', () => ({ requireMailArchiveImportAccess: jest.fn().mockResolvedValue({}) }));

import { requireMailArchiveImportAccess } from './archive-import-service';
import { importMailEmlFiles } from './migration-actions';

describe('legacy Mail archive import action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('authorizes then redirects old form submissions to the resumable uploader', async () => {
    await expect(importMailEmlFiles('mkety-ops', new FormData())).rejects.toThrow(
      'redirect:/app/mkety-ops/mail/migration?error=upload-version',
    );
    expect(requireMailArchiveImportAccess).toHaveBeenCalledWith('mkety-ops');
  });
});
