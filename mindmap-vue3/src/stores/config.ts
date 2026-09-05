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
  /** OpenAI-compatible AI endpoint */
  aiEndpoint: string;
  /** AI model identifier */
  aiModel: string;
  /** API key for the configured AI endpoint */
  aiApiKey: string;
}

const CONFIG_KEY = 'user.config';

const DEFAULT_CONFIG: UserConfig = {
  isAutoSave: true,
  defSavePath: '',
  ifSaveLogToDisk: false,
  recentMaxNum: 5,
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
      recentMaxNum:
        typeof parsed.recentMaxNum === 'number' ? parsed.recentMaxNum : DEFAULT_CONFIG.recentMaxNum,
      aiEndpoint: typeof parsed.aiEndpoint === 'string' ? parsed.aiEndpoint : '',
      aiModel: typeof parsed.aiModel === 'string' ? parsed.aiModel : '',
      aiApiKey: typeof parsed.aiApiKey === 'string' ? parsed.aiApiKey : '',
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
    userConfig.value = { ...userConfig.value, ...partial };
  }

  function reset(): void {
    userConfig.value = { ...DEFAULT_CONFIG };
  }

  return { userConfig, save, reset };
});
