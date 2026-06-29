import type { PermissionState } from '@music-coding/shared-types';
import { permissionStore } from '../storage/store';

export class PermissionService {
  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    const defaults: Record<string, string> = {
      weather: 'disabled',
      projectContext: 'disabled',
      commandExecution: 'always_ask',
      fileOperations: 'disabled',
    };

    for (const [key, value] of Object.entries(defaults)) {
      if (!permissionStore.get(key) || permissionStore.get(key) === 'disabled') {
        permissionStore.set(key, value);
      }
    }
  }

  getPermissions(): PermissionState {
    return {
      weather: (permissionStore.get('weather') as PermissionState['weather']) || 'disabled',
      projectContext: (permissionStore.get('projectContext') as PermissionState['projectContext']) || 'disabled',
      commandExecution: (permissionStore.get('commandExecution') as PermissionState['commandExecution']) || 'always_ask',
      fileOperations: (permissionStore.get('fileOperations') as PermissionState['fileOperations']) || 'disabled',
    };
  }

  updatePermission(key: keyof PermissionState, value: string): void {
    permissionStore.set(key, value);
  }

  hasPermission(key: keyof PermissionState): boolean {
    const status = permissionStore.get(key);
    return status === 'enabled' || status === 'connected';
  }
}
