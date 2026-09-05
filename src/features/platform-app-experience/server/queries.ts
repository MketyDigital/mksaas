import { defaultAppExperience } from '../defaults';
import { platformControlModules } from '../control-center-registry';

export async function getPublishedAppExperience() {
  return defaultAppExperience;
}

export async function getPublishedWorkspaceCards() {
  return defaultAppExperience.workspaces.filter((workspace) => workspace.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPublishedControlCenterModules() {
  return platformControlModules.filter((module) => module.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPublishedControlCenterModule(moduleKey: string) {
  return (await getPublishedControlCenterModules()).find((module) => module.key === moduleKey || module.href.endsWith(`/${moduleKey}`)) ?? null;
}
