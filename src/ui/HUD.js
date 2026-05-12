/**
 * UI System (HUD)
 * Warstwa UI - misje, dialogi, poszukiwania i prędkościomierz.
 */
import { EventBus } from '../core/EventBus.js';

import { GameState, GAME_STATES } from '../core/GameState.js';

export const UISystem = {
    layer: null,
    currentDialogue: null,
    missionText: '',
    wantedStars: 0,
    isBlinking: false,
    speedValue: 0,
    showSpeed: false,

    init() {
        this.layer = document.getElementById('uiLayer');
        const mobileHUD = document.getElementById('mobileHUD');

        EventBus.on('state_change', ({ to }) => {
            const isPlay = to === GAME_STATES.PLAY;
            this.layer.style.display = isPlay ? 'block' : 'none';
            if (mobileHUD) mobileHUD.style.display = isPlay ? 'grid' : 'none';
        });

        EventBus.on('ui_show_dialogue', (text) => {
            this.currentDialogue = text;
            this.updateDOM();
        });

        EventBus.on('mission_update', (text) => {
            this.missionText = text;
            this.updateDOM();
        });

        EventBus.on('ui_show_action_hint', (text) => {
            this.actionHint = text;
            this.updateDOM();
        });

        EventBus.on('wanted_level_change', ({ stars }) => {
            if (stars > this.wantedStars) {
                this.isBlinking = true;
                setTimeout(() => {
                    this.isBlinking = false;
                    this.updateDOM();
                }, 400); // 400ms flash
            }
            this.wantedStars = stars;
            this.updateDOM();
        });

        EventBus.on('wanted_reset', () => {
            this.wantedStars = 0;
            this.updateDOM();
        });

        EventBus.on('speed_update', (speed) => {
            this.speedValue = speed;
            this.updateDOM();
        });

        EventBus.on('vehicle_entered', () => {
            this.showSpeed = true;
            this.updateDOM();
        });

        EventBus.on('vehicle_exited', () => {
            this.showSpeed = false;
            this.speedValue = 0;
            this.updateDOM();
        });
    },

    updateDOM() {
        let html = '';
        const shadowStyle = 'text-shadow: 0 2px 4px rgba(0,0,0,0.85);';
        const glassStyle = 'background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(4px); box-shadow: 0 4px 6px rgba(0,0,0,0.3);';

        if (this.missionText) {
            html += `<div style="position:absolute; top:25px; left:25px; font-size:20px; font-weight:bold; color:white; font-family: system-ui, -apple-system, sans-serif; letter-spacing:0.5px; ${shadowStyle}">${this.missionText}</div>`;
        }
        if (this.currentDialogue) {
            html += `<div style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); font-size:15px; font-weight:500; color:white; font-family: system-ui, -apple-system, sans-serif; ${glassStyle} padding:12px 20px; border-radius:8px; max-width: 80%; text-align: center;">${this.currentDialogue}</div>`;
        }
        if (this.actionHint) {
            html += `<div style="position:absolute; bottom:25px; right:25px; font-size:13px; font-weight:bold; color:white; font-family: system-ui, -apple-system, sans-serif; ${glassStyle} padding:6px 12px; border-radius:6px; letter-spacing:0.5px;">${this.actionHint}</div>`;
        }
        if (this.wantedStars > 0) {
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                starsHtml += i < this.wantedStars ? '★' : '☆';
            }
            const color = this.isBlinking ? '#e74c3c' : '#f1c40f'; // red flash, gold normal
            html += `<div style="position:absolute; top:20px; right:25px; font-size:30px; letter-spacing:3px; color:${color}; ${shadowStyle} transition: color 0.15s;">${starsHtml}</div>`;
        }
        if (this.showSpeed) {
            // Zamieniamy speed z px/s na fikcyjne km/h (np. 500 maxSpeed -> ~150 km/h)
            const kmh = Math.round(this.speedValue * 0.3);
            html += `<div id="speedometer" style="position:absolute; bottom:25px; left:25px; font-size:24px; font-weight:bold; color:#2ecc71; font-family: monospace; letter-spacing:1px; ${shadowStyle}">${kmh} KM/H</div>`;
        }
        this.layer.innerHTML = html;
    }
};
