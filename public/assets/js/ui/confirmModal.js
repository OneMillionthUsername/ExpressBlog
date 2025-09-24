// Lightweight, promise-based confirmation modal used by admin delegated actions
export function confirmModal(message = 'Sind Sie sicher?') {
  return new Promise((resolve) => {
    try {
      // If running in a non-DOM environment (tests), fallback to false
      if (typeof document === 'undefined') return resolve(false);

      // Reuse existing modal if present
      let modal = document.getElementById('confirm-modal');
      if (modal) {
        // update message and reuse
        const msg = modal.querySelector('.confirm-modal-message');
        if (msg) msg.textContent = message;
      } else {
        modal = document.createElement('div');
        modal.id = 'confirm-modal';
        modal.className = 'modal confirm-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
          <div class="modal-content">
            <div class="modal-body">
              <p class="confirm-modal-message">${message}</p>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" data-action="confirm-cancel">Abbrechen</button>
              <button type="button" class="btn btn-danger" data-action="confirm-ok">Löschen</button>
            </div>
          </div>
        `;
        // Append modal to body; styling is provided by CSS in public/assets/css/components.css
        document.body.appendChild(modal);
      }

      const okBtn = modal.querySelector('[data-action="confirm-ok"]');
      const cancelBtn = modal.querySelector('[data-action="confirm-cancel"]');

      function cleanup() {
        try {
          if (modal && modal.parentElement) modal.parentElement.removeChild(modal);
  } catch { /* ignore */ }
    // cleanup is just removing the modal element; CSS is persistent
        if (okBtn) okBtn.removeEventListener('click', onOk);
        if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
        document.removeEventListener('keydown', onKeyDown);
      }

      function onOk(e) { e && e.preventDefault(); cleanup(); resolve(true); }
      function onCancel(e) { e && e.preventDefault(); cleanup(); resolve(false); }
      function onKeyDown(e) {
        if (e.key === 'Escape') { onCancel(); }
        if (e.key === 'Enter') { onOk(); }
      }

      if (okBtn) okBtn.addEventListener('click', onOk);
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
      document.addEventListener('keydown', onKeyDown);

      // Focus management
      (okBtn || cancelBtn || modal).focus();
    } catch {
      // If anything goes wrong, resolve false to avoid accidental deletes
      resolve(false);
    }
  });
}
