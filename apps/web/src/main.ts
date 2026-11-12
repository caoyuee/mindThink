import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { i18n } from '@/i18n';
import { setupErrorHandler } from '@/composables/useErrorHandler';

import '@/styles/global.css';

const app = createApp(App);
app.use(createPinia());
app.use(i18n);

setupErrorHandler(app);

app.mount('#app');
