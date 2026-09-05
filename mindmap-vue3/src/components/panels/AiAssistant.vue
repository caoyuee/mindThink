<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMindmapStore } from '@/stores/mindmap';
import { useConfigStore } from '@/stores/config';
import { useToastStore } from '@/composables/useToast';
import { createMcpContext } from '@/core/mcp';
import { createAiChatRequest, normalizeAiEndpoint, readAiChatResponse } from '@/core/ai';

const { t } = useI18n();
const mindmap = useMindmapStore();
const config = useConfigStore();
const toast = useToastStore();
const prompt = ref(t('ai.defaultPrompt'));
const answer = ref('');
const loading = ref(false);

async function ask(): Promise<void> {
  const endpoint = normalizeAiEndpoint(config.userConfig.aiEndpoint);
  if (!endpoint || !config.userConfig.aiModel.trim()) {
    toast.warn(t('ai.configureFirst'));
    return;
  }
  loading.value = true;
  answer.value = '';
  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.userConfig.aiApiKey
          ? { Authorization: `Bearer ${config.userConfig.aiApiKey}` }
          : {}),
      },
      body: JSON.stringify(
        createAiChatRequest(config.userConfig.aiModel, prompt.value, createMcpContext(mindmap.doc)),
      ),
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    answer.value = readAiChatResponse(await response.json());
  } catch (error) {
    toast.error(`${t('toast.error')}: ${(error as Error).message}`);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="assistant">
    <h3>{{ t('ai.title') }}</h3>
    <textarea v-model="prompt" rows="3" :placeholder="t('ai.prompt')" />
    <button :disabled="loading" @click="void ask()">
      {{ loading ? t('ai.loading') : t('ai.ask') }}
    </button>
    <pre v-if="answer" class="answer">{{ answer }}</pre>
    <button
      v-if="answer && mindmap.selectedId"
      class="secondary"
      @click="mindmap.updateNote(mindmap.selectedId, answer)"
    >
      {{ t('ai.applyNote') }}
    </button>
  </section>
</template>

<style scoped>
.assistant {
  display: grid;
  gap: 6px;
  margin-top: 16px;
  padding: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
}
.assistant h3 {
  margin: 0;
  font-size: 13px;
  color: var(--fg-mute);
}
.assistant textarea,
.assistant button {
  font: inherit;
  padding: 6px 8px;
}
.assistant textarea {
  resize: vertical;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
}
.assistant button {
  background: var(--accent);
  color: var(--accent-fg);
  border: 0;
  border-radius: 3px;
  cursor: pointer;
}
.assistant button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.assistant .secondary {
  background: var(--bg-elev);
  color: var(--fg);
  border: 1px solid var(--border);
}
.answer {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  font: inherit;
}
</style>
