import { requireProjectAccess } from '@/features/projects/server/access';
import { AutomationBuilderShell } from '@/features/projects/workspaces/automation/AutomationBuilderShell';
import { AutomationWorkflowDraftNodeForm } from '@/features/projects/workspaces/automation/AutomationWorkflowDraftNodeForm';
import { AutomationWorkflowMetadataForm } from '@/features/projects/workspaces/automation/AutomationWorkflowMetadataForm';
import { AutomationWorkflowNodeConfigDraftForm } from '@/features/projects/workspaces/automation/AutomationWorkflowNodeConfigDraftForm';
import { AutomationWorkflowNodeStructureDraftForm } from '@/features/projects/workspaces/automation/AutomationWorkflowNodeStructureDraftForm';
import { AutomationWorkflowPreflightPanel } from '@/features/projects/workspaces/automation/AutomationWorkflowPreflightPanel';
import { getAutomationBuilderSnapshot } from '@/features/projects/workspaces/automation/data';
import { getProjectWorkspaceByKey } from '@/features/projects/workspaces/registry';
import { WorkspaceEmptyState } from '@/features/projects/workspaces/WorkspaceEmptyState';
import { WorkspaceShell } from '@/features/projects/workspaces/WorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function AutomationBuilderPage({ params }: { params: Promise<{ tenant: string; project: string; workflow: string }> }) {
  const { project: projectSlug, tenant: tenantSlug, workflow: workflowSlug } = await params;
  const access = await requireProjectAccess({ projectSlug, tenantSlug });
  if (access.status !== 'ok') return <div className="p-8">{access.reason}</div>;

  const snapshot = await getAutomationBuilderSnapshot({ projectId: access.project.id, tenantId: access.tenant.id, workflowSlug });

  return (
    <WorkspaceShell projectName={access.project.name} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} workspace={getProjectWorkspaceByKey('automation')}>
      {snapshot ? (
        <div className="space-y-6">
          <AutomationBuilderShell projectSlug={access.project.slug} recentRuns={snapshot.recentRuns} tenantSlug={access.tenant.slug} workflow={snapshot.workflow} />
          <AutomationWorkflowPreflightPanel preflight={snapshot.preflight} />
          <AutomationWorkflowMetadataForm canManage={access.canManage} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} workflow={snapshot.workflow} />
          <AutomationWorkflowDraftNodeForm canManage={access.canManage} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} workflowSlug={snapshot.workflow.slug} />
          <AutomationWorkflowNodeConfigDraftForm canManage={access.canManage} nodes={snapshot.workflow.nodes} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} workflowSlug={snapshot.workflow.slug} />
          <AutomationWorkflowNodeStructureDraftForm canManage={access.canManage} nodes={snapshot.workflow.nodes} projectSlug={access.project.slug} tenantSlug={access.tenant.slug} workflowSlug={snapshot.workflow.slug} />
        </div>
      ) : (
        <WorkspaceEmptyState actions={[{ href: `/t/${access.tenant.slug}/projects/${access.project.slug}/automation`, label: 'Back to Automation Workspace' }]} description="This workflow record could not be found inside the current tenant and project." title="Workflow not found" />
      )}
    </WorkspaceShell>
  );
}
