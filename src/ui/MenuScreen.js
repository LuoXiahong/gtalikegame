/**
 * MenuScreen — title and end-of-game screens.
 */
import { EventBus } from '../core/EventBus.js';
import { GameState, GAME_STATES } from '../core/GameState.js';
import { I18n } from '../i18n/I18n.js';

export const MenuScreen = {
    layer: null,
    _state: null,

    init() {
        this.layer = document.getElementById('menuLayer');

        EventBus.on('state_change', ({ to }) => {
            this.render(to);
        });

        EventBus.on('locale_change', () => {
            if (this._state) this.render(this._state);
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleEnter();
            }
        });
    },

    handleEnter() {
        const state = GameState.getState();
        if (state === GAME_STATES.MENU || state === GAME_STATES.WASTED || state === GAME_STATES.MISSION_PASSED) {
            if (state === GAME_STATES.WASTED || state === GAME_STATES.MISSION_PASSED) {
                EventBus.emit('game_restart');
            }
            GameState.setState(GAME_STATES.PLAY);
        }
    },

    render(state) {
        this._state = state;

        if (state === GAME_STATES.PLAY) {
            this.layer.innerHTML = '';
            this.layer.style.display = 'none';
            return;
        }

        this.layer.style.display = 'flex';
        this.layer.style.position = 'absolute';
        this.layer.style.top = '0';
        this.layer.style.left = '0';
        this.layer.style.width = '100%';
        this.layer.style.height = '100%';
        this.layer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.layer.style.color = 'white';
        this.layer.style.flexDirection = 'column';
        this.layer.style.justifyContent = 'center';
        this.layer.style.alignItems = 'center';
        this.layer.style.zIndex = '100';

        let html = '';

        if (state === GAME_STATES.MENU) {
            html = `
                <h1 style="font-size: 48px; margin-bottom: 20px; color: #f1c40f; text-shadow: 2px 2px #000;">NOIR CITY</h1>
                <p style="font-size: 24px; animation: blink 1s infinite;">${I18n.t('menu.pressStart')}</p>
                <div style="margin-top: 40px; font-size: 14px; color: #bdc3c7;">
                    ${I18n.t('menu.controls')}
                </div>
                <div style="margin-top: 12px; font-size: 13px; color: #95a5a6;">
                    ${I18n.t('menu.hints')}
                </div>
            `;
        } else if (state === GAME_STATES.WASTED) {
            this.layer.style.backgroundColor = 'rgba(139, 0, 0, 0.5)';
            html = `
                <h1 style="font-size: 72px; color: #ff0000; text-shadow: 3px 3px #000; letter-spacing: 10px;">${I18n.t('menu.wasted')}</h1>
                <p style="font-size: 20px; margin-top: 20px;">${I18n.t('menu.pressRestart')}</p>
            `;
        } else if (state === GAME_STATES.MISSION_PASSED) {
            html = `
                <h1 style="font-size: 48px; color: #2ecc71; text-shadow: 2px 2px #000;">${I18n.t('menu.missionPassed')}</h1>
                <p style="font-size: 20px; margin-top: 20px;">${I18n.t('menu.respect')}</p>
                <p style="font-size: 16px; margin-top: 20px;">${I18n.t('menu.pressContinue')}</p>
            `;
        }

        this.layer.innerHTML = html;
    }
};
