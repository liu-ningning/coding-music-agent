import { spawn, execSync } from 'child_process';
import type {
  CodingSession,
  AgentMessage,
  AgentRunStatus,
  CodingTaskType,
  CodingMoodState,
  ApprovalDecision,
  PermissionState,
} from '@music-coding/shared-types';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { sessionStore, messageStore, type StoredSession } from '../storage/store';
import { PermissionService } from '../permission/service';
import { ContextService } from '../context/service';
import { createLogger } from '../utils/logger';

const log = createLogger('agent');

export const agentEvents = new EventEmitter();

// 查找 claude CLI 路径
function findClaudePath(): string | null {
  const home = process.env.HOME || '';
  const candidates = [
    'claude',
    `${home}/.nvm/versions/node/v22.12.0/bin/claude`,
    `${home}/.nvm/versions/node/v20.0.0/bin/claude`,
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    `${home}/.local/bin/claude`,
  ];

  for (const path of candidates) {
    try {
      execSync(`"${path}" --version`, { stdio: 'ignore', timeout: 5000 });
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

export class AgentService {
  private sessionHistories: Map<string, string[]> = new Map();
  private claudeAvailable: boolean;
  private claudePath: string | null;
  private claudeVersion: string | null = null;
  private permissionService: PermissionService;
  private contextService: ContextService | null = null;

  constructor(permissionService: PermissionService) {
    this.permissionService = permissionService;
    this.claudePath = findClaudePath();
    this.claudeAvailable = this.claudePath !== null;

    if (this.claudeAvailable && this.claudePath) {
      try {
        this.claudeVersion = execSync(`"${this.claudePath}" --version`, { encoding: 'utf-8', timeout: 5000 }).trim();
      } catch {
        this.claudeVersion = null;
      }
    }

    log.info(`Claude CLI: ${this.claudePath || '未找到'} (${this.claudeVersion || '未知版本'})`);
  }

  // 设置 ContextService 引用（用于情绪分析）
  setContextService(contextService: ContextService): void {
    this.contextService = contextService;
  }

  isClaudeAvailable(): boolean {
    return this.claudeAvailable;
  }

  getClaudeVersion(): string | null {
    return this.claudeVersion;
  }

  createSession(title: string, projectPath?: string, id?: string): CodingSession {
    const now = new Date().toISOString();

    // 强制校验：普通会话不允许访问目录
    // 只有明确传递 projectPath 时才允许访问目录
    const validatedProjectPath = projectPath ? projectPath : undefined;

    const session: CodingSession = {
      id: id || `sess_${randomUUID().slice(0, 8)}`,
      title,
      projectPath: validatedProjectPath,
      taskType: 'unknown',
      mood: 'neutral',
      status: 'idle',
      startedAt: now,
      updatedAt: now,
    };

    sessionStore.create(session as StoredSession);
    this.sessionHistories.set(session.id, []);
    agentEvents.emit('agent.session.created', { session });

    log.info(`会话创建: ${session.id}${validatedProjectPath ? ` (${validatedProjectPath})` : ''}`);
    return session;
  }

  getSession(id: string): CodingSession | null {
    const session = sessionStore.getById(id);
    return session ? (session as CodingSession) : null;
  }

  listSessions(): CodingSession[] {
    return sessionStore.getAll() as CodingSession[];
  }

  async sendMessage(
    sessionId: string,
    content: string,
    onDelta: (delta: string) => void,
    onComplete: (message: string) => void,
    onError: (error: Error) => void,
    onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void,
    onThinking?: (thinking: string) => void,
  ): Promise<void> {
    // 保存用户消息
    messageStore.add({
      id: `msg_${randomUUID().slice(0, 8)}`,
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    });

    // 分析用户情绪（用于音乐推荐）
    if (this.contextService) {
      this.contextService.addUserMessage(content);
    }

    // 更新状态
    sessionStore.update(sessionId, { status: 'running' as AgentRunStatus });

    if (!this.claudeAvailable) {
      sessionStore.update(sessionId, { status: 'failed' as AgentRunStatus });
      onError(new Error('Claude CLI 未安装。请先安装：npm install -g @anthropic-ai/claude-code'));
      return;
    }

    const session = this.getSession(sessionId);
    // 强制校验：普通会话不允许访问目录
    // 只有明确设置了 projectPath 的会话才能访问目录
    const projectPath = session?.projectPath;
    const history = this.sessionHistories.get(sessionId) || [];
    const fullPrompt = history.length > 0
      ? `${history.join('\n\n')}\n\n用户: ${content}`
      : content;

    // 根据会话类型设置目录访问限制
    let pathRestriction = '';
    if (!projectPath) {
      // 普通会话：不允许访问任何目录
      pathRestriction = '\n\n[系统提示] 当前会话不允许访问任何文件目录，请仅提供代码建议和解答，不要尝试读取或修改文件。';
    } else {
      // 目录会话：只允许在指定目录内操作
      pathRestriction = `\n\n[系统提示] 当前会话仅允许在目录 "${projectPath}" 内操作。如果需要在此目录之外执行任何操作（读取、写入、删除文件等），必须先询问用户并获得明确许可。绝对不要自行决定访问目录外的文件。`;
    }

    try {
      const enhancedPath = [
        process.env.PATH,
        '/usr/local/bin',
        '/opt/homebrew/bin',
        `${process.env.HOME}/.nvm/versions/node/v22.12.0/bin`,
        `${process.env.HOME}/.local/bin`,
      ].filter(Boolean).join(':');

      // 根据命令执行权限设置 Claude CLI 的权限模式
      const permissionMode = this.getPermissionMode();
      log.info(`权限模式: ${permissionMode}`);

      const claudeArgs: string[] = [];

      // 文件操作权限：开启后允许 Agent 在会话目录内执行文件操作
      // 注意：--allowedTools 必须在 --print 之前，否则 CLI 参数解析会出错
      const allowedTools = this.getAllowedTools();
      if (allowedTools.length > 0) {
        claudeArgs.push('--allowedTools', allowedTools.join(','));
        log.info(`允许工具: ${allowedTools.join(', ')}`);
      }

      claudeArgs.push(
        '--print',
        '--output-format', 'stream-json',
        '--verbose',
        '--permission-mode', permissionMode,
        fullPrompt + pathRestriction,
      );

      const claude = spawn(this.claudePath!, claudeArgs, {
        cwd: projectPath || undefined,  // 普通会话不设置 cwd，不使用默认目录
        env: { ...process.env, PATH: enhancedPath, HOME: process.env.HOME },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      let errorOutput = '';
      let buffer = '';

      claude.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            this.handleStreamEvent(event, sessionId, onDelta, onToolUse, onThinking);
            // 收集最终结果
            if (event.type === 'result' && !event.is_error) {
              output = event.result || '';
            }
          } catch {
            // 忽略解析错误
          }
        }
      });

      claude.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0 && output) {
          messageStore.add({
            id: `msg_${randomUUID().slice(0, 8)}`,
            sessionId,
            role: 'assistant',
            content: output.trim(),
            createdAt: new Date().toISOString(),
          });

          history.push(`用户: ${content}`);
          history.push(`助手: ${output.trim()}`);
          if (history.length > 20) {
            this.sessionHistories.set(sessionId, history.slice(-20));
          } else {
            this.sessionHistories.set(sessionId, history);
          }

          sessionStore.update(sessionId, { status: 'completed' as AgentRunStatus });
          onComplete(output.trim());
        } else {
          sessionStore.update(sessionId, { status: 'failed' as AgentRunStatus });
          onError(new Error(errorOutput || `Claude CLI exited with code ${code}`));
        }
      });

      claude.on('error', (err) => {
        sessionStore.update(sessionId, { status: 'failed' as AgentRunStatus });
        onError(new Error(`Failed to start Claude CLI: ${err.message}`));
      });

    } catch (err) {
      sessionStore.update(sessionId, { status: 'failed' as AgentRunStatus });
      onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // 处理 stream-json 事件
  private handleStreamEvent(
    event: Record<string, unknown>,
    sessionId: string,
    onDelta: (delta: string) => void,
    onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void,
    onThinking?: (thinking: string) => void,
  ): void {
    switch (event.type) {
      case 'assistant': {
        const message = event.message as Record<string, unknown> | undefined;
        if (message?.content) {
          const content = message.content as Array<Record<string, unknown>>;
          for (const block of content) {
            if (block.type === 'text' && block.text) {
              onDelta(block.text as string);
            } else if (block.type === 'tool_use' && onToolUse) {
              const toolName = block.name as string;
              const toolInput = block.input as Record<string, unknown>;

              // 检查是否需要审批（包括目录访问检查）
              if (this.requiresApproval(toolName, toolInput, sessionId)) {
                // 检查是否是目录外访问
                const session = this.getSession(sessionId);
                const projectPath = session?.projectPath;
                const filePaths = this.extractFilePaths(toolName, toolInput);
                const isOutsidePath = projectPath && filePaths.some(p => !this.isPathInsideDirectory(p, projectPath));

                // 触发审批流程
                const approvalId = `approval_${randomUUID().slice(0, 8)}`;
                const approval = {
                  id: approvalId,
                  sessionId,
                  type: 'command' as const,
                  title: isOutsidePath ? '目录外访问' : '命令执行确认',
                  description: isOutsidePath
                    ? `尝试访问项目目录外的文件: ${filePaths.join(', ')}`
                    : `执行命令: ${toolName}`,
                  command: toolName === 'Bash' ? String(toolInput.command || '') : undefined,
                  affectedFiles: filePaths,
                  riskLevel: isOutsidePath ? 'high' as const : 'medium' as const,
                };

                agentEvents.emit('agent.approval.required', { approval });
              }

              onToolUse(toolName, toolInput);
            } else if (block.type === 'thinking' && block.thinking && onThinking) {
              onThinking(block.thinking as string);
            }
          }
        }
        break;
      }
      case 'result': {
        // 结果在 close 事件中处理
        break;
      }
      default:
        // 忽略其他事件（system, thinking_tokens 等）
        break;
    }
  }

  getMessages(sessionId: string): AgentMessage[] {
    return messageStore.getBySession(sessionId) as AgentMessage[];
  }

  approve(approvalId: string, decision: ApprovalDecision): void {
    agentEvents.emit('approval.resolved', { id: approvalId, decision });
  }

  clearSessionHistory(sessionId: string): void {
    this.sessionHistories.delete(sessionId);
  }

  // 检查命令是否需要用户确认
  requiresApproval(toolName: string, toolInput: Record<string, unknown>, sessionId?: string): boolean {
    const permission = this.permissionService.getPermissions().commandExecution;

    // 如果权限禁用，所有命令都需要确认
    if (permission === 'disabled') {
      return true;
    }

    // 如果是 always_ask，所有命令都需要确认
    if (permission === 'always_ask') {
      return true;
    }

    // 检查目录访问限制
    if (sessionId && this.isOutsideProjectPath(toolName, toolInput, sessionId)) {
      return true;
    }

    // 如果是 trusted_commands，只有危险命令需要确认
    if (permission === 'trusted_commands') {
      return this.isDangerousCommand(toolName, toolInput);
    }

    return true;
  }

  // 检查是否尝试访问项目目录外的文件
  private isOutsideProjectPath(toolName: string, toolInput: Record<string, unknown>, sessionId: string): boolean {
    const session = this.getSession(sessionId);
    const projectPath = session?.projectPath;

    // 如果没有设置 projectPath（普通会话），不需要检查目录限制
    // 因为普通会话已经有其他限制
    if (!projectPath) {
      return false;
    }

    // 获取工具调用中的文件路径
    const filePaths = this.extractFilePaths(toolName, toolInput);

    // 检查每个文件路径是否在项目目录内
    for (const filePath of filePaths) {
      if (!this.isPathInsideDirectory(filePath, projectPath)) {
        log.warn(`目录外访问: ${filePath} (项目: ${projectPath})`);
        return true;
      }
    }

    return false;
  }

  // 从工具调用中提取文件路径
  private extractFilePaths(toolName: string, toolInput: Record<string, unknown>): string[] {
    const paths: string[] = [];

    // Bash 命令
    if (toolName === 'Bash' || toolName === 'bash') {
      const command = String(toolInput.command || '');
      // 提取命令中的文件路径（简单实现）
      const pathPatterns = [
        /(?:cat|less|more|head|tail|vim|vi|nano|code|open)\s+([^\s|&;]+)/g,
        /(?:cp|mv|rm|mkdir|touch|chmod|chown)\s+(?:-[^\s]*\s+)*([^\s|&;]+)/g,
        /(?:find|ls|grep|awk|sed)\s+[^\s]*\s+([^\s|&;]+)/g,
        />\s*([^\s|&;]+)/g,
        /<\s*([^\s|&;]+)/g,
      ];

      for (const pattern of pathPatterns) {
        let match;
        while ((match = pattern.exec(command)) !== null) {
          if (match[1] && !match[1].startsWith('-')) {
            paths.push(match[1]);
          }
        }
      }
    }

    // 文件读取工具
    if (toolName === 'Read' || toolName === 'read') {
      const filePath = String(toolInput.file_path || toolInput.path || '');
      if (filePath) paths.push(filePath);
    }

    // 文件写入工具
    if (toolName === 'Write' || toolName === 'write') {
      const filePath = String(toolInput.file_path || toolInput.path || '');
      if (filePath) paths.push(filePath);
    }

    // 文件编辑工具
    if (toolName === 'Edit' || toolName === 'edit') {
      const filePath = String(toolInput.file_path || toolInput.path || '');
      if (filePath) paths.push(filePath);
    }

    // 文件删除工具
    if (toolName === 'Delete' || toolName === 'delete') {
      const filePath = String(toolInput.file_path || toolInput.path || '');
      if (filePath) paths.push(filePath);
    }

    return paths;
  }

  // 检查路径是否在指定目录内
  private isPathInsideDirectory(filePath: string, directoryPath: string): boolean {
    const path = require('path');

    // 解析为绝对路径
    const resolvedFilePath = path.resolve(filePath);
    const resolvedDirectoryPath = path.resolve(directoryPath);

    // 确保目录路径以分隔符结尾
    const normalizedDirectoryPath = resolvedDirectoryPath.endsWith(path.sep)
      ? resolvedDirectoryPath
      : resolvedDirectoryPath + path.sep;

    // 检查文件路径是否以目录路径开头
    return resolvedFilePath.startsWith(normalizedDirectoryPath) ||
           resolvedFilePath === resolvedDirectoryPath;
  }

  // 判断是否为危险命令
  private isDangerousCommand(toolName: string, toolInput: Record<string, unknown>): boolean {
    // 危险命令列表
    const dangerousPatterns = [
      /rm\s+-rf/i,
      /sudo/i,
      /chmod\s+777/i,
      /mkfs/i,
      /dd\s+if=/i,
      /shutdown/i,
      /reboot/i,
      /format/i,
    ];

    // 如果是 Bash 工具，检查命令内容
    if (toolName === 'Bash' || toolName === 'bash') {
      const command = String(toolInput.command || '');
      return dangerousPatterns.some(pattern => pattern.test(command));
    }

    // 文件删除操作
    if (toolName === 'Delete' || toolName === 'delete') {
      return true;
    }

    // 网络请求（可能泄露数据）
    if (toolName === 'WebFetch' || toolName === 'WebSearch') {
      return false; // 读取操作通常安全
    }

    return false;
  }

  // 获取命令执行权限状态
  getCommandExecutionPermission(): PermissionState['commandExecution'] {
    return this.permissionService.getPermissions().commandExecution;
  }

  // 根据权限设置返回 Claude CLI 的权限模式
  private getPermissionMode(): string {
    const permission = this.permissionService.getPermissions().commandExecution;

    switch (permission) {
      case 'disabled':
        // 禁用：使用 plan 模式，只计划不执行
        return 'plan';
      case 'always_ask':
        // 总是询问：使用 default 模式
        return 'default';
      case 'trusted_commands':
        // 信任命令：使用 auto 模式，自动批准安全操作
        return 'auto';
      default:
        return 'default';
    }
  }

  // 根据文件操作权限返回允许的工具列表
  private getAllowedTools(): string[] {
    const fileOps = this.permissionService.getPermissions().fileOperations;

    if (fileOps !== 'enabled') {
      return [];
    }

    // 文件操作开启后，允许以下工具在会话目录内执行
    return [
      'Bash(rm *)',
      'Bash(rmdir *)',
      'Bash(mkdir *)',
      'Bash(mv *)',
      'Bash(cp *)',
      'Bash(chmod *)',
      'Bash(touch *)',
      'Write',
      'Edit',
    ];
  }
}
