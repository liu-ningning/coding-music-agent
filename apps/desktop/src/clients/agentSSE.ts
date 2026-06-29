import { useAgentStore } from '@/stores/agentStore';
import type { AgentEvent } from '@music-coding/shared-types';
import { SIDECAR_BASE } from '@/config';

// 格式化时长
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// 发送消息（SSE 流式响应）
export async function sendAgentMessage(sessionId: string, content: string): Promise<void> {
  const store = useAgentStore.getState();
  const startTime = Date.now();

  // 添加用户消息
  store.addMessage(sessionId, {
    id: `msg_${Date.now()}`,
    sessionId,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  });

  store.setRunStatus(sessionId, 'running');
  store.setError(sessionId, null);
  store.clearThinkingLogs(sessionId);
  store.setThinkingStep(sessionId, '正在分析输入...');
  store.addThinkingLog(sessionId, '正在分析输入...', 'info');

  // 添加一个延迟后的"等待响应"日志
  setTimeout(() => {
    const currentStatus = store.sessions[sessionId]?.runStatus;
    if (currentStatus === 'running') {
      store.addThinkingLog(sessionId, '正在等待响应...', 'info');
    }
  }, 2000);

  try {
    const response = await fetch(`${SIDECAR_BASE}/agent/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, content }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            store.completeStreaming(sessionId);
            store.setRunStatus(sessionId, 'completed');
            store.setThinkingStep(sessionId, '');
            store.clearThinkingLogs(sessionId);
            return;
          }

          try {
            const event = JSON.parse(data) as AgentEvent;
            handleAgentEvent(event, sessionId);
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    store.completeStreaming(sessionId);
    store.setRunStatus(sessionId, 'completed');
    store.setThinkingStep(sessionId, '');
    store.clearThinkingLogs(sessionId);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    store.setError(sessionId, {
      code: 'CLAUDE_AGENT_FAILED',
      message: error.message,
    });
    store.setRunStatus(sessionId, 'failed');
  }
}

// 处理 Agent 事件
function handleAgentEvent(event: AgentEvent, sessionId: string): void {
  const store = useAgentStore.getState();

  switch (event.type) {
    case 'agent.thinking':
      // 更新思考步骤
      store.setThinkingStep(sessionId, '思考中...');
      // 如果思考内容较长，添加到日志
      if (event.thinking && event.thinking.length > 50) {
        const summary = event.thinking.slice(0, 50) + '...';
        store.addThinkingLog(sessionId, summary, 'info');
      }
      break;

    case 'agent.message.delta':
      // 收到文本内容时，清除工具调用状态（工具已完成）
      if (store.sessions[sessionId]?.currentToolCall) {
        const toolCallStartTime = store.sessions[sessionId]?.toolCallStartTime;
        const toolDuration = toolCallStartTime ? Date.now() - toolCallStartTime : undefined;
        store.setToolCall(sessionId, null);
        store.setThinkingStep(sessionId, '处理中...');
        // 更新最后一条日志的时长
        if (toolDuration) {
          const logs = store.sessions[sessionId]?.thinkingLogs || [];
          if (logs.length > 0) {
            const lastLog = logs[logs.length - 1];
            store.updateThinkingLogDuration(sessionId, lastLog.id, toolDuration);
          }
        }
      }
      store.appendDelta(sessionId, event.delta);
      break;

    case 'agent.message.completed':
      store.completeStreaming(sessionId);
      store.setThinkingStep(sessionId, '');
      store.clearThinkingLogs(sessionId);
      break;

    case 'agent.tool.requested':
      store.setToolCall(sessionId, event.request);
      store.setThinkingStep(sessionId, `调用 ${event.request.name}...`);
      store.addThinkingLog(sessionId, `调用 ${event.request.name}`, 'tool', undefined, JSON.stringify(event.request.args));
      // 记录工具调用开始时间
      store.setToolCallStartTime(sessionId, Date.now());
      break;

    case 'agent.tool.completed':
      const toolCallStartTime = store.sessions[sessionId]?.toolCallStartTime;
      const toolDuration = toolCallStartTime ? Date.now() - toolCallStartTime : undefined;
      store.setToolCall(sessionId, null);
      store.setThinkingStep(sessionId, '处理中...');
      // 工具完成时更新最后一条日志的时长
      if (toolDuration) {
        const logs = store.sessions[sessionId]?.thinkingLogs || [];
        if (logs.length > 0) {
          const lastLog = logs[logs.length - 1];
          store.updateThinkingLogDuration(sessionId, lastLog.id, toolDuration);
        }
      }
      break;

    case 'agent.run.failed':
      store.setError(sessionId, event.error);
      store.setRunStatus(sessionId, 'failed');
      store.clearThinkingLogs(sessionId);
      store.setThinkingStep(sessionId, '');
      break;

    case 'agent.approval.required':
      store.setApproval(sessionId, event.approval);
      store.setThinkingStep(sessionId, '等待授权确认...');
      store.addThinkingLog(sessionId, `需要授权: ${event.approval.title}`, 'tool');
      break;

    default:
      break;
  }
}

// 获取 Sessions 列表
export async function fetchSessions() {
  const response = await fetch(`${SIDECAR_BASE}/agent/sessions`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// 获取消息列表
export async function fetchMessages(sessionId: string) {
  const response = await fetch(`${SIDECAR_BASE}/agent/session/${sessionId}/messages`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// 审批决策
export async function submitApproval(approvalId: string, decision: string) {
  const response = await fetch(`${SIDECAR_BASE}/agent/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalId, decision }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
