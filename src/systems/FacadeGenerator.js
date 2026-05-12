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

        ctx.fillStyle = '#b2bec3';
        ctx.fillRect(0, 0, W, H);

        // Add subtle procedural noise for organic texture (T-261)
        this.addFacadeNoise(ctx, W, H, 0.08, 0.05);

        // Window grid parameters
        const windowW = 20;
        const windowH = 30;
        const startX = 20;
        const startY = 20;
        const stepX = 40;
        const stepY = 60;

        for (let y = startY; y < H; y += stepY) {
            for (let x = startX; x < W; x += stepX) {
                // Window light variation (T-261)
                const rand = Math.random();
                let glassColor = '#2c3e50'; // Standard dark glass
                let lightColor = null;

                if (rand < 0.15) {
                    glassColor = '#111921'; // Very dark/closed blinds
                } else if (rand < 0.30) {
                    lightColor = '#f39c12'; // Warm orange glow
                } else if (rand < 0.42) {
                    lightColor = '#f1c40f'; // Golden/warm yellow
                } else if (rand < 0.48) {
                    lightColor = '#fff9e6'; // Bright glowing whitish yellow
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);

                // Window frame bevel
                ctx.strokeStyle = '#dfe6e9';
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

        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, 0, W, H);

        // Modern curtain-wall vertical stripes
        const stripeW = 12;
        const stepX = 20;

        for (let x = 8; x < W; x += stepX) {
            ctx.fillStyle = '#1b2a4a'; // Deep navy glass
            ctx.fillRect(x, 0, stripeW, H);

            // Horizontal floor divisions
            ctx.fillStyle = '#34495e';
            for (let y = 0; y < H; y += 40) {
                ctx.fillRect(x, y, stripeW, 2);
            }

            // Random reflections & illuminated offices (T-261)
            for (let y = 15; y < H; y += 40) {
                const rand = Math.random();
                if (rand < 0.15) {
                    ctx.fillStyle = '#f1c40f'; // Warm yellow office light
                    ctx.fillRect(x + 1, y, stripeW - 2, 10);
                } else if (rand < 0.25) {
                    ctx.fillStyle = '#fff9e6'; // Neon white office light
                    ctx.fillRect(x + 1, y, stripeW - 2, 10);
                } else if (rand < 0.32) {
                    ctx.fillStyle = '#45aaf2'; // Sky reflection
                    ctx.fillRect(x + 1, y, stripeW - 2, 12);
                } else if (rand < 0.35) {
                    ctx.fillStyle = '#ff4757'; // Red alert/warning beacon inside
                    ctx.fillRect(x + 1, y, stripeW - 2, 10);
                }
            }
        }

        // Fake glass sheen / gradient diagonal reflections
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(160, 0);
        ctx.lineTo(210, 0);
        ctx.lineTo(0, 100);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(80, H);
        ctx.lineTo(W, H - 80);
        ctx.lineTo(W, H - 50);
        ctx.lineTo(110, H);
        ctx.closePath();
        ctx.fill();
    },

    drawShopFrontFacade(ctx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = '#f5cd79';
        ctx.fillRect(0, 0, W, H);

        // Add subtle procedural noise (T-261)
        this.addFacadeNoise(ctx, W, H, 0.08, 0.05);

        // Upper floors: Office windows
        const windowW = 18;
        const windowH = 26;
        for (let y = 20; y < 140; y += 50) {
            for (let x = 20; x < W; x += 40) {
                const rand = Math.random();
                let glassColor = '#4b6584';
                let lightColor = null;

                if (rand < 0.15) {
                    glassColor = '#1e272e'; // Dark/closed window
                } else if (rand < 0.30) {
                    lightColor = '#fed330'; // Golden yellow light
                } else if (rand < 0.40) {
                    lightColor = '#f39c12'; // Warm orange light
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);

                ctx.strokeStyle = '#f1f2f6';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (lightColor) {
                    ctx.fillStyle = lightColor;
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                }
            }
        }

        // Storefront awning (striped retro style)
        const awningY = 150;
        const awningH = 15;
        ctx.fillStyle = '#eb4d4b';
        ctx.fillRect(5, awningY, W - 10, awningH);

        ctx.fillStyle = '#ffffff';
        for (let x = 10; x < W - 10; x += 20) {
            ctx.fillRect(x, awningY, 10, awningH);
        }

        // Awning dropshadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, awningY + awningH, W, 4);

        // Ground floor: Storefront display windows
        const groundY = 175;
        const groundH = 81;

        for (let x = 12; x < W; x += 80) {
            const glassW = 68;
            const glassH = groundH - 12;
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(x, groundY, glassW, glassH);

            ctx.strokeStyle = '#718093';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, groundY, glassW, glassH);

            // Illuminated interior glow
            const grad = ctx.createLinearGradient(0, groundY + 20, 0, groundY + glassH);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(255,255,255,0.15)');
            ctx.fillStyle = grad;
            ctx.fillRect(x + 2, groundY + 2, glassW - 4, glassH - 4);
        }
    },

    drawShopSideFacade(ctx) {
        const W = 256;
        const H = 256;

        ctx.fillStyle = '#f5cd79';
        ctx.fillRect(0, 0, W, H);

        // Add subtle procedural noise (T-261)
        this.addFacadeNoise(ctx, W, H, 0.08, 0.05);

        // Regular upper-floor windows on shop sides
        const windowW = 18;
        const windowH = 26;
        for (let y = 20; y < H - 40; y += 50) {
            for (let x = 20; x < W; x += 40) {
                const rand = Math.random();
                let glassColor = '#4b6584';
                let lightColor = null;

                if (rand < 0.15) {
                    glassColor = '#1e272e'; // Dark/closed window
                } else if (rand < 0.30) {
                    lightColor = '#fed330'; // Golden yellow light
                } else if (rand < 0.40) {
                    lightColor = '#f39c12'; // Warm orange light
                }

                ctx.fillStyle = glassColor;
                ctx.fillRect(x, y, windowW, windowH);

                ctx.strokeStyle = '#f1f2f6';
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
