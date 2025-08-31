
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
    feedback.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert">
            <span>&times;</span>
        </button>
    `;
    
    feedbackContainer.appendChild(feedback);
    
    // Auto-remove nach 4 Sekunden
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 300);
        }
    }, 4000);
}