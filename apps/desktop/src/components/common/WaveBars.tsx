import s from '@/styles/layout.module.css';

interface WaveBarsProps {
  /** 是否播放中 */
  playing?: boolean;
  /** 条数，默认 5 */
  count?: number;
  /** 各条高度数组，默认 [5, 9, 4, 8, 5] */
  heights?: number[];
  /** 容器高度，默认 20px */
  height?: number;
  /** 容器宽度，默认 24px */
  width?: number;
  /** 条宽度，默认 3.5px */
  barWidth?: number;
  /** 圆角，默认 2px */
  barRadius?: number;
  /** 颜色，默认 accent */
  color?: string;
  /** 额外 class */
  className?: string;
}

export function WaveBars({
  playing = false,
  count = 5,
  heights = [5, 9, 4, 8, 5],
  height = 20,
  width = 24,
  barWidth = 3.5,
  barRadius = 2,
  color = 'var(--color-accent)',
  className,
}: WaveBarsProps) {
  const bars = heights.slice(0, count);

  return (
    <div
      className={`${s.waveBars} ${className || ''}`}
      style={{ height, width }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          className={`${s.waveBarsBar} ${playing ? s.waveBarsBarPlaying : ''}`}
          style={{
            height: h,
            width: barWidth,
            borderRadius: barRadius,
            background: color,
            opacity: playing ? 0.9 : 0.5,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
