// Simple action registry for decoupled UI handlers

const actionMap = new Map();

export function registerAction(name, fn) {
  if (!name || typeof name !== 'string') return false;
  if (typeof fn !== 'function') return false;
  actionMap.set(name, fn);
  return true;
}

export function unregisterAction(name) {
  if (!name || typeof name !== 'string') return false;
  return actionMap.delete(name);
}

export function getAction(name) {
  if (!name || typeof name !== 'string') return undefined;
  return actionMap.get(name);
}

export function getActionMap() {
  const obj = {};
  actionMap.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}
