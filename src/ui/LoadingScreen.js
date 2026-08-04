/**
 * LoadingScreen — boot overlay with a progress bar, shown while
 * AssetLoader loads assets/config.
 */
import { I18n } from '../i18n/I18n.js';

const CSS = `
#loadingScreen {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 200;
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: #0d0d0f;
    color: #fff;
    font-family: 'Yomogi', cursive;
}
#loadingScreen.active {
    display: flex;
}
#loadingScreen .loadingTitle {
    font-size: 22px;
    letter-spacing: 6px;
    color: #d0dae8;
    margin-bottom: 22px;
}
#loadingScreen .loadingTrack {
    width: 220px;
    height: 8px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
    overflow: hidden;
}
#loadingScreen .loadingFill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, #6b7d90, #d0dae8);
    transition: width 0.2s ease-out;
}
#loadingScreen .loadingPercent {
    margin-top: 10px;
    font-size: 13px;
    color: #95a5a6;
}
`;

export const LoadingScreen = {
    _el: null,
    _fillEl: null,
    _percentEl: null,

    init() {
        if (this._el) return;

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const el = document.createElement('div');
        el.id = 'loadingScreen';
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = `
            <div class="loadingTitle">${I18n.t('menu.loading')}</div>
            <div class="loadingTrack"><div class="loadingFill"></div></div>
            <div class="loadingPercent">0%</div>
        `;

        const root = document.getElementById('gameContainer') || document.body;
        root.appendChild(el);
        this._el = el;
        this._fillEl = el.querySelector('.loadingFill');
        this._percentEl = el.querySelector('.loadingPercent');
    },

    show() {
        if (!this._el) return;
        this.setProgress(0);
        this._el.classList.add('active');
    },

    setProgress(fraction) {
        const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
        if (this._fillEl) this._fillEl.style.width = `${pct}%`;
        if (this._percentEl) this._percentEl.textContent = `${pct}%`;
    },

    hide() {
        if (!this._el) return;
        this._el.classList.remove('active');
    },

    isVisible() {
        return Boolean(this._el?.classList.contains('active'));
    }
};
