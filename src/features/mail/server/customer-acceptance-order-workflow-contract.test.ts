import fs from 'node:fs';
import path from 'node:path';

describe('Mail then Enterprise AI acceptance order', () => {
  const candidate = fs.readFileSync(
    path.join(process.cwd(), '.github/workflows/mkety-public-candidate-deploy.yml'),
    'utf8',
  );
  const manualGate = "github.event_name == 'workflow_dispatch' && inputs.run_enterprise_ai_acceptance == true";

  it('keeps internal Enterprise AI acceptance off automatic candidate deployments', () => {
    expect(candidate).toContain('run_enterprise_ai_acceptance:');
    expect(candidate).toContain('default: false');
    expect(candidate).toContain(manualGate);

    for (const [start, end] of [
      ['Prepare ephemeral managed-AI commercial acceptance fixture', 'Run real managed-AI commercial accounting acceptance'],
      ['Run real managed-AI commercial accounting acceptance', 'Restore staging AI policy and remove commercial fixture'],
    ]) {
      const step = candidate.split(`- name: ${start}`)[1]?.split(`- name: ${end}`)[0] ?? '';
      expect(step).toContain(manualGate);
    }
  });
});
