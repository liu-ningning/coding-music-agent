import { create } from 'zustand';
import type {
  CodingContext,
  TimeOfDay,
  WeatherContext,
  UserManualState,
  AgentRunStatus,
  CodingTaskType,
} from '@music-coding/shared-types';

interface ContextStore {
  context: CodingContext;
  setTimeOfDay: (tod: TimeOfDay) => void;
  setWeather: (weather: WeatherContext) => void;
  setManualState: (state: UserManualState) => void;
  setAgentStatus: (status: AgentRunStatus) => void;
  setTaskType: (type: CodingTaskType) => void;
  incrementFailure: () => void;
  resetFailure: () => void;
  setSessionDuration: (ms: number) => void;
  updateFromServer: (ctx: Partial<CodingContext>) => void;
}

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'late_night';
}

export const useContextStore = create<ContextStore>((set, get) => ({
  context: {
    sessionId: '',
    timeOfDay: getTimeOfDay(),
    manualState: null,
    agentStatus: 'idle',
    taskType: 'unknown',
    failureCount: 0,
    sessionDurationMs: 0,
  },

  setTimeOfDay: (tod) =>
    set((state) => ({
      context: { ...state.context, timeOfDay: tod },
    })),

  setWeather: (weather) =>
    set((state) => ({
      context: { ...state.context, weather },
    })),

  setManualState: (manualState) =>
    set((state) => ({
      context: { ...state.context, manualState },
    })),

  setAgentStatus: (agentStatus) =>
    set((state) => ({
      context: { ...state.context, agentStatus },
    })),

  setTaskType: (taskType) =>
    set((state) => ({
      context: { ...state.context, taskType },
    })),

  incrementFailure: () =>
    set((state) => ({
      context: { ...state.context, failureCount: state.context.failureCount + 1 },
    })),

  resetFailure: () =>
    set((state) => ({
      context: { ...state.context, failureCount: 0 },
    })),

  setSessionDuration: (ms) =>
    set((state) => ({
      context: { ...state.context, sessionDurationMs: ms },
    })),

  updateFromServer: (ctx) =>
    set((state) => ({
      context: { ...state.context, ...ctx },
    })),
}));
