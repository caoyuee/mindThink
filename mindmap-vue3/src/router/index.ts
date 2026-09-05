/**
 * 应用路由
 *
 * 路由表:
 * - /           → EditorView（默认, 重定向）
 * - /editor     → EditorView
 * - /settings   → SettingsView
 * - /about      → AboutView
 * - /:pathMatch(.*)* → NotFoundView
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/editor' },
  {
    path: '/editor',
    name: 'editor',
    component: () => import('@/views/EditorView.vue'),
    meta: { title: 'Editor' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: 'About' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '404' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    const baseTitle = 'DesktopNaotu';
    document.title = to.meta['title'] ? `${to.meta['title']} · ${baseTitle}` : baseTitle;
  }
});
