// Add a simple mock Redis factory
export function createMockRedis() {
  const store = new Map<string, { value: string; ttl?: number }>();
  const now = () => Math.floor(Date.now() / 1000);
  return {
    duplicate: (_opts?: any) => createMockRedis(),
    get: async (key: string) => store.get(key)?.value ?? null,
    set: async (key: string, value: string) => {
      store.set(key, { value });
      return 'OK';
    },
    setex: async (key: string, seconds: number, value: string) => {
      store.set(key, { value, ttl: now() + seconds });
      return 'OK';
    },
    ttl: async (key: string) => {
      const item = store.get(key);
      if (!item?.ttl) return -1;
      return Math.max(item.ttl - now(), -1);
    },
    exists: async (key: string) => (store.has(key) ? 1 : 0),
    del: async (...keys: string[]) => {
      let cnt = 0;
      for (const k of keys) {
        if (store.delete(k)) cnt++;
      }
      return cnt;
    },
  };
}
