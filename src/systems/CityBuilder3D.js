/**
 * CityBuilder3D — buildings, sidewalks, trees, and billboards.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WorldGrid } from '../world/WorldGrid.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { FacadeGenerator } from './FacadeGenerator.js';
import { createPropAt } from './PropFactory.js';
import { createTreeAt, plantHash } from './TreeFactory.js';
import { addContactShadow } from './ContactShadow.js';
import { bakeStaticInstances } from './StaticInstancer.js';

/** Inset from block outer edge onto sidewalk (2D px). */
export const LAMP_EDGE_INSET = 30;
/** Target spacing along a block edge (2D px) — corners + even steps. */
export const LAMP_EDGE_SPACING = 220;
/** Min 3D distance between a tree/prop and a lamp. */
const PROP_LAMP_CLEARANCE = 2.5;

/**
 * Rim light on building edges.
 *
 * Each archetype already outlined itself, but in a dark warm brown keyed to its
 * own brick/stone — which at night is indistinguishable from the black behind
 * it, so unlit facades collapsed into flat silhouettes with no depth. A single
 * cool, dim value instead reads as the sky/street ambient catching the corner:
 * it separates the mass from the background without lifting the overall
 * exposure or breaking the noir mood.
 */
export const BUILDING_RIM_EDGE = 0x6b727c;

/**
 * Wall base colors. Archetypes used to be differentiated by saturated brick/
 * sandstone/cream hues (0x9c4a3a etc.) — after the night grading's 16% chroma
 * survival, that still read as a warm mauve tint at odds with every other
 * chilled-out surface in the scene (measured: roof frac(R>B) 0.88 vs ref
 * 0.04). Differentiate by VALUE instead, with a slight cool bias (B >= R) to
 * match the rest of the palette. This is a color-space fix, independent of
 * the "night desat 0.84 + silver tint" grading decision (STATUS.md) — it
 * changes what goes INTO the grading, not the grading itself.
 */
export const BUILDING_ALBEDO = {
    residential: 0x5f6163,
    shop: 0x9a9b9c,
    skyscraperTiers: [0x8d9094, 0x84878b, 0x7b7e82, 0x6f7276],
};

/**
 * Roof clutter (HVAC, masts, vents, billboard frames) repeats on every building
 * with identical parameters, but each call used to allocate its own material.
 * Distinct material instances cannot share an instanced batch, so those hundreds
 * of small meshes stayed hundreds of separate draw calls. Cache by key — the
 * same trick PropFactory already uses for street furniture.
 */
const _buildingMatCache = new Map();
function sharedBuildingMat(key, factory) {
    let mat = _buildingMatCache.get(key);
    if (!mat) {
        mat = factory();
        _buildingMatCache.set(key, mat);
    }
    return mat;
}

/**
 * Per-block plant slots (2D px offsets from block center).
 * Corners → taller trees; mid-edges → shrubs/hedges; quarters → mixed.
 * Type picked deterministically from `kinds` via plantHash(r,c,slot).
 */
export const TREE_SLOT_DEFS = [
    // Corners
    { ox: -170, oz: -170, kinds: ['oak', 'pine', 'birch'] },
    { ox: 170, oz: -170, kinds: ['pine', 'oak', 'round'] },
    { ox: -170, oz: 170, kinds: ['round', 'birch', 'oak'] },
    { ox: 170, oz: 170, kinds: ['birch', 'pine', 'oak'] },
    // Mid-edges
    { ox: -170, oz: 0, kinds: ['hedge', 'tallBush', 'bush'] },
    { ox: 170, oz: 0, kinds: ['bush', 'hedge', 'tallBush'] },
    { ox: 0, oz: -170, kinds: ['tallBush', 'bush', 'round'] },
    { ox: 0, oz: 170, kinds: ['bush', 'tallBush', 'hedge'] },
    // Quarter curb — denser shrubs between corner and mid
    { ox: -170, oz: -85, kinds: ['bush', 'hedge'] },
    { ox: -170, oz: 85, kinds: ['hedge', 'bush'] },
    { ox: 170, oz: -85, kinds: ['bush', 'tallBush'] },
    { ox: 170, oz: 85, kinds: ['tallBush', 'bush'] },
    { ox: -85, oz: -170, kinds: ['hedge', 'bush'] },
    { ox: 85, oz: -170, kinds: ['bush', 'hedge'] },
    { ox: -85, oz: 170, kinds: ['tallBush', 'bush'] },
    { ox: 85, oz: 170, kinds: ['bush', 'hedge'] }
];

// Set once by RenderSystem3D after setupEnvironment() — see the identical note in
// NPCModelFactory.js.
let _envMap = null;
export function setSharedEnvironment(envMap) {
    _envMap = envMap;
}

export const CityBuilder3D = {
    buildCity(renderSystem) {
        const SF = WorldMetrics.SCALE_FACTOR;
        // Removed groundPlane and asphaltPlane to allow 2D tilemap to show through

        renderSystem.buildings = [];
        const shops = [];

        // Three ground planes need three separated values, or the night grading
        // (desat 0.84 + tint) collapses them into one grey and the curb line dies.
        // Asphalt sits near 0x22; sidewalk goes lighter and the building pad darker
        // so street → kerb → building base reads as distinct steps, not a gradient.
        // The sidewalk is the plane lamps stand on, so it is the one that blows out
        // first — 0xa39d92 pushed the kerb into bloom under every lamp. Most of the
        // separation is carried by dropping the building pad instead.
        const sidewalkMat = new THREE.MeshStandardMaterial({
            color: 0x969084,
            roughness: 0.95,
            metalness: 0.0,
            envMapIntensity: 0.15
        });
        const buildingZoneMat = new THREE.MeshStandardMaterial({
            color: 0x55504a,
            roughness: 0.95,
            metalness: 0.0,
            envMapIntensity: 0.15
        });
        // Pin envMap so envMapIntensity above is actually read at render time.
        if (_envMap) {
            sidewalkMat.envMap = _envMap;
            buildingZoneMat.envMap = _envMap;
        }

        // Sidewalk + building-zone pads are static and share one material each —
        // merge all 9 blocks into a single mesh per material instead of 18 draw calls.
        const sidewalkGeoms = [];
        const buildingZoneGeoms = [];

        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = (b.x + b.w / 2) * SF;
                const posZ = (b.y + b.h / 2) * SF;

                const swGeom = new THREE.BoxGeometry(b.w * SF, WorldMetrics.SIDEWALK_HEIGHT, b.h * SF);
                swGeom.translate(posX, WorldMetrics.SIDEWALK_HEIGHT / 2, posZ);
                sidewalkGeoms.push(swGeom);

                const bzGeom = new THREE.BoxGeometry(300 * SF, 0.05, 300 * SF);
                bzGeom.translate(posX, WorldMetrics.SIDEWALK_HEIGHT + 0.025, posZ);
                buildingZoneGeoms.push(bzGeom);

                const pattern = (r + c) % 3;
                if (pattern === 0) {
                    this.createBuilding(renderSystem, { type: 'skyscraper', x: posX, z: posZ, height: 380 * SF, width: 120 * SF, depth: 120 * SF });
                    const s1 = this.createBuilding(renderSystem, { type: 'shop', x: posX - 80 * SF, z: posZ - 80 * SF, height: 50 * SF, width: 80 * SF, depth: 80 * SF });
                    const s2 = this.createBuilding(renderSystem, { type: 'shop', x: posX + 80 * SF, z: posZ + 80 * SF, height: 50 * SF, width: 80 * SF, depth: 80 * SF });
                    shops.push({ group: s1, w: 80 * SF, d: 80 * SF, h: 50 * SF });
                    shops.push({ group: s2, w: 80 * SF, d: 80 * SF, h: 50 * SF });
                } else if (pattern === 1) {
                    this.createBuilding(renderSystem, { type: 'residential', x: posX - 60 * SF, z: posZ, height: 180 * SF, width: 120 * SF, depth: 200 * SF });
                    this.createBuilding(renderSystem, { type: 'residential', x: posX + 60 * SF, z: posZ + 50 * SF, height: 140 * SF, width: 100 * SF, depth: 100 * SF });
                } else {
                    this.createBuilding(renderSystem, { type: 'residential', x: posX, z: posZ - 50 * SF, height: 200 * SF, width: 180 * SF, depth: 120 * SF });
                    const s1 = this.createBuilding(renderSystem, { type: 'shop', x: posX - 80 * SF, z: posZ + 80 * SF, height: 60 * SF, width: 80 * SF, depth: 80 * SF });
                    const s2 = this.createBuilding(renderSystem, { type: 'shop', x: posX + 80 * SF, z: posZ + 80 * SF, height: 45 * SF, width: 80 * SF, depth: 80 * SF });
                    shops.push({ group: s1, w: 80 * SF, d: 80 * SF, h: 60 * SF });
                    shops.push({ group: s2, w: 80 * SF, d: 80 * SF, h: 45 * SF });
                }
            }
        }

        const swMesh = new THREE.Mesh(mergeGeometries(sidewalkGeoms), sidewalkMat);
        swMesh.receiveShadow = true;
        renderSystem.scene.add(swMesh);
        renderSystem.sidewalks = [swMesh];

        const bzMesh = new THREE.Mesh(mergeGeometries(buildingZoneGeoms), buildingZoneMat);
        bzMesh.receiveShadow = true;
        renderSystem.scene.add(bzMesh);
        renderSystem.buildingZones = [bzMesh];

        renderSystem.trees = [];
        const lampSpots = this.collectLampSpots(SF);
        for (const spot of this.collectTreeSpots(SF)) {
            if (!this._clearOfLamps(spot.x, spot.z, lampSpots)) continue;
            this.createTree(renderSystem, spot.type, spot.x, spot.z, spot.rot, spot.seed);
        }

        this.placeSidewalkProps(renderSystem);

        renderSystem.billboards = [];
        if (shops.length >= 2) {
            shops.sort(() => Math.random() - 0.5);
            this.addBillboard(renderSystem, shops[0].group, shops[0].w, shops[0].d, shops[0].h);
            this.addBillboard(renderSystem, shops[1].group, shops[1].w, shops[1].d, shops[1].h);
        }

        // Trees and street furniture never move, and between them accounted for
        // roughly half of all draw calls. Collapse them into one InstancedMesh
        // per (geometry, material) pair. The arrays stay populated as data — only
        // the scene graph is flattened.
        // Buildings join in for their roof clutter, which now shares materials.
        // Their bodies use per-face material arrays and are skipped by the baker,
        // so those few dozen draws stay — the win here is the hundreds of small
        // HVAC/mast/vent meshes riding on them.
        renderSystem.staticInstances = bakeStaticInstances(
            renderSystem.scene,
            [...renderSystem.trees, ...renderSystem.props, ...renderSystem.buildings]
        );
    },

    /**
     * Lamps + street furniture: all deterministic (roles per block pattern).
     */
    placeSidewalkProps(renderSystem) {
        const SF = WorldMetrics.SCALE_FACTOR;
        renderSystem.props = [];
        renderSystem.lampLightSpots = [];

        const lampSpots = this.collectLampSpots(SF);
        for (const spot of lampSpots) {
            this._placeProp(renderSystem, 'lampPost', spot.x, spot.z, spot.rot);
        }

        for (const spot of this.collectStreetPropSpots(SF)) {
            if (!this._clearOfLamps(spot.x, spot.z, lampSpots)) continue;
            this._placeProp(renderSystem, spot.type, spot.x, spot.z, spot.rot);
        }
    },

    _clearOfLamps(x, z, lampSpots) {
        return lampSpots.every(lamp => Math.hypot(x - lamp.x, z - lamp.z) >= PROP_LAMP_CLEARANCE);
    },

    /**
     * Deterministic plant positions for every block sidewalk ring.
     * @param {number} SF
     * @returns {{ x: number, z: number, type: string, rot: number, seed: number }[]}
     */
    collectTreeSpots(SF) {
        const spots = [];
        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = (b.x + b.w / 2) * SF;
                const posZ = (b.y + b.h / 2) * SF;

                TREE_SLOT_DEFS.forEach((def, slot) => {
                    // Skip ~1/5 of quarter slots for breathing room (still deterministic)
                    const h = plantHash(r, c, slot);
                    if (slot >= 8 && h % 5 === 0) return;

                    const type = def.kinds[h % def.kinds.length];
                    const rot = ((h >>> 3) % 4) * (Math.PI / 2);
                    spots.push({
                        x: posX + def.ox * SF,
                        z: posZ + def.oz * SF,
                        type,
                        rot,
                        seed: h
                    });
                });
            }
        }
        return spots;
    },

    /**
     * Deterministic benches / trash cans / hydrants / kiosks per block.
     * Bench back faces the building; seat looks toward the street.
     * @param {number} SF
     * @returns {{ x: number, z: number, type: string, rot: number }[]}
     */
    collectStreetPropSpots(SF) {
        const spots = [];

        // Bench: local +Z is sitting direction (back is local -Z)
        const benchNS = [
            { ox: 0, oz: -185, rot: Math.PI }, // north curb → face street (-Z)
            { ox: 0, oz: 185, rot: 0 }         // south curb → face street (+Z)
        ];
        const benchEW = [
            { ox: -185, oz: 0, rot: Math.PI / 2 },  // west → street (-X)
            { ox: 185, oz: 0, rot: -Math.PI / 2 }   // east → street (+X)
        ];

        const trashDiagA = [
            { ox: -195, oz: -175 },
            { ox: 195, oz: 175 }
        ];
        const trashDiagB = [
            { ox: 195, oz: -175 },
            { ox: -195, oz: 175 }
        ];

        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const posX = (b.x + b.w / 2) * SF;
                const posZ = (b.y + b.h / 2) * SF;
                const pattern = (r + c) % 4;

                const benches = pattern % 2 === 0 ? benchNS : benchEW;
                for (const bench of benches) {
                    spots.push({
                        x: posX + bench.ox * SF,
                        z: posZ + bench.oz * SF,
                        type: 'bench',
                        rot: bench.rot
                    });
                }

                const trash = pattern < 2 ? trashDiagA : trashDiagB;
                for (const t of trash) {
                    spots.push({
                        x: posX + t.ox * SF,
                        z: posZ + t.oz * SF,
                        type: 'trashCan',
                        rot: 0
                    });
                }

                // One hydrant on a free mid-side (not occupied by benches)
                const hydrant = pattern % 2 === 0
                    ? { ox: -200, oz: 70, rot: Math.PI / 2 }
                    : { ox: 70, oz: -200, rot: 0 };
                spots.push({
                    x: posX + hydrant.ox * SF,
                    z: posZ + hydrant.oz * SF,
                    type: 'hydrant',
                    rot: hydrant.rot
                });

                // Sparse kiosks (~every 3rd block)
                if ((r * 3 + c) % 3 === 0) {
                    const kiosk = pattern < 2
                        ? { ox: 175, oz: 110, rot: -Math.PI / 2 }
                        : { ox: -175, oz: -110, rot: Math.PI / 2 };
                    spots.push({
                        x: posX + kiosk.ox * SF,
                        z: posZ + kiosk.oz * SF,
                        type: 'kiosk',
                        rot: kiosk.rot
                    });
                }
            }
        }

        return spots;
    },

    /**
     * Deterministic lamp world positions (3D xz) for every block edge.
     * @param {number} SF
     * @returns {{ x: number, z: number, rot: number }[]}
     */
    collectLampSpots(SF) {
        const spots = [];
        const seen = new Set();

        const add = (wx, wz, rot) => {
            const k = `${Math.round(wx)},${Math.round(wz)}`;
            if (seen.has(k)) return;
            seen.add(k);
            spots.push({ x: wx * SF, z: wz * SF, rot });
        };

        /** Place endpoints + even interior steps along an edge (2D px). */
        const placeEdge = (x0, z0, x1, z1, rot) => {
            const dx = x1 - x0;
            const dz = z1 - z0;
            const len = Math.hypot(dx, dz);
            const steps = Math.max(1, Math.round(len / LAMP_EDGE_SPACING));
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                add(x0 + dx * t, z0 + dz * t, rot);
            }
        };

        for (let r = 0; r < WorldGrid.GRID_ROWS; r++) {
            for (let c = 0; c < WorldGrid.GRID_COLS; c++) {
                const b = WorldGrid.getBlockBounds(r, c);
                const x0 = b.x + LAMP_EDGE_INSET;
                const x1 = b.x + b.w - LAMP_EDGE_INSET;
                const z0 = b.y + LAMP_EDGE_INSET;
                const z1 = b.y + b.h - LAMP_EDGE_INSET;

                // Arm local +X → rotate so globe faces outward toward the street
                placeEdge(x0, z0, x1, z0, Math.PI / 2);   // north → -Z
                placeEdge(x0, z1, x1, z1, -Math.PI / 2);  // south → +Z
                placeEdge(x0, z0, x0, z1, Math.PI);       // west  → -X
                placeEdge(x1, z0, x1, z1, 0);             // east  → +X
            }
        }

        return spots;
    },

    _placeProp(renderSystem, type, x, z, rot) {
        const prop = createPropAt(type, x, z, rot);
        renderSystem.scene.add(prop);
        renderSystem.props.push(prop);
        if (type === 'lampPost') {
            // Record where a light *would* go. The pool in RenderSystem3D picks the
            // nearest of these each frame; the post owns no light of its own.
            const off = prop.userData.lampLightOffset || { x: 0, y: 4.9, z: 0 };
            const cos = Math.cos(rot || 0);
            const sin = Math.sin(rot || 0);
            renderSystem.lampLightSpots.push({
                x: x + off.x * cos - off.z * sin,
                y: off.y,
                z: z + off.x * sin + off.z * cos
            });
        }
    },

    createBuilding(renderSystem, config) {
        const { type, x, z, height, width, depth } = config;
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        let roofY = height;
        let roofWidth = width;
        let roofDepth = depth;

        // Shared blob decal (NPCs/vehicles use the same helper) — reacts to
        // weather_change (rain) by offsetting/stretching to match the rain angle.
        addContactShadow(group, {
            width: width * 1.15,
            depth: depth * 1.15,
            y: WorldMetrics.SIDEWALK_HEIGHT + 0.005,
            opacity: 0.45
        });

        if (type === 'skyscraper') {
            // Art Deco "wedding cake": stacked setbacks, each smaller than the last
            const tiers = [
                { heightRatio: 0.38, scale: 1.00, color: BUILDING_ALBEDO.skyscraperTiers[0] },
                { heightRatio: 0.26, scale: 0.82, color: BUILDING_ALBEDO.skyscraperTiers[1] },
                { heightRatio: 0.20, scale: 0.64, color: BUILDING_ALBEDO.skyscraperTiers[2] },
                { heightRatio: 0.16, scale: 0.46, color: BUILDING_ALBEDO.skyscraperTiers[3] } // darker crown
            ];

            let yCursor = 0;
            tiers.forEach(tier => {
                const tierH = height * tier.heightRatio;
                const tierW = width * tier.scale;
                const tierD = depth * tier.scale;
                const geom = new THREE.BoxGeometry(tierW, tierH, tierD);
                const mats = this.getBuildingMaterials('skyscraper', tierW, tierH, tierD, tier.color);
                const mesh = new THREE.Mesh(geom, mats);
                mesh.position.y = yCursor + tierH / 2;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                group.add(mesh);

                const edges = new THREE.EdgesGeometry(geom);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: BUILDING_RIM_EDGE }));
                line.position.y = mesh.position.y;
                group.add(line);

                roofWidth = tierW;
                roofDepth = tierD;
                yCursor += tierH;
            });
            roofY = height;

        } else if (type === 'residential') {
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMats = this.getBuildingMaterials('residential', width, height, depth, BUILDING_ALBEDO.residential);
            const body = new THREE.Mesh(bodyGeom, bodyMats);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: BUILDING_RIM_EDGE }));
            line.position.y = height / 2;
            group.add(line);

        } else if (type === 'shop') {
            const bodyGeom = new THREE.BoxGeometry(width, height, depth);
            const bodyMats = this.getBuildingMaterials('shop', width, height, depth, BUILDING_ALBEDO.shop);
            const body = new THREE.Mesh(bodyGeom, bodyMats);
            body.position.y = height / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            const edges = new THREE.EdgesGeometry(bodyGeom);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: BUILDING_RIM_EDGE }));
            line.position.y = height / 2;
            group.add(line);
        }

        this.addHVACUnits(group, roofWidth, roofDepth, roofY);

        renderSystem.scene.add(group);
        renderSystem.buildings.push(group);
        return group;
    },

    getBuildingMaterials(type, width, height, depth, baseColor) {
        // No .envMap on topMat/bottomMat: they have no explicit envMapIntensity of
        // their own (T56 decides that), so pinning envMap here would swap the global
        // environmentIntensity for three's default of 1 instead — a brightness
        // regression, not a fix (verified by screenshot).
        const topMat = new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.8,
            metalness: 0.1
        });
        const bottomMat = topMat;

        let matX, matZ;

        if (type === 'skyscraper') {
            matX = this.createFaceMaterial('skyscraper', depth, height, baseColor);
            matZ = this.createFaceMaterial('skyscraper', width, height, baseColor);
            return [matX, matX, topMat, bottomMat, matZ, matZ];
        } else if (type === 'residential') {
            matX = this.createFaceMaterial('residential', depth, height, baseColor);
            matZ = this.createFaceMaterial('residential', width, height, baseColor);
            return [matX, matX, topMat, bottomMat, matZ, matZ];
        } else if (type === 'shop') {
            const matFront = this.createFaceMaterial('shop_front', width, height, baseColor);
            const matSide = this.createFaceMaterial('shop_side', depth, height, baseColor);
            return [matSide, matSide, topMat, bottomMat, matFront, matFront];
        }

        return [topMat, topMat, topMat, bottomMat, topMat, topMat];
    },

    createFaceMaterial(textureType, faceWidth, faceHeight, baseColor) {
        const originalTexture = FacadeGenerator.textures.get(textureType);
        if (!originalTexture) {
            return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.8, metalness: 0.1 });
        }
        const texture = originalTexture.clone();
        const emOriginal = FacadeGenerator.emissiveTextures.get(textureType);
        const emissiveMap = emOriginal ? emOriginal.clone() : null;

        const repeatY = (textureType === 'shop_front' || textureType === 'shop_side') ? 1 : faceHeight / 5.0;
        const repeatX = faceWidth / 5.0;
        texture.repeat.set(repeatX, repeatY);
        if (emissiveMap) {
            emissiveMap.repeat.set(repeatX, repeatY);
        }

        const color = new THREE.Color(baseColor);
        const tint = 0.95 + Math.random() * 0.1;
        color.multiplyScalar(tint);

        const faceMat = new THREE.MeshStandardMaterial({
            map: texture,
            color: color,
            roughness: 0.8,
            metalness: textureType === 'skyscraper' ? 0.08 : 0.05,
            // Window-only emissive map (black elsewhere) — gentle glow, no bloom needed
            emissive: 0xffffff,
            emissiveMap: emissiveMap,
            emissiveIntensity: emissiveMap ? 0.4 : 0,
            envMapIntensity: 0.35
        });
        if (_envMap) faceMat.envMap = _envMap;
        return faceMat;
    },

    addHVACUnits(group, roofWidth, roofDepth, roofY) {
        if (Math.random() > 0.4) return;

        const sizes = [
            { w: 1.5, h: 0.8, d: 1.2 },
            { w: 1.0, h: 0.6, d: 1.0 },
            { w: 2.2, h: 1.0, d: 1.6 }
        ];

        const count = Math.floor(Math.random() * 3) + 1;
        const hvacMat = sharedBuildingMat('hvac', () => new THREE.MeshStandardMaterial({ color: 0x7f8c8d, roughness: 0.5, metalness: 0.6 }));
        const hvacEdgeMat = sharedBuildingMat('hvac-edge', () => new THREE.LineBasicMaterial({ color: 0x2c3e50 }));

        for (let i = 0; i < count; i++) {
            const size = sizes[Math.floor(Math.random() * sizes.length)];
            const geom = new THREE.BoxGeometry(size.w, size.h, size.d);
            const mesh = new THREE.Mesh(geom, hvacMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const marginX = roofWidth * 0.15 + size.w / 2;
            const marginZ = roofDepth * 0.15 + size.d / 2;

            const rangeX = Math.max(0, roofWidth - marginX * 2);
            const rangeZ = Math.max(0, roofDepth - marginZ * 2);

            const rx = rangeX > 0 ? (Math.random() - 0.5) * rangeX : 0;
            const rz = rangeZ > 0 ? (Math.random() - 0.5) * rangeZ : 0;

            mesh.position.set(rx, roofY + size.h / 2, rz);
            group.add(mesh);

            const edges = new THREE.EdgesGeometry(geom);
            const line = new THREE.LineSegments(edges, hvacEdgeMat);
            line.position.copy(mesh.position);
            group.add(line);
        }

        if (Math.random() < 0.35) {
            const isAntenna = Math.random() < 0.5;
            if (isAntenna) {
                const mastGeom = new THREE.CylinderGeometry(0.1, 0.15, 4.0, 4);
                const mastMat = sharedBuildingMat('mast', () => new THREE.MeshStandardMaterial({ color: 0xdcdde1, metalness: 0.8, roughness: 0.2 }));
                const mast = new THREE.Mesh(mastGeom, mastMat);
                mast.castShadow = true;
                mast.receiveShadow = true;

                const rx = (Math.random() - 0.5) * roofWidth * 0.4;
                const rz = (Math.random() - 0.5) * roofDepth * 0.4;
                mast.position.set(rx, roofY + 2.0, rz);
                group.add(mast);

                const beaconGeom = new THREE.BoxGeometry(0.25, 0.25, 0.25);
                const beaconMat = sharedBuildingMat('beacon', () => new THREE.MeshBasicMaterial({ color: 0xff4757 }));
                const beacon = new THREE.Mesh(beaconGeom, beaconMat);
                beacon.position.set(rx, roofY + 4.125, rz);
                group.add(beacon);
            } else {
                const shaftGeom = new THREE.BoxGeometry(2.5, 3.0, 2.5);
                const shaftMat = sharedBuildingMat('shaft', () => new THREE.MeshStandardMaterial({ color: 0x718093, roughness: 0.9, metalness: 0.1 }));
                const shaft = new THREE.Mesh(shaftGeom, shaftMat);
                shaft.castShadow = true;
                shaft.receiveShadow = true;

                const rx = (Math.random() - 0.5) * roofWidth * 0.4;
                const rz = (Math.random() - 0.5) * roofDepth * 0.4;
                shaft.position.set(rx, roofY + 1.5, rz);
                group.add(shaft);

                const ventGeom = new THREE.BoxGeometry(0.3, 1.2, 0.8);
                const ventMat = sharedBuildingMat('vent', () => new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.5 }));
                const vent = new THREE.Mesh(ventGeom, ventMat);
                vent.position.set(rx + 1.25, roofY + 1.0, rz);
                group.add(vent);

                const edges = new THREE.EdgesGeometry(shaftGeom);
                const line = new THREE.LineSegments(edges, hvacEdgeMat);
                line.position.copy(shaft.position);
                group.add(line);
            }
        }
    },

    addBillboard(renderSystem, group, roofWidth, roofDepth, roofY) {
        const billboardGroup = new THREE.Group();

        const legGeom = new THREE.BoxGeometry(0.2, 2.0, 0.2);
        const legMat = sharedBuildingMat('leg', () => new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.5 }));
        const legEdgeMat = sharedBuildingMat('leg-edge', () => new THREE.LineBasicMaterial({ color: 0x111111 }));

        const leftLeg = new THREE.Mesh(legGeom, legMat);
        leftLeg.position.set(-1.5, 1.0, 0);
        leftLeg.castShadow = true;
        leftLeg.receiveShadow = true;
        billboardGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeom, legMat);
        rightLeg.position.set(1.5, 1.0, 0);
        rightLeg.castShadow = true;
        rightLeg.receiveShadow = true;
        billboardGroup.add(rightLeg);

        [leftLeg, rightLeg].forEach(leg => {
            const edges = new THREE.EdgesGeometry(legGeom);
            const line = new THREE.LineSegments(edges, legEdgeMat);
            line.position.copy(leg.position);
            billboardGroup.add(line);
        });

        const boardGeom = new THREE.BoxGeometry(5.0, 2.5, 0.3);
        const boardMat = sharedBuildingMat('board', () => new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8, metalness: 0.1 }));
        const board = new THREE.Mesh(boardGeom, boardMat);
        board.position.set(0, 2.5, 0);
        board.castShadow = true;
        board.receiveShadow = true;
        billboardGroup.add(board);

        const boardEdges = new THREE.EdgesGeometry(boardGeom);
        const boardLine = new THREE.LineSegments(boardEdges, legEdgeMat);
        boardLine.position.copy(board.position);
        billboardGroup.add(boardLine);

        const posterGeom = new THREE.PlaneGeometry(4.6, 2.1);
        // Neon is the only allowed period color accent
        const neonPosterColors = [0xff2d55, 0xffaa00, 0x00e5ff, 0xff0044];
        const randomColor = neonPosterColors[Math.floor(Math.random() * neonPosterColors.length)];
        const posterMat = new THREE.MeshStandardMaterial({
            color: randomColor,
            emissive: randomColor,
            emissiveIntensity: 0.45,
            roughness: 0.55,
            metalness: 0.15,
            side: THREE.DoubleSide
        });

        const poster = new THREE.Mesh(posterGeom, posterMat);
        poster.position.set(0, 2.5, 0.16);
        poster.castShadow = true;
        poster.receiveShadow = true;
        billboardGroup.add(poster);

        const posterEdges = new THREE.EdgesGeometry(posterGeom);
        const posterLine = new THREE.LineSegments(posterEdges, new THREE.LineBasicMaterial({ color: 0xffffff }));
        posterLine.position.copy(poster.position);
        billboardGroup.add(posterLine);

        billboardGroup.position.set(0, roofY, 0);

        const rotations = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        billboardGroup.rotation.y = rotations[Math.floor(Math.random() * rotations.length)];

        group.add(billboardGroup);
        renderSystem.billboards.push(billboardGroup);
    },

    createTree(renderSystem, sizeType, x, z, rotationY = 0, variantSeed = 0) {
        const group = createTreeAt(sizeType, x, z, rotationY, variantSeed);
        renderSystem.scene.add(group);
        renderSystem.trees.push(group);
        return group;
    }
};
