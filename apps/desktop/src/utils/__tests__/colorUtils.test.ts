import { describe, it, expect } from 'vitest';
import { withAlpha } from '../colorUtils';

describe('withAlpha', () => {
  describe('hex 颜色输入', () => {
    it('应该将 6 位 hex 转换为 rgba 格式', () => {
      // 0x15 = 21, 21/255 ≈ 0.08
      expect(withAlpha('#58A6A6', '15')).toBe('rgba(88, 166, 166, 0.08)');
      // 0x40 = 64, 64/255 ≈ 0.25
      expect(withAlpha('#58A6A6', '40')).toBe('rgba(88, 166, 166, 0.25)');
      // 0xff = 255, 255/255 = 1.00
      expect(withAlpha('#58A6A6', 'ff')).toBe('rgba(88, 166, 166, 1.00)');
      // 0x00 = 0, 0/255 = 0.00
      expect(withAlpha('#58A6A6', '00')).toBe('rgba(88, 166, 166, 0.00)');
    });

    it('应该处理不同颜色值', () => {
      expect(withAlpha('#B56B6B', '20')).toBe('rgba(181, 107, 107, 0.13)');
      expect(withAlpha('#6F8FAF', '30')).toBe('rgba(111, 143, 175, 0.19)');
      expect(withAlpha('#7E6FB5', '40')).toBe('rgba(126, 111, 181, 0.25)');
      expect(withAlpha('#000000', '80')).toBe('rgba(0, 0, 0, 0.50)');
      expect(withAlpha('#FFFFFF', '15')).toBe('rgba(255, 255, 255, 0.08)');
    });
  });

  describe('rgba 颜色输入', () => {
    it('应该将 rgba 转换为指定 alpha 的 rgba', () => {
      const result = withAlpha('rgba(255,255,255,0.08)', '15');
      // 0x15 = 21, 21/255 ≈ 0.08
      expect(result).toBe('rgba(255, 255, 255, 0.08)');
    });

    it('应该正确计算 alpha 值', () => {
      // 0x40 = 64, 64/255 ≈ 0.25
      const result = withAlpha('rgba(255,255,255,0.08)', '40');
      expect(result).toBe('rgba(255, 255, 255, 0.25)');
    });

    it('应该处理 rgb 输入（无 alpha）', () => {
      // 0x15 = 21, 21/255 ≈ 0.08
      const result = withAlpha('rgb(100, 150, 200)', '15');
      expect(result).toBe('rgba(100, 150, 200, 0.08)');
    });

    it('应该处理带空格的 rgba', () => {
      const result = withAlpha('rgba( 128 , 64 , 32 , 0.5 )', '80');
      // 0x80 = 128, 128/255 ≈ 0.50
      expect(result).toBe('rgba(128, 64, 32, 0.50)');
    });
  });

  describe('降级处理', () => {
    it('对无法识别的格式返回原色', () => {
      expect(withAlpha('transparent', '15')).toBe('transparent');
      expect(withAlpha('inherit', '15')).toBe('inherit');
      expect(withAlpha('currentColor', '15')).toBe('currentColor');
    });

    it('对 3 位 hex 返回原色', () => {
      // 3 位 hex 不匹配 6 位 hex 正则
      expect(withAlpha('#FFF', '15')).toBe('#FFF');
    });

    it('对 8 位 hex（已有 alpha）返回原色', () => {
      expect(withAlpha('#58A6A615', '40')).toBe('#58A6A615');
    });
  });

  describe('氛围层实际使用场景', () => {
    it('feature_flow 颜色应该生成有效的 rgba', () => {
      const glow = '#58A6A6';
      expect(withAlpha(glow, '15')).toMatch(/^rgba\(/);
      expect(withAlpha(glow, '40')).toMatch(/^rgba\(/);
      expect(withAlpha(glow, '20')).toMatch(/^rgba\(/);
      expect(withAlpha(glow, '30')).toMatch(/^rgba\(/);
    });

    it('neutral 默认颜色应该生成有效的 rgba', () => {
      const glow = 'rgba(255,255,255,0.08)';
      expect(withAlpha(glow, '15')).toMatch(/^rgba\(/);
      expect(withAlpha(glow, '40')).toMatch(/^rgba\(/);
      expect(withAlpha(glow, '20')).toMatch(/^rgba\(/);
      expect(withAlpha(glow, '30')).toMatch(/^rgba\(/);
    });

    it('emergency_focus 颜色应该生成有效的 rgba', () => {
      const glow = '#B56B6B';
      expect(withAlpha(glow, '15')).toMatch(/^rgba\(/);
      expect(withAlpha(glow, '40')).toMatch(/^rgba\(/);
    });

    it('所有 mood 颜色格式一致（均为 rgba）', () => {
      const moods = ['#58A6A6', '#6F8FAF', '#7E6FB5', '#7A8B9A', '#B56B6B', '#9A8BAF', '#4A5A7A', 'rgba(255,255,255,0.08)'];
      for (const color of moods) {
        const result = withAlpha(color, '40');
        expect(result).toMatch(/^rgba\(/);
      }
    });
  });
});
