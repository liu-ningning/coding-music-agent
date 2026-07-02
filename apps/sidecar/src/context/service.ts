import type {
  CodingContext,
  CodingMoodState,
  CodingTaskType,
  TimeOfDay,
  UserManualState,
  WeatherContext,
  PermissionState,
} from '@music-coding/shared-types';
import { WeatherProvider } from '../weather/provider';
import { createLogger } from '../utils/logger';

const log = createLogger('context');
import { determineMood } from '../recommendation/mood';
import { PermissionService } from '../permission/service';
import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { basename } from 'path';
import { createHash } from 'crypto';

export const contextEvents = new EventEmitter();

// 任务类型检测关键词配置
const TASK_TYPE_KEYWORDS: Record<CodingTaskType, string[]> = {
  feature: ['feat', 'feature', 'add', '新增', '添加', '实现', 'implement', 'create', '创建'],
  debug: ['fix', 'bug', 'debug', '修复', '调试', 'error', '错误', 'issue', '问题', 'broken', '崩溃'],
  refactor: ['refactor', '重构', 'clean', '优化', 'optimize', 'restructure', '重写'],
  review: ['review', '审查', 'code review', 'pr', 'merge', '合并', '检查'],
  hotfix: ['hotfix', '紧急', 'urgent', 'emergency', '线上', 'production', 'critical', '严重'],
  test: ['test', '测试', 'spec', '单元测试', '集成测试', 'e2e'],
  docs: ['doc', 'docs', '文档', 'readme', 'changelog', '注释', 'comment'],
  unknown: [],
};

// 情绪关键词配置
interface EmotionKeywords {
  positive: string[];
  negative: string[];
  frustrated: string[];
  excited: string[];
  tired: string[];
  focused: string[];
  anxious: string[];
  calm: string[];
  confused: string[];
  confident: string[];
}

const EMOTION_KEYWORDS: EmotionKeywords = {
  positive: [
    // 中文
    '好', '棒', '赞', '不错', '厉害', '牛', '强', '优秀', '完美', '漂亮',
    '成功', '解决了', '搞定了', '通过了', '完成了', '实现了', '达到了',
    '开心', '高兴', '满意', '舒服', '顺畅', '顺利', '流畅',
    '感谢', '谢谢', '辛苦了', '太棒了', '真好', '可以的', '没问题',
    // 英文
    'nice', 'great', 'awesome', 'excellent', 'perfect', 'wonderful', 'amazing',
    'good', 'well', 'brilliant', 'fantastic', 'outstanding', 'superb',
    'success', 'solved', 'fixed', 'working', 'done', 'completed', 'finished',
    'happy', 'glad', 'pleased', 'satisfied', 'smooth', 'easy',
    'thanks', 'thank', 'appreciate', 'love', 'like', 'enjoy',
  ],
  negative: [
    // 中文
    '不好', '差', '糟糕', '烂', '垃圾', '坑', '坑爹', '坑人',
    '失败', '出错', '报错', '挂了', '崩了', '炸了', '坏了',
    '错误', '问题', 'bug', '缺陷', '漏洞', '异常', '故障',
    '不行', '不可', '不能', '无法', '没法', '做不到',
    '失望', '沮丧', '难过', '伤心', '痛苦', '难受',
    // 英文
    'bad', 'poor', 'terrible', 'horrible', 'awful', 'worst', 'suck',
    'failed', 'failure', 'error', 'issue', 'problem', 'bug', 'broken',
    'wrong', 'incorrect', 'invalid', 'crash', 'crashed', 'dead',
    'cannot', "can't", 'unable', 'impossible', 'no way',
    'disappointed', 'sad', 'unhappy', 'upset', 'annoyed',
  ],
  frustrated: [
    // 中文
    '烦', '烦躁', '烦死了', '烦人', '讨厌', '恼火', '气死',
    '搞不定', '搞不懂', '弄不明白', '想不通', '想不明白',
    '卡住', '卡死了', '卡顿', '死循环', '无限循环',
    '又', '又是', '又来了', '还是', '仍然', '依然',
    '为什么', '为啥', '怎么回事', '什么情况', '什么鬼',
    '崩溃', '抓狂', '疯了', '要疯', '受不了', '忍不了',
    '浪费时间', '白忙', '白费', '无语', '服了',
    // 英文
    'frustrated', 'annoying', 'annoyed', 'irritating', 'irritated',
    'stuck', 'trapped', 'blocked', 'blocking', 'hung',
    'loop', 'looping', 'infinite', 'endless', 'never ending',
    'why', 'how', 'what', 'when', 'where', 'who',
    'again', 'still', 'yet', 'once more', 'over and over',
    'crazy', 'mad', 'insane', 'ridiculous', 'absurd',
    'waste', 'wasted', 'useless', 'pointless', 'meaningless',
  ],
  excited: [
    // 中文
    '太好了', '太棒了', '太强了', '太牛了', '太厉害了',
    '终于', '总算', '可算', '好不容易', '总算搞定了',
    '搞定', '搞定了', '完成了', '成功了', '通过了',
    '耶', '哇', '哦', '啊', '嗯', '好耶',
    'cool', '酷', '帅', '漂亮', '完美',
    '惊喜', '意外', '没想到', '居然', '竟然',
    '突破', '进展', '进步', '提升', '优化',
    // 英文
    'awesome', 'amazing', 'incredible', 'unbelievable', 'wow',
    'finally', 'at last', 'done', 'completed', 'finished',
    'yes', 'yeah', 'yep', 'yay', 'hooray', 'woohoo',
    'cool', 'neat', 'sweet', 'dope', 'lit', 'fire',
    'breakthrough', 'progress', 'improvement', 'upgrade',
    'excited', 'thrilled', 'pumped', 'stoked', 'hyped',
  ],
  tired: [
    // 中文
    '累', '累了', '好累', '太累', '超级累', '累死了',
    '困', '困了', '好困', '想睡', '想睡觉', '瞌睡',
    '疲', '疲惫', '疲劳', '疲倦', '乏力', '没力气',
    '不想', '不想动', '不想做', '不想写', '不想干',
    '摸鱼', '划水', '偷懒', '休息', '歇会', '躺平',
    '加班', '熬夜', '通宵', '深夜', '凌晨',
    '慢', '慢死了', '效率低', '没效率', '拖延',
    '放弃', '算了', '就这样吧', '随便', '将就',
    // 英文
    'tired', 'exhausted', 'fatigued', 'weary', 'worn out', 'drained',
    'sleepy', 'drowsy', 'dozing', 'napping', 'rest',
    'lazy', 'slacking', 'procrastinating', 'delaying',
    'slow', 'slowly', 'inefficient', 'unproductive',
    'give up', 'quit', 'surrender', 'forget it', 'whatever',
    'overtime', 'late night', 'all night', 'burning midnight oil',
  ],
  focused: [
    // 中文
    '专注', '专心', '集中', '沉浸', '投入', '认真',
    'flow', '心流', '状态好', '手感好', '感觉来了',
    '效率高', '高效', '产出', '生产力', '多产',
    '思路清晰', '逻辑清晰', '想清楚', '理清楚', '理顺了',
    '顺手', '顺畅', '流畅', '丝滑', '丝般顺滑',
    '进入状态', '进入心流', '进入节奏', '找到感觉',
    '安静', '平静', '冷静', '沉着', '淡定',
    '继续', '接着', '再来', '继续干', '继续做',
    // 英文
    'focus', 'focused', 'concentrate', 'concentrated', 'immersed',
    'flow', 'flow state', 'in the zone', 'on fire', 'rolling',
    'productive', 'efficient', 'effective', 'output', 'performance',
    'clear', 'clarity', 'lucid', 'sharp', 'precise',
    'smooth', 'fluent', 'effortless', 'natural', 'easy',
    'quiet', 'calm', 'peaceful', 'serene', 'composed',
    'continue', 'keep', 'keep going', 'proceed', 'go on',
  ],
  anxious: [
    // 中文
    '焦虑', '紧张', '担心', '担忧', '不安', '忐忑',
    '急', '着急', '急死了', '赶紧', '赶快', '快点',
    '来不及', '时间紧', 'deadline', '截止', '催',
    '慌', '慌了', '心慌', '手忙脚乱', '乱了',
    '压力', '压力大', '鸭梨', '负担', '沉重',
    // 英文
    'anxious', 'nervous', 'worried', 'concerned', 'uneasy',
    'urgent', 'hurry', 'rush', 'rushing', 'quick', 'fast',
    'deadline', 'due', 'overdue', 'late', 'behind',
    'panic', 'panicking', 'flustered', 'confused', 'lost',
    'pressure', 'stress', 'stressed', 'overwhelmed', 'swamped',
  ],
  calm: [
    // 中文
    '平静', '冷静', '淡定', '沉着', '从容',
    '安心', '放心', '踏实', '稳', '稳定',
    '轻松', '自在', '舒适', '惬意', '悠然',
    '慢慢', '不急', '不慌', '按部就班', '有条不紊',
    '思考', '想想', '考虑', '分析', '研究',
    // 英文
    'calm', 'relaxed', 'peaceful', 'serene', 'tranquil',
    'easy', 'comfortable', 'cozy', 'pleasant', 'chill',
    'slow', 'steady', 'stable', 'consistent', 'reliable',
    'think', 'consider', 'analyze', 'study', 'research',
    'mindful', 'aware', 'present', 'grounded', 'centered',
  ],
  confused: [
    // 中文
    '困惑', '迷茫', '迷惑', '不解', '不懂',
    '不知道', '不清楚', '不明白', '不了解', '不理解',
    '怎么回事', '什么情况', '什么原理', '为什么',
    '不确定', '拿不准', '没把握', '没底',
    '试试', '试一下', '看看', '也许', '可能',
    // 英文
    'confused', 'puzzled', 'perplexed', 'baffled', 'bewildered',
    'lost', 'unclear', 'unsure', 'uncertain', 'doubtful',
    'why', 'how', 'what', 'wonder', 'question',
    'maybe', 'perhaps', 'possibly', 'might', 'could',
    'try', 'test', 'experiment', 'guess', 'estimate',
  ],
  confident: [
    // 中文
    '自信', '有信心', '有把握', '确定', '肯定',
    '没问题', '小意思', '简单', '容易', '轻松',
    '我知道', '我懂', '我明白', '我理解', '我会',
    '一定', '必须', '肯定', '绝对', '当然',
    '擅长', '拿手', '在行', '专业', '精通',
    // 英文
    'confident', 'sure', 'certain', 'definitely', 'absolutely',
    'easy', 'simple', 'piece of cake', 'no problem', 'breeze',
    'know', 'understand', 'comprehend', 'grasp', 'master',
    'must', 'have to', 'need to', 'should', 'will',
    'skilled', 'expert', 'professional', 'proficient', 'adept',
  ],
};

// 情绪状态映射到 Mood
interface EmotionToMoodMap {
  [key: string]: CodingMoodState;
}

const EMOTION_TO_MOOD: EmotionToMoodMap = {
  positive: 'feature_flow',
  negative: 'debug_calm',
  frustrated: 'debug_calm',
  excited: 'feature_flow',
  tired: 'low_energy',
  focused: 'feature_flow',
  anxious: 'emergency_focus',
  calm: 'review_focus',
  confused: 'debug_calm',
  confident: 'feature_flow',
};

export class ContextService {
  private weatherProvider: WeatherProvider;
  private permissionService: PermissionService;
  private currentContext: CodingContext;
  private projectPath: string | null = null;
  private projectId: string | null = null;
  private projectName: string | null = null;
  private lastDetectedTaskType: CodingTaskType = 'unknown';
  private taskTypeConfidence: number = 0;
  private lastDetectedEmotion: string | null = null;
  private emotionConfidence: number = 0;
  private recentMessages: Array<{ content: string; timestamp: number }> = [];
  private readonly MAX_RECENT_MESSAGES = 10;

  constructor(permissionService: PermissionService) {
    this.weatherProvider = new WeatherProvider();
    this.permissionService = permissionService;
    this.currentContext = this.createDefaultContext();

    // 每分钟更新时间
    setInterval(() => this.updateTimeOfDay(), 60 * 1000);

    // 每 5 分钟更新项目上下文（如果权限允许）
    setInterval(() => this.updateProjectContext(), 5 * 60 * 1000);

    // 每 2 分钟检测任务类型（如果权限允许）
    setInterval(() => this.detectAndUpdateTaskType(), 2 * 60 * 1000);
  }

  // 获取当前上下文
  getCurrentContext(): CodingContext {
    return { ...this.currentContext };
  }

  // 获取当前 Mood
  getCurrentMood(): CodingMoodState {
    return determineMood(this.currentContext);
  }

  // 设置手动状态
  setManualState(state: UserManualState): void {
    this.currentContext = { ...this.currentContext, manualState: state };
    this.emitUpdate();
  }

  // 设置任务类型
  setTaskType(type: CodingContext['taskType']): void {
    this.currentContext = { ...this.currentContext, taskType: type };
    this.emitUpdate();
  }

  // 设置 Session ID
  setSessionId(sessionId: string): void {
    this.currentContext = { ...this.currentContext, sessionId };
  }

  // 设置项目路径
  setProjectPath(path: string): void {
    this.projectPath = path;
    this.projectName = basename(path);
    this.projectId = this.generateProjectId(path);
    this.updateProjectContext();
    // 设置项目路径后立即检测任务类型
    this.detectAndUpdateTaskType();
  }

  // 获取项目 ID
  getProjectId(): string | null {
    return this.projectId;
  }

  // 获取项目名称
  getProjectName(): string | null {
    return this.projectName;
  }

  // 获取项目路径
  getProjectPath(): string | null {
    return this.projectPath;
  }

  // 生成项目 ID（基于路径的哈希）
  private generateProjectId(path: string): string {
    const hash = createHash('md5').update(path).digest('hex');
    return `proj_${hash.slice(0, 8)}`;
  }

  // 更新天气
  async updateWeather(): Promise<WeatherContext> {
    const weather = await this.weatherProvider.getWeather();
    this.currentContext = { ...this.currentContext, weather };
    contextEvents.emit('context.weather.updated', { weather });
    this.emitUpdate();
    return weather;
  }

  // 增加失败计数
  incrementFailure(): void {
    this.currentContext = {
      ...this.currentContext,
      failureCount: this.currentContext.failureCount + 1,
    };
    this.emitUpdate();
  }

  // 重置失败计数
  resetFailure(): void {
    this.currentContext = { ...this.currentContext, failureCount: 0 };
    this.emitUpdate();
  }

  // 更新 Session 时长
  updateSessionDuration(ms: number): void {
    this.currentContext = { ...this.currentContext, sessionDurationMs: ms };
  }

  // 设置 Agent 状态
  setAgentStatus(status: CodingContext['agentStatus']): void {
    this.currentContext = { ...this.currentContext, agentStatus: status };
    this.emitUpdate();
  }

  // 获取项目上下文信息（根据权限级别）
  getProjectInfo(): Record<string, unknown> {
    const permission = this.permissionService.getPermissions().projectContext;

    if (permission === 'disabled') {
      return { enabled: false };
    }

    const info: Record<string, unknown> = { enabled: true };

    // metadata_only: 只读取基本元数据
    if (permission === 'metadata_only' || permission === 'file_activity' || permission === 'code_content') {
      if (this.projectPath) {
        info.projectName = this.projectName;
        info.projectPath = this.projectPath;
        info.projectId = this.projectId;
      }
      info.sessionId = this.currentContext.sessionId;
      info.taskType = this.currentContext.taskType;
      info.agentStatus = this.currentContext.agentStatus;
    }

    // file_activity: 读取文件活动信息
    if (permission === 'file_activity' || permission === 'code_content') {
      try {
        // 获取最近修改的文件（仅在项目路径存在时）
        if (this.projectPath) {
          const recentFiles = this.getRecentFiles(this.projectPath);
          info.recentFiles = recentFiles;
        }
      } catch (e) {
        log.error(`获取文件活动失败: ${e}`);
      }
    }

    // code_content: 读取代码内容（最高权限）
    if (permission === 'code_content') {
      try {
        if (this.projectPath) {
          // 获取 git 状态
          const gitStatus = this.getGitStatus(this.projectPath);
          info.gitStatus = gitStatus;
        }
      } catch (e) {
        log.error(`获取代码内容失败: ${e}`);
      }
    }

    return info;
  }

  // ── 私有方法 ──

  private createDefaultContext(): CodingContext {
    return {
      sessionId: '',
      timeOfDay: this.getTimeOfDay(),
      manualState: null,
      agentStatus: 'idle',
      taskType: 'unknown',
      failureCount: 0,
      sessionDurationMs: 0,
    };
  }

  private getTimeOfDay(): TimeOfDay {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 23) return 'evening';
    return 'late_night';
  }

  private updateTimeOfDay(): void {
    const newTimeOfDay = this.getTimeOfDay();
    if (newTimeOfDay !== this.currentContext.timeOfDay) {
      this.currentContext = { ...this.currentContext, timeOfDay: newTimeOfDay };
      this.emitUpdate();
    }
  }

  // 更新项目上下文（根据权限）
  private updateProjectContext(): void {
    const permission = this.permissionService.getPermissions().projectContext;
    if (permission === 'disabled' || !this.projectPath) {
      return;
    }

    // 触发上下文更新事件
    const projectInfo = this.getProjectInfo();
    contextEvents.emit('context.project.updated', { projectInfo });
  }

  // 检测并更新任务类型
  private detectAndUpdateTaskType(): void {
    const permission = this.permissionService.getPermissions().projectContext;
    if (permission === 'disabled' || !this.projectPath) {
      return;
    }

    const detected = this.detectTaskType();
    if (detected.type !== this.currentContext.taskType && detected.confidence > this.taskTypeConfidence) {
      this.lastDetectedTaskType = detected.type;
      this.taskTypeConfidence = detected.confidence;
      this.currentContext = { ...this.currentContext, taskType: detected.type };
      this.emitUpdate();
      log.info(`任务类型: ${detected.type} (${detected.confidence.toFixed(2)})`);
    }
  }

  // 检测任务类型（综合分析）
  private detectTaskType(): { type: CodingTaskType; confidence: number; source: string } {
    const results: Array<{ type: CodingTaskType; confidence: number; source: string }> = [];

    // 1. 从 git commit message 检测
    const gitResult = this.detectFromGitCommits();
    if (gitResult) results.push(gitResult);

    // 2. 从文件活动模式检测
    const fileResult = this.detectFromFileActivity();
    if (fileResult) results.push(fileResult);

    // 3. 从分支名称检测
    const branchResult = this.detectFromBranchName();
    if (branchResult) results.push(branchResult);

    // 返回置信度最高的结果
    if (results.length === 0) {
      return { type: 'unknown', confidence: 0, source: 'none' };
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results[0];
  }

  // 从 git commit message 检测任务类型
  private detectFromGitCommits(): { type: CodingTaskType; confidence: number; source: string } | null {
    if (!this.projectPath) return null;

    try {
      // 获取最近 5 条 commit message
      const result = execSync('git log --oneline -5 --no-merges', {
        cwd: this.projectPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      if (!result) return null;

      const commits = result.split('\n');
      const typeScores: Record<string, number> = {};

      for (const commit of commits) {
        const lowerCommit = commit.toLowerCase();
        for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
          if (type === 'unknown') continue;
          for (const keyword of keywords) {
            if (lowerCommit.includes(keyword)) {
              typeScores[type] = (typeScores[type] || 0) + 1;
            }
          }
        }
      }

      // 找到得分最高的类型
      let maxScore = 0;
      let detectedType: CodingTaskType = 'unknown';
      for (const [type, score] of Object.entries(typeScores)) {
        if (score > maxScore) {
          maxScore = score;
          detectedType = type as CodingTaskType;
        }
      }

      if (maxScore > 0) {
        const confidence = Math.min(maxScore / commits.length, 1);
        return { type: detectedType, confidence, source: 'git-commits' };
      }

      return null;
    } catch {
      return null;
    }
  }

  // 从文件活动模式检测任务类型
  private detectFromFileActivity(): { type: CodingTaskType; confidence: number; source: string } | null {
    if (!this.projectPath) return null;

    try {
      // 获取最近修改的文件
      const result = execSync(
        'git diff --name-only HEAD~3..HEAD 2>/dev/null || find . -maxdepth 2 -name "*.ts" -o -name "*.tsx" -newer package.json | head -10',
        { cwd: this.projectPath, encoding: 'utf-8', timeout: 5000 }
      ).trim();

      if (!result) return null;

      const files = result.split('\n').filter(Boolean);
      let detectedType: CodingTaskType = 'unknown';
      let confidence = 0;

      // 分析文件模式
      const hasTestFiles = files.some(f => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));
      const hasDocFiles = files.some(f => f.includes('.md') || f.includes('docs/'));
      const hasConfigFiles = files.some(f => f.includes('config') || f.includes('.json') || f.includes('.yaml'));
      const hasSourceFiles = files.some(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js'));

      if (hasTestFiles && !hasSourceFiles) {
        detectedType = 'test';
        confidence = 0.7;
      } else if (hasDocFiles && !hasSourceFiles) {
        detectedType = 'docs';
        confidence = 0.7;
      } else if (hasSourceFiles) {
        // 默认认为是功能开发
        detectedType = 'feature';
        confidence = 0.4;
      }

      if (detectedType !== 'unknown') {
        return { type: detectedType, confidence, source: 'file-activity' };
      }

      return null;
    } catch {
      return null;
    }
  }

  // 从分支名称检测任务类型
  private detectFromBranchName(): { type: CodingTaskType; confidence: number; source: string } | null {
    if (!this.projectPath) return null;

    try {
      const branch = execSync('git branch --show-current', {
        cwd: this.projectPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim().toLowerCase();

      if (!branch) return null;

      // 分支名称模式匹配
      if (branch.startsWith('feature/') || branch.startsWith('feat/')) {
        return { type: 'feature', confidence: 0.8, source: 'branch-name' };
      }
      if (branch.startsWith('fix/') || branch.startsWith('bugfix/') || branch.startsWith('hotfix/')) {
        const isHotfix = branch.startsWith('hotfix/');
        return { type: isHotfix ? 'hotfix' : 'debug', confidence: 0.8, source: 'branch-name' };
      }
      if (branch.startsWith('refactor/') || branch.startsWith('ref/')) {
        return { type: 'refactor', confidence: 0.8, source: 'branch-name' };
      }
      if (branch.startsWith('review/') || branch.startsWith('pr/')) {
        return { type: 'review', confidence: 0.8, source: 'branch-name' };
      }
      if (branch.startsWith('test/') || branch.startsWith('tests/')) {
        return { type: 'test', confidence: 0.8, source: 'branch-name' };
      }
      if (branch.startsWith('docs/') || branch.startsWith('doc/')) {
        return { type: 'docs', confidence: 0.8, source: 'branch-name' };
      }

      // 关键词匹配
      for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
        if (type === 'unknown') continue;
        for (const keyword of keywords) {
          if (branch.includes(keyword)) {
            return { type: type as CodingTaskType, confidence: 0.6, source: 'branch-name' };
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  // 添加用户消息到近期消息列表
  // 情绪分析基于用户消息文本，不涉及项目文件，始终启用
  addUserMessage(content: string): void {
    this.recentMessages.push({
      content,
      timestamp: Date.now(),
    });

    // 保持消息列表大小
    if (this.recentMessages.length > this.MAX_RECENT_MESSAGES) {
      this.recentMessages.shift();
    }

    // 分析情绪（始终启用，不依赖 projectContext 权限）
    this.analyzeAndUpdateEmotion();
  }

  // 分析并更新情绪状态
  // 情绪分析基于用户消息文本，不涉及项目文件，始终启用
  private analyzeAndUpdateEmotion(): void {
    const emotion = this.detectEmotionFromMessages();
    if (emotion.emotion !== this.lastDetectedEmotion && emotion.confidence > this.emotionConfidence) {
      this.lastDetectedEmotion = emotion.emotion;
      this.emotionConfidence = emotion.confidence;

      // 将情绪映射到 Mood
      const mood = EMOTION_TO_MOOD[emotion.emotion];
      if (mood) {
        // 更新上下文中的任务类型（用于影响 Mood 判断）
        this.currentContext = { ...this.currentContext, taskType: this.mapEmotionToTaskType(emotion.emotion) };
        this.emitUpdate();
        log.info(`情绪检测: ${emotion.emotion} → ${mood}`);
      }
    }
  }

  // 从消息中检测情绪
  private detectEmotionFromMessages(): { emotion: string; confidence: number } {
    if (this.recentMessages.length === 0) {
      return { emotion: 'neutral', confidence: 0 };
    }

    const emotionScores: Record<string, number> = {};
    const totalMessages = this.recentMessages.length;

    // 分析每条消息
    for (const msg of this.recentMessages) {
      const content = msg.content.toLowerCase();

      for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
        for (const keyword of keywords) {
          if (content.includes(keyword)) {
            emotionScores[emotion] = (emotionScores[emotion] || 0) + 1;
          }
        }
      }
    }

    // 找到得分最高的情绪
    let maxScore = 0;
    let detectedEmotion = 'neutral';
    for (const [emotion, score] of Object.entries(emotionScores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    }

    if (maxScore > 0) {
      const confidence = Math.min(maxScore / totalMessages, 1);
      return { emotion: detectedEmotion, confidence };
    }

    return { emotion: 'neutral', confidence: 0 };
  }

  // 将情绪映射到任务类型（用于影响 Mood 判断）
  private mapEmotionToTaskType(emotion: string): CodingTaskType {
    const emotionToTaskType: Record<string, CodingTaskType> = {
      positive: 'feature',
      negative: 'debug',
      frustrated: 'debug',
      excited: 'feature',
      tired: 'unknown',
      focused: 'feature',
      anxious: 'hotfix',
      calm: 'review',
      confused: 'debug',
      confident: 'feature',
      neutral: 'unknown',
    };

    return emotionToTaskType[emotion] || 'unknown';
  }

  // 获取当前检测到的情绪
  getDetectedEmotion(): { emotion: string | null; confidence: number } {
    return {
      emotion: this.lastDetectedEmotion,
      confidence: this.emotionConfidence,
    };
  }

  // 重置情绪检测状态
  resetEmotionDetection(): void {
    this.lastDetectedEmotion = null;
    this.emotionConfidence = 0;
    this.recentMessages = [];
  }

  // 获取最近修改的文件
  private getRecentFiles(projectPath: string): string[] {
    try {
      const result = execSync(
        `find "${projectPath}" -maxdepth 3 -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -10`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      return result.trim().split('\n').filter(Boolean).map(f => basename(f));
    } catch {
      return [];
    }
  }

  // 获取 git 状态
  private getGitStatus(projectPath: string): Record<string, unknown> {
    try {
      const branch = execSync('git branch --show-current', {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      const status = execSync('git status --short', {
        cwd: projectPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      const changedFiles = status.split('\n').filter(Boolean).length;

      return {
        branch,
        changedFiles,
        hasChanges: changedFiles > 0,
      };
    } catch {
      return { branch: 'unknown', changedFiles: 0, hasChanges: false };
    }
  }

  private emitUpdate(): void {
    contextEvents.emit('context.updated', { context: this.currentContext });

    // 检查 Mood 是否变化
    const mood = this.getCurrentMood();
    contextEvents.emit('context.mood.changed', { mood });
  }
}
