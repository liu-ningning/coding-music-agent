import { create } from 'zustand';
import type { SidecarStatus } from '@music-coding/shared-types';
import { SIDECAR_PORT } from '@/config';

interface SidecarStore {
  status: SidecarStatus;
  version: string | null;
  port: number;
  claudeAvailable: boolean;
  setStatus: (status: SidecarStatus) => void;
  setVersion: (version: string) => void;
  setPort: (port: number) => void;
  setClaudeAvailable: (available: boolean) => void;
}

export const useSidecarStore = create<SidecarStore>((set) => ({
  status: 'not_started',
  version: null,
  port: SIDECAR_PORT,
  claudeAvailable: false,
  setStatus: (status) => set({ status }),
  setVersion: (version) => set({ version }),
  setPort: (port) => set({ port }),
  setClaudeAvailable: (available) => set({ claudeAvailable: available }),
}));
