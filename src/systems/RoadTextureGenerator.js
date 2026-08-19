/**
 * RoadTextureGenerator — procedural road textures via Canvas2D + THREE.CanvasTexture.
 */
import * as THREE from 'three';

/**
 * Road paint values. Crosswalks were near-white (`rgba(240,242,245,0.9)`) and
 * became the brightest element in frame, pulling focus off the character under
 * the lamp — the lane dashes were toned to match so paint reads as one material.
 */
const CROSSWALK_PAINT = 'rgba(176, 178, 182, 0.72)';
const LANE_PAINT = 'rgba(168, 170, 174, 0.7)';

/**
 * Radius covering every lobe of a puddle, measured from the puddle origin.
 * @param {{ lobes?: { ox: number, oy: number, rx: number, ry: number }[] }} p
 */
function puddleExtent(p) {
    let max = 0;
    for (const lobe of (p.lobes || [])) {
        const reach = Math.hypot(lobe.ox, lobe.oy) + Math.max(lobe.rx, lobe.ry);
        if (reach > max) max = reach;
    }
    return max || 1;
}

/**
 * Fill the union of a puddle's lobes as ONE shape.
 *
 * The lobes exist to wobble the outline off a perfect circle. Filling each of
 * them with its own radial gradient instead stacked three ramps on top of each
 * other, and every lobe boundary showed up as a step — which is what made the
 * puddles read as concentric dark rings ("donuts") rather than water. The lobes
 * overlap heavily, so adding them to a single path and filling once with the
 * nonzero rule yields their union, painted by exactly one gradient.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ lobes?: { ox: number, oy: number, rx: number, ry: number, rot?: number }[] }} p
 */
function fillPuddleShape(ctx, p) {
    ctx.beginPath();
    for (const lobe of (p.lobes || [])) {
        ctx.ellipse(lobe.ox, lobe.oy, lobe.rx, lobe.ry, lobe.rot || 0, 0, Math.PI * 2);
    }
    ctx.fill();
}

export const RoadTextureGenerator = {
    textures: new Map(),
    roughnessTextures: new Map(),
    _wetness: 'clear',

    init() {
        if (this.textures.size > 0) return;
        this.textures.set('straight', this.createCanvasTexture('straight'));
        this.textures.set('intersection', this.createCanvasTexture('intersection'));
        this.textures.set('crosswalk', this.createCanvasTexture('crosswalk'));
        this.roughnessTextures.set('straight', this.createRoughnessTexture('straight'));
        this.roughnessTextures.set('intersection', this.createRoughnessTexture('intersection'));
        this.roughnessTextures.set('crosswalk', this.createRoughnessTexture('crosswalk'));
    },

    setWetness(weather, meshes) {
        const wetness = weather === 'rain' ? 'rain' : 'clear';
        this._wetness = wetness;
        if (this.textures.size > 0) {
            for (const type of ['straight', 'intersection', 'crosswalk']) {
                this._rebakeAlbedo(type);
                this._rebakeRoughness(type);
            }
        }
        if (meshes) {
            this.applyWetnessToMeshes(meshes);
        }
    },

    _wetPatchCount(type) {
        if (this._wetness === 'rain') {
            return type === 'straight' ? 2 : 1;
        }
        return type === 'straight' ? 1 : 0;
    },

    /** How many water puddles to stamp (rain only). Wear patches are separate. */
    _puddleCount(type) {
        if (this._wetness !== 'rain') return 0;
        if (type === 'straight') return 3;
        if (type === 'intersection') return 2;
        return 0;
    },

    /**
     * Material knobs — road stays mostly matte; puddle gloss comes from roughnessMap
     * (dark = shiny). Mild envMap so puddles can catch lamp/env highlights.
     */
    getSurfaceMaterialProps() {
        if (this._wetness === 'rain') {
            return {
                roughness: 0.92,
                metalness: 0.04,
                envMapIntensity: 0.55,
            };
        }
        return {
            roughness: 1.0,
            metalness: 0.0,
            envMapIntensity: 0,
        };
    },

    /**
     * Push wet/dry material params onto road meshes after texture rebake.
     * Skips transparent overlays (crosswalk stripes — asphalt gloss shows below).
     * @param {Iterable<{ material?: THREE.Material }>} meshes
     */
    applyWetnessToMeshes(meshes) {
        const props = this.getSurfaceMaterialProps();
        for (const mesh of meshes || []) {
            const mat = mesh?.material;
            if (!mat || mat.transparent) continue;
            mat.roughness = props.roughness;
            mat.metalness = props.metalness;
            mat.envMapIntensity = props.envMapIntensity;
            mat.needsUpdate = true;
        }
    },

    _rebakeAlbedo(type) {
        const texture = this.textures.get(type);
        if (!texture?.image) return;
        const patches = this.generateWetPatches(this._wetPatchCount(type), type);
        const puddles = this.generatePuddles(this._puddleCount(type), type);
        texture.userData = texture.userData || {};
        texture.userData.wetPatches = patches;
        texture.userData.puddles = puddles;

        const canvas = texture.image;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) {
            texture.needsUpdate = true;
            return;
        }

        if (type === 'crosswalk') {
            ctx.clearRect(0, 0, 512, 512);
            this.drawCrosswalk(ctx);
        } else {
            ctx.fillStyle = '#222428';
            ctx.fillRect(0, 0, 512, 512);
            this.addAsphaltNoise(ctx, 512, 512);

            if (type === 'straight') {
                this.drawStraightRoad(ctx, true);
                this.applyAsphaltDirt(ctx, false);
            } else if (type === 'intersection') {
                this.drawIntersection(ctx);
                this.applyCornerDirt(ctx);
            }

            this.addWetPatchesAlbedo(ctx, patches);
            this.addPuddlesAlbedo(ctx, puddles);
        }

        texture.needsUpdate = true;
    },

    _rebakeRoughness(type) {
        const albedo = this.textures.get(type);
        const texture = this.roughnessTextures.get(type);
        if (!texture?.image || !albedo) return;
        const patches = (albedo.userData && albedo.userData.wetPatches)
            || this.generateWetPatches(this._wetPatchCount(type), type);
        const puddles = (albedo.userData && albedo.userData.puddles)
            || this.generatePuddles(this._puddleCount(type), type);

        const canvas = texture.image;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return;

        this._fillRoughnessBase(ctx);
        this.addWetPatchesRoughness(ctx, patches);
        this.addPuddlesRoughness(ctx, puddles);
        // Lane paint last → stays matte even if a puddle overlaps the dash corridor
        this.addLanePaintRoughness(ctx, type);
        texture.needsUpdate = true;
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

    /**
     * Sparse road wear: potholes + wheel ruts (koleiny) — NOT water puddles.
     * Water uses generatePuddles(). Spaced so wear marks don't merge.
     * @param {number} [_count] ignored — layout is type-driven
     * @param {string} [type]
     */
    generateWetPatches(_count = 3, type = 'straight') {
        const rain = this._wetness === 'rain';
        const patches = [];
        /** @type {{ x: number, y: number, r: number }[]} */
        const placed = [];

        const farEnough = (x, y, radius) => {
            const pad = rain ? 56 : 48;
            for (const p of placed) {
                const dx = p.x - x;
                const dy = p.y - y;
                const min = p.r + radius + pad;
                if (dx * dx + dy * dy < min * min) return false;
            }
            return true;
        };

        const commit = (patch, radius) => {
            placed.push({ x: patch.x, y: patch.y, r: radius });
            patches.push(patch);
        };

        const makePothole = (x, y) => {
            const scale = rain ? 1.0 : 0.75;
            const rx = (11 + Math.random() * 10) * scale;
            const ry = (9 + Math.random() * 8) * scale;
            const lobes = [
                { ox: 0, oy: 0, rx, ry, rot: Math.random() * Math.PI },
                {
                    ox: (Math.random() - 0.5) * rx * 0.55,
                    oy: (Math.random() - 0.5) * ry * 0.55,
                    rx: rx * (0.55 + Math.random() * 0.25),
                    ry: ry * (0.5 + Math.random() * 0.25),
                    rot: Math.random() * Math.PI,
                },
            ];
            return {
                kind: 'pothole',
                x,
                y,
                rot: Math.random() * Math.PI,
                intensity: 0.65 + Math.random() * 0.35,
                lobes,
            };
        };

        /** Long thin wheel track along travel axis (texture Y for straight roads). */
        const makeRut = (x, y) => {
            const len = (rain ? 90 : 70) + Math.random() * 70;
            const half = len * 0.5;
            const w = 5 + Math.random() * 4;
            const wobble = (Math.random() - 0.5) * 0.1;
            const lobes = [
                { ox: 0, oy: 0, rx: w, ry: half, rot: wobble },
                {
                    ox: (Math.random() - 0.5) * 3,
                    oy: (Math.random() - 0.5) * 16,
                    rx: w * 0.85,
                    ry: half * (0.55 + Math.random() * 0.25),
                    rot: wobble + (Math.random() - 0.5) * 0.08,
                },
            ];
            return {
                kind: 'rut',
                x,
                y,
                rot: 0,
                intensity: 0.5 + Math.random() * 0.35,
                lobes,
            };
        };

        if (type === 'crosswalk') {
            return patches;
        }

        if (type === 'straight') {
            // One koleina (lane) + optional second; max 1 dziura — sparse like wear, not noise
            const rutLanes = rain
                ? [168 + Math.random() * 28, ...(Math.random() < 0.55 ? [318 + Math.random() * 28] : [])]
                : [170 + Math.random() * 25];
            for (const lx of rutLanes) {
                for (let attempt = 0; attempt < 8; attempt++) {
                    const y = 130 + Math.random() * 250;
                    const rut = makeRut(lx, y);
                    const span = Math.max(...rut.lobes.map((l) => l.ry)) + 8;
                    if (!farEnough(lx, y, span * 0.4)) continue;
                    commit(rut, span * 0.4);
                    break;
                }
            }
            const holes = rain ? 1 : 0;
            for (let i = 0; i < holes; i++) {
                for (let attempt = 0; attempt < 14; attempt++) {
                    const x = 90 + Math.random() * 330;
                    const y = 90 + Math.random() * 330;
                    if (Math.abs(x - 256) < 36) continue;
                    const hole = makePothole(x, y);
                    const r = Math.max(hole.lobes[0].rx, hole.lobes[0].ry);
                    if (!farEnough(x, y, r + 20)) continue;
                    commit(hole, r);
                    break;
                }
            }
            return patches;
        }

        // Intersection: at most one pothole, rarely a short rut
        if (rain) {
            for (let attempt = 0; attempt < 14; attempt++) {
                const x = 100 + Math.random() * 310;
                const y = 100 + Math.random() * 310;
                const hole = makePothole(x, y);
                const r = Math.max(hole.lobes[0].rx, hole.lobes[0].ry);
                if (!farEnough(x, y, r + 24)) continue;
                commit(hole, r);
                break;
            }
            if (Math.random() < 0.35) {
                for (let attempt = 0; attempt < 10; attempt++) {
                    const x = 140 + Math.random() * 230;
                    const y = 140 + Math.random() * 230;
                    const rut = makeRut(x, y);
                    rut.rot = Math.random() < 0.5 ? 0 : Math.PI / 2;
                    if (!farEnough(x, y, 48)) continue;
                    commit(rut, 48);
                    break;
                }
            }
        }
        return patches;
    },

    /**
     * Irregular water puddles (rain only). Separate from wear (pothole/rut).
     * Large, mostly round bodies with small lobe bumps for edge irregularity.
     * @param {number} count
     * @param {string} [type]
     */
    generatePuddles(count = 0, type = 'straight') {
        const puddles = [];
        if (this._wetness !== 'rain' || count <= 0 || type === 'crosswalk') {
            return puddles;
        }

        /** @type {{ x: number, y: number, r: number }[]} */
        const placed = [];

        const farEnough = (x, y, radius) => {
            for (const p of placed) {
                const dx = p.x - x;
                const dy = p.y - y;
                const min = p.r + radius + 28;
                if (dx * dx + dy * dy < min * min) return false;
            }
            return true;
        };

        const makePuddle = (x, y) => {
            // Large + nearly circular; small offset lobes = soft outline wobble
            const r = 32 + Math.random() * 36;
            const lobes = [
                {
                    ox: 0,
                    oy: 0,
                    rx: r,
                    ry: r * (0.88 + Math.random() * 0.12),
                    rot: Math.random() * Math.PI,
                },
                {
                    ox: (Math.random() - 0.5) * r * 0.22,
                    oy: (Math.random() - 0.5) * r * 0.22,
                    rx: r * (0.78 + Math.random() * 0.12),
                    ry: r * (0.76 + Math.random() * 0.12),
                    rot: Math.random() * Math.PI,
                },
                {
                    ox: (Math.random() - 0.5) * r * 0.38,
                    oy: (Math.random() - 0.5) * r * 0.38,
                    rx: r * (0.38 + Math.random() * 0.18),
                    ry: r * (0.36 + Math.random() * 0.18),
                    rot: Math.random() * Math.PI,
                },
            ];
            return {
                kind: 'puddle',
                x,
                y,
                rot: Math.random() * Math.PI,
                // Wide spread on purpose: a street where every puddle is equally
                // deep and glossy reads as a pattern. Most are shallow films, a
                // few hold real water.
                intensity: 0.5 + Math.random() * 0.5,
                lobes,
            };
        };

        const target = Math.max(0, count);
        for (let i = 0; i < target; i++) {
            for (let attempt = 0; attempt < 22; attempt++) {
                const x = 80 + Math.random() * 350;
                const y = 80 + Math.random() * 350;
                // Keep puddle centers clear of the dashed paint strip
                if (type === 'straight' && Math.abs(x - 256) < 40) continue;
                const puddle = makePuddle(x, y);
                const span = Math.max(puddle.lobes[0].rx, puddle.lobes[0].ry) + 10;
                if (!farEnough(x, y, span)) continue;
                placed.push({ x, y, r: span });
                puddles.push(puddle);
                break;
            }
        }
        return puddles;
    },

    createCanvasTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;
        const patches = this.generateWetPatches(this._wetPatchCount(type), type);
        const puddles = this.generatePuddles(this._puddleCount(type), type);

        if (ctx) {
            if (type === 'crosswalk') {
                // Transparent overlay: stripes only, underlying asphalt shows through
                ctx.clearRect(0, 0, 512, 512);
                this.drawCrosswalk(ctx);
            } else {
                ctx.fillStyle = '#222428';
                ctx.fillRect(0, 0, 512, 512);

                this.addAsphaltNoise(ctx, 512, 512);

                if (type === 'straight') {
                    this.drawStraightRoad(ctx, true);
                    this.applyAsphaltDirt(ctx, false); // curb dirt on left/right only
                } else if (type === 'intersection') {
                    this.drawIntersection(ctx);
                    // Corner gutter dirt continues the curb bands from straight roads
                    this.applyCornerDirt(ctx);
                }

                this.addWetPatchesAlbedo(ctx, patches);
                this.addPuddlesAlbedo(ctx, puddles);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // NearestFilter: crisp retro pixel look on mag
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.userData = texture.userData || {};
        texture.userData.wetPatches = patches;
        texture.userData.puddles = puddles;
        return texture;
    },

    createRoughnessTexture(type) {
        const albedo = this.getTexture(type);
        const patches = (albedo.userData && albedo.userData.wetPatches) || this.generateWetPatches(6, type);
        const puddles = (albedo.userData && albedo.userData.puddles)
            || this.generatePuddles(this._puddleCount(type), type);

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext ? canvas.getContext('2d') : null;

        if (ctx) {
            this._fillRoughnessBase(ctx);
            this.addWetPatchesRoughness(ctx, patches);
            this.addPuddlesRoughness(ctx, puddles);
            this.addLanePaintRoughness(ctx, type);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        return texture;
    },

    /** Shared roughness fill — matte asphalt; puddles paint glossy cores separately. */
    _fillRoughnessBase(ctx) {
        ctx.fillStyle = '#e6e6e6';
        ctx.fillRect(0, 0, 512, 512);

        const noiseCount = 180;
        for (let i = 0; i < noiseCount; i++) {
            const rx = Math.random() * 512;
            const ry = Math.random() * 512;
            const v = 200 + Math.floor(Math.random() * 40);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.beginPath();
            ctx.arc(rx, ry, 8 + Math.random() * 20, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    addWetPatchesAlbedo(ctx, patches) {
        ctx.save();
        for (const p of patches) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);
            const a = (p.intensity ?? 1) * 0.75;

            for (const lobe of (p.lobes || [])) {
                ctx.save();
                ctx.translate(lobe.ox, lobe.oy);
                ctx.rotate(lobe.rot || 0);
                const r = Math.max(lobe.rx, lobe.ry);
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);

                if (p.kind === 'rut') {
                    // Shallow wheel groove — elongated, moderate darkening
                    grad.addColorStop(0, `rgba(16, 18, 24, ${0.26 * a})`);
                    grad.addColorStop(0.35, `rgba(24, 28, 34, ${0.14 * a})`);
                    grad.addColorStop(0.75, `rgba(36, 40, 48, ${0.05 * a})`);
                    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                } else {
                    // Pothole: darker pit, soft worn rim (not a flat ink blot)
                    grad.addColorStop(0, `rgba(10, 12, 16, ${0.34 * a})`);
                    grad.addColorStop(0.4, `rgba(20, 24, 30, ${0.16 * a})`);
                    grad.addColorStop(0.75, `rgba(48, 52, 60, ${0.06 * a})`);
                    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                }

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(0, 0, lobe.rx, lobe.ry, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            ctx.restore();
        }
        ctx.restore();
    },

    /** Dark reflective water body — albedo only; gloss is in roughness map. */
    addPuddlesAlbedo(ctx, puddles) {
        if (!puddles?.length) return;
        ctx.save();
        for (const p of puddles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);
            const a = p.intensity ?? 1;
            const r = puddleExtent(p);

            // What makes a puddle read as water is the specular kick from the
            // roughness map, not a dark stain in the albedo. The old ramp also put
            // a *lighter* stop (48,56,68) outside a near-black core, so keep the
            // darkening subtle and strictly monotonic.
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, `rgba(14, 18, 26, ${0.34 * a})`);
            grad.addColorStop(0.55, `rgba(18, 23, 31, ${0.2 * a})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            fillPuddleShape(ctx, p);

            ctx.restore();
        }
        ctx.restore();
    },

    addWetPatchesRoughness(ctx, patches) {
        // Wear stays relatively matte — only puddles get mirror-like roughness.
        ctx.save();
        for (const p of patches) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);
            for (const lobe of (p.lobes || [])) {
                ctx.save();
                ctx.translate(lobe.ox, lobe.oy);
                ctx.rotate(lobe.rot || 0);
                const r = Math.max(lobe.rx, lobe.ry);
                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                grad.addColorStop(0, 'rgb(150, 150, 150)');
                grad.addColorStop(0.55, 'rgb(195, 195, 195)');
                grad.addColorStop(1, 'rgba(230, 230, 230, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.ellipse(0, 0, lobe.rx, lobe.ry, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();
        }
        ctx.restore();
    },

    /**
     * Near-black roughness inside puddle lobes → shiny water; asphalt stays matte.
     * (Three.js multiplies roughnessMap × material.roughness.)
     */
    addPuddlesRoughness(ctx, puddles) {
        if (!puddles?.length) return;
        ctx.save();
        for (const p of puddles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot || 0);

            const r = puddleExtent(p);
            // `intensity` used to drive the albedo only, so every puddle came out
            // equally mirror-like and the strongest ones read as a hot white flare.
            // Drive gloss from it too: shallow puddles get a broad soft sheen,
            // deep ones stay reflective, and a near-black core (roughness ~0.03)
            // is avoided entirely — that is what produced the blown specular.
            const a = p.intensity ?? 1;
            const dull = 1 - a;
            const core = Math.round(26 + dull * 70);
            const mid = Math.round(58 + dull * 70);
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, `rgb(${core}, ${core}, ${core})`);
            grad.addColorStop(0.55, `rgb(${mid}, ${mid}, ${mid})`);
            grad.addColorStop(0.85, 'rgb(140, 140, 140)');
            grad.addColorStop(1, 'rgba(230, 230, 230, 0)');
            ctx.fillStyle = grad;
            fillPuddleShape(ctx, p);

            ctx.restore();
        }
        ctx.restore();
    },

    /**
     * Force lane dashes (and zebra paint) to stay matte — paint must not specular-glint.
     * Drawn after puddles so overlapping water doesn't make the stripe shiny.
     */
    addLanePaintRoughness(ctx, type) {
        if (type === 'straight') {
            // Matches drawStraightRoad dash corridor (~x=256, width ~8 + soft pad)
            const margin = 92;
            const x0 = 246;
            const w = 20;
            ctx.fillStyle = '#f2f2f2';
            ctx.fillRect(x0, margin, w, 512 - margin * 2);
            return;
        }
        if (type === 'crosswalk') {
            // Entire overlay is paint — fully matte
            ctx.fillStyle = '#f2f2f2';
            ctx.fillRect(0, 0, 512, 512);
        }
    },

    addAsphaltNoise(ctx, width, height) {
        // Keep aggregate visible in rain — wet look is puddles, not smoothed dirt removal
        const blotchCount = 28;
        for (let i = 0; i < blotchCount; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            const rSize = 40 + Math.random() * 60;
            const isLight = Math.random() < 0.5;
            const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rSize);
            grad.addColorStop(0, isLight ? 'rgba(255, 255, 255, 0.022)' : 'rgba(10, 10, 15, 0.038)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
            ctx.fill();
        }

        const stoneCount = 700;
        for (let i = 0; i < stoneCount; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            const rSize = 1.0 + Math.random() * 2.0;
            const isLight = Math.random() < 0.4;
            ctx.fillStyle = isLight
                ? 'rgba(230, 230, 235, 0.1)'
                : 'rgba(5, 5, 10, 0.14)';
            ctx.beginPath();
            ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
            ctx.fill();
        }

        const pixelFrac = 0.07;
        const pixelCount = Math.round(width * height * pixelFrac);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        for (let i = 0; i < pixelCount; i++) {
            const rx = Math.random() * width;
            const ry = Math.random() * height;
            ctx.fillRect(rx, ry, 1, 1);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
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

        ctx.strokeStyle = LANE_PAINT;
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
        // Faint tire-wear arcs — kept subtle so they don't read as pasted shadows
        ctx.save();
        ctx.strokeStyle = 'rgba(5, 5, 8, 0.12)';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.arc(512, 512, 220, Math.PI * 1.05, Math.PI * 1.45);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 190, Math.PI * 0.05, Math.PI * 0.45);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(5, 5, 8, 0.08)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(180, 150);
        ctx.lineTo(180, 360);
        ctx.moveTo(196, 170);
        ctx.lineTo(196, 380);
        ctx.stroke();
        ctx.restore();

        // Zebras live on exit-road approaches (RoadBuilder3D), not inside the junction.
    },

    /**
     * Dark gutter dirt in the 4 corners — quarter-discs centered on the sidewalk
     * corners, with the exact same width (85px) and falloff as applyAsphaltDirt,
     * so the curb band continues seamlessly from straight tiles.
     */
    applyCornerDirt(ctx) {
        ctx.save();
        const R = 85; // must match dirtWidth in applyAsphaltDirt
        const corners = [[0, 0], [512, 0], [0, 512], [512, 512]];
        for (const [cx, cy] of corners) {
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
            grad.addColorStop(0, 'rgba(10, 10, 12, 0.85)');
            grad.addColorStop(0.35, 'rgba(10, 10, 12, 0.45)');
            grad.addColorStop(1, 'rgba(10, 10, 12, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        }
        ctx.restore();
    },

    drawCrosswalk(ctx) {
        const stripeCount = 5;
        const stripeW = 48;
        const gap = (512 - stripeCount * stripeW) / (stripeCount + 1);
        const stripeH = 280;
        const y = (512 - stripeH) / 2;

        for (let i = 0; i < stripeCount; i++) {
            const x = gap + i * (stripeW + gap);
            ctx.fillStyle = 'rgba(10, 10, 12, 0.4)';
            ctx.fillRect(x + 1, y + 1, stripeW, stripeH);
            // Worn, rain-dulled paint — bright enough to read as a crossing, dim
            // enough that the figure under a lamp stays the brightest thing in frame.
            ctx.fillStyle = CROSSWALK_PAINT;
            ctx.fillRect(x, y, stripeW, stripeH);
            // Paint wear: punch holes so the road below shows through
            for (let c = 0; c < 4; c++) {
                ctx.clearRect(
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
