import { describe, it, expect, beforeEach } from 'vitest';
import { useMusicStore } from '../musicStore';

describe('musicStore - playedTrackIds', () => {
  beforeEach(() => {
    // 清空 store
    useMusicStore.setState({ sessions: {}, activeSessionId: null });
  });

  it('应该初始化空的 playedTrackIds', () => {
    const sessionId = 'test-session-1';
    useMusicStore.getState().initSession(sessionId);

    const sessionData = useMusicStore.getState().sessions[sessionId];
    expect(sessionData.playedTrackIds).toBeInstanceOf(Set);
    expect(sessionData.playedTrackIds.size).toBe(0);
  });

  it('应该添加单个已播放歌曲', () => {
    const sessionId = 'test-session-1';
    const trackId = 'track-123';

    useMusicStore.getState().initSession(sessionId);
    useMusicStore.getState().addPlayedTrack(sessionId, trackId);

    const playedIds = useMusicStore.getState().getPlayedTrackIds(sessionId);
    expect(playedIds).toContain(trackId);
    expect(playedIds.length).toBe(1);
  });

  it('应该添加多个已播放歌曲', () => {
    const sessionId = 'test-session-1';
    const trackIds = ['track-1', 'track-2', 'track-3'];

    useMusicStore.getState().initSession(sessionId);
    useMusicStore.getState().addPlayedTracks(sessionId, trackIds);

    const playedIds = useMusicStore.getState().getPlayedTrackIds(sessionId);
    expect(playedIds).toEqual(expect.arrayContaining(trackIds));
    expect(playedIds.length).toBe(3);
  });

  it('应该去重添加已播放歌曲', () => {
    const sessionId = 'test-session-1';
    const trackId = 'track-123';

    useMusicStore.getState().initSession(sessionId);
    useMusicStore.getState().addPlayedTrack(sessionId, trackId);
    useMusicStore.getState().addPlayedTrack(sessionId, trackId); // 重复添加

    const playedIds = useMusicStore.getState().getPlayedTrackIds(sessionId);
    expect(playedIds.length).toBe(1);
  });

  it('应该清空已播放歌曲', () => {
    const sessionId = 'test-session-1';
    const trackIds = ['track-1', 'track-2', 'track-3'];

    useMusicStore.getState().initSession(sessionId);
    useMusicStore.getState().addPlayedTracks(sessionId, trackIds);

    expect(useMusicStore.getState().getPlayedTrackIds(sessionId).length).toBe(3);

    useMusicStore.getState().clearPlayedTracks(sessionId);

    expect(useMusicStore.getState().getPlayedTrackIds(sessionId).length).toBe(0);
  });

  it('不同 session 的 playedTrackIds 应该独立', () => {
    const session1 = 'session-1';
    const session2 = 'session-2';

    useMusicStore.getState().initSession(session1);
    useMusicStore.getState().initSession(session2);

    useMusicStore.getState().addPlayedTrack(session1, 'track-1');
    useMusicStore.getState().addPlayedTrack(session2, 'track-2');

    expect(useMusicStore.getState().getPlayedTrackIds(session1)).toContain('track-1');
    expect(useMusicStore.getState().getPlayedTrackIds(session1)).not.toContain('track-2');

    expect(useMusicStore.getState().getPlayedTrackIds(session2)).toContain('track-2');
    expect(useMusicStore.getState().getPlayedTrackIds(session2)).not.toContain('track-1');
  });

  it('getPlayedTrackIds 应该返回空数组当 session 不存在', () => {
    const playedIds = useMusicStore.getState().getPlayedTrackIds('non-existent');
    expect(playedIds).toEqual([]);
  });
});
