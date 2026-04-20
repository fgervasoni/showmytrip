function initSettingsMenu() {
    const menus = Array.from(document.querySelectorAll<HTMLElement>('[data-settings-menu]'));

    menus.forEach((menuRoot) => {
        if (menuRoot.dataset.initialized === 'true') return;

        const btn = menuRoot.querySelector<HTMLButtonElement>('.settings-btn');
        const dropdown = menuRoot.querySelector<HTMLElement>('.settings-dropdown');
        if (!btn || !dropdown) return;

        menuRoot.dataset.initialized = 'true';

        // Toggle menu
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !dropdown.classList.contains('hidden');
            dropdown.classList.toggle('hidden');
            btn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!menuRoot.contains(e.target as Node)) {
                dropdown.classList.add('hidden');
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        // Highlight current values
        const currentTheme = localStorage.getItem('smt_theme') ?? 'system';
        const currentUnits = document.cookie.match(/smt_units=(\w+)/)?.[1] ?? 'km';

        dropdown.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((el) => {
            el.setAttribute('aria-checked', el.dataset.theme === currentTheme ? 'true' : 'false');
        });
        dropdown.querySelectorAll<HTMLButtonElement>('[data-units]').forEach((el) => {
            el.setAttribute('aria-checked', el.dataset.units === currentUnits ? 'true' : 'false');
        });

        // Theme
        dropdown.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((el) => {
            el.addEventListener('click', () => {
                const theme = el.dataset.theme!;
                localStorage.setItem('smt_theme', theme);

                dropdown.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-checked', 'false'));
                el.setAttribute('aria-checked', 'true');

                if (theme === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    document.documentElement.classList.toggle('dark', prefersDark);
                } else {
                    document.documentElement.classList.toggle('dark', theme === 'dark');
                }
            });
        });

        // Locale
        dropdown.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((el) => {
            el.addEventListener('click', () => {
                const loc = el.dataset.locale!;
                document.cookie = `smt_locale=${loc};path=/;max-age=31536000`;
                window.location.reload();
            });
        });

        // Units
        dropdown.querySelectorAll<HTMLButtonElement>('[data-units]').forEach((el) => {
            el.addEventListener('click', () => {
                const u = el.dataset.units!;
                document.cookie = `smt_units=${u};path=/;max-age=31536000`;

                dropdown.querySelectorAll('[data-units]').forEach((b) => b.setAttribute('aria-checked', 'false'));
                el.setAttribute('aria-checked', 'true');

                window.location.reload();
            });
        });
    });
}

document.addEventListener('astro:page-load', initSettingsMenu);
