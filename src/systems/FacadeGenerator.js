/**
 * PROCEDURAL FACADE GENERATOR SYSTEM (FacadeGenerator)
 * Generates procedural facade textures for buildings using Canvas2D and THREE.CanvasTexture.
 */
import * as THREE from 'three';

export const FacadeGenerator = {
    textures: new Map(),

    init() {
        this.textures.set('residential', this.createCanvasTexture('residential'));
        this.textures.set('skyscraper', this.createCanvasTexture('skyscraper'));
        this.textures.set('shop_front', this.createCanvasTexture('shop_front'));
        this.textures.set('shop_side', this.createCanvasTexture('shop_side'));
    },

    createCanvasTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;

        if (ctx) {
            if (type === 'residential') {
                this.drawResidentialFacade(ctx);
            } else if (type === 'skyscraper') {
                this.drawSkyscraperFacade(ctx);
            } else if (type === 'shop_front') {
                this.drawShopFrontFacade(ctx);
            } else if (type === 'shop_side') {
                this.drawShopSideFacade(ctx);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
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

    drawResidentialFacade(ctx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = '#9c4a3a'; // brick
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
                } else if (rand < 0.28) {
                    lightColor = '#e8c070'; // warm tungsten
                } else if (rand < 0.36) {
                    lightColor = '#f5e6c8';
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);

                ctx.strokeStyle = '#c4a882';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    ctx.fillStyle = lightColor;
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                }
            }
        }
    },

    drawSkyscraperFacade(ctx) {
        const W = 256;
        const H = 256;

        // Limestone / sandstone masonry (not curtain-wall glass)
        ctx.fillStyle = '#c4a882';
        ctx.fillRect(0, 0, W, H);

        this.addFacadeNoise(ctx, W, H, 0.06, 0.04);

        // Punched window grid
        const windowW = 14;
        const windowH = 22;
        const stepX = 28;
        const stepY = 36;

        for (let y = 10; y < H - 8; y += stepY) {
            for (let x = 8; x < W - 8; x += stepX) {
                const rand = Math.random();
                let glassColor = '#1a1f28';
                if (rand < 0.12) {
                    glassColor = '#e8c070'; // lit office
                } else if (rand < 0.18) {
                    glassColor = '#f5e6c8';
                } else if (rand < 0.22) {
                    glassColor = '#0a0a0a';
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);

                ctx.strokeStyle = '#8b7355';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);
            }
        }

        // Subtle horizontal string courses
        ctx.fillStyle = 'rgba(90, 70, 45, 0.25)';
        for (let y = stepY - 4; y < H; y += stepY) {
            ctx.fillRect(0, y, W, 2);
        }
    },

    drawShopFrontFacade(ctx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = '#d4c5a9'; // cream
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
                } else if (rand < 0.30) {
                    lightColor = '#e8c070';
                } else if (rand < 0.38) {
                    lightColor = '#f5e6c8';
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);

                ctx.strokeStyle = '#8b7355';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    ctx.fillStyle = lightColor;
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                }
            }
        }

        // Storefront awning — deep burgundy with cream stripes (period, not neon)
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

    drawShopSideFacade(ctx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = '#d4c5a9';
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
                } else if (rand < 0.30) {
                    lightColor = '#e8c070';
                } else if (rand < 0.38) {
                    lightColor = '#f5e6c8';
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);

                ctx.strokeStyle = '#8b7355';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    ctx.fillStyle = lightColor;
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                }
            }
        }
    }
};
