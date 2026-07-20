/**
 * RoadTextureGenerator — procedural road textures via Canvas2D + THREE.CanvasTexture.
 */
import * as THREE from 'three';

export const RoadTextureGenerator = {
    textures: new Map(),
    roughnessTextures: new Map(),

    init() {
        if (this.textures.size > 0) return;
        this.textures.set('straight', this.createCanvasTexture('straight'));
        this.textures.set('intersection', this.createCanvasTexture('intersection'));
        this.textures.set('crosswalk', this.createCanvasTexture('crosswalk'));
        this.roughnessTextures.set('straight', this.createRoughnessTexture('straight'));
        this.roughnessTextures.set('intersection', this.createRoughnessTexture('intersection'));
        this.roughnessTextures.set('crosswalk', this.createRoughnessTexture('crosswalk'));
    },

    getTexture(type) {
        if (!this.textures.has(type)) {
            this.textures.set(type, this.createCanvasTexture(type));
        }
        return this.textures.get(type);
    },

    getRoughnessTexture(type) {
        if (!this.roughnessTextures.has(type)) {
            this.roughnessTextures.set(type, this.createRoughnessTexture(type));
        }
        return this.roughnessTextures.get(type);
    },

    /** Deterministic-ish wet patch list for albedo + roughness alignment. */
    generateWetPatches(count = 7) {
        const patches = [];
        for (let i = 0; i < count; i++) {
            patches.push({
                x: 40 + Math.random() * 432,
                y: 40 + Math.random() * 432,
                rx: 18 + Math.random() * 42,
                ry: 10 + Math.random() * 28,
                rot: Math.random() * Math.PI,
                dark: Math.random() < 0.55
            });
        }
        return patches;
    },

    createCanvasTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;
        const patches = this.generateWetPatches(type === 'crosswalk' ? 4 : 8);

        if (ctx) {
            ctx.fillStyle = '#222428';
            ctx.fillRect(0, 0, 512, 512);

            this.addAsphaltNoise(ctx, 512, 512);

            if (type === 'straight') {
                this.drawStraightRoad(ctx, true);
                this.applyAsphaltDirt(ctx, false); // curb dirt on left/right only
            } else if (type === 'intersection') {
                // No edge dirt: all 4 sides connect to roads — keep asphalt uniform
                this.drawIntersection(ctx);
            } else if (type === 'crosswalk') {
                this.drawCrosswalk(ctx);
            }

            this.addWetPatchesAlbedo(ctx, patches);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // NearestFilter: crisp retro pixel look on mag
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.userData = texture.userData || {};
        texture.userData.wetPatches = patches;
        return texture;
    },

    createRoughnessTexture(type) {
        const albedo = this.getTexture(type);
        const patches = (albedo.userData && albedo.userData.wetPatches) || this.generateWetPatches(6);

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;

        if (ctx) {
            // High roughness base (light gray → rough asphalt)
            ctx.fillStyle = '#e6e6e6';
            ctx.fillRect(0, 0, 512, 512);

            // Subtle noise
            for (let i = 0; i < 200; i++) {
                const rx = Math.random() * 512;
                const ry = Math.random() * 512;
                const v = 200 + Math.floor(Math.random() * 40);
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.beginPath();
                ctx.arc(rx, ry, 8 + Math.random() * 20, 0, Math.PI * 2);
                ctx.fill();
            }

            this.addWetPatchesRoughness(ctx, patches);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    },

    addWetPatchesAlbedo(ctx, patches) {
        ctx.save();
        for (const p of patches) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(p.rx, p.ry));
            if (p.dark) {
                grad.addColorStop(0, 'rgba(8, 10, 14, 0.22)');
                grad.addColorStop(0.55, 'rgba(12, 14, 18, 0.1)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            } else {
                grad.addColorStop(0, 'rgba(90, 100, 110, 0.14)');
                grad.addColorStop(0.55, 'rgba(70, 80, 90, 0.06)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            }
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    },

    addWetPatchesRoughness(ctx, patches) {
        ctx.save();
        for (const p of patches) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            // Dark = low roughness (wet / reflective)
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(p.rx, p.ry));
            grad.addColorStop(0, 'rgb(18, 18, 18)');
            grad.addColorStop(0.45, 'rgb(55, 55, 55)');
            grad.addColorStop(1, 'rgba(230, 230, 230, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    },

    addAsphaltNoise(ctx, width, height) {
        // Large aging blotches
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

        // Medium aggregate stones
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

        // High-frequency sand grain
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
        // Clear asphalt near both ends so dashes stop short of intersections
        // (mirrors 2D Decals clearance). ~18% of a 50 m segment ≈ 9 m gap.
        const margin = 92;
        const dashStart = margin;
        const dashEnd = 512 - margin;

        ctx.save();

        ctx.strokeStyle = 'rgba(10, 10, 12, 0.4)';
        ctx.lineWidth = 8;
        ctx.setLineDash([40, 40]);
        ctx.lineDashOffset = 20;
        ctx.beginPath();
        if (isVertical) {
            ctx.moveTo(257, dashStart);
            ctx.lineTo(257, dashEnd);
        } else {
            ctx.moveTo(dashStart, 257);
            ctx.lineTo(dashEnd, 257);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(240, 242, 245, 0.9)';
        ctx.lineWidth = 6;
        ctx.setLineDash([40, 40]);
        ctx.lineDashOffset = 20;
        ctx.beginPath();
        if (isVertical) {
            ctx.moveTo(256, dashStart);
            ctx.lineTo(256, dashEnd);
        } else {
            ctx.moveTo(dashStart, 256);
            ctx.lineTo(dashEnd, 256);
        }
        ctx.stroke();

        // Paint wear only along the dashed span
        ctx.restore();
        ctx.save();
        ctx.fillStyle = '#222428';
        const paintCenter = 256;
        for (let i = 0; i < 40; i++) {
            const ry = dashStart + Math.random() * (dashEnd - dashStart);
            const rx = paintCenter + (Math.random() - 0.5) * 8;
            ctx.fillRect(rx, ry, Math.random() < 0.5 ? 2 : 1, Math.random() < 0.5 ? 2 : 1);
        }
        ctx.restore();
    },

    drawIntersection(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(5, 5, 8, 0.35)';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.arc(512, 512, 220, Math.PI * 1.05, Math.PI * 1.45);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 190, Math.PI * 0.05, Math.PI * 0.45);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(5, 5, 8, 0.25)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(180, 150);
        ctx.lineTo(180, 360);
        ctx.moveTo(196, 170);
        ctx.lineTo(196, 380);
        ctx.stroke();
        ctx.restore();

        // Zebras live on exit-road approaches (RoadBuilder3D), not inside the junction.
    },

    drawCrosswalk(ctx) {
        ctx.fillStyle = '#222428';
        ctx.fillRect(0, 0, 512, 512);
        this.addAsphaltNoise(ctx, 512, 512);

        const stripeCount = 5;
        const stripeW = 48;
        const gap = (512 - stripeCount * stripeW) / (stripeCount + 1);
        const stripeH = 280;
        const y = (512 - stripeH) / 2;

        for (let i = 0; i < stripeCount; i++) {
            const x = gap + i * (stripeW + gap);
            ctx.fillStyle = 'rgba(10, 10, 12, 0.4)';
            ctx.fillRect(x + 1, y + 1, stripeW, stripeH);
            ctx.fillStyle = 'rgba(240, 242, 245, 0.9)';
            ctx.fillRect(x, y, stripeW, stripeH);
            ctx.fillStyle = '#222428';
            for (let c = 0; c < 4; c++) {
                ctx.fillRect(
                    x + Math.random() * (stripeW - 2),
                    y + Math.random() * (stripeH - 2),
                    1 + Math.random() * 2,
                    1 + Math.random() * 2
                );
            }
        }
    },

    applyAsphaltDirt(ctx, allEdges = false) {
        ctx.save();
        const dirtWidth = 85; // Wider, smoother curb/gutter dirt falloff

        const leftGrad = ctx.createLinearGradient(0, 0, dirtWidth, 0);
        leftGrad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
        leftGrad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
        leftGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, dirtWidth, 512);

        const rightGrad = ctx.createLinearGradient(512, 0, 512 - dirtWidth, 0);
        rightGrad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
        rightGrad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
        rightGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(512 - dirtWidth, 0, dirtWidth, 512);

        if (allEdges) {
            const topGrad = ctx.createLinearGradient(0, 0, 0, dirtWidth);
            topGrad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
            topGrad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
            topGrad.addColorStop(1, 'rgba(10, 10, 12, 0)');
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, 512, dirtWidth);

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
