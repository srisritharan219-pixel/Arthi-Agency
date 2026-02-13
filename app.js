// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Initial Render
    if (window.UI) {
        window.UI.switchView('dashboard');
    } else {
        console.error('UI Module not loaded');
    }

    // Navigation Listener
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', (e) => {
            // Get data-view from button or closest parent (in case of icon click)
            const target = e.target.closest('.nav-item').dataset.view;
            if (target && window.UI) {
                window.UI.switchView(target);
            }
        });
    });
});
