<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="about-view">
    <h1>{{ t('about.title') }} {{ t('app.name') }}</h1>
    <p class="tagline">{{ t('app.tagline') }}</p>

    <section>
      <h2>{{ t('about.version') }}</h2>
      <p>0.1.0 (alpha)</p>
    </section>

    <section>
      <h2>{{ t('about.thanks') }}</h2>
      <ul>
        <li>Vue 3 + Vite + TypeScript</li>
        <li>markmap (gerald-burns)</li>
        <li>Pinia, vue-i18n, vue-router</li>
      </ul>
    </section>

    <section>
      <h2>{{ t('about.github') }}</h2>
      <p>
        <a href="https://github.com/NaoTu/DesktopNaotu" target="_blank" rel="noopener"
          >github.com/NaoTu/DesktopNaotu</a
        >
      </p>
    </section>

    <section>
      <h2>{{ t('about.issues') }}</h2>
      <p>通过 GitHub Issues 反馈</p>
    </section>
  </div>
</template>

<style scoped>
.about-view {
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 32px;
}
h1 {
  margin: 0 0 4px 0;
  font-size: 22px;
}
.tagline {
  margin: 0 0 24px 0;
  color: var(--fg-mute);
}
section {
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
section h2 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--fg-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
section ul {
  margin: 0;
  padding-left: 20px;
}
a {
  color: var(--accent);
}
</style>
