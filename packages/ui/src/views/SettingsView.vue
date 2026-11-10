<script setup lang="ts">
/**
 * 设置视图
 */
import { useI18n } from 'vue-i18n';
import {
  BACKUP_KEEP_MAX,
  BACKUP_KEEP_MIN,
  RECENT_FILES_MAX,
  RECENT_FILES_MIN,
  useConfigStore,
} from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useToastStore } from '@/composables/useToast';
import { setLocale, type AppLocale, SUPPORTED_LOCALES, LOCALE_LABELS } from '@/i18n';
import { isTauri, chooseDirectory } from '@/platform';
import { ref, watch } from 'vue';

const { t, locale } = useI18n();
const config = useConfigStore();
const ui = useUiStore();
const toast = useToastStore();

// 临时语言选择（保存时应用）
const pendingLocale = ref<AppLocale>(locale.value as AppLocale);

watch(
  () => locale.value,
  (v) => {
    pendingLocale.value = v as AppLocale;
  },
);

function onSave(): void {
  setLocale(pendingLocale.value);
  config.save(config.userConfig);
  toast.success(t('settings.saved'));
}

/** 打开目录选择对话框并设置默认保存路径（仅桌面端可用；Web 端按钮禁用）。 */
async function chooseDefSavePath(): Promise<void> {
  const selected = await chooseDirectory();
  if (selected) config.save({ defSavePath: selected });
}

/** 清除默认保存路径。 */
function clearDefSavePath(): void {
  config.save({ defSavePath: '' });
}
</script>

<template>
  <div class="settings-view">
    <h1>{{ t('settings.title') }}</h1>

    <section class="setting">
      <label>{{ t('settings.language') }}</label>
      <select v-model="pendingLocale">
        <option v-for="loc in SUPPORTED_LOCALES" :key="loc" :value="loc">
          {{ LOCALE_LABELS[loc] }}
        </option>
      </select>
    </section>

    <section class="setting">
      <label>{{ t('settings.theme') }}</label>
      <select v-model="ui.theme">
        <option value="light">{{ t('settings.light') }}</option>
        <option value="dark">{{ t('settings.dark') }}</option>
      </select>
    </section>

    <section class="setting">
      <label>{{ t('settings.autoSave') }}</label>
      <input v-model="config.userConfig.isAutoSave" type="checkbox" />
    </section>

    <section class="setting">
      <label for="recent-max">{{ t('settings.recentMaxNum') }}</label>
      <input
        id="recent-max"
        v-model.number="config.userConfig.recentMaxNum"
        type="number"
        :min="RECENT_FILES_MIN"
        :max="RECENT_FILES_MAX"
        step="1"
      />
      <small>{{
        t('settings.recentMaxNumHint', { min: RECENT_FILES_MIN, max: RECENT_FILES_MAX })
      }}</small>
    </section>

    <section class="setting">
      <label for="backup-keep">{{ t('settings.backupKeepMax') }}</label>
      <input
        id="backup-keep"
        v-model.number="config.userConfig.backupKeepMax"
        type="number"
        :min="BACKUP_KEEP_MIN"
        :max="BACKUP_KEEP_MAX"
        step="1"
      />
      <small>{{
        t('settings.backupKeepMaxHint', { min: BACKUP_KEEP_MIN, max: BACKUP_KEEP_MAX })
      }}</small>
    </section>

    <section class="setting">
      <label for="save-path">{{ t('settings.savePath') }}</label>
      <div class="path-row">
        <input
          id="save-path"
          :value="config.userConfig.defSavePath"
          type="text"
          :placeholder="t('settings.savePathWeb')"
          readonly
        />
        <button type="button" :disabled="!isTauri()" @click="chooseDefSavePath">
          {{ t('settings.chooseDir') }}
        </button>
        <button
          type="button"
          :disabled="!isTauri() || !config.userConfig.defSavePath"
          @click="clearDefSavePath"
        >
          {{ t('settings.clear') }}
        </button>
      </div>
      <small v-if="isTauri()">{{ t('settings.savePathHint') }}</small>
      <small v-else>{{ t('settings.comingSoon') }}</small>
    </section>

    <section class="setting">
      <label>{{ t('settings.saveLogs') }}</label>
      <input v-model="config.userConfig.ifSaveLogToDisk" type="checkbox" :disabled="!isTauri()" />
      <small v-if="isTauri()">{{ t('settings.saveLogsHint') }}</small>
      <small v-else>{{ t('settings.comingSoon') }}</small>
    </section>

    <div class="actions">
      <button class="primary" @click="onSave">
        {{ t('settings.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 32px;
  overflow-y: auto;
}
h1 {
  margin: 0 0 24px 0;
  font-size: 22px;
}
.setting {
  display: grid;
  grid-template-columns: 200px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.setting small {
  grid-column: 2 / 4;
  font-size: 11px;
  color: var(--fg-mute);
}
.setting label {
  color: var(--fg-mute);
  font-size: 13px;
}
.setting select,
.setting input[type='text'],
.setting input[type='number'] {
  padding: 6px 10px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
}
.path-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.path-row input[type='text'] {
  flex: 1;
}
.path-row button {
  padding: 6px 12px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.path-row button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}
.actions .primary {
  padding: 8px 16px;
  background: var(--accent);
  color: var(--accent-fg);
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
