<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  x: number;
  y: number;
  targetId: string;
  isRoot: boolean;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  action: [action: string, id: string];
  close: [];
}>();

const { t } = useI18n();

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}));

function act(action: string) {
  emit('action', action, props.targetId);
  emit('close');
}
</script>

<template>
  <div class="context-menu" :style="style" @click.stop>
    <button @click="act('add-child')">{{ t('node.addChild') }}</button>
    <button v-if="!isRoot" @click="act('add-sibling')">
      {{ t('node.addSibling') }}
    </button>
    <button v-if="!isRoot" @click="act('rename')">
      {{ t('node.rename') }}
    </button>
    <div v-if="!isRoot" class="sep" />
    <button v-if="!isRoot" @click="act('indent')">
      {{ t('node.indent') }}
    </button>
    <button v-if="!isRoot" @click="act('outdent')">
      {{ t('node.outdent') }}
    </button>
    <div v-if="!isRoot" class="sep" />
    <button v-if="!isRoot" class="danger" style="color: var(--danger)" @click="act('remove')">
      {{ t('node.delete') }}
    </button>
  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: var(--shadow);
  min-width: 160px;
  padding: 4px 0;
}
.context-menu button {
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  background: transparent;
  color: var(--fg);
  border: none;
  cursor: pointer;
  font-size: 13px;
}
.context-menu button:hover {
  background: var(--accent);
  color: var(--accent-fg);
}
.context-menu .sep {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
</style>
