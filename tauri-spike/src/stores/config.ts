/**
 * Config store：用户配置（自动保存、最近文件、保存路径等）
 *
 * 设计:
 * - 桌面端(Tauri)阶段: 写入 OS userData/naotu.config.json
 * - 当前(web)阶段: 写入 localStorage（占位实现）
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export interface UserConfig {
  /** 自动保存 */
  isAutoSave: boolean;
  /** 默认保存路径(仅桌面端) */
  defSavePath: string;
  /** 记录日志到磁盘 */
  ifSaveLogToDisk: boolean;
  /** 最近文件最大数量 */
  recentMaxNum: number;
  /** 最近打开的文件路径，最新的排在前面 */
  recentFiles: string[];
  /** OpenAI-compatible AI endpoint */
  aiEndpoint: string;
  /** AI model identifier */
  aiModel: string;
  /** API key kept in local app configuration */
  aiApiKey: string;
}

const CONFIG_KEY = 'user.config';
export const RECENT_FILES_MIN = 1;
export const RECENT_FILES_MAX = 20;

export function normalizeRecentMaxNum(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 5;
  return Math.min(RECENT_FILES_MAX, Math.max(RECENT_FILES_MIN, Math.round(value)));
}

const DEFAULT_CONFIG: UserConfig = {
  isAutoSave: true,
  defSavePath: '',
  ifSaveLogToDisk: false,
  recentMaxNum: 5,
  recentFiles: [],
  aiEndpoint: '',
  aiModel: '',
  aiApiKey: '',
};

function loadConfig(): UserConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<UserConfig>;
    return {
      ...DEFAULT_CONFIG,
      isAutoSave:
        typeof parsed.isAutoSave === 'boolean' ? parsed.isAutoSave : DEFAULT_CONFIG.isAutoSave,
      defSavePath: typeof parsed.defSavePath === 'string' ? parsed.defSavePath : '',
      ifSaveLogToDisk: typeof parsed.ifSaveLogToDisk === 'boolean' ? parsed.ifSaveLogToDisk : false,
      recentMaxNum: normalizeRecentMaxNum(parsed.recentMaxNum),
      aiEndpoint: typeof parsed.aiEndpoint === 'string' ? parsed.aiEndpoint : '',
      aiModel: typeof parsed.aiModel === 'string' ? parsed.aiModel : '',
      aiApiKey: typeof parsed.aiApiKey === 'string' ? parsed.aiApiKey : '',
      recentFiles: Array.isArray(parsed.recentFiles)
        ? parsed.recentFiles.filter((path): path is string => typeof path === 'string')
        : [],
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export const useConfigStore = defineStore('config', () => {
  const userConfig = ref<UserConfig>(loadConfig());

  // 自动持久化
  watch(
    userConfig,
    (cfg) => {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
      } catch {
        // ignore
      }
    },
    { deep: true },
  );

  function save(partial: Partial<UserConfig>): void {
    const recentMaxNum = normalizeRecentMaxNum(
      partial.recentMaxNum ?? userConfig.value.recentMaxNum,
    );
    userConfig.value = {
      ...userConfig.value,
      ...partial,
      recentMaxNum,
      recentFiles: (partial.recentFiles ?? userConfig.value.recentFiles).slice(0, recentMaxNum),
    };
  }

  function addRecentFile(path: string): void {
    const recentFiles = [
      path,
      ...userConfig.value.recentFiles.filter((item) => item !== path),
    ].slice(0, userConfig.value.recentMaxNum);
    save({ recentFiles });
  }

  function removeRecentFile(path: string): void {
    save({ recentFiles: userConfig.value.recentFiles.filter((item) => item !== path) });
  }

  function clearRecentFiles(): void {
    save({ recentFiles: [] });
  }

  function reset(): void {
    userConfig.value = { ...DEFAULT_CONFIG, recentFiles: [] };
  }

  return { userConfig, save, addRecentFile, removeRecentFile, clearRecentFiles, reset };
});
