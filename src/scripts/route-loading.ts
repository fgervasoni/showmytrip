declare global {
	interface Window {
		__showMyTripRouteLoadingInit?: boolean;
	}
}

if (!window.__showMyTripRouteLoadingInit) {
	window.__showMyTripRouteLoadingInit = true;

	let overlay: HTMLDivElement | null = null;
	let labelEl: HTMLSpanElement | null = null;
	let showTimer: number | null = null;
	let pendingLabel = '';
	const DEFAULT_LABEL = 'Loading…';
	const SHOW_DELAY_MS = 150;

	const ensureOverlay = (): void => {
		// Re-create if the overlay was removed from the DOM (e.g. Astro View Transition swap)
		if (overlay && !overlay.isConnected) {
			overlay = null;
			labelEl = null;
		}
		if (overlay) return;

		overlay = document.createElement('div');
		overlay.className = 'page-loader';
		overlay.setAttribute('aria-hidden', 'true');
		overlay.innerHTML = `
			<div class="page-loader-card" role="status" aria-live="polite">
				<span class="loading-spinner" aria-hidden="true"></span>
				<span class="page-loader-text"></span>
			</div>
		`;

		labelEl = overlay.querySelector('.page-loader-text');
		document.body.appendChild(overlay);
	};

	const clearShowTimer = (): void => {
		if (showTimer !== null) {
			window.clearTimeout(showTimer);
			showTimer = null;
		}
	};

	const showLoader = (label?: string): void => {
		ensureOverlay();
		clearShowTimer();

		const nextLabel = label?.trim() || pendingLabel || DEFAULT_LABEL;
		pendingLabel = nextLabel;
		if (labelEl) labelEl.textContent = nextLabel;
		overlay?.classList.add('visible');
		overlay?.setAttribute('aria-hidden', 'false');
		document.body.classList.add('page-loading');
	};

	const hideLoader = (): void => {
		clearShowTimer();
		pendingLabel = '';
		if (overlay && !overlay.isConnected) {
			overlay = null;
			labelEl = null;
		}
		overlay?.classList.remove('visible');
		overlay?.setAttribute('aria-hidden', 'true');
		document.body.classList.remove('page-loading');
	};

	const scheduleLoader = (label?: string): void => {
		pendingLabel = label?.trim() || pendingLabel || DEFAULT_LABEL;
		clearShowTimer();
		showTimer = window.setTimeout(() => showLoader(), SHOW_DELAY_MS);
	};

	const shouldHandleLink = (link: HTMLAnchorElement): boolean => {
		if (link.target && link.target !== '_self') return false;
		if (link.hasAttribute('download')) return false;
		if (link.origin !== window.location.origin) return false;

		const href = link.getAttribute('href');
		if (!href || href.startsWith('#')) return false;
		if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;

		return !(link.pathname === window.location.pathname
			&& link.search === window.location.search
			&& link.hash === window.location.hash);
	};

	document.addEventListener('click', (event) => {
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

		const target = event.target;
		if (!(target instanceof Element)) return;

		const link = target.closest('a[data-route-loading]');
		if (!(link instanceof HTMLAnchorElement) || !shouldHandleLink(link)) return;

		scheduleLoader(link.dataset.loadingLabel);
	}, {capture: true});

	document.addEventListener('astro:before-preparation', () => {
		if (!pendingLabel) {
			scheduleLoader();
		}
	});

	document.addEventListener('astro:page-load', hideLoader);
	window.addEventListener('pageshow', hideLoader);
}

export {};

