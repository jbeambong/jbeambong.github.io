// Minimal reactive store
const state = {
  user: null,
  alerts: [],
};

const listeners = {};

export const store = {
  get: key => state[key],
  set(key, value) {
    state[key] = value;
    (listeners[key] || []).forEach(fn => fn(value));
  },
  on(key, fn) {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(fn);
    return () => { listeners[key] = listeners[key].filter(l => l !== fn); };
  },
};
