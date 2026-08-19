import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RenderSystem3D, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD, ZOOM_LEVELS, DEFAULT_ZOOM_INDEX, STREET_LIGHT_POOL_SIZE } from './RenderSystem3D.js';
import { InputSystem } from '../input/InputManager.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { RetroFilmSettings } from './RetroFilmSettings.js';
import { TimeOfDaySettings } from './TimeOfDaySettings.js';
import { VehicleSystem } from './VehicleSystem.js';
import { EventBus } from '../core/EventBus.js';

// JSDOM has no WebGL — mock Three.js WebGLRenderer + PMREM
vi.mock('three', async () => {
    const original = await vi.importActual('three');
    return {
        ...original,
        WebGLRenderer: class {
            constructor() {
                this.setSize = vi.fn();
                this.setClearColor = vi.fn();
                this.render = vi.fn();
                this.setPixelRatio = vi.fn();
                this.shadowMap = {
                    enabled: false,
                    type: 0
                };
                this.toneMapping = 0;
                this.info = { autoReset: true };
            }
        },
        PMREMGenerator: class {
            constructor() {}
            fromScene() {
                return { texture: new original.Texture() };
            }
            dispose() {}
        }
    };
});

vi.mock('three/addons/postprocessing/EffectComposer.js', () => {
    return {
        EffectComposer: class {
            constructor(renderer) {
                this.renderer = renderer;
                this.passes = [];
            }
            addPass(pass) {
                this.passes.push(pass);
            }
            setSize(w, h) {}
            render() {
                if (this.renderer && typeof this.renderer.render === 'function') {
                    this.renderer.render();
                }
            }
        }
    };
});

vi.mock('three/addons/postprocessing/RenderPass.js', () => {
    return {
        RenderPass: class {
            constructor(scene, camera) {
                this.scene = scene;
                this.camera = camera;
            }
        }
    };
});

vi.mock('three/addons/postprocessing/ShaderPass.js', () => {
    return {
        ShaderPass: class {
            constructor(shader) {
                this.shader = shader;
                this.enabled = true;
                // Clone uniforms like Three.js ShaderPass
                this.uniforms = {};
                if (shader && shader.uniforms) {
                    for (const key of Object.keys(shader.uniforms)) {
                        this.uniforms[key] = { value: shader.uniforms[key].value };
                    }
                }
            }
        }
    };
});

vi.mock('three/addons/postprocessing/OutputPass.js', () => {
    return {
        OutputPass: class {
            constructor() {}
        }
    };
});

vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => {
    return {
        UnrealBloomPass: class {
            constructor(resolution, strength, radius, threshold) {
                this.resolution = resolution;
                this.strength = strength;
                this.radius = radius;
                this.threshold = threshold;
                this.enabled = true;
                this.setSize = vi.fn();
            }
        }
    };
});

vi.mock('three/addons/environments/RoomEnvironment.js', () => {
    return {
        RoomEnvironment: class {
            constructor() {}
        }
    };
});

vi.mock('../world/World.js', () => ({
    World: {
        getEntitiesByType: vi.fn().mockReturnValue([])
    }
}));

describe('RenderSystem3D', () => {
    let mockCanvas;
    let mockParent;
    const SF = WorldMetrics.SCALE_FACTOR;

    beforeEach(() => {
        vi.clearAllMocks();
        EventBus.clear();
        RetroFilmSettings.reset();
        TimeOfDaySettings.reset();
        VehicleSystem.controlledEntity = null;
        RenderSystem3D.lookAheadX = 0;
        RenderSystem3D.lookAheadZ = 0;

        mockParent = {
            clientWidth: 800,
            clientHeight: 600
        };
        
        mockCanvas = {
            parentElement: mockParent
        };
 
        vi.spyOn(document, 'getElementById').mockImplementation((id) => {
            if (id === 'gameCanvas3D') return mockCanvas;
            return null;
        });
    });

    it('should be a singleton object with required methods', () => {
        expect(RenderSystem3D).toBeDefined();
        expect(typeof RenderSystem3D.init).toBe('function');
        expect(typeof RenderSystem3D.update).toBe('function');
    });

    it('should initialize renderer, scene and camera correctly', () => {
        RenderSystem3D.init();

        expect(RenderSystem3D.renderer).toBeDefined();
        expect(RenderSystem3D.scene).toBeDefined();
        expect(RenderSystem3D.camera).toBeDefined();

        // Fog + post-processing + IBL environment (default TOD = night)
        expect(RenderSystem3D.scene.fog).toBeDefined();
        // Fog distances are scaled by the live zoom; normalise to read base values.
        RenderSystem3D.camera.zoom = 1;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBe(30);
        expect(RenderSystem3D.scene.fog.far).toBe(160);
        expect(RenderSystem3D.scene.environment).toBeDefined();
        expect(RenderSystem3D.composer).toBeDefined();
        expect(RenderSystem3D.ambientLight.intensity).toBeCloseTo(0.10);
        expect(RenderSystem3D._streetLightMult).toBeCloseTo(1.7);
        expect(RenderSystem3D.tiltShiftPass).toBeDefined();
        expect(RenderSystem3D.retroFilmPass).toBeDefined();
        expect(RenderSystem3D.retroFilmPass.uniforms.intensity).toBeDefined();
        expect(RenderSystem3D.retroFilmPass.enabled).toBe(true);
        expect(RenderSystem3D.bloomPass).toBeDefined();
        expect(RenderSystem3D.bloomPass.strength).toBeCloseTo(BLOOM_STRENGTH);
        expect(RenderSystem3D.bloomPass.radius).toBeCloseTo(BLOOM_RADIUS);
        expect(RenderSystem3D.bloomPass.threshold).toBeCloseTo(BLOOM_THRESHOLD);
        expect(RenderSystem3D.bloomPass.enabled).toBe(true);
        // Pipeline: Render → Bloom → TiltShift → RetroFilm → Output
        expect(RenderSystem3D.composer.passes.length).toBeGreaterThanOrEqual(5);

        expect(RenderSystem3D.groundPlane).toBeDefined();
        expect(RenderSystem3D.asphaltPlane).toBeDefined();
        // Merged into one draw call per material (was 9 individual meshes each)
        expect(RenderSystem3D.sidewalks.length).toBe(1);
        expect(RenderSystem3D.buildingZones.length).toBe(1);
        expect(RenderSystem3D.buildings.length).toBe(24); // cluster building count
        expect(RenderSystem3D.laneMarkings.length).toBeGreaterThan(0);
        expect(RenderSystem3D.zebras.length).toBeGreaterThan(0);
        expect(RenderSystem3D.box5u).toBeDefined();

        // Deterministic ring slots (corners + mids + quarters); lamp clearance may drop a few
        expect(RenderSystem3D.trees.length).toBeGreaterThanOrEqual(100);
        expect(RenderSystem3D.trees.length).toBeLessThanOrEqual(144);
        expect(RenderSystem3D.billboards.length).toBe(2);
        expect(RenderSystem3D.props.length).toBeGreaterThanOrEqual(70);
        // Deterministic lamps: 9 blocks × 8 edge samples (corners + mids)
        expect(RenderSystem3D.lampLightSpots.length).toBe(72);
        // ...but only a small fixed pool of them is ever a real PointLight.
        expect(RenderSystem3D.streetLights.length).toBe(STREET_LIGHT_POOL_SIZE);
        expect(RenderSystem3D.box5u.visible).toBe(false);
    });

    it('street light pool keeps a constant light count while following the player', () => {
        RenderSystem3D.init();
        const pool = RenderSystem3D.streetLights;
        const countLights = () => {
            let n = 0;
            RenderSystem3D.scene.traverse(o => { if (o.isPointLight) n++; });
            return n;
        };

        const before = countLights();
        RenderSystem3D.updateStreetLightPool(110, 110);
        const nearby = pool.map(l => l.position.clone());
        RenderSystem3D.updateStreetLightPool(260, 260);
        const after = countLights();

        // The pool moves; it never grows, shrinks or hides. three.js bakes
        // NUM_POINT_LIGHTS into the shader, so a changing count would recompile
        // every affected material mid-play — a visible hitch.
        expect(after).toBe(before);
        expect(pool.length).toBe(STREET_LIGHT_POOL_SIZE);
        expect(pool.every(l => l.visible)).toBe(true);
        // ...and it actually tracked the focus point rather than staying put.
        expect(pool.some((l, i) => !l.position.equals(nearby[i]))).toBe(true);
    });

    it('street light pool picks the nearest lamp spots without duplicates', () => {
        RenderSystem3D.init();
        RenderSystem3D.updateStreetLightPool(110, 110);
        const pool = RenderSystem3D.streetLights;

        const keys = pool.map(l => `${l.position.x.toFixed(3)},${l.position.z.toFixed(3)}`);
        expect(new Set(keys).size).toBe(keys.length);

        // Every chosen spot must be at least as close as any unchosen one.
        const chosen = new Set(keys);
        const dist = (p) => Math.hypot(p.x - 110, p.z - 110);
        const worstChosen = Math.max(...pool.map(l => dist(l.position)));
        const unchosen = RenderSystem3D.lampLightSpots
            .filter(s => !chosen.has(`${s.x.toFixed(3)},${s.z.toFixed(3)}`));
        expect(Math.min(...unchosen.map(dist))).toBeGreaterThanOrEqual(worstChosen - 1e-6);
    });

    it('should assign emissive maps to facade materials', () => {
        RenderSystem3D.init();

        const resBuilding = RenderSystem3D.createBuilding({
            type: 'residential', x: 300, z: 300, height: 20, width: 10, depth: 10
        });
        const mesh = resBuilding.children.find(c => c.isMesh && c.geometry.type === 'BoxGeometry');
        expect(mesh.material[0].emissiveMap).toBeDefined();
        expect(mesh.material[0].emissiveIntensity).toBeCloseTo(0.4);
        // Emissive map must not be the albedo (avoids glowing bricks / road bloom)
        expect(mesh.material[0].emissiveMap).not.toBe(mesh.material[0].map);
    });

    it('should use roughnessMap on road lane meshes', () => {
        RenderSystem3D.init();
        const lane = RenderSystem3D.laneMarkings[0];
        expect(lane.material.roughnessMap).toBeDefined();
        // Default weather is rain → matte road + puddle gloss via roughnessMap
        expect(lane.material.roughness).toBeCloseTo(0.92);
        expect(lane.material.metalness).toBeCloseTo(0.04);
        expect(lane.material.envMapIntensity).toBeCloseTo(0.55);
    });

    it('should dry road materials when weather switches to clear', () => {
        RenderSystem3D.init();
        const lane = RenderSystem3D.laneMarkings[0];
        expect(lane.material.envMapIntensity).toBeCloseTo(0.55);

        TimeOfDaySettings.applyWeather('clear');
        expect(lane.material.roughness).toBe(1);
        expect(lane.material.metalness).toBe(0);
        expect(lane.material.envMapIntensity).toBe(0);

        TimeOfDaySettings.applyWeather('rain');
        expect(lane.material.envMapIntensity).toBeCloseTo(0.55);
        expect(lane.material.metalness).toBeCloseTo(0.04);
    });

    it('should keep bloom pass before film grading with soft lamp glow settings', () => {
        RenderSystem3D.init();
        const passes = RenderSystem3D.composer.passes;
        const bloomIdx = passes.indexOf(RenderSystem3D.bloomPass);
        const tiltIdx = passes.indexOf(RenderSystem3D.tiltShiftPass);
        const filmIdx = passes.indexOf(RenderSystem3D.retroFilmPass);
        expect(bloomIdx).toBeGreaterThan(0);
        expect(bloomIdx).toBeLessThan(tiltIdx);
        expect(tiltIdx).toBeLessThan(filmIdx);
        expect(RenderSystem3D.bloomPass.strength).toBeLessThan(0.25);
        expect(RenderSystem3D.bloomPass.threshold).toBeGreaterThan(0.88);
    });

    it('should handle update cycles and sync camera', () => {
        RenderSystem3D.init();
        
        RenderSystem3D.update();

        // box5u motion function should have moved it
        expect(RenderSystem3D.box5u.position.x).not.toBe(RenderSystem3D.originX * SF);

        expect(RenderSystem3D.renderer.render).toHaveBeenCalled();
    });

    it('should sync retro film pass with settings while keeping pass enabled for grading', () => {
        RenderSystem3D.init();
        expect(RenderSystem3D.retroFilmPass.enabled).toBe(true);
        expect(RenderSystem3D.retroFilmPass.uniforms.sepia.value).toBeCloseTo(0);

        RetroFilmSettings.applyPreset('off');
        EventBus.emit('retro_settings_change', RetroFilmSettings.toJSON());

        expect(RenderSystem3D.retroFilmPass.enabled).toBe(true);
        expect(RenderSystem3D.retroFilmPass.uniforms.intensity.value).toBe(0);

        RetroFilmSettings.applyPreset('subtle');
        RenderSystem3D.applyRetroSettings();
        expect(RenderSystem3D.retroFilmPass.enabled).toBe(true);
        expect(RenderSystem3D.retroFilmPass.uniforms.vignette.value).toBeCloseTo(0.25);
    });

    it('should lerp lighting when time of day changes', () => {
        RenderSystem3D.init();
        expect(RenderSystem3D.ambientLight.intensity).toBeCloseTo(0.10); // night

        TimeOfDaySettings.applyPreset('dusk');
        expect(RenderSystem3D._todTo).toBeDefined();
        expect(RenderSystem3D._todT).toBe(0);

        // Halfway through 1.5s transition
        RenderSystem3D.updateTimeOfDay(0.75);
        expect(RenderSystem3D._todT).toBeCloseTo(0.5);
        expect(RenderSystem3D.ambientLight.intensity).toBeGreaterThan(0.10);
        expect(RenderSystem3D.ambientLight.intensity).toBeLessThan(0.42);

        // Finish transition
        RenderSystem3D.updateTimeOfDay(1.0);
        expect(RenderSystem3D._todTo).toBeNull();
        expect(RenderSystem3D.ambientLight.intensity).toBeCloseTo(0.42);
        RenderSystem3D.camera.zoom = 1;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBe(60);
        expect(RenderSystem3D._streetLightMult).toBeCloseTo(1.0);
    });

    it('should scale fog near/far with camera zoom', () => {
        RenderSystem3D.init();
        // night base: near 30, far 160 at zoom 1
        RenderSystem3D.camera.zoom = 1;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBe(30);
        expect(RenderSystem3D.scene.fog.far).toBe(160);

        RenderSystem3D.camera.zoom = 2;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBeCloseTo(31.5);
        expect(RenderSystem3D.scene.fog.far).toBeCloseTo(168);

        RenderSystem3D.camera.zoom = 0.5;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBeCloseTo(29.25);
        expect(RenderSystem3D.scene.fog.far).toBeCloseTo(156);
    });

    it('should create custom building types via createBuilding', () => {
        RenderSystem3D.init();
        const initialCount = RenderSystem3D.buildings.length;
        
        RenderSystem3D.createBuilding({ type: 'skyscraper', x: 200, z: 200, height: 40, width: 10, depth: 10 });
        expect(RenderSystem3D.buildings.length).toBe(initialCount + 1);
        
        const newBuilding = RenderSystem3D.buildings[RenderSystem3D.buildings.length - 1];
        expect(newBuilding.position.x).toBe(200);
        expect(newBuilding.position.z).toBe(200);
        
        // Skyscraper has sub-meshes (contact shadow, base, top setback)
        expect(newBuilding.children.length).toBeGreaterThan(2);
    });

    it('should assign materials with map textures to building components', () => {
        RenderSystem3D.init();
        
        const resBuilding = RenderSystem3D.createBuilding({ type: 'residential', x: 300, z: 300, height: 20, width: 10, depth: 10 });
        const mesh = resBuilding.children.find(c => c.isMesh && c.geometry.type === 'BoxGeometry');
        expect(mesh).toBeDefined();
        expect(Array.isArray(mesh.material)).toBe(true);
        expect(mesh.material.length).toBe(6);
        
        // Sides get procedural texture maps; top/bottom are solid color (no map)
        expect(mesh.material[0].map).toBeDefined(); // Side X+
        expect(mesh.material[1].map).toBeDefined(); // Side X-
        expect(mesh.material[2].map).toBeNull();    // Top (Roof)
        expect(mesh.material[3].map).toBeNull();    // Bottom (Ground)
        expect(mesh.material[4].map).toBeDefined(); // Side Z+
        expect(mesh.material[5].map).toBeDefined(); // Side Z-
    });

    it('should create trees and billboards with shadow options', () => {
        RenderSystem3D.init();

        const tree = RenderSystem3D.createTree('shrub', 100, 100);
        expect(tree).toBeDefined();
        expect(tree.position.x).toBe(100);
        expect(tree.position.z).toBe(100);
        expect(tree.position.y).toBeCloseTo(WorldMetrics.SIDEWALK_HEIGHT);
        
        const trunkMesh = tree.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');
        expect(trunkMesh).toBeDefined();
        expect(trunkMesh.castShadow).toBe(true);
        expect(trunkMesh.receiveShadow).toBe(true);

        const leafMesh = tree.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry');
        expect(leafMesh).toBeDefined();
        expect(leafMesh.castShadow).toBe(true);
        expect(leafMesh.receiveShadow).toBe(true);
    });

    it('should push camera focus ahead of a fast-moving controlled car (look-ahead)', () => {
        RenderSystem3D.init();

        VehicleSystem.controlledEntity = {
            type: 'car',
            transform: { x: 1000, y: 1000, angle: 0 },
            physics: { speed: 300 }
        };

        // Look-ahead lerps in gradually over many frames — subtle, not a snap.
        for (let i = 0; i < 200; i++) {
            RenderSystem3D.update();
        }

        expect(RenderSystem3D.lookAheadX).toBeGreaterThan(80);
        expect(RenderSystem3D.lookAheadX).toBeLessThan(95);
        expect(RenderSystem3D.lookAheadZ).toBeCloseTo(0, 1);

        const camPos = RenderSystem3D.camera.position;
        const carSceneX = 1000 * WorldMetrics.SCALE_FACTOR;
        // Camera keeps the fixed iso offset from the (look-ahead-shifted) focus point,
        // so with angle=0 the focus — and camera — moves further along +X than the car itself.
        expect(camPos.x).toBeGreaterThan(carSceneX + 1200 * WorldMetrics.SCALE_FACTOR * Math.cos(45 * Math.PI / 180) * Math.cos(35.264 * Math.PI / 180));
    });

    it('should not look ahead when the controlled car is stationary', () => {
        RenderSystem3D.init();

        VehicleSystem.controlledEntity = {
            type: 'car',
            transform: { x: 1000, y: 1000, angle: 0.7 },
            physics: { speed: 0 }
        };

        for (let i = 0; i < 30; i++) {
            RenderSystem3D.update();
        }

        expect(RenderSystem3D.lookAheadX).toBeCloseTo(0);
        expect(RenderSystem3D.lookAheadZ).toBeCloseTo(0);
    });

    it('should start at the default zoom step and cycle through Z', () => {
        RenderSystem3D.init();
        VehicleSystem.controlledEntity = null;

        expect(RenderSystem3D.zoomIndex).toBe(DEFAULT_ZOOM_INDEX);
        expect(RenderSystem3D.currentZoom).toBeCloseTo(ZOOM_LEVELS[DEFAULT_ZOOM_INDEX]);
        // Default sits between a wider and a tighter step, not at either end.
        expect(DEFAULT_ZOOM_INDEX).toBeGreaterThan(0);
        expect(DEFAULT_ZOOM_INDEX).toBeLessThan(ZOOM_LEVELS.length - 1);

        const seen = [];
        for (let press = 0; press < ZOOM_LEVELS.length; press++) {
            InputSystem.zoomToggleJustPressed = true;
            RenderSystem3D.update();
            seen.push(ZOOM_LEVELS[RenderSystem3D.zoomIndex]);
        }

        // Steps forward through the list, then wraps back to the default.
        expect(seen).toEqual([
            ZOOM_LEVELS[2], ZOOM_LEVELS[0], ZOOM_LEVELS[1]
        ]);
    });

    it('should ease the camera toward a newly selected zoom step', () => {
        RenderSystem3D.init();
        VehicleSystem.controlledEntity = null;

        InputSystem.zoomToggleJustPressed = true;
        for (let i = 0; i < 400; i++) RenderSystem3D.update();

        expect(RenderSystem3D.camera.zoom).toBeCloseTo(ZOOM_LEVELS[2], 1);
    });

    it('should keep shadowMap enabled in screenshot mode (T26 regression)', () => {
        // screenshotMode is detected from window.location.search — captures are one-off
        // renders, not realtime gameplay, so shadows must stay on or comparison
        // screenshots show flat, contrast-less lighting vs. live gameplay.
        history.pushState({}, '', '?screenshot=street-intersection');
        try {
            RenderSystem3D.init();
            expect(RenderSystem3D.screenshotMode).toBe('street-intersection');
            expect(RenderSystem3D.renderer.shadowMap.enabled).toBe(true);
        } finally {
            history.pushState({}, '', '/');
        }
    });

    it('should freeze look-ahead smoothing in screenshot mode', () => {
        RenderSystem3D.init();
        RenderSystem3D.screenshotMode = 'street-intersection';

        VehicleSystem.controlledEntity = {
            type: 'car',
            transform: { x: 1000, y: 1000, angle: 0 },
            physics: { speed: 300 }
        };

        RenderSystem3D.update();

        expect(RenderSystem3D.lookAheadX).toBe(0);
        expect(RenderSystem3D.lookAheadZ).toBe(0);
    });
});
