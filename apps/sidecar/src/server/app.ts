import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { AgentService, agentEvents } from '../agent/service';
import { MusicService, musicEvents } from '../music/service';
import { ContextService, contextEvents } from '../context/service';
import { PermissionService } from '../permission/service';
import { RecommendationOrchestrator } from '../recommendation/orchestrator';
import { createLogger, logEvents, getRecentLogs, clearLogs } from '../utils/logger';

const log = createLogger('server');
const version = '0.0.1';
const PORT = Number(process.env.PORT) || 4567;

export function createServer(): Express {
  const app = express();
  const permissionService = new PermissionService();
  const agentService = new AgentService(permissionService);
  const musicService = new MusicService();
  const contextService = new ContextService(permissionService);
  const orchestrator = new RecommendationOrchestrator(musicService);

  // 设置 ContextService 引用到 AgentService（用于情绪分析）
  agentService.setContextService(contextService);

  app.use(cors());
  app.use(express.json());

  // 启动时预加载高优先级 Mood（异步，不阻塞服务器启动）
  musicService.warmupHighPriorityMoods().catch(e => {
    log.error(`高优先级预热失败: ${e}`);
  });

  // ── Health Check ──
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // ── Version ──
  app.get('/version', (_req, res) => {
    res.json({ version });
  });

  // ── Config ──
  app.get('/config', (_req: Request, res: Response) => {
    const claudeVersion = agentService.getClaudeVersion();
    res.json({
      claudeAvailable: agentService.isClaudeAvailable(),
      claudeVersion: claudeVersion || null,
      mode: 'local_cli',
      port: PORT,
    });
  });

  // ── Agent APIs ──

  app.post('/agent/session/create', (req: Request, res: Response) => {
    try {
      const { id, title, projectPath } = req.body as { id?: string; title: string; projectPath?: string };
      if (!title) {
        res.status(400).json({ error: 'title is required' });
        return;
      }
      const session = agentService.createSession(title, projectPath, id);
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/agent/session/:id', (req: Request, res: Response) => {
    try {
      const session = agentService.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.json(session);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/agent/sessions', (_req: Request, res: Response) => {
    try {
      const sessions = agentService.listSessions();
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/agent/session/:id/messages', (req: Request, res: Response) => {
    try {
      const messages = agentService.getMessages(req.params.id);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/agent/message', async (req: Request, res: Response) => {
    try {
      const { sessionId, content } = req.body as { sessionId: string; content: string };
      if (!sessionId || !content) {
        res.status(400).json({ error: 'sessionId and content are required' });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      await agentService.sendMessage(
        sessionId,
        content,
        (delta) => {
          res.write(`data: ${JSON.stringify({ type: 'agent.message.delta', sessionId, delta })}\n\n`);
        },
        (message) => {
          res.write(`data: ${JSON.stringify({ type: 'agent.message.completed', sessionId, message })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
        (error) => {
          res.write(`data: ${JSON.stringify({ type: 'agent.run.failed', sessionId, error: { code: 'CLAUDE_AGENT_FAILED', message: error.message } })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
        (toolName, toolInput) => {
          res.write(`data: ${JSON.stringify({ type: 'agent.tool.requested', sessionId, request: { id: `tool_${Date.now()}`, name: toolName, args: toolInput, status: 'running' } })}\n\n`);
        },
        (thinking) => {
          res.write(`data: ${JSON.stringify({ type: 'agent.thinking', sessionId, thinking })}\n\n`);
        },
      );
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });

  app.post('/agent/approve', (req: Request, res: Response) => {
    try {
      const { approvalId, decision } = req.body as { approvalId: string; decision: string };
      if (!approvalId || !decision) {
        res.status(400).json({ error: 'approvalId and decision are required' });
        return;
      }
      agentService.approve(approvalId, decision as any);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/agent/check-permission', (req: Request, res: Response) => {
    try {
      const { toolName, toolInput, sessionId } = req.body as { toolName: string; toolInput: Record<string, unknown>; sessionId?: string };
      if (!toolName) {
        res.status(400).json({ error: 'toolName is required' });
        return;
      }
      const requiresApproval = agentService.requiresApproval(toolName, toolInput || {}, sessionId);
      const permission = agentService.getCommandExecutionPermission();

      // 检查是否是目录外访问
      let outsideProjectPath = false;
      if (sessionId) {
        const session = agentService.getSession(sessionId);
        if (session?.projectPath) {
          outsideProjectPath = agentService.requiresApproval(toolName, toolInput || {}, sessionId) &&
                               !agentService.requiresApproval(toolName, toolInput || {}); // 排除其他权限检查
        }
      }

      res.json({ requiresApproval, permission, outsideProjectPath });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/events/agent', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const onEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    agentEvents.on('agent.session.created', onEvent);
    agentEvents.on('agent.approval.required', onEvent);
    agentEvents.on('approval.resolved', onEvent);

    req.on('close', () => {
      agentEvents.off('agent.session.created', onEvent);
      agentEvents.off('agent.approval.required', onEvent);
      agentEvents.off('approval.resolved', onEvent);
    });
  });

  // ── Music APIs ──

  app.get('/music/status', async (_req: Request, res: Response) => {
    try {
      const status = await musicService.getAuthStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/music/warmup-status', (_req: Request, res: Response) => {
    try {
      const status = musicService.getWarmupStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/auth/start', async (_req: Request, res: Response) => {
    try {
      const result = await musicService.startAuth();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── 网易云二维码登录 API ──

  app.get('/music/auth/qr/create', async (_req: Request, res: Response) => {
    try {
      const result = await musicService.startQrAuth();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/music/auth/qr/check', async (req: Request, res: Response) => {
    try {
      const { key } = req.query as { key?: string };
      if (!key) {
        res.status(400).json({ error: 'key is required' });
        return;
      }
      const result = await musicService.checkQrAuth(key);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/auth/logout', async (_req: Request, res: Response) => {
    try {
      await musicService.logout();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/recommend', async (req: Request, res: Response) => {
    try {
      const { sessionId, mood, refresh, preferences, playedTrackIds } = req.body as {
        sessionId: string;
        mood: string;
        refresh?: boolean;
        preferences?: string[];
        playedTrackIds?: string[];
      };
      if (!sessionId || !mood) {
        res.status(400).json({ error: 'sessionId and mood are required' });
        return;
      }
      const recommendation = await musicService.recommend(sessionId, mood as any, refresh || false, preferences || [], playedTrackIds || []);

      // 用户首次请求推荐后，触发后台预热
      musicService.backgroundWarmup().catch(e => {
        log.error(`后台预热失败: ${e}`);
      });

      res.json(recommendation);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/play', async (req: Request, res: Response) => {
    try {
      const { track } = req.body as { track?: any };
      const state = await musicService.play(track);
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/pause', async (_req: Request, res: Response) => {
    try {
      const state = await musicService.pause();
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/next', async (_req: Request, res: Response) => {
    try {
      const state = await musicService.next();
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/music/playback', async (_req: Request, res: Response) => {
    try {
      const state = await musicService.getPlaybackState();
      res.json(state);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/music/track-features/:trackId', (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      const features = musicService.getTrackFeatures(trackId);
      if (features) {
        res.json(features);
      } else {
        res.status(404).json({ error: 'Track features not found' });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 获取歌词
  app.get('/music/lyrics/:trackId', async (req: Request, res: Response) => {
    try {
      const { trackId } = req.params;
      const lyrics = await musicService.getLyrics(trackId);
      if (lyrics) {
        res.json(lyrics);
      } else {
        res.status(404).json({ error: 'Lyrics not found' });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/feedback', (req: Request, res: Response) => {
    try {
      const { sessionId, recommendationId, action, mood } = req.body as { sessionId: string; recommendationId: string; action: string; mood?: string };
      if (!sessionId || !recommendationId || !action) {
        res.status(400).json({ error: 'sessionId, recommendationId, and action are required' });
        return;
      }
      musicService.recordFeedback(sessionId, recommendationId, action as any);

      // 如果有 mood 参数，同时记录到偏好学习
      if (mood) {
        musicService.recordFeedbackWithLearning(sessionId, mood as any, action as any);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/music/preference-learning/:sessionId', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const learning = musicService.getPreferenceLearning(sessionId);
      if (learning) {
        res.json(learning);
      } else {
        res.json({ message: 'No learning data found' });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/preference-learning/reset', (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body as { sessionId: string };
      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }
      musicService.resetPreferenceLearning(sessionId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Project Preferences APIs ──

  app.get('/music/project-preferences/:projectId', (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const prefs = musicService.getProjectPreferences(projectId);
      if (prefs) {
        res.json(prefs);
      } else {
        res.json({ message: 'No project preferences found' });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/music/project-preferences', (req: Request, res: Response) => {
    try {
      const { projectId, projectName, preferences, inheritGlobal } = req.body as {
        projectId: string;
        projectName: string;
        preferences: string[];
        inheritGlobal?: boolean;
      };
      if (!projectId || !projectName || !preferences) {
        res.status(400).json({ error: 'projectId, projectName, and preferences are required' });
        return;
      }
      musicService.setProjectPreferences(projectId, projectName, preferences, inheritGlobal ?? true);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/music/project-preferences/:projectId', (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      musicService.deleteProjectPreferences(projectId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/music/project-preferences', (_req: Request, res: Response) => {
    try {
      const allPrefs = musicService.getAllProjectPreferences();
      const result: Record<string, any> = {};
      allPrefs.forEach((prefs, projectId) => {
        result[projectId] = prefs;
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/events/music', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const onEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    musicEvents.on('music.recommendation.ready', onEvent);
    musicEvents.on('music.playback.changed', onEvent);
    musicEvents.on('music.feedback.recorded', onEvent);
    musicEvents.on('music.warmup.completed', onEvent);

    req.on('close', () => {
      musicEvents.off('music.recommendation.ready', onEvent);
      musicEvents.off('music.playback.changed', onEvent);
      musicEvents.off('music.feedback.recorded', onEvent);
      musicEvents.off('music.warmup.completed', onEvent);
    });
  });

  // ── Context APIs ──

  app.get('/context/current', (_req: Request, res: Response) => {
    try {
      const context = contextService.getCurrentContext();
      const mood = contextService.getCurrentMood();
      res.json({ ...context, mood });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/context/manual-state', (req: Request, res: Response) => {
    try {
      const { state } = req.body as { state: string | null };
      contextService.setManualState(state as any);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/context/weather', async (_req: Request, res: Response) => {
    try {
      const weather = await contextService.updateWeather();
      res.json(weather);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/context/project', (_req: Request, res: Response) => {
    try {
      const projectInfo = contextService.getProjectInfo();
      res.json(projectInfo);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/context/auto-recommend', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body as { sessionId: string };
      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }
      contextService.setSessionId(sessionId);
      const context = contextService.getCurrentContext();
      const recommendation = await orchestrator.recommend(sessionId, context);
      if (recommendation) {
        res.json(recommendation);
      } else {
        res.json({ message: 'Mood unchanged, no new recommendation needed' });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.get('/events/context', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const onEvent = (event: unknown) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    contextEvents.on('context.updated', onEvent);
    contextEvents.on('context.mood.changed', onEvent);
    contextEvents.on('context.weather.updated', onEvent);

    req.on('close', () => {
      contextEvents.off('context.updated', onEvent);
      contextEvents.off('context.mood.changed', onEvent);
      contextEvents.off('context.weather.updated', onEvent);
    });
  });

  // ── Permission APIs ──

  app.get('/permissions', (_req: Request, res: Response) => {
    try {
      const { permissionStore } = require('../storage/store.js');
      const permissions = permissionStore.getAll();
      res.json(permissions);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.patch('/permissions', (req: Request, res: Response) => {
    try {
      const { key, value } = req.body as { key: string; value: string };
      if (!key || !value) {
        res.status(400).json({ error: 'key and value are required' });
        return;
      }
      const { permissionStore } = require('../storage/store.js');
      permissionStore.set(key, value);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Log APIs ──

  // 获取最近日志
  app.get('/logs/recent', (req: Request, res: Response) => {
    try {
      const count = Number(req.query.count) || 50;
      res.json(getRecentLogs(count));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 清空日志缓冲区
  app.delete('/logs', (_req: Request, res: Response) => {
    try {
      clearLogs();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 日志实时推送（SSE）
  app.get('/events/logs', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const onLog = (entry: unknown) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    logEvents.on('log', onLog);

    req.on('close', () => {
      logEvents.off('log', onLog);
    });
  });

  // ── Admin APIs ──

  app.post('/admin/clear', (_req: Request, res: Response) => {
    try {
      const { store } = require('../storage/store.js');
      store.clear();
      log.info('数据已清除');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return app;
}
