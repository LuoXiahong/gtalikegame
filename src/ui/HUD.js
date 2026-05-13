/**
 * UI System (HUD)
 * Warstwa UI - misje, dialogi, poszukiwania i prędkościomierz.
 */
import { EventBus } from '../core/EventBus.js';

import { GameState, GAME_STATES } from '../core/GameState.js';

import { World } from '../world/World.js';
import { Tilemap, TILE_COLORS } from '../world/Tilemap.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';

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
    currentDialogue: null,
    missionText: '',
    wantedStars: 0,
    isBlinking: false,
    speedValue: 0,
    showSpeed: false,

    init() {
        this.layer = document.getElementById('uiLayer');
        this.minimapCanvas = document.getElementById('minimap');
        this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
        const mobileHUD = document.getElementById('mobileHUD');

        EventBus.on('state_change', ({ to }) => {
            const isPlay = to === GAME_STATES.PLAY;
            this.layer.style.display = isPlay ? 'block' : 'none';
            if (this.minimapCanvas) {
                this.minimapCanvas.style.display = isPlay ? 'block' : 'none';
            }
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
            const safeMission = escapeHTML(this.missionText);
            html += `<div style="position:absolute; top:25px; left:25px; font-size:20px; font-weight:bold; color:white; font-family: system-ui, -apple-system, sans-serif; letter-spacing:0.5px; ${shadowStyle}">${safeMission}</div>`;
        }
        if (this.currentDialogue) {
            const safeDialogue = escapeHTML(this.currentDialogue);
            html += `<div style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); font-size:15px; font-weight:500; color:white; font-family: system-ui, -apple-system, sans-serif; ${glassStyle} padding:12px 20px; border-radius:8px; max-width: 80%; text-align: center;">${safeDialogue}</div>`;
        }
        if (this.actionHint) {
            const safeHint = escapeHTML(this.actionHint);
            html += `<div style="position:absolute; bottom:25px; right:25px; font-size:13px; font-weight:bold; color:white; font-family: system-ui, -apple-system, sans-serif; ${glassStyle} padding:6px 12px; border-radius:6px; letter-spacing:0.5px;">${safeHint}</div>`;
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

        // 1. Clear minimap canvas
        ctx.clearRect(0, 0, width, height);

        // 2. Setup map orientation and scale (centered on player, rotates with player direction)
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-pAngle - Math.PI / 2);
        ctx.scale(0.22, 0.22); // Scaling factor to translate world units to radar size
        ctx.translate(-px, -py);

        // 3. Draw surrounding tile grid
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

        // 4. Draw building blocks
        World.buildings.forEach(b => {
            ctx.fillStyle = '#1e272e'; // dark building block color
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.strokeStyle = '#2f3640'; // roof edge
            ctx.lineWidth = 12;
            ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

        // 5. Draw active traffic cars
        World.getEntitiesByType('car').forEach(carEntity => {
            if (carEntity === controlled) return;
            ctx.save();
            ctx.translate(carEntity.transform.x, carEntity.transform.y);
            ctx.rotate(carEntity.transform.angle);
            ctx.fillStyle = '#e67e22'; // traffic car color
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.fillRect(-22, -10, 44, 20);
            ctx.strokeRect(-22, -10, 44, 20);
            ctx.restore();
        });

        // 6. Draw police vehicles
        World.getEntitiesByType('police').forEach(p => {
            ctx.save();
            ctx.translate(p.transform.x, p.transform.y);
            ctx.rotate(p.transform.angle);
            const blink = Math.floor(Date.now() / 150) % 2 === 0;
            ctx.fillStyle = blink ? '#2980b9' : '#e74c3c'; // blinking sirens
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.fillRect(-22, -10, 44, 20);
            ctx.strokeRect(-22, -10, 44, 20);
            ctx.restore();
        });

        // 7. Draw NPCs
        World.getEntitiesByType('npc').forEach(npc => {
            ctx.fillStyle = '#fed330'; // yellow NPC dot
            ctx.beginPath();
            ctx.arc(npc.transform.x, npc.transform.y, 14, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();

        // 8. Draw player icon on top of the map (static center pointing straight up)
        ctx.fillStyle = '#00d2d3'; // sleek cyan indicator
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 12);
        ctx.lineTo(cx - 8, cy + 9);
        ctx.lineTo(cx, cy + 5); // inner notch
        ctx.lineTo(cx + 8, cy + 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 9. Overlay cool glass reflection gloss (static)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.arc(cx, cy, 65, 0, Math.PI, true);
        ctx.closePath();
        ctx.fill();
    }
};
