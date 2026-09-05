<script setup lang="ts">
/**
 * 设置视图
 */
import { useI18n } from 'vue-i18n';
import { RECENT_FILES_MAX, RECENT_FILES_MIN, useConfigStore } from '@/stores/config';
import { useUiStore } from '@/stores/ui';
import { useToastStore } from '@/composables/useToast';
import { setLocale, type AppLocale, SUPPORTED_LOCALES, LOCALE_LABELS } from '@/i18n';
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
      <label>{{ t('settings.savePath') }}</label>
      <input
        v-model="config.userConfig.defSavePath"
        type="text"
        :placeholder="t('settings.savePathWeb')"
        disabled
      />
      <small>{{ t('settings.comingSoon') }}</small>
    </section>

    <section class="setting">
      <label>{{ t('settings.aiEndpoint') }}</label>
      <input
        v-model="config.userConfig.aiEndpoint"
        type="text"
        :placeholder="t('settings.aiEndpointPlaceholder')"
      />
    </section>

    <section class="setting">
      <label>{{ t('settings.aiModel') }}</label>
      <input
        v-model="config.userConfig.aiModel"
        type="text"
        :placeholder="t('settings.aiModelPlaceholder')"
      />
    </section>

    <section class="setting">
      <label>{{ t('settings.aiApiKey') }}</label>
      <input v-model="config.userConfig.aiApiKey" type="password" />
    </section>

    <section class="setting">
      <label>{{ t('settings.saveLogs') }}</label>
      <input v-model="config.userConfig.ifSaveLogToDisk" type="checkbox" disabled />
      <small>{{ t('settings.comingSoon') }}</small>
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
