/**
 * SYSTEM PROCEDURALNYCH ELEWACJI (FacadeGenerator)
 * Generuje tekstury elewacji dla budynków przy użyciu Canvas2D i THREE.CanvasTexture.
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

    drawResidentialFacade(ctx) {
        const W = 256;
        const H = 256;

        // Tło elewacji (jasnoszary/beżowy)
        ctx.fillStyle = '#b2bec3';
        ctx.fillRect(0, 0, W, H);

        // Siatka okien
        const windowW = 20;
        const windowH = 30;
        const startX = 20;
        const startY = 20;
        const stepX = 40;
        const stepY = 60;

        for (let y = startY; y < H; y += stepY) {
            for (let x = startX; x < W; x += stepX) {
                // Rysuj okno
                ctx.fillStyle = '#2c3e50';
                ctx.fillRect(x, y, windowW, windowH);

                // Bevel/Ramka okna
                ctx.strokeStyle = '#dfe6e9';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                // Lived-in look: 15% szansy na zapalone światło (żółte)
                if (Math.random() < 0.15) {
                    ctx.fillStyle = '#fed330'; // Ciepły żółty
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                }
            }
        }
    },

    drawSkyscraperFacade(ctx) {
        const W = 256;
        const H = 256;

        // Tło wieżowca (bardzo ciemny szary/metal)
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(0, 0, W, H);

        // Pionowe pasy szkła (nowoczesna elewacja kurtynowa)
        const stripeW = 12;
        const stepX = 20;

        for (let x = 8; x < W; x += stepX) {
            ctx.fillStyle = '#1b2a4a'; // Głęboki granat/szkło
            ctx.fillRect(x, 0, stripeW, H);

            // Podziałki poziome okien wieżowca
            ctx.fillStyle = '#34495e';
            for (let y = 0; y < H; y += 40) {
                ctx.fillRect(x, y, stripeW, 2);
            }

            // Kilka losowych refleksów świetlnych w pionowych oknach
            for (let y = 15; y < H; y += 40) {
                if (Math.random() < 0.2) {
                    ctx.fillStyle = '#fed330'; // Zapalone światło w biurze
                    ctx.fillRect(x + 1, y, stripeW - 2, 10);
                } else if (Math.random() < 0.3) {
                    ctx.fillStyle = '#45aaf2'; // Odbicie nieba
                    ctx.fillRect(x + 1, y, stripeW - 2, 12);
                }
            }
        }

        // Skośny refleks świetlny na całej elewacji (imitacja odbicia słońca w szklanej fasadzie)
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

        // 1. Tło elewacji (ciepły piaskowy kolor pasujący do shop w RenderSystem3D)
        ctx.fillStyle = '#f5cd79';
        ctx.fillRect(0, 0, W, H);

        // 2. Piętro górne: Regularne mniejsze okna biurowe
        const windowW = 18;
        const windowH = 26;
        for (let y = 20; y < 140; y += 50) {
            for (let x = 20; x < W; x += 40) {
                ctx.fillStyle = '#4b6584'; // Ciemne szkło
                ctx.fillRect(x, y, windowW, windowH);

                // Ramka
                ctx.strokeStyle = '#f1f2f6';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                // Efekt życia
                if (Math.random() < 0.15) {
                    ctx.fillStyle = '#fed330';
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                }
            }
        }

        // 3. Pas rozdzielający (Gzyms / Markiza)
        // Czerwona markiza
        const awningY = 150;
        const awningH = 15;
        ctx.fillStyle = '#eb4d4b'; // Czerwony
        ctx.fillRect(5, awningY, W - 10, awningH);

        // Paski na markizie dla stylu retro makiety
        ctx.fillStyle = '#ffffff';
        for (let x = 10; x < W - 10; x += 20) {
            ctx.fillRect(x, awningY, 10, awningH);
        }

        // Ciemny cień pod markizą
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, awningY + awningH, W, 4);

        // 4. Parter: Witryny sklepowe
        const groundY = 175;
        const groundH = 81;

        // Bardzo ciemne szkło dla kontrastu
        for (let x = 12; x < W; x += 80) {
            // Szyba witryny
            const glassW = 68;
            const glassH = groundH - 12;
            ctx.fillStyle = '#1e272e';
            ctx.fillRect(x, groundY, glassW, glassH);

            // Podziałki metalowe (szprosy)
            ctx.strokeStyle = '#718093';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, groundY, glassW, glassH);

            // Środek (symulacja oświetlonego wnętrza sklepu na spodzie witryny)
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

        // Tło elewacji (boki sklepu - bez wielkich witryn, ale ten sam piaskowy kolor)
        ctx.fillStyle = '#f5cd79';
        ctx.fillRect(0, 0, W, H);

        // Regularne okna biurowe na całej wysokości bocznej ściany
        const windowW = 18;
        const windowH = 26;
        for (let y = 20; y < H - 40; y += 50) {
            for (let x = 20; x < W; x += 40) {
                ctx.fillStyle = '#4b6584';
                ctx.fillRect(x, y, windowW, windowH);

                ctx.strokeStyle = '#f1f2f6';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, windowW, windowH);

                if (Math.random() < 0.15) {
                    ctx.fillStyle = '#fed330';
                    ctx.fillRect(x + 2, y + 2, windowW - 4, windowH - 4);
                }
            }
        }
    }
};
