/**
 * 将颜色值附加指定的 alpha 透明度。
 * 统一输出 rgba() 格式，确保 CSS transition 能平滑过渡。
 *
 * @param color - CSS 颜色值（hex 或 rgba）
 * @param alphaHex - 16 进制 alpha 值（如 '15' 表示约 8% 不透明度）
 */
export function withAlpha(color: string, alphaHex: string): string {
  const alpha = parseInt(alphaHex, 16) / 255;

  // hex 6 位：#RRGGBB → rgba
  const hexMatch = color.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (hexMatch) {
    return `rgba(${parseInt(hexMatch[1], 16)}, ${parseInt(hexMatch[2], 16)}, ${parseInt(hexMatch[3], 16)}, ${alpha.toFixed(2)})`;
  }

  // rgba/rgb：替换 alpha 值
  const rgbaMatch = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${alpha.toFixed(2)})`;
  }

  // 无法识别的格式，降级返回原色
  return color;
}
