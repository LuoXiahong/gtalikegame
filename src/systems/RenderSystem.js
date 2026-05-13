/**
 * 2D RENDERING SYSTEM (RenderSystem)
 * Responsible for sorting, layers, frustum culling, and drawing in 2D mode.
 */
import { World } from '../world/World.js';
import { Camera } from '../world/Camera.js';
import { VehicleSystem } from './VehicleSystem.js';
import { MissionSystem } from './MissionSystem.js';
import { TILE_COLORS } from '../world/Tilemap.js';

export const RenderSystem = {
    ctx: null,
    canvas: null,
    debugAI: false,

    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
    },

    drawTilemap() {
        if (!World.tilemap) return;

        const ts = World.tilemap.tileSize;
        
        // Frustum culling: calculate visible tiles bounds
        const startCol = Math.max(0, Math.floor(-Camera.x / ts));
        const endCol = Math.min(World.tilemap.cols - 1, Math.floor((-Camera.x + this.canvas.width) / ts));
        const startRow = Math.max(0, Math.floor(-Camera.y / ts));
        const endRow = Math.min(World.tilemap.rows - 1, Math.floor((-Camera.y + this.canvas.height) / ts));

        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const type = World.tilemap.data[r][c];
                this.ctx.fillStyle = TILE_COLORS[type];
                this.ctx.fillRect(c * ts, r * ts, ts, ts);
            }
        }
    },

    drawDecals() {
        if (!World.decals) return;
        this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
        World.decals.items.forEach(d => {
            if (d.type === 'crosswalk') {
                const stripes = d.w > d.h ? 6 : 1;
                const stripeW = d.w > d.h ? d.w / 11 : d.w;
                const stripeH = d.w > d.h ? d.h : d.h / 11;
                
                for (let i = 0; i < 11; i += 2) {
                    if (d.w > d.h) {
                        this.ctx.fillRect(d.x - d.w/2 + i * stripeW, d.y - d.h/2, stripeW, stripeH);
                    } else {
                        this.ctx.fillRect(d.x - d.w/2, d.y - d.h/2 + i * stripeH, stripeW, stripeH);
                    }
                }
            } else {
                this.ctx.fillRect(d.x - d.w/2, d.y - d.h/2, d.w, d.h);
            }
        });
    },

    drawShadows() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.15)';
        const shadowOffset = 30;
        World.buildings.forEach(b => {
            // Flat polygon drop shadows
            this.ctx.fillRect(b.x + shadowOffset, b.y + shadowOffset, b.w, b.h);
        });
    },

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= World.width; x += World.tileSize) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, World.height); this.ctx.stroke();
        }
        for (let y = 0; y <= World.height; y += World.tileSize) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(World.width, y); this.ctx.stroke();
        }
    },

    drawEntities() {
        const player = World.getEntitiesByType('player')[0];
        if (!player) return;

        const renderables = [
            ...World.buildings.map(b => ({ ...b, type: 'building' })),
            ...World.getEntitiesByType('car').map(c => ({
                x: c.transform.x, y: c.transform.y, w: c.transform.width, h: c.transform.height,
                z: c.visual.z, color: c.visual.color, type: 'car', angle: c.transform.angle
            }))
        ].sort((a, b) => {
            const ax = a.type === 'car' ? a.x : a.x + a.w / 2;
            const ay = a.type === 'car' ? a.y : a.y + a.h / 2;
            const bx = b.type === 'car' ? b.x : b.x + b.w / 2;
            const by = b.type === 'car' ? b.y : b.y + b.h / 2;
            const distA = Math.pow(ax - player.transform.x, 2) + Math.pow(ay - player.transform.y, 2);
            const distB = Math.pow(bx - player.transform.x, 2) + Math.pow(by - player.transform.y, 2);
            return distB - distA;
        });

        // 1. 3D projection calculations
        renderables.forEach(item => {
            const project = (px, py) => {
                const dx = px - player.transform.x;
                const dy = py - player.transform.y;
                return { x: px + dx * item.z, y: py + dy * item.z };
            };

            let p1, p2, p3, p4;

            if (item.type === 'car') {
                const cos = Math.cos(item.angle);
                const sin = Math.sin(item.angle);
                const getRotated = (lx, ly) => ({
                    x: item.x + (lx * cos - ly * sin),
                    y: item.y + (lx * sin + ly * cos)
                });

                const hw = item.w / 2;
                const hh = item.h / 2;
                p1 = getRotated(-hw, -hh); p2 = getRotated(hw, -hh);
                p3 = getRotated(hw, hh); p4 = getRotated(-hw, hh);

                // Draw wheels under the chassis
                this.ctx.save();
                this.ctx.translate(item.x, item.y);
                this.ctx.rotate(item.angle);
                this.ctx.fillStyle = '#222';
                const wheelW = 18; const wheelH = 8;
                this.ctx.fillRect(-hw + 10, -hh - 4, wheelW, wheelH);
                this.ctx.fillRect(hw - 28, -hh - 4, wheelW, wheelH);
                this.ctx.fillRect(-hw + 10, hh - 4, wheelW, wheelH);
                this.ctx.fillRect(hw - 28, hh - 4, wheelW, wheelH);
                this.ctx.restore();
            } else {
                p1 = { x: item.x, y: item.y }; p2 = { x: item.x + item.w, y: item.y };
                p3 = { x: item.x + item.w, y: item.y + item.h }; p4 = { x: item.x, y: item.y + item.h };
            }

            const r1 = project(p1.x, p1.y); const r2 = project(p2.x, p2.y);
            const r3 = project(p3.x, p3.y); const r4 = project(p4.x, p4.y);

            const color = item.type === 'building' ? '#636e72' : item.color;
            
            // Wall 1 (left/top)
            this.ctx.fillStyle = item.type === 'building' ? '#636e72' : color;
            this.ctx.beginPath(); this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y); this.ctx.lineTo(r2.x, r2.y); this.ctx.lineTo(r1.x, r1.y); this.ctx.fill();
            if (item.type === 'car') { this.ctx.fillStyle = 'rgba(0,0,0,0.2)'; this.ctx.fill(); }

            // Wall 2 (right)
            this.ctx.fillStyle = item.type === 'building' ? '#2d3436' : color;
            this.ctx.beginPath(); this.ctx.moveTo(p2.x, p2.y); this.ctx.lineTo(p3.x, p3.y); this.ctx.lineTo(r3.x, r3.y); this.ctx.lineTo(r2.x, r2.y); this.ctx.fill();
            if (item.type === 'car') { this.ctx.fillStyle = 'rgba(0,0,0,0.4)'; this.ctx.fill(); }

            // Wall 3 (bottom)
            this.ctx.fillStyle = item.type === 'building' ? '#b2bec3' : color;
            this.ctx.beginPath(); this.ctx.moveTo(p3.x, p3.y); this.ctx.lineTo(p4.x, p4.y); this.ctx.lineTo(r4.x, r4.y); this.ctx.lineTo(r3.x, r3.y); this.ctx.fill();
            if (item.type === 'car') { this.ctx.fillStyle = 'rgba(0,0,0,0.1)'; this.ctx.fill(); }

            // Wall 4 (left)
            this.ctx.fillStyle = item.type === 'building' ? '#555' : color;
            this.ctx.beginPath(); this.ctx.moveTo(p4.x, p4.y); this.ctx.lineTo(p1.x, p1.y); this.ctx.lineTo(r1.x, r1.y); this.ctx.lineTo(r4.x, r4.y); this.ctx.fill();
            if (item.type === 'car') { this.ctx.fillStyle = 'rgba(0,0,0,0.3)'; this.ctx.fill(); }

            // Roof
            this.ctx.fillStyle = item.type === 'building' ? '#7f8c8d' : color;
            this.ctx.beginPath(); this.ctx.moveTo(r1.x, r1.y); this.ctx.lineTo(r2.x, r2.y); this.ctx.lineTo(r3.x, r3.y); this.ctx.lineTo(r4.x, r4.y); this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(0,0,0,0.5)'; this.ctx.lineWidth = 1; this.ctx.stroke();
        });

        // 2. Draw flat entities (NPCs, Player)
        const controlled = VehicleSystem.getControlledEntity();

        World.entities.forEach(ent => {
            if ((ent.type !== 'npc' && ent.type !== 'player') || ent.visible === false) return;

            this.ctx.save();
            this.ctx.translate(ent.transform.x, ent.transform.y);
            this.ctx.rotate(ent.transform.angle);

            let legSwing = 0;
            if (ent.type === 'player' && ent.physics) {
                const spd = Math.sqrt(ent.physics.velX * ent.physics.velX + ent.physics.velY * ent.physics.velY);
                if (spd > 0.1) {
                    ent.visual.walkCycle += spd * 0.3;
                } else {
                    ent.visual.walkCycle = 0;
                }
                legSwing = Math.sin(ent.visual.walkCycle) * 8;
            } else if (ent.type === 'npc') {
                legSwing = Math.sin(ent.visual.walkCycle) * 6;
            }

            if (ent.type === 'player' || ent.type === 'npc') {
                const colorMain = ent.visual.color;
                const colorPants = ent.type === 'player' ? '#2980b9' : '#34495e';
                const yOffset = ent.type === 'npc' ? -10 : -15;

                this.ctx.fillStyle = colorPants;
                this.ctx.fillRect(-5, yOffset + 3, 12 + legSwing, 6);
                this.ctx.beginPath(); this.ctx.arc(-5 + 12 + legSwing, yOffset + 6, 4, 0, Math.PI * 2); this.ctx.fillStyle = '#222'; this.ctx.fill();
                this.ctx.fillStyle = colorPants;
                this.ctx.fillRect(-5, yOffset + 21, 12 - legSwing, 6);
                this.ctx.beginPath(); this.ctx.arc(-5 + 12 - legSwing, yOffset + 24, 4, 0, Math.PI * 2); this.ctx.fillStyle = '#222'; this.ctx.fill();

                this.ctx.fillStyle = colorMain;
                if (ent.type === 'player') this.ctx.fillRect(-10, -15, 20, 30);
                else this.ctx.fillRect(-4, -10, 8, 20);

                this.ctx.beginPath(); this.ctx.arc(0, 0, 7, 0, Math.PI * 2); this.ctx.fillStyle = '#f1c27d'; this.ctx.fill();
                if (ent.type === 'player') {
                    this.ctx.beginPath(); this.ctx.arc(8, 0, 2, 0, Math.PI * 2); this.ctx.fillStyle = '#e0b16a'; this.ctx.fill();
                }
            }
            this.ctx.restore();

            if (ent.type === 'player' && ent.visible) {
                this.ctx.save();
                this.ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                this.ctx.beginPath(); this.ctx.arc(ent.transform.x, ent.transform.y, ent.interactionRadius, 0, Math.PI * 2); this.ctx.stroke();
                this.ctx.restore();
            }
        });

        // 3. Highlight active vehicle
        if (controlled && controlled.type === 'car') {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(
                controlled.transform.x - controlled.transform.width / 2 - 5, 
                controlled.transform.y - controlled.transform.height / 2 - 5, 
                controlled.transform.width + 10, 
                controlled.transform.height + 10
            );
            this.ctx.restore();
        }
    },

    drawDebugHitboxes() {
        this.ctx.lineWidth = 1;
        
        // Buildings (top-left)
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        World.buildings.forEach(b => {
            this.ctx.strokeRect(b.x, b.y, b.w, b.h);
        });

        // Entities (center-based)
        const entities = [
            ...World.getEntitiesByType('player'), 
            ...World.getEntitiesByType('npc'), 
            ...World.getEntitiesByType('car'),
            ...World.getEntitiesByType('police')
        ];
        entities.forEach(ent => {
            const t = ent.transform;
            this.ctx.strokeStyle = ent.type === 'player' ? '#ff0000' : '#00ff00';
            this.ctx.strokeRect(t.x - t.width / 2, t.y - t.height / 2, t.width, t.height);
        });
    },

    drawOriginMarker() {
        this.ctx.save();
        this.ctx.strokeStyle = '#f1c40f';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        // Crosshair at origin (0,0)
        this.ctx.moveTo(-20, 0);
        this.ctx.lineTo(20, 0);
        this.ctx.moveTo(0, -20);
        this.ctx.lineTo(0, 20);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText('ORIGIN (0,0)', 5, -5);
        this.ctx.restore();
    },

    drawMissionObjective() {
        if (!MissionSystem.targetLocation) return;
        
        const loc = MissionSystem.targetLocation;
        this.ctx.save();
        
        const pulse = Math.sin(Date.now() / 200) * 10;
        this.ctx.strokeStyle = '#f1c40f';
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([10, 5]);
        this.ctx.beginPath();
        this.ctx.arc(loc.x, loc.y, loc.radius + pulse, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.fillStyle = 'rgba(241, 196, 15, 0.2)';
        this.ctx.fill();

        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('TARGET ZONE', loc.x, loc.y - loc.radius - 20);
        
        this.ctx.restore();
    },

    drawDebugAI() {
        if (!this.debugAI) return;
        
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'center';
        
        // NPC debug info
        World.getEntitiesByType('npc').forEach(npc => {
            const t = npc.transform;
            const state = npc.ai ? npc.ai.state : 'idle';
            this.ctx.fillText(`AI: ${state}`, t.x, t.y - t.height / 2 - 10);
        });
        
        // Traffic vehicles debug info
        World.getEntitiesByType('car').filter(car => car.ai && car.ai.type === 'traffic').forEach(car => {
            const t = car.transform;
            const speed = Math.round(car.ai.currentSpeed || 0);
            const avoiding = car.ai.avoidTimer > 0 ? ` [avoiding]` : '';
            this.ctx.fillText(`TRAFFIC: ${speed}px/s${avoiding}`, t.x, t.y - t.height / 2 - 10);
        });
        
        this.ctx.restore();
    },

    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(Camera.x, Camera.y);
        this.drawTilemap();
        this.drawDecals();
        this.drawGrid();
        this.drawShadows();
        this.drawEntities();
        this.drawMissionObjective();
        
        // Debug overlays
        this.drawOriginMarker();
        this.drawDebugHitboxes();
        this.drawDebugAI();

        this.ctx.restore();
    }
};
