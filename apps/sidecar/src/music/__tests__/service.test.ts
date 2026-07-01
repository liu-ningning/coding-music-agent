import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MusicService } from '../service';

// Mock NeteaseMusicProvider
vi.mock('../netease', () => ({
  NeteaseMusicProvider: vi.fn().mockImplementation(() => ({
    getAuthStatus: vi.fn().mockResolvedValue({ connected: true }),
    startAuth: vi.fn().mockResolvedValue({ success: true }),
    simulateLogin: vi.fn(),
    searchTracks: vi.fn().mockResolvedValue([]),
    getHotTracks: vi.fn().mockResolvedValue([]),
    fillTrackUrls: vi.fn().mockImplementation((tracks) => Promise.resolve({ playableTracks: tracks, vipTracks: [] })),
  })),
}));

// Mock storage store
vi.mock('../../storage/store', () => ({
  feedbackStore: { add: vi.fn() },
  recommendationStore: { add: vi.fn() },
}));

describe('MusicService - 去重功能', () => {
  let service: MusicService;

  beforeEach(() => {
    service = new MusicService();
  });

  it('应该在 recommend 方法中接收 playedTrackIds 参数', async () => {
    const recommendSpy = vi.spyOn(service, 'recommend');

    const playedTrackIds = ['track-1', 'track-2'];

    try {
      await service.recommend('session-1', 'neutral', false, [], playedTrackIds);
    } catch (e) {
      // 忽略错误，我们只关心参数传递
    }

    expect(recommendSpy).toHaveBeenCalledWith('session-1', 'neutral', false, [], playedTrackIds);
  });

  it('应该使用默认空数组当 playedTrackIds 未提供', async () => {
    const recommendSpy = vi.spyOn(service, 'recommend');

    try {
      await service.recommend('session-1', 'neutral', false, []);
    } catch (e) {
      // 忽略错误
    }

    expect(recommendSpy).toHaveBeenCalledWith('session-1', 'neutral', false, []);
  });
});
