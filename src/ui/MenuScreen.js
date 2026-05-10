/**
 * UI: MenuScreen
 * Zarządza ekranami tytułowymi i komunikatami końca gry.
 */
import { EventBus } from '../core/EventBus.js';
import { GameState, GAME_STATES } from '../core/GameState.js';

export const MenuScreen = {
    layer: null,

    init() {
        this.layer = document.getElementById('menuLayer');
        
        EventBus.on('state_change', ({ to }) => {
            this.render(to);
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
            GameState.setState(GAME_STATES.PLAY);
        }
    },

    render(state) {
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
                <h1 style="font-size: 48px; margin-bottom: 20px; color: #f1c40f; text-shadow: 2px 2px #000;">GTA JS</h1>
                <p style="font-size: 24px; animation: blink 1s infinite;">PRESS ENTER TO START</p>
                <div style="margin-top: 40px; font-size: 14px; color: #bdc3c7;">
                    WASD - Move | F - Enter/Exit Vehicle | Mouse - Aim/Shoot
                </div>
            `;
        } else if (state === GAME_STATES.WASTED) {
            this.layer.style.backgroundColor = 'rgba(139, 0, 0, 0.5)';
            html = `
                <h1 style="font-size: 72px; color: #ff0000; text-shadow: 3px 3px #000; letter-spacing: 10px;">WASTED</h1>
                <p style="font-size: 20px; margin-top: 20px;">PRESS ENTER TO RESTART</p>
            `;
        } else if (state === GAME_STATES.MISSION_PASSED) {
            html = `
                <h1 style="font-size: 48px; color: #2ecc71; text-shadow: 2px 2px #000;">MISSION PASSED!</h1>
                <p style="font-size: 20px; margin-top: 20px;">RESPECT +</p>
                <p style="font-size: 16px; margin-top: 20px;">PRESS ENTER TO CONTINUE</p>
            `;
        }

        this.layer.innerHTML = html;
    }
};
