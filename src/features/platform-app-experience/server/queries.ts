import { defaultAppExperience } from '../defaults';

export async function getPublishedAppExperience() {
  return defaultAppExperience;
}

export async function getPublishedWorkspaceCards() {
  return defaultAppExperience.workspaces.filter((workspace) => workspace.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getPublishedControlCenterModules() {
  return defaultAppExperience.controlCenterModules.filter((module) => module.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder);
}
