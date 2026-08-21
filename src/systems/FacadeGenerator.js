/**
 * PROCEDURAL FACADE GENERATOR SYSTEM (FacadeGenerator)
 * Generates albedo + black/lit-window emissive maps for buildings.
 */
import * as THREE from 'three';

/**
 * The main albedo texture is multiplied by the building's own material.color
 * (CityBuilder3D.getBuildingMaterials) — these used to be saturated hues in
 * their own right (brick/sandstone/cream), so a building's wall color was two
 * saturated colors multiplied together, which compounds rather than cancels
 * (measured: residential walls came out more saturated than either input).
 * Desaturated to the same luminance as before (differentiate archetypes by
 * value, not hue) so multiplying by a neutral material.color stays neutral.
 */
const FACADE_BG = {
    brick: '#616161',     // was #9c4a3a
    sandstone: '#acacac', // was #c4a882
    cream: '#c6c6c6',     // was #d4c5a9
};
/** Lit/glass window colors — were warm amber, now neutral so windows don't reintroduce hue that the wall fix just removed. */
const WINDOW_PALETTE = {
    litAmber: '#b0b4b8',  // was #e8c070
    litCream: '#d8dadc',  // was #f5e6c8
    frameLight: '#7a7c7e', // was #c4a882
    frameDark: '#5a5c5e',  // was #8b7355
};

export const FacadeGenerator = {
    textures: new Map(),
    emissiveTextures: new Map(),

    init() {
        this.textures.clear();
        this.emissiveTextures.clear();
        for (const type of ['residential', 'skyscraper', 'shop_front', 'shop_side']) {
            this.createCanvasTexture(type);
        }
    },

    createCanvasTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;

        const emCanvas = document.createElement('canvas');
        emCanvas.width = 256;
        emCanvas.height = 256;
        const emCtx = emCanvas.getContext ? emCanvas.getContext('2d') : null;
        if (emCtx) {
            emCtx.fillStyle = '#000000';
            emCtx.fillRect(0, 0, 256, 256);
        }

        if (ctx) {
            if (type === 'residential') {
                this.drawResidentialFacade(ctx, emCtx);
            } else if (type === 'skyscraper') {
                this.drawSkyscraperFacade(ctx, emCtx);
            } else if (type === 'shop_front') {
                this.drawShopFrontFacade(ctx, emCtx);
            } else if (type === 'shop_side') {
                this.drawShopSideFacade(ctx, emCtx);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;

        const emissiveMap = new THREE.CanvasTexture(emCanvas);
        emissiveMap.wrapS = THREE.RepeatWrapping;
        emissiveMap.wrapT = THREE.RepeatWrapping;
        emissiveMap.magFilter = THREE.NearestFilter;
        emissiveMap.minFilter = THREE.LinearMipmapLinearFilter;

        texture.userData.emissiveMap = emissiveMap;
        this.textures.set(type, texture);
        this.emissiveTextures.set(type, emissiveMap);
        return texture;
    },

    paintLitWindow(emCtx, x, y, w, h, color) {
        if (!emCtx || !color) return;
        emCtx.fillStyle = color;
        emCtx.fillRect(x, y, w, h);
    },

    addFacadeNoise(ctx, width, height, density = 0.05, opacity = 0.04) {
        ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
        const count = width * height * density;
        for (let i = 0; i < count; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            ctx.fillRect(rx, ry, 1, 1);
        }
    },

    drawResidentialFacade(ctx, emCtx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = FACADE_BG.brick;
        ctx.fillRect(0, 0, W, H);
        this.addFacadeNoise(ctx, W, H, 0.08, 0.05);

        const windowW = 18;
        const windowH = 28;
        const startX = 22;
        const startY = 22;
        const stepX = 42;
        const stepY = 58;

        for (let y = startY; y < H; y += stepY) {
            for (let x = startX; x < W; x += stepX) {
                const rand = Math.random();
                let glassColor = '#1a1a18';
                let lightColor = null;

                if (rand < 0.12) {
                    glassColor = '#0d0d0c';
                } else if (rand < 0.32) {
                    lightColor = WINDOW_PALETTE.litAmber;
                } else if (rand < 0.42) {
                    lightColor = WINDOW_PALETTE.litCream;
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);
                ctx.strokeStyle = WINDOW_PALETTE.frameLight;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    ctx.fillStyle = lightColor;
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                    this.paintLitWindow(emCtx, x + 2, y + 2, windowW - 4, windowH - 4, lightColor);
                }
            }
        }
    },

    drawSkyscraperFacade(ctx, emCtx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = FACADE_BG.sandstone;
        ctx.fillRect(0, 0, W, H);
        this.addFacadeNoise(ctx, W, H, 0.06, 0.04);

        const windowW = 14;
        const windowH = 22;
        const stepX = 28;
        const stepY = 36;

        for (let y = 10; y < H - 8; y += stepY) {
            for (let x = 8; x < W - 8; x += stepX) {
                const rand = Math.random();
                let glassColor = '#1a1f28';
                let lightColor = null;
                if (rand < 0.14) {
                    lightColor = WINDOW_PALETTE.litAmber;
                    glassColor = lightColor;
                } else if (rand < 0.22) {
                    lightColor = WINDOW_PALETTE.litCream;
                    glassColor = lightColor;
                } else if (rand < 0.26) {
                    glassColor = '#0a0a0a';
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);
                ctx.strokeStyle = WINDOW_PALETTE.frameDark;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    this.paintLitWindow(emCtx, x, y, windowW, windowH, lightColor);
                }
            }
        }

        ctx.fillStyle = 'rgba(70, 71, 72, 0.25)';
        for (let y = stepY - 4; y < H; y += stepY) {
            ctx.fillRect(0, y, W, 2);
        }
    },

    drawShopFrontFacade(ctx, emCtx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = FACADE_BG.cream;
        ctx.fillRect(0, 0, W, H);
        this.addFacadeNoise(ctx, W, H, 0.08, 0.05);

        const windowW = 18;
        const windowH = 26;
        for (let y = 20; y < 140; y += 50) {
            for (let x = 20; x < W; x += 40) {
                const rand = Math.random();
                let glassColor = '#1a1f28';
                let lightColor = null;

                if (rand < 0.15) {
                    glassColor = '#0d0d0c';
                } else if (rand < 0.35) {
                    lightColor = WINDOW_PALETTE.litAmber;
                } else if (rand < 0.45) {
                    lightColor = WINDOW_PALETTE.litCream;
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);
                ctx.strokeStyle = WINDOW_PALETTE.frameDark;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    ctx.fillStyle = lightColor;
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                    this.paintLitWindow(emCtx, x + 2, y + 2, windowW - 4, windowH - 4, lightColor);
                }
            }
        }

        const awningY = 150;
        const awningH = 15;
        ctx.fillStyle = '#5c1a1a';
        ctx.fillRect(5, awningY, W - 10, awningH);
        ctx.fillStyle = '#d4c5a9';
        for (let x = 10; x < W - 10; x += 20) {
            ctx.fillRect(x, awningY, 10, awningH);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, awningY + awningH, W, 4);

        const groundY = 175;
        const groundH = 81;
        for (let x = 12; x < W; x += 80) {
            const glassW = 68;
            const glassH = groundH - 12;
            ctx.fillStyle = '#1a1a18';
            ctx.fillRect(x, groundY, glassW, glassH);
            ctx.strokeStyle = '#6b5a40';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, groundY, glassW, glassH);

            const grad = ctx.createLinearGradient(0, groundY + 20, 0, groundY + glassH);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(232,192,112,0.12)');
            ctx.fillStyle = grad;
            ctx.fillRect(x + 2, groundY + 2, glassW - 4, glassH - 4);
        }
    },

    drawShopSideFacade(ctx, emCtx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = FACADE_BG.cream;
        ctx.fillRect(0, 0, W, H);
        this.addFacadeNoise(ctx, W, H, 0.08, 0.05);

        const windowW = 18;
        const windowH = 26;
        for (let y = 20; y < H - 40; y += 50) {
            for (let x = 20; x < W; x += 40) {
                const rand = Math.random();
                let glassColor = '#1a1f28';
                let lightColor = null;

                if (rand < 0.15) {
                    glassColor = '#0d0d0c';
                } else if (rand < 0.35) {
                    lightColor = WINDOW_PALETTE.litAmber;
                } else if (rand < 0.45) {
                    lightColor = WINDOW_PALETTE.litCream;
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);
                ctx.strokeStyle = WINDOW_PALETTE.frameDark;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    ctx.fillStyle = lightColor;
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                    this.paintLitWindow(emCtx, x + 2, y + 2, windowW - 4, windowH - 4, lightColor);
                }
            }
        }
    }
};
