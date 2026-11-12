/**
 * 节点文本展示截断。
 *
 * markmap 用最内层内容 div 的 scrollWidth 做布局测量，CSS 的
 * max-width + overflow:hidden 截断不会改变 scrollWidth，会导致
 * 连线/圆点按全文宽度排布，所以截断必须在数据投影层（content）
 * 完成，而不是靠 CSS。完整文本通过 MindEditor 挂 title 提示。
 */

/** 展示宽度预算：CJK/全角字符计 2 个单位，其余计 1 */
export const NODE_TEXT_MAX_UNITS = 20;

/** 判断是否为宽字符（CJK / 全角），近似按 Unicode East Asian Width F/W 范围 */
function isWideChar(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) || // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) || // CJK 部首/标点
    (code >= 0x3041 && code <= 0x33ff) || // 假名/注音/CJK 兼容
    (code >= 0x3400 && code <= 0x4dbf) || // CJK 扩展 A
    (code >= 0x4e00 && code <= 0x9fff) || // CJK 基本区
    (code >= 0xa000 && code <= 0xa4cf) || // 彝文
    (code >= 0xac00 && code <= 0xd7a3) || // 谚文音节
    (code >= 0xf900 && code <= 0xfaff) || // CJK 兼容表意
    (code >= 0xfe30 && code <= 0xfe4f) || // CJK 兼容形式
    (code >= 0xff00 && code <= 0xff60) || // 全角 ASCII/标点
    (code >= 0xffe0 && code <= 0xffe6) || // 全角符号
    (code >= 0x20000 && code <= 0x3fffd) // CJK 扩展 B-F
  );
}

/**
 * 截断文本用于画布节点展示：宽度预算内原样返回；超预算时截断并
 * 追加省略号。空文本原样返回。
 */
export function truncateForDisplay(text: string, maxUnits: number = NODE_TEXT_MAX_UNITS): string {
  if (!text) return text;
  let units = 0;
  for (let i = 0; i < text.length; i += 1) {
    units += isWideChar(text.charCodeAt(i)) ? 2 : 1;
    if (units > maxUnits) {
      // 从超出位置回退一个字符再拼省略号，避免正好卡在边界
      const cut = Math.max(0, i - 1);
      return `${text.slice(0, cut)}…`;
    }
  }
  return text;
}
