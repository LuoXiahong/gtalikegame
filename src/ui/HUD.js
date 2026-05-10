/**
 * UI System (HUD)
 * Warstwa UI - misje, dialogi
 */
import { EventBus } from '../core/EventBus.js';

import { GameState, GAME_STATES } from '../core/GameState.js';

export const UISystem = {
    layer: null,
    currentDialogue: null,
    missionText: '',
    wantedStars: 0,
    isBlinking: false,

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
    },

    updateDOM() {
        let html = '';
        if (this.missionText) {
            html += `<div style="position:absolute; top:40px; left:20px; font-size:22px; font-weight:bold; color:white; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;">${this.missionText}</div>`;
        }
        if (this.currentDialogue) {
            html += `<div style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); font-size:16px; font-weight:bold; color:white; background:rgba(0,0,0,0.7); padding:10px; border-radius:5px;">${this.currentDialogue}</div>`;
        }
        if (this.actionHint) {
            html += `<div style="position:absolute; bottom:20px; right:20px; font-size:14px; color:white; background:rgba(0,0,0,0.5); padding:5px; border-radius:3px;">${this.actionHint}</div>`;
        }
        if (this.wantedStars > 0) {
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                starsHtml += i < this.wantedStars ? '★' : '☆';
            }
            const color = this.isBlinking ? '#e74c3c' : '#f1c40f'; // red flash, gold normal
            html += `<div style="position:absolute; top:20px; right:20px; font-size:32px; letter-spacing:2px; color:${color}; text-shadow: 2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000; transition: color 0.2s;">${starsHtml}</div>`;
        }
        this.layer.innerHTML = html;
    }
};
