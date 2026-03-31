
// Feedback-Nachrichten anzeigen
export function showFeedback(message, type = 'info') {
  let feedbackContainer = document.getElementById('comment-feedback');
  if (!feedbackContainer) {
    // Falls kein Container vorhanden ist, erstelle einen
    feedbackContainer = document.createElement('div');
    feedbackContainer.id = 'comment-feedback';
    document.body.appendChild(feedbackContainer);
  }
    
  const alertClass = type === 'success' ? 'alert-success' : 
    type === 'error' ? 'alert-danger' : 'alert-info';
    
  const feedback = document.createElement('div');
  feedback.className = `alert ${alertClass} alert-dismissible fade show`;
  const msgSpan = document.createElement('span');
  msgSpan.innerHTML = message;
  feedback.appendChild(msgSpan);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'close';
  closeBtn.innerHTML = '<span>&times;</span>';
  closeBtn.addEventListener('click', () => feedback.remove());
  feedback.appendChild(closeBtn);

  feedbackContainer.appendChild(feedback);
    
  // Auto-remove nach 3 Sekunden
  setTimeout(() => {
    if (feedback.parentNode) {
      feedback.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }
  }, 3000);
}