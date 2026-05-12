/**
 * PROCEDURAL ROAD TEXTURE GENERATOR SYSTEM (RoadTextureGenerator)
 * Generates high-quality procedural road textures using Canvas2D and THREE.CanvasTexture.
 */
import * as THREE from 'three';

export const RoadTextureGenerator = {
    textures: new Map(),

    init() {
        if (this.textures.size > 0) return;
        this.textures.set('straight', this.createCanvasTexture('straight'));
        this.textures.set('intersection', this.createCanvasTexture('intersection'));
    },

    getTexture(type) {
        if (this.textures.size === 0) {
            this.init();
        }
        return this.textures.get(type);
    },

    createCanvasTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;

        if (ctx) {
            // Fill background with core premium asphalt color
            ctx.fillStyle = '#222428'; // Slightly lighter, richer asphalt grey
            ctx.fillRect(0, 0, 512, 512);

            // Add deep multi-layered procedural grain and aggregate stones
            this.addAsphaltNoise(ctx, 512, 512);

            if (type === 'straight') {
                this.drawStraightRoad(ctx, true);
                this.applyAsphaltDirt(ctx, false); // dirt on left/right edges
            } else if (type === 'intersection') {
                this.drawIntersection(ctx);
                this.applyAsphaltDirt(ctx, true); // dirt on all 4 edges
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // NearestFilter for crisp, stylish, premium retro pixel feel
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    },

    addAsphaltNoise(ctx, width, height) {
        // Layer 1: Large organic color variations (asphalt aging blotches)
        for (let i = 0; i < 30; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            const rSize = 40 + Math.random() * 60;
            const isLight = Math.random() < 0.5;
            const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rSize);
            grad.addColorStop(0, isLight ? 'rgba(255, 255, 255, 0.025)' : 'rgba(10, 10, 15, 0.04)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Layer 2: Medium aggregate stones (simulating gravel texture in asphalt)
        for (let i = 0; i < 800; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            const rSize = 1.0 + Math.random() * 2.0;
            const isLight = Math.random() < 0.45;
            ctx.fillStyle = isLight ? 'rgba(230, 230, 235, 0.12)' : 'rgba(5, 5, 10, 0.15)';
            ctx.beginPath();
            ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // Layer 3: Sharp sand micro-pixels (very high-frequency grain)
        const pixelCount = Math.round(width * height * 0.08);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        for (let i = 0; i < pixelCount; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            ctx.fillRect(rx, ry, 1, 1);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
        for (let i = 0; i < pixelCount; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            ctx.fillRect(rx, ry, 1, 1);
        }
    },

    drawStraightRoad(ctx, isVertical = true) {
        ctx.save();

        // 1. Draw subtle dark outline backing for painted line to pop (contrast drop-shadow)
        ctx.strokeStyle = 'rgba(10, 10, 12, 0.4)';
        ctx.lineWidth = 8;
        ctx.setLineDash([40, 40]);
        ctx.lineDashOffset = 20;
        ctx.beginPath();
        if (isVertical) {
            ctx.moveTo(257, 0);
            ctx.lineTo(257, 512);
        } else {
            ctx.moveTo(0, 257);
            ctx.lineTo(512, 257);
        }
        ctx.stroke();

        // 2. Draw actual off-white dashed line with painted texture feeling
        ctx.strokeStyle = 'rgba(240, 242, 245, 0.9)'; // Slightly transparent, realistic paint
        ctx.lineWidth = 6;
        ctx.setLineDash([40, 40]);
        ctx.lineDashOffset = 20;
        ctx.beginPath();
        if (isVertical) {
            ctx.moveTo(256, 0);
            ctx.lineTo(256, 512);
        } else {
            ctx.moveTo(0, 256);
            ctx.lineTo(512, 256);
        }
        ctx.stroke();

        // 3. Apply subtle scratches/wear directly on the paint
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#222428'; // Overwrite with asphalt color to simulate paint chipping
        const paintCenter = 256;
        for (let i = 0; i < 40; i++) {
            const ry = Math.random() * 512;
            const rx = paintCenter + (Math.random() - 0.5) * 8;
            ctx.fillRect(rx, ry, Math.random() < 0.5 ? 2 : 1, Math.random() < 0.5 ? 2 : 1);
        }
        ctx.restore();
    },

    drawIntersection(ctx) {
        // 1. Draw curved tire skid marks for dramatic street effect
        ctx.save();
        ctx.strokeStyle = 'rgba(5, 5, 8, 0.35)';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        
        // Curve 1 (bottom-right turning)
        ctx.beginPath();
        ctx.arc(512, 512, 220, Math.PI * 1.05, Math.PI * 1.45);
        ctx.stroke();

        // Curve 2 (top-left turning)
        ctx.beginPath();
        ctx.arc(0, 0, 190, Math.PI * 0.05, Math.PI * 0.45);
        ctx.stroke();

        // Straight skid (heavy brake)
        ctx.strokeStyle = 'rgba(5, 5, 8, 0.25)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(180, 150);
        ctx.lineTo(180, 360);
        ctx.moveTo(196, 170);
        ctx.lineTo(196, 380);
        ctx.stroke();
        ctx.restore();

        // 2. Draw zebras with realistic paint thickness & drop-shadow backing
        ctx.save();
        
        const offsets = [-153.6, -76.8, 0, 76.8, 153.6];
        const center = 256;

        const drawZebraStripe = (x, y, w, h) => {
            // Dark backing
            ctx.fillStyle = 'rgba(10, 10, 12, 0.4)';
            ctx.fillRect(x + 1, y + 1, w, h);
            // Main paint
            ctx.fillStyle = 'rgba(240, 242, 245, 0.9)';
            ctx.fillRect(x, y, w, h);
            // Paint wear chipping
            ctx.fillStyle = '#222428';
            const chips = Math.floor(2 + Math.random() * 3);
            for (let c = 0; c < chips; c++) {
                const cx = x + Math.random() * (w - 2);
                const cy = y + Math.random() * (h - 2);
                ctx.fillRect(cx, cy, 1 + Math.random() * 2, 1 + Math.random() * 2);
            }
        };

        // North crossing (top)
        offsets.forEach(dx => {
            const x = Math.round(center + dx - 5);
            drawZebraStripe(x, 10, 10, 50);
        });

        // South crossing (bottom)
        offsets.forEach(dx => {
            const x = Math.round(center + dx - 5);
            drawZebraStripe(x, 512 - 60, 10, 50);
        });

        // West crossing (left)
        offsets.forEach(dy => {
            const y = Math.round(center + dy - 5);
            drawZebraStripe(10, y, 50, 10);
        });

        // East crossing (right)
        offsets.forEach(dy => {
            const y = Math.round(center + dy - 5);
            drawZebraStripe(512 - 60, y, 50, 10);
        });

        ctx.restore();
    },

    applyAsphaltDirt(ctx, allEdges = false) {
        ctx.save();
        const dirtWidth = 85; // Wider, smoother rynsztok transition

        // Left edge (curb shadow)
        const leftGrad = ctx.createLinearGradient(0, 0, dirtWidth, 0);
        leftGrad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
        leftGrad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
        leftGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, dirtWidth, 512);

        // Right edge (curb shadow)
        const rightGrad = ctx.createLinearGradient(512, 0, 512 - dirtWidth, 0);
        rightGrad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
        rightGrad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
        rightGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(512 - dirtWidth, 0, dirtWidth, 512);

        if (allEdges) {
            // Top edge
            const topGrad = ctx.createLinearGradient(0, 0, 0, dirtWidth);
            topGrad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
            topGrad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
            topGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, 512, dirtWidth);

            // Bottom edge
            const bottomGrad = ctx.createLinearGradient(0, 512, 0, 512 - dirtWidth);
            bottomGrad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
            bottomGrad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
            bottomGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');
            ctx.fillStyle = bottomGrad;
            ctx.fillRect(0, 512 - dirtWidth, 512, dirtWidth);
        }

        ctx.restore();
    }
};
