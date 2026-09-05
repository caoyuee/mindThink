import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  normalizeRecentMaxNum,
  RECENT_FILES_MAX,
  RECENT_FILES_MIN,
  useConfigStore,
} from '@/stores/config';

describe('config store recent file limit', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('normalizes the recent file limit', () => {
    expect(normalizeRecentMaxNum(0)).toBe(RECENT_FILES_MIN);
    expect(normalizeRecentMaxNum(99)).toBe(RECENT_FILES_MAX);
    expect(normalizeRecentMaxNum(4.6)).toBe(5);
    expect(normalizeRecentMaxNum(Number.NaN)).toBe(5);
    expect(normalizeRecentMaxNum('8')).toBe(5);
  });

  it('normalizes values saved by the settings view', () => {
    const store = useConfigStore();
    store.save({ recentMaxNum: 100 });
    expect(store.userConfig.recentMaxNum).toBe(RECENT_FILES_MAX);

    store.save({ recentMaxNum: -2 });
    expect(store.userConfig.recentMaxNum).toBe(RECENT_FILES_MIN);
  });

  it('normalizes a persisted invalid limit', () => {
    localStorage.setItem('user.config', JSON.stringify({ recentMaxNum: 100 }));
    setActivePinia(createPinia());

    expect(useConfigStore().userConfig.recentMaxNum).toBe(RECENT_FILES_MAX);
  });
});
