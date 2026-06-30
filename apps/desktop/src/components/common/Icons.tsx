/**
 * 统一 SVG 图标库
 * 风格：线性图标，1.5px 描边，圆角端点
 * 颜色：currentColor，继承父元素
 * 尺寸：默认 16x16，可通过 size 参数调整
 */

interface IconProps {
  size?: number;
  className?: string;
}

const defaultProps: IconProps = {
  size: 16,
};

// ── 播放器控制 ──

/** 上一首 */
export function IconPrevious({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 3v10M13 3L7 8l6 5V3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 播放 */
export function IconPlay({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M5 3l8 5-8 5V3z" fill="currentColor"/>
    </svg>
  );
}

/** 暂停 */
export function IconPause({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="4" y="3" width="2.5" height="10" rx="0.5" fill="currentColor"/>
      <rect x="9.5" y="3" width="2.5" height="10" rx="0.5" fill="currentColor"/>
    </svg>
  );
}

/** 下一首 */
export function IconNext({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13 3v10M3 3l6 5-6 5V3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── 反馈操作 ──

/** 换歌/刷新 */
export function IconRefresh({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 8a5.5 5.5 0 0 1 9.9-3.3M13.5 8a5.5 5.5 0 0 1-9.9 3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 1v3.7h-3.7M4 15v-3.7h3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 专注/靶心 */
export function IconTarget({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="1" fill="currentColor"/>
    </svg>
  );
}

/** 不喜欢/踩 */
export function IconDislike({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 14s-5.5-3.5-5.5-7A3.5 3.5 0 0 1 8 4.5 3.5 3.5 0 0 1 13.5 7C13.5 10.5 8 14 8 14z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 活力/火焰 */
export function IconFire({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1C8 1 4 5 4 9a4 4 0 0 0 8 0c0-2-1-3.5-2-4.5.5 1.5 0 3-1 3.5 0-2-1-3-1-3s-1 1.5-1 3c-1-.5-1.5-2-1-3.5C5 6 4 8 4 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 安静/静音 */
export function IconMute({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L4.5 5H2v6h2.5L8 14V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 5.5l3 5M14 5.5l-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 跳过 */
export function IconSkip({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 3l7 5-7 5V3zM13 3v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 保持/确认 */
export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5.5 8l2 2 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 错误/关闭 */
export function IconError({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 警告 */
export function IconWarning({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L1.5 13h13L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 6v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── 导航/界面 ──

/** 会话/聊天 */
export function IconChat({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3h12v8H5l-3 3V3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 文件夹 */
export function IconFolder({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4v8h12V6H8L6.5 4H2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 设置/齿轮 */
export function IconSettings({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M13 3l-1.5 1.5M4.5 11.5L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 锁/权限 */
export function IconLock({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="1" fill="currentColor"/>
    </svg>
  );
}

/** 展开箭头（向下） */
export function IconChevronDown({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 收起箭头（向右） */
export function IconChevronRight({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── 状态/模式 ──

/** 自动/刷新 */
export function IconAuto({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2a6 6 0 1 1 0 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 2l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 创意/灯泡 */
export function IconCreative({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6 13h4M6.5 11.5h3M8 1a4.5 4.5 0 0 0-2 8.5h4A4.5 4.5 0 0 0 8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 提神/闪电 */
export function IconEnergy({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M9 1L3 9h5l-1 6 6-8H8l1-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 夜间/月亮 */
export function IconNight({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13 10A6 6 0 0 1 6 3a7 7 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Debug/虫子 */
export function IconDebug({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="9" r="4" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 9H3M13 9h-2M8 5V3M5.5 6L4 4.5M10.5 6L12 4.5M5.5 12L4 13.5M10.5 12L12 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="6.5" cy="8.5" r="0.5" fill="currentColor"/>
      <circle cx="9.5" cy="8.5" r="0.5" fill="currentColor"/>
    </svg>
  );
}

// ── 其他 ──

/** 音乐 */
export function IconMusic({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6 12V4l7-2v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="4.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="11.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

/** 天气/晴天 */
export function IconSunny({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 禁用 */
export function IconDisabled({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M4 12L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 删除/垃圾桶 */
export function IconDelete({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 关闭 */
export function IconClose({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

// ── 补充图标（用于 ManualStateSelector）──

/** 深度工作/大脑 */
export function IconBrain({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1C6 1 4.5 2.5 4.5 4.5c0 .5.1 1 .3 1.5C3.5 6.5 2.5 8 2.5 9.5 2.5 12 4.5 14 7 14h2c2.5 0 4.5-2 4.5-4.5 0-1.5-1-3-2.3-3.5.2-.5.3-1 .3-1.5C11.5 2.5 10 1 8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 1v13M6 4.5c1 .5 2 .5 3 0M5.5 8c1.5.5 3.5.5 5 0M6 11.5c1 .5 2 .5 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 调试/扳手 */
export function IconWrench({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M10 2a3.5 3.5 0 0 0-3 5.2L3 11.2V14h2.8l4-4A3.5 3.5 0 0 0 14 6a3.5 3.5 0 0 0-4-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 阅读/书本 */
export function IconBook({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 2v12l6-3 6 3V2l-6 3-6-3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 深夜/城市 */
export function IconCity({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 14V5l3-2v11M5 7h2M5 9.5h2M5 12h2M7 14V4l4-2v12M9 6h2M9 8.5h2M9 11h2M11 14V6l3-2v10M12.5 8h0M12.5 10.5h0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 环境音/波浪 */
export function IconWave({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1 8c1-2 2-3 3-3s2 2 3 2 2-2 3-2 2 1 3 3 2 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 11c1-2 2-3 3-3s2 2 3 2 2-2 3-2 2 1 3 3 2 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    </svg>
  );
}

/** 紧急/警报 */
export function IconAlert({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// ── 状态指示图标 ──

/** 圆形勾选 */
export function IconCircleCheck({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5.5 8l2 2 3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 圆形叉号 */
export function IconCircleX({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 空心圆 */
export function IconCircle({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

/** 加载点 */
export function IconLoading({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="4" cy="8" r="1.5" fill="currentColor" opacity="0.4"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.7"/>
      <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
    </svg>
  );
}

/** 温度计 */
export function IconThermometer({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2v8M5 10a3 3 0 1 0 6 0M8 2a2 2 0 0 0-2 2v6a3 3 0 1 0 4 0V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="10" r="1" fill="currentColor"/>
    </svg>
  );
}

/** 面板收起（展开状态显示，双箭头向右 >>） */
export function IconPanelOpen({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 4l4 4-4 4M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 面板展开（收起状态显示，双箭头向左 <<） */
export function IconPanelClose({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13 4l-4 4 4 4M8 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** 歌词（开启） */
export function IconLyrics({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 3h8M4 6h6M4 9h7M4 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 歌词（关闭） */
export function IconLyricsOff({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 3h8M4 6h6M4 9h7M4 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
      <path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 音量（有声） */
export function IconVolume({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L4.5 5H2v6h2.5L8 14V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 5.5c.8.8 1.2 2 1.2 2.5s-.4 1.7-1.2 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 3.5c1.3 1.3 2 3 2 4.5s-.7 3.2-2 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

/** 音量（静音） */
export function IconVolumeMute({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L4.5 5H2v6h2.5L8 14V2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11 5.5l3 5M14 5.5l-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
