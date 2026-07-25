/**
 * UISystem (HUD) — missions, dialogue, wanted stars, speedometer, minimap.
 */
import { EventBus } from '../core/EventBus.js';

import { GameState, GAME_STATES } from '../core/GameState.js';

import { World } from '../world/World.js';
import { Tilemap, TILE_COLORS } from '../world/Tilemap.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { UISettings } from './UISettings.js';
import { I18n } from '../i18n/I18n.js';
import { clipMinimapContent, drawMinimapBezel, drawMinimapGlass } from './MinimapBezel.js';

/** Minimap: top 20 + 130 + border ≈ 156 → mission text sits below map */
const MISSION_TOP_PX = 162;

const escapeHTML = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const UISystem = {
    layer: null,
    minimapCanvas: null,
    minimapCtx: null,
    mobileHUD: null,
    playActive: false,
    currentDialogue: null,
    missionText: '',
    wantedStars: 0,
    isBlinking: false,
    speedValue: 0,
    showSpeed: false,

    init() {
        this.lastStateHash = null;
        this.layer = document.getElementById('uiLayer');
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
        this.mobileHUD = document.getElementById('mobileHUD');
        this.playActive = GameState.getState() === GAME_STATES.PLAY;

        UISettings.init();
        this.syncOnScreenControls();

        EventBus.on('state_change', ({ to }) => {
            const isPlay = to === GAME_STATES.PLAY;
            this.playActive = isPlay;
            this.layer.style.display = isPlay ? 'block' : 'none';
            if (this.minimapCanvas) {
                this.minimapCanvas.style.display = isPlay ? 'block' : 'none';
            }
            this.syncOnScreenControls();
        });

        EventBus.on('ui_settings_change', () => {
            this.syncOnScreenControls();
            this.lastStateHash = null;
            this.updateDOM();
        });

        EventBus.on('locale_change', () => {
            this.lastStateHash = null;
            this.updateDOM();
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
                }, 400);
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

    /** Apply play-state + UISettings to on-screen WASD/F pad. */
    syncOnScreenControls() {
        const el = this.mobileHUD;
        if (!el) return;
        const show = this.playActive && UISettings.showOnScreenControls;
        if (el.classList && typeof el.classList.toggle === 'function') {
            el.classList.toggle('is-visible', show);
        }
        if (el.style) el.style.display = show ? 'grid' : 'none';
        if (typeof el.setAttribute === 'function') {
            el.setAttribute('aria-hidden', show ? 'false' : 'true');
        }
    },

    updateDOM() {
        const kmh = Math.round(this.speedValue * 0.3);
        const onScreenPad = UISettings.showOnScreenControls;
        const kmhLabel = I18n.t('hud.kmh');
        const stateHash = `${this.missionText}|${this.currentDialogue}|${this.actionHint}|${this.wantedStars}|${this.isBlinking}|${this.showSpeed}|${kmh}|${onScreenPad}|${I18n.getLocale()}`;
        if (this.lastStateHash === stateHash) return;
        this.lastStateHash = stateHash;

        let html = '';
        const shadowStyle = 'text-shadow: 0 2px 4px rgba(0,0,0,0.85);';
        const glassStyle = 'background: rgba(0,0,0,0.65); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(4px); box-shadow: 0 4px 6px rgba(0,0,0,0.3);';

        if (this.missionText) {
            const safeMission = escapeHTML(this.missionText);
            html += `<div id="missionProgress" style="position:absolute; top:${MISSION_TOP_PX}px; left:20px; max-width:140px; font-size:13px; font-weight:bold; color:white; font-family: 'Yomogi', cursive; letter-spacing:0.3px; line-height:1.35; ${shadowStyle}">${safeMission}</div>`;
        }
        if (this.currentDialogue) {
            const safeDialogue = escapeHTML(this.currentDialogue);
            html += `<div style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); font-size:15px; font-weight:500; color:white; font-family: 'Yomogi', cursive; ${glassStyle} padding:12px 20px; border-radius:8px; max-width: 80%; text-align: center;">${safeDialogue}</div>`;
        }
        if (this.actionHint) {
            const safeHint = escapeHTML(this.actionHint);
            // When pad is on, action hint sits top-right to avoid F button / speedometer clash
            const hintPos = onScreenPad
                ? 'bottom:auto; top:70px; right:25px;'
                : 'bottom:25px; right:25px;';
            html += `<div style="position:absolute; ${hintPos} font-size:13px; font-weight:bold; color:white; font-family: 'Yomogi', cursive; ${glassStyle} padding:6px 12px; border-radius:6px; letter-spacing:0.5px;">${safeHint}</div>`;
        }
        if (this.wantedStars > 0) {
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                starsHtml += i < this.wantedStars ? '★' : '☆';
            }
            const color = this.isBlinking ? '#e74c3c' : '#f1c40f';
            html += `<div style="position:absolute; top:20px; right:25px; font-size:30px; letter-spacing:3px; color:${color}; font-family: 'Yomogi', cursive; ${shadowStyle} transition: color 0.15s;">${starsHtml}</div>`;
        }
        if (this.showSpeed) {
            // Keep speedometer clear of the on-screen pad when that pad is visible
            const speedPos = onScreenPad
                ? 'bottom:25px; right:25px;'
                : 'bottom:25px; left:25px;';
            html += `<div id="speedometer" style="position:absolute; ${speedPos} font-size:24px; font-weight:bold; color:#2ecc71; font-family: 'Yomogi', cursive; letter-spacing:1px; ${shadowStyle}">${kmh} ${kmhLabel}</div>`;
        }
        this.layer.innerHTML = html;
    },

    update() {
        if (GameState.getState() !== GAME_STATES.PLAY) return;
        if (this.minimapCtx) {
            this.drawMinimap();
        }
    },

    drawMinimap() {
        const controlled = VehicleSystem.getControlledEntity() || World.getEntitiesByType('player')[0];
        if (!controlled) return;

        const px = controlled.transform.x;
        const py = controlled.transform.y;
        const pAngle = controlled.transform.angle;

        const ctx = this.minimapCtx;
        const width = this.minimapCanvas.width;
        const height = this.minimapCanvas.height;
        const cx = width / 2;
        const cy = height / 2;

        ctx.clearRect(0, 0, width, height);

        // Map disc (clipped so tiles don't bleed under the metal ring)
        ctx.save();
        clipMinimapContent(ctx, cx, cy, width, height);

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-pAngle - Math.PI / 2);
        ctx.scale(0.22, 0.22);
        ctx.translate(-px, -py);

        const startCol = Math.max(0, Math.floor((px - 350) / 100));
        const endCol = Math.min(Tilemap.cols - 1, Math.floor((px + 350) / 100));
        const startRow = Math.max(0, Math.floor((py - 350) / 100));
        const endRow = Math.min(Tilemap.rows - 1, Math.floor((py + 350) / 100));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const tileType = Tilemap.data[r][c];
                ctx.fillStyle = TILE_COLORS[tileType] || '#27ae60';
                ctx.fillRect(c * 100, r * 100, 100, 100);
            }
        }

        World.buildings.forEach(b => {
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = '#2f3640';
            ctx.lineWidth = 12;
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

        World.getEntitiesByType('car').forEach(carEntity => {
            if (carEntity === controlled) return;
            ctx.save();
            ctx.translate(carEntity.transform.x, carEntity.transform.y);
            ctx.rotate(carEntity.transform.angle);
            ctx.fillStyle = '#e67e22';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.fillRect(-22, -10, 44, 20);
            ctx.strokeRect(-22, -10, 44, 20);
            ctx.restore();
        });

        World.getEntitiesByType('police').forEach(p => {
            ctx.save();
            ctx.translate(p.transform.x, p.transform.y);
            ctx.rotate(p.transform.angle);
            const blink = Math.floor(Date.now() / 150) % 2 === 0;
            ctx.fillStyle = blink ? '#2980b9' : '#e74c3c';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.fillRect(-22, -10, 44, 20);
            ctx.strokeRect(-22, -10, 44, 20);
            ctx.restore();
        });

        World.getEntitiesByType('npc').forEach(npc => {
            ctx.fillStyle = '#fed330';
            ctx.beginPath();
            ctx.arc(npc.transform.x, npc.transform.y, 14, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        ctx.fillStyle = '#00d2d3';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx - 8, cy + 9);
        ctx.lineTo(cx, cy + 5);
        ctx.lineTo(cx + 8, cy + 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore(); // end content clip

        drawMinimapGlass(ctx, width, height);
        drawMinimapBezel(ctx, width, height);
    }
};
