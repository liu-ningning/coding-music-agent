import { useState, useRef, useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { useSessionStore } from '@/stores/sessionStore';
import { sendAgentMessage } from '@/clients/agentSSE';
import { ToolCallCard } from './ToolCallCard';
import { ApprovalDialog } from './ApprovalDialog';
import { ErrorCard } from '../common/ErrorCard';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { IconMusic, IconCircle, IconCircleX } from '@/components/common/Icons';
import s from '@/styles/layout.module.css';

// 格式化时长
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// 实时时长显示组件
function LiveDuration({ startTime }: { startTime: number }) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(Date.now() - startTime);
    }, 100);
    return () => clearInterval(timer);
  }, [startTime]);

  return <span className={s.thinkingLogDuration}>{formatDuration(duration)}</span>;
}

export function AgentConsole() {
  const [input, setInput] = useState('');
  const [showTip, setShowTip] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const currentSession = useSessionStore((st) => st.current);
  const sessionId = currentSession?.id;

  const agentData = useAgentStore((st) => {
    if (!sessionId) return null;
    return st.sessions[sessionId] || null;
  });
  const setAgentActiveSession = useAgentStore((st) => st.setActiveSession);
  const initAgentSession = useAgentStore((st) => st.initSession);
  const setAgentError = useAgentStore((st) => st.setError);

  const messages = agentData?.messages || [];
  const streaming = agentData?.streamingContent || '';
  const runStatus = agentData?.runStatus || 'idle';
  const error = agentData?.error || null;
  const toolCall = agentData?.currentToolCall || null;
  const currentApproval = agentData?.currentApproval || null;
  const thinkingStep = agentData?.thinkingStep || '';
  const thinkingLogs = agentData?.thinkingLogs || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // 切换 Session 时同步 agentStore
  useEffect(() => {
    if (sessionId) {
      setAgentActiveSession(sessionId);
      initAgentSession(sessionId);
    }
  }, [sessionId]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || runStatus === 'running') return;

    // 没有 Session 时提示
    if (!sessionId) {
      setShowTip(true);
      setTimeout(() => setShowTip(false), 3000);
      return;
    }

    setInput('');
    await sendAgentMessage(sessionId, content);
  };

  const isEmpty = messages.length === 0 && !streaming;

  return (
    <div className={s.console}>
      {currentApproval && <ApprovalDialog approval={currentApproval} />}
      <div className={s.consoleMessages}>
        {isEmpty ? (
          <div className={s.consoleEmpty}>
            {sessionId ? (
              <>
                <div>准备开始一个新的 Coding Session。</div>
                <div>你可以直接描述要完成的开发任务。</div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}><IconMusic size={32} /></div>
                <div style={{ fontSize: 15, marginBottom: 8, color: 'var(--color-text-primary)' }}>
                  欢迎使用 Coding Music Agent
                </div>
                <div style={{ marginBottom: 16 }}>
                  请先创建一个 Coding Session 开始体验
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  点击左侧「+ New Session」创建会话
                </div>
              </>
            )}
          </div>
        ) : (
          <div className={s.messages}>
            {messages.map((m) => (
              <div key={m.id} className={`${s.msg} ${m.role === 'user' ? s.msgUser : s.msgAssistant}`}>
                <div className={`${s.msgBubble} ${m.role === 'user' ? s.msgBubbleUser : s.msgBubbleAssistant}`}>
                  <MarkdownRenderer content={m.content} />
                </div>
              </div>
            ))}
            {toolCall && (
              <div className={`${s.msg} ${s.msgAssistant}`}>
                <ToolCallCard request={toolCall} />
              </div>
            )}
            {(thinkingLogs.length > 0 || thinkingStep) && (
              <div className={`${s.msg} ${s.msgAssistant}`}>
                <div className={s.thinkingLog}>
                  {thinkingLogs.map((log) => {
                    const iconClass = log.type === 'tool' ? s.thinkingLogIconTool
                      : log.type === 'error' ? s.thinkingLogIconError
                      : s.thinkingLogIconInfo;
                    // 最后一条日志且正在运行时，显示实时时长
                    const isLastLog = log === thinkingLogs[thinkingLogs.length - 1];
                    const showLiveDuration = isLastLog && runStatus === 'running' && !log.duration;

                    return (
                      <div key={log.id} className={s.thinkingLogEntry}>
                        <span className={`${s.thinkingLogIcon} ${iconClass}`}>
                          {log.type === 'error' ? <IconCircleX size={10} /> : <IconCircle size={10} />}
                        </span>
                        <div className={s.thinkingLogContent}>
                          <div className={s.thinkingLogHeader}>
                            <span className={s.thinkingLogText}>{log.text}</span>
                            {showLiveDuration ? (
                              <LiveDuration startTime={log.timestamp} />
                            ) : log.duration ? (
                              <span className={s.thinkingLogDuration}>
                                {formatDuration(log.duration)}
                              </span>
                            ) : null}
                          </div>
                          {log.details && (
                            <div className={s.thinkingLogDetails}>
                              {log.details}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {runStatus === 'running' && thinkingStep && thinkingStep !== thinkingLogs[thinkingLogs.length - 1]?.text && (
                    <div className={s.thinkingLogEntry}>
                      <div className={s.runningDots}>
                        <span className={s.runningDot} />
                        <span className={s.runningDot} />
                        <span className={s.runningDot} />
                      </div>
                      <span className={s.thinkingLogText}>{thinkingStep}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {streaming && (
              <div className={`${s.msg} ${s.msgAssistant}`}>
                <div className={`${s.msgBubble} ${s.msgBubbleAssistant}`}>
                  <MarkdownRenderer content={streaming} />
                  <span className={s.cursor} />
                </div>
              </div>
            )}
            {error && <ErrorCard error={error} onRetry={() => sessionId && setAgentError(sessionId, null)} onDismiss={() => sessionId && setAgentError(sessionId, null)} />}
            <div ref={endRef} />
          </div>
        )}
      </div>
      <div className={s.consoleInputArea}>
        <div className={s.consoleInputWrap}>
          <input
            className={s.consoleInput}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder={sessionId ? '描述你的开发任务...' : '请先创建会话...'}
            disabled={runStatus === 'running' || !sessionId}
          />
          <button
            className={s.consoleSendBtn}
            onClick={handleSend}
            disabled={!input.trim() || runStatus === 'running' || !sessionId}
          >
            {runStatus === 'running' ? '运行中...' : '发送'}
          </button>
        </div>
        {showTip && (
          <div className={s.consoleStatus} style={{ color: 'var(--color-warning)' }}>
            请先点击左侧「+ New Session」创建会话
          </div>
        )}
      </div>
    </div>
  );
}
