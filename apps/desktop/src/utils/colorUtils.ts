/**
 * 将颜色值附加指定的 alpha 透明度。
 * - hex 6 位 (#RRGGBB) → 8 位 hex (#RRGGBBAA)
 * - rgba/rgb 颜色 → 替换/添加 alpha 通道
 * - 其他格式 → 原样返回（降级处理）
 *
 * @param color - CSS 颜色值
 * @param alphaHex - 16 进制 alpha 值（如 '15' 表示约 8% 不透明度）
 */
export function withAlpha(color: string, alphaHex: string): string {
  // hex 6 位：#RRGGBB → #RRGGBBAA
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `${color}${alphaHex}`;
  }
  // rgba/rgb：替换 alpha 值
  const rgbaMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbaMatch) {
    const alpha = parseInt(alphaHex, 16) / 255;
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha.toFixed(2)})`;
  }
  // 无法识别的格式，降级返回原色
  return color;
}
