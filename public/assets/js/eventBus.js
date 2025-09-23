// Minimal event bus to avoid window/global pollution
// Usage: import { bus } from './eventBus.js'; bus.addEventListener('event', handler);
export const bus = new EventTarget();
