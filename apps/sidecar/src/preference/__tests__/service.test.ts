import { describe, it, expect, beforeEach } from 'vitest';
import { PreferenceService } from '../service';

describe('PreferenceService', () => {
  let service: PreferenceService;

  beforeEach(() => {
    service = new PreferenceService();
  });

  it('应该创建新的学习数据', () => {
    const sessionId = 'test-session-1';
    const learning = service.getLearning(sessionId);

    // 初始时没有学习数据
    expect(learning).toBeNull();
  });

  it('应该记录反馈并更新权重', () => {
    const sessionId = 'test-session-1';
    const mood = 'feature_flow';
    const action = 'more_focus';

    // 记录反馈
    service.recordFeedback(sessionId, mood, action);

    // 获取学习数据
    const learning = service.getLearning(sessionId);
    expect(learning).not.toBeNull();
    expect(learning!.feedbackHistory.length).toBe(1);
    expect(learning!.feedbackHistory[0].action).toBe(action);
    expect(learning!.feedbackHistory[0].mood).toBe(mood);
  });

  it('应该增加正向反馈的权重', () => {
    const sessionId = 'test-session-1';
    const mood = 'feature_flow';

    // 记录多次正向反馈
    service.recordFeedback(sessionId, mood, 'like');
    service.recordFeedback(sessionId, mood, 'like');
    service.recordFeedback(sessionId, mood, 'like');

    const learning = service.getLearning(sessionId);
    expect(learning!.styleWeights[mood]).toBeGreaterThan(0.5);
  });

  it('应该降低负向反馈的权重', () => {
    const sessionId = 'test-session-dislike';
    const mood = 'feature_flow';

    // 记录多次负向反馈
    service.recordFeedback(sessionId, mood, 'dislike');
    service.recordFeedback(sessionId, mood, 'dislike');
    service.recordFeedback(sessionId, mood, 'dislike');

    const learning = service.getLearning(sessionId);
    expect(learning!.styleWeights[mood]).toBeLessThan(0.5);
  });

  it('应该限制权重在 0-1 范围内', () => {
    const sessionId = 'test-session-1';
    const mood = 'feature_flow';

    // 记录大量正向反馈
    for (let i = 0; i < 20; i++) {
      service.recordFeedback(sessionId, mood, 'like');
    }

    const learning = service.getLearning(sessionId);
    expect(learning!.styleWeights[mood]).toBeLessThanOrEqual(1);
    expect(learning!.styleWeights[mood]).toBeGreaterThanOrEqual(0);
  });

  it('应该重置学习数据', () => {
    const sessionId = 'test-session-1';
    const mood = 'feature_flow';

    // 记录反馈
    service.recordFeedback(sessionId, mood, 'like');

    // 重置学习数据
    service.resetLearning(sessionId);

    // 验证学习数据已被删除
    const learning = service.getLearning(sessionId);
    expect(learning).toBeNull();
  });

  it('应该处理多个 Mood 的权重', () => {
    const sessionId = 'test-session-1';

    // 记录不同 Mood 的反馈
    service.recordFeedback(sessionId, 'feature_flow', 'like');
    service.recordFeedback(sessionId, 'debug_calm', 'dislike');
    service.recordFeedback(sessionId, 'low_energy', 'more_relaxed');

    const learning = service.getLearning(sessionId);
    expect(learning!.styleWeights['feature_flow']).toBeGreaterThan(0.5);
    expect(learning!.styleWeights['debug_calm']).toBeLessThan(0.5);
    expect(learning!.styleWeights['low_energy']).toBeGreaterThan(0.5);
  });
});
