// Shared UI utilities for WHOOP Developer API Test Site

declare global {
    interface Window {
        whoopAuth: any;
    }
}

class UiController {
    init(): void {
        document.addEventListener('DOMContentLoaded', () => {
            this.setActiveNavItem();
            this.bindLogoutButton();
        });
    }

    private setActiveNavItem(): void {
        const nav = document.querySelector('.nav-tabs');
        if (!nav) return;

        const path = window.location.pathname;
        const links = Array.from(nav.querySelectorAll('a.nav-tab')) as HTMLAnchorElement[];
        links.forEach(link => link.classList.remove('active'));

        // Map common paths to their base route
        const route = this.normalizeRoute(path);
        const active = links.find(l => this.normalizeRoute(l.getAttribute('href') || '') === route);
        if (active) active.classList.add('active');
    }

    private normalizeRoute(path: string): string {
        if (!path) return '/';
        const url = path.split('?')[0].split('#')[0];
        if (url === '' || url === '/') return '/dashboard';
        return url;
    }

    private bindLogoutButton(): void {
        const btn = document.getElementById('logout-btn');
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            try {
                if (window.whoopAuth && typeof window.whoopAuth.logout === 'function') {
                    window.whoopAuth.logout();
                } else {
                    // Fallback
                    fetch('/auth/logout', { method: 'POST' }).finally(() => {
                        window.location.href = '/';
                    });
                }
            } catch {
                window.location.href = '/';
            }
        });
    }
}

new UiController().init();

export {};



