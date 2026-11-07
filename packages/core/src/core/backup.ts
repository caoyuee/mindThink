/**
 * 备份文件工具（纯模块，共享于 Web + Tauri，必须两端字节一致）
 *
 * 仅负责备份文件名匹配 / 排序 / 超限裁剪等纯逻辑，便于单测。
 * 真正扫描磁盘与删除由平台层（Tauri 命令）完成；
 * 红线：只允许操作 `<原名>.backup-*` 命名的文件，杜绝误删。
 */

/** 生成备份时间戳：ISO 8601 中 `:` 与 `.` 替换为 `-`，便于文件名安全且字典序可排序。 */
export function formatBackupStamp(date: Date): string {
  return date.toISOString().replace(/[.:]/g, '-');
}

/**
 * 判断文件名是否为某原文件的备份文件。
 * 备份命名规则：`<originalBasename>.backup-<stamp>`。
 */
export function isBackupFileName(originalBasename: string, fileName: string): boolean {
  return fileName.startsWith(`${originalBasename}.backup-`);
}

/** 将备份路径按时间降序排列（最新在前）。stamp 为 ISO 序，字典序即时间序。 */
export function sortBackupPathsDesc(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    if (a < b) return 1;
    if (a > b) return -1;
    return 0;
  });
}

/**
 * 从已降序排列的备份路径中挑出需删除的（超出 keep 数量的老备份）。
 * 返回待删除路径；keep <= 0 时全部删除。
 */
export function selectBackupsToDelete(sortedDescPaths: string[], keep: number): string[] {
  if (keep <= 0) return [...sortedDescPaths];
  return sortedDescPaths.slice(keep);
}

/** 从完整路径中取文件名（跨平台兼容）。 */
export function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}
