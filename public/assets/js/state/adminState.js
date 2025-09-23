import { bus } from '../eventBus.js';

let _isAdmin = false;

export function isAdmin() {
  return _isAdmin;
}

export function setAdmin(value) {
  const v = !!value;
  if (_isAdmin === v) return;
  _isAdmin = v;
  try {
    bus.dispatchEvent(new CustomEvent('admin:change', { detail: { isAdmin: _isAdmin } }));
  } catch {
    // ignore in non-DOM test environments
  }
}
