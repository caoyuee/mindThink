<script setup lang="ts">
/**
 * AboutDialog —— 关于弹窗（替代原 /about 整页 AboutView）。
 *
 * 受控组件：open 由 ui store 驱动；Esc / 遮罩点击 / 关闭按钮 → emit('close')。
 * Teleport 到 body，焦点圈闭在关闭按钮，关闭后焦点回还给触发前的元素。
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const closeButton = ref<HTMLButtonElement | null>(null);
let returnFocus: HTMLElement | null = null;

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      returnFocus = (document.activeElement as HTMLElement | null) ?? null;
      window.addEventListener('keydown', onKeydown);
      // 等 DOM 渲染完再聚焦关闭按钮
      requestAnimationFrame(() => closeButton.value?.focus());
    } else {
      window.removeEventListener('keydown', onKeydown);
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
      returnFocus = null;
    }
  },
);

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="about-backdrop"
      data-testid="about-backdrop"
      @click.self="emit('close')"
    >
      <section
        class="about-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('about.title')"
        data-testid="about-dialog"
      >
        <header class="header">
          <h2>{{ t('about.title') }} {{ t('app.name') }}</h2>
          <button
            ref="closeButton"
            class="close-btn"
            type="button"
            data-testid="about-close"
            @click="emit('close')"
          >
            {{ t('common.close') }}
          </button>
        </header>

        <div class="body">
          <p class="tagline">{{ t('app.tagline') }}</p>

          <section>
            <h3>{{ t('about.version') }}</h3>
            <p>0.1.0 (alpha)</p>
          </section>

          <section>
            <h3>{{ t('about.thanks') }}</h3>
            <ul>
              <li>Vue 3 + Vite + TypeScript</li>
              <li>markmap (gerald-burns)</li>
              <li>Pinia, vue-i18n, vue-router</li>
            </ul>
          </section>

          <section>
            <h3>{{ t('about.github') }}</h3>
            <p>
              <a href="https://github.com/caoyuee/mindThink" target="_blank" rel="noopener"
                >github.com/caoyuee/mindThink</a
              >
            </p>
          </section>

          <section>
            <h3>{{ t('about.issues') }}</h3>
            <p>通过 GitHub Issues 反馈</p>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.about-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.about-dialog {
  display: flex;
  flex-direction: column;
  width: min(520px, calc(100vw - 48px));
  max-height: min(80vh, 560px);
  padding: 16px 20px;
  background: var(--bg-elev);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
h2 {
  margin: 0;
  font-size: 16px;
}
.close-btn {
  flex-shrink: 0;
  padding: 5px 14px;
  font: inherit;
  border-radius: 5px;
  cursor: pointer;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
}
.close-btn:hover {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}
.close-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.body {
  overflow-y: auto;
  min-height: 0;
}
.tagline {
  margin: 12px 0;
  color: var(--fg-mute);
}
section {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
section:last-child {
  border-bottom: none;
}
section h3 {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--fg-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
section p {
  margin: 0;
}
section ul {
  margin: 0;
  padding-left: 20px;
}
a {
  color: var(--accent);
}
</style>
