// ── Coding Session ──

export type CodingTaskType =
  | 'feature'
  | 'debug'
  | 'refactor'
  | 'review'
  | 'hotfix'
  | 'test'
  | 'docs'
  | 'unknown';

export type CodingMoodState =
  | 'feature_flow'
  | 'debug_calm'
  | 'deep_refactor'
  | 'review_focus'
  | 'emergency_focus'
  | 'low_energy'
  | 'late_night_flow'
  | 'recovery_mode'
  | 'neutral';

export type AgentRunStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'failed'
  | 'completed'
  | 'cancelled';

export interface CodingSession {
  id: string;
  title: string;
  projectName?: string;
  projectPath?: string;
  taskType: CodingTaskType;
  mood: CodingMoodState;
  status: AgentRunStatus;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
}

// ── Context ──

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late_night';

export interface WeatherContext {
  condition: string;
  temperature: number;
  description: string;
  city?: string;
}

export type UserManualState =
  | 'need_focus'       // 需要专注
  | 'need_relax'       // 需要放松
  | 'need_energy'      // 需要提神
  | 'low_state'        // 状态不好
  | 'emergency'        // 紧急模式
  | 'deep_work'        // 深度工作
  | 'creative'         // 创意模式
  | 'reading'          // 阅读代码
  | 'debugging'        // 调试模式
  | 'late_night'       // 深夜编码
  | 'background'       // 纯背景音
  | null;

export interface CodingContext {
  sessionId: string;
  timeOfDay: TimeOfDay;
  weather?: WeatherContext;
  manualState: UserManualState;
  agentStatus: AgentRunStatus;
  taskType: CodingTaskType;
  failureCount: number;
  sessionDurationMs: number;
}

// ── Music ──

export type MusicMode = 'smart_radio' | 'smart_playlist' | 'manual';

export interface MusicTrack {
  id: string;
  provider: 'netease';
  providerTrackId: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  coverUrl?: string;
  playable: boolean;
  playUrl?: string;
  /** 推荐来源：daily=每日推荐，search=搜索，hot=热歌榜 */
  source?: 'daily' | 'search' | 'hot';
}

export interface MusicAtmosphere {
  id: string;
  label: string;
  mood: CodingMoodState;
  intensity: 'low' | 'medium' | 'high';
  distractionLevel: 'minimal' | 'balanced' | 'energetic';
  animationLevel: 'none' | 'subtle' | 'active';
  colors: {
    backgroundGradient: string;
    edgeGlow: string;
    accent: string;
  };
}

export interface DiversityScore {
  overall: number;        // 总体多样性分数 (0-1)
  artistDiversity: number; // 艺术家多样性
  albumDiversity: number;  // 专辑多样性
  durationDiversity: number; // 时长多样性
  recommendations: string[]; // 改进建议
}

// ── Track Features ──

export interface TrackFeatures {
  bpm: number;           // 节奏 (60-180)
  energy: number;        // 能量 (0-1)
  valence: number;       // 情绪 (0-1, 悲伤-快乐)
  danceability: number;  // 可舞性 (0-1)
  instrumentalness: number; // 器乐度 (0-1)
}

export interface MusicRecommendation {
  id: string;
  sessionId: string;
  mode: MusicMode;
  title: string;
  reason: string;
  tracks: MusicTrack[];
  atmosphere: MusicAtmosphere;
  contextUsed: string[];
  createdAt: string;
  diversityScore?: DiversityScore; // 多样性分数（可选）
}

export type MusicFeedbackAction =
  | 'like'
  | 'dislike'
  | 'more_focus'
  | 'more_relaxed'
  | 'more_energy'
  | 'less_distraction'
  | 'change_set'
  | 'keep_vibe';

export interface MusicFeedback {
  id: string;
  sessionId: string;
  recommendationId: string;
  action: MusicFeedbackAction;
  createdAt: string;
}

// ── Preference Learning ──

export interface FeedbackRecord {
  sessionId: string;
  mood: CodingMoodState;
  action: MusicFeedbackAction;
  timestamp: string;
}

export interface PreferenceLearning {
  id: string;
  styleWeights: Record<CodingMoodState, number>;  // 风格权重 (0-1)
  feedbackHistory: FeedbackRecord[];               // 反馈历史
  lastUpdated: string;
}

// ── Project Preferences ──

export interface ProjectPreferences {
  projectId: string;
  projectName: string;
  preferences: string[];      // 项目专属偏好设置
  inheritGlobal: boolean;     // 是否继承全局偏好
  lastUsed: string;           // 最后使用时间
}

// ── User Profile (Collaborative Filtering) ──

export interface ListeningRecord {
  trackId: string;
  trackName: string;
  artist: string;
  genre: string;
  duration: number;
  timestamp: string;
  rating?: number;  // 用户评分（可选）
}

export interface UserProfile {
  userId: string;
  genrePreferences: Record<string, number>;  // 风格偏好权重 (0-1)
  artistPreferences: Record<string, number>;  // 艺术家偏好权重 (0-1)
  featurePreferences: TrackFeatures;          // 特征偏好
  listeningHistory: ListeningRecord[];        // 听歌历史
  lastUpdated: string;
}

export interface PlaybackState {
  status: 'playing' | 'paused' | 'stopped' | 'loading';
  currentTrack?: MusicTrack;
  progressMs?: number;
  volume: number;
}

// ── Permission ──

export type PermissionLevel =
  | 'none'
  | 'basic'
  | 'metadata'
  | 'activity'
  | 'content'
  | 'execution';

export interface PermissionState {
  weather: 'disabled' | 'enabled' | 'error';
  projectContext: 'disabled' | 'metadata_only' | 'file_activity' | 'code_content';
  commandExecution: 'always_ask' | 'trusted_commands' | 'disabled';
  fileOperations: 'disabled' | 'enabled';
}

// ── Approval ──

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  type: 'command' | 'file_write' | 'file_delete' | 'network' | 'code_read';
  title: string;
  description: string;
  command?: string;
  affectedFiles?: string[];
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: string;
}

export type ApprovalDecision =
  | 'approve_once'
  | 'deny'
  | 'approve_for_session'
  | 'edit_before_approve';

// ── Error ──

export type AppErrorCode =
  | 'SIDECAR_START_FAILED'
  | 'SIDECAR_HEALTH_FAILED'
  | 'CLAUDE_AUTH_FAILED'
  | 'CLAUDE_AGENT_FAILED'
  | 'NETEASE_AUTH_EXPIRED'
  | 'NETEASE_PLAY_FAILED'
  | 'WEATHER_FAILED'
  | 'PERMISSION_DENIED'
  | 'RECOMMENDATION_FAILED'
  | 'SQLITE_FAILED'
  | 'CLOUD_SYNC_FAILED';

export interface AppError {
  code: AppErrorCode;
  message: string;
  retry?: () => void;
  details?: unknown;
}

// ── Async State ──

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading'; message?: string }
  | { status: 'success'; data: T }
  | { status: 'empty'; message: string }
  | { status: 'error'; error: AppError }
  | { status: 'permission_required'; permission: string };

// ── Sidecar ──

export type SidecarStatus =
  | 'not_started'
  | 'starting'
  | 'healthy'
  | 'degraded'
  | 'crashed'
  | 'restarting'
  | 'stopped';

// ── Agent Messages ──

export interface AgentMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  eventType?: 'message' | 'tool_call' | 'approval' | 'error';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: unknown;
}

export interface AgentRunResult {
  sessionId: string;
  status: 'completed' | 'failed' | 'cancelled';
  summary?: string;
  error?: AppError;
}

// ── Events ──

export type AgentEvent =
  | { type: 'agent.session.created'; session: CodingSession }
  | { type: 'agent.message.delta'; sessionId: string; delta: string }
  | { type: 'agent.message.completed'; sessionId: string; message: string }
  | { type: 'agent.tool.requested'; request: ToolCallRequest }
  | { type: 'agent.tool.completed'; requestId: string; result: unknown }
  | { type: 'agent.approval.required'; approval: ApprovalRequest }
  | { type: 'agent.run.completed'; sessionId: string; result: AgentRunResult }
  | { type: 'agent.run.failed'; sessionId: string; error: AppError }
  | { type: 'agent.thinking'; sessionId: string; thinking: string };

export type MusicEvent =
  | { type: 'music.recommendation.started'; sessionId: string }
  | { type: 'music.recommendation.ready'; recommendation: MusicRecommendation }
  | { type: 'music.playback.changed'; playback: PlaybackState }
  | { type: 'music.atmosphere.changed'; atmosphere: MusicAtmosphere }
  | { type: 'music.feedback.recorded'; feedback: MusicFeedback };

export type ContextEvent =
  | { type: 'context.updated'; context: CodingContext }
  | { type: 'context.mood.changed'; mood: CodingMoodState }
  | { type: 'context.weather.updated'; weather: WeatherContext };

export type ApprovalEvent =
  | { type: 'approval.created'; approval: ApprovalRequest }
  | { type: 'approval.resolved'; id: string; decision: ApprovalDecision };

export type AppEvent = AgentEvent | MusicEvent | ContextEvent | ApprovalEvent;
