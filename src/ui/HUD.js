/**
 * UISystem (HUD) — missions, dialogue, wanted stars, speedometer, minimap.
 */
import { EventBus } from '../core/EventBus.js';
import { EVENTS } from '../core/Events.js';

import { GameState, GAME_STATES } from '../core/GameState.js';

import { World } from '../world/World.js';
import { Tilemap, TILE_TYPES } from '../world/Tilemap.js';
import { UISettings } from './UISettings.js';
import { I18n } from '../i18n/I18n.js';
import { clipMinimapContent, drawMinimapBezel, drawMinimapGlass } from './MinimapBezel.js';

/** Minimap: top 20 + 130 + border ≈ 156 → HP bar sits directly below the map */
const HEALTH_TOP_PX = 162;
/** Mission text clears the HP bar (162 + 14 + gap) */
const MISSION_TOP_PX = 186;

/**
 * HP fill stays in the noir palette — bone while healthy, muted amber/red as it
 * drops. The threshold still has to read at a glance, so the critical step keeps
 * enough chroma to be unmistakable without becoming the loudest pixel on screen.
 */
const HEALTH_FILL_OK = '#c6c6c1';
const HEALTH_FILL_WARN = '#9a8452';
const HEALTH_FILL_CRIT = '#a8524e';

/** Same palette rule as the HP bar: the alert step keeps chroma, not neon. */
const WANTED_STAR_IDLE = '#c9b47a';
const WANTED_STAR_ALERT = '#b5564f';

/**
 * Minimap blips read by value and shape, not hue — a saturated dot on a
 * monochrome noir scene reads as the brightest thing on screen. Police keep
 * colour on purpose: an active pursuit has to be unmissable.
 */
const BLIP_PLAYER = '#e8e8ea';
const BLIP_NPC = '#8f9094';
const BLIP_CAR = '#5c5e63';
const BLIP_OUTLINE = 'rgba(12, 12, 14, 0.85)';
const BLIP_POLICE_A = '#9fb2c4';
const BLIP_POLICE_B = '#b4646a';

/**
 * The minimap keeps its own ground palette rather than reusing `TILE_COLORS`.
 * Those values (navy road, green grass) belong to the 2D gameplay renderer,
 * which is a separate presentation — restyling them there would be a silent
 * change to a view nobody asked about. Here the tiles read as a monochrome
 * street plan so the disc sits in the same palette as the noir scene.
 */
const MINIMAP_TILE_COLORS = {
    [TILE_TYPES.GRASS]: '#3a3d39',
    [TILE_TYPES.ROAD]: '#2b2c2f',
    [TILE_TYPES.SIDEWALK]: '#6e7073',
    [TILE_TYPES.BUILDING_ZONE]: '#4a4c4f'
};
const MINIMAP_TILE_FALLBACK = '#3a3d39';
const MINIMAP_BUILDING_FILL = '#191a1c';
const MINIMAP_BUILDING_EDGE = '#303235';

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
    healthValue: null,

    init() {
        this.lastStateHash = null;
        this.layer = document.getElementById('uiLayer');
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
        this.mobileHUD = document.getElementById('mobileHUD');
        this.playActive = GameState.getState() === GAME_STATES.PLAY;

        UISettings.init();
        this.syncOnScreenControls();

        EventBus.on(EVENTS.STATE_CHANGE, ({ to }) => {
            const isPlay = to === GAME_STATES.PLAY;
            this.playActive = isPlay;
            this.layer.style.display = isPlay ? 'block' : 'none';
            if (this.minimapCanvas) {
                this.minimapCanvas.style.display = isPlay ? 'block' : 'none';
            }
            this.syncOnScreenControls();
        });

        EventBus.on(EVENTS.UI_SETTINGS_CHANGE, () => {
            this.syncOnScreenControls();
            this.lastStateHash = null;
            this.updateDOM();
        });

        EventBus.on(EVENTS.LOCALE_CHANGE, () => {
            this.lastStateHash = null;
            this.updateDOM();
        });

        EventBus.on(EVENTS.UI_SHOW_DIALOGUE, (text) => {
            this.currentDialogue = text;
            this.updateDOM();
        });

        EventBus.on(EVENTS.MISSION_UPDATE, (text) => {
            this.missionText = text;
            this.updateDOM();
        });

        EventBus.on(EVENTS.UI_SHOW_ACTION_HINT, (text) => {
            this.actionHint = text;
            this.updateDOM();
        });

        EventBus.on(EVENTS.WANTED_LEVEL_CHANGE, ({ stars }) => {
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

        EventBus.on(EVENTS.WANTED_RESET, () => {
            this.wantedStars = 0;
            this.updateDOM();
        });

        EventBus.on(EVENTS.SPEED_UPDATE, (speed) => {
            this.speedValue = speed;
            this.updateDOM();
        });

        EventBus.on(EVENTS.VEHICLE_ENTERED, () => {
            this.showSpeed = true;
            this.updateDOM();
        });

        EventBus.on(EVENTS.VEHICLE_EXITED, () => {
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
        const healthKey = this.healthValue ? `${this.healthValue.current}/${this.healthValue.max}` : '';
        const stateHash = `${this.missionText}|${this.currentDialogue}|${this.actionHint}|${this.wantedStars}|${this.isBlinking}|${this.showSpeed}|${kmh}|${onScreenPad}|${I18n.getLocale()}|${healthKey}`;
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
            const color = this.isBlinking ? WANTED_STAR_ALERT : WANTED_STAR_IDLE;
            html += `<div style="position:absolute; top:20px; right:25px; font-size:30px; letter-spacing:3px; color:${color}; font-family: 'Yomogi', cursive; ${shadowStyle} transition: color 0.15s;">${starsHtml}</div>`;
        }
        if (this.healthValue) {
            const pct = Math.max(0, Math.min(1, this.healthValue.current / (this.healthValue.max || 1)));
            const barColor = pct > 0.5 ? HEALTH_FILL_OK : pct > 0.25 ? HEALTH_FILL_WARN : HEALTH_FILL_CRIT;
            html += `<div id="healthBar" style="position:absolute; top:${HEALTH_TOP_PX}px; left:20px; width:130px; height:14px; ${glassStyle} border-radius:7px; overflow:hidden;"><div style="width:${Math.round(pct * 100)}%; height:100%; background:${barColor}; transition: width 0.15s, background-color 0.15s;"></div></div>`;
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

        const player = World.getEntitiesByType('player')[0];
        if (player && player.health) {
            const h = player.health;
            if (!this.healthValue || h.current !== this.healthValue.current || h.max !== this.healthValue.max) {
                this.healthValue = { current: h.current, max: h.max };
                this.updateDOM();
            }
        }

        if (this.minimapCtx) {
            this.drawMinimap();
        }
    },

    drawMinimap() {
        const controlled = World.getControlled() || World.getEntitiesByType('player')[0];
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
                ctx.fillStyle = MINIMAP_TILE_COLORS[tileType] || MINIMAP_TILE_FALLBACK;
                ctx.fillRect(c * 100, r * 100, 100, 100);
            }
        }

        World.buildings.forEach(b => {
            ctx.fillStyle = MINIMAP_BUILDING_FILL;
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = MINIMAP_BUILDING_EDGE;
            ctx.lineWidth = 12;
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

        World.getEntitiesByType('car').forEach(carEntity => {
            if (carEntity === controlled) return;
            ctx.save();
            ctx.translate(carEntity.transform.x, carEntity.transform.y);
            ctx.rotate(carEntity.transform.angle);
            ctx.fillStyle = BLIP_CAR;
            ctx.strokeStyle = BLIP_OUTLINE;
            ctx.lineWidth = 4;
            ctx.fillRect(-22, -10, 44, 20);
            ctx.strokeRect(-22, -10, 44, 20);
            ctx.restore();
        });

        // Police stay the one chromatic exception — a pursuit must read instantly.
        World.getEntitiesByType('police').forEach(p => {
            ctx.save();
            ctx.translate(p.transform.x, p.transform.y);
            ctx.rotate(p.transform.angle);
            const blink = Math.floor(Date.now() / 150) % 2 === 0;
            ctx.fillStyle = blink ? BLIP_POLICE_A : BLIP_POLICE_B;
            ctx.strokeStyle = BLIP_OUTLINE;
            ctx.lineWidth = 4;
            ctx.fillRect(-22, -10, 44, 20);
            ctx.strokeRect(-22, -10, 44, 20);
            ctx.restore();
        });

        World.getEntitiesByType('npc').forEach(npc => {
            ctx.fillStyle = BLIP_NPC;
            ctx.beginPath();
            ctx.arc(npc.transform.x, npc.transform.y, 14, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        ctx.fillStyle = BLIP_PLAYER;
        ctx.strokeStyle = BLIP_OUTLINE;
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

        // Bezel + glass are static (never depend on player/entity state) — cache
        // the composited overlay once instead of re-allocating gradients every frame.
        const overlay = this.getBezelOverlay(width, height);
        if (overlay) {
            ctx.drawImage(overlay, 0, 0);
        } else {
            drawMinimapGlass(ctx, width, height);
            drawMinimapBezel(ctx, width, height);
        }
    },

    /**
     * Lazily builds (and caches by size) an offscreen canvas with the glass + bezel
     * overlay pre-rendered. Falls back to null if canvas creation isn't available
     * (e.g. minimal document stubs in tests), letting callers draw directly instead.
     */
    getBezelOverlay(width, height) {
        if (this._bezelOverlay && this._bezelOverlayW === width && this._bezelOverlayH === height) {
            return this._bezelOverlay;
        }
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
            return null;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return null;

        drawMinimapGlass(ctx, width, height);
        drawMinimapBezel(ctx, width, height);

        this._bezelOverlay = canvas;
        this._bezelOverlayW = width;
        this._bezelOverlayH = height;
        return canvas;
    }
};
