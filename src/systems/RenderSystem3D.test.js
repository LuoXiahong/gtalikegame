import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RenderSystem3D, BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD, STREET_LIGHT_POOL_SIZE } from './RenderSystem3D.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { RetroFilmSettings } from './RetroFilmSettings.js';
import { TimeOfDaySettings } from './TimeOfDaySettings.js';
import { EventBus } from '../core/EventBus.js';
import { World } from '../world/World.js';
import { Camera, ZOOM_LEVELS, DEFAULT_ZOOM_INDEX } from '../world/Camera.js';

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
        getEntitiesByType: vi.fn().mockReturnValue([]),
        getControlled: vi.fn().mockReturnValue(null)
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
        World.getControlled.mockReturnValue(null);
        // Camera is a real singleton RenderSystem3D reads from directly (not
        // mocked) — reset it so state doesn't leak between tests.
        Camera.focusX = 1100;
        Camera.focusY = 1100;
        Camera.zoomIndex = DEFAULT_ZOOM_INDEX;
        Camera.zoom = ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
        Camera.lookAheadX = 0;
        Camera.lookAheadY = 0;

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
        expect(RenderSystem3D.scene.fog.near).toBe(50);
        expect(RenderSystem3D.scene.fog.far).toBe(180);
        expect(RenderSystem3D.scene.environment).toBeDefined();
        expect(RenderSystem3D.composer).toBeDefined();
        expect(RenderSystem3D.ambientLight.intensity).toBeCloseTo(0.10);
        expect(RenderSystem3D._streetLightMult).toBeCloseTo(1.1);
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
            RenderSystem3D.scene.traverse(o => { if (o.userData?.isStreetLight) n++; });
            return n;
        };

        const before = countLights();
        RenderSystem3D.updateStreetLightPool(110, 110);
        const nearby = pool.map(l => l.position.clone());
        RenderSystem3D.updateStreetLightPool(260, 260);
        const after = countLights();

        // The pool moves; it never grows, shrinks or hides. three.js bakes the
        // light count into the shader, so a changing one would recompile every
        // affected material mid-play — a visible hitch.
        expect(after).toBe(before);
        expect(pool.length).toBe(STREET_LIGHT_POOL_SIZE);
        expect(pool.every(l => l.visible)).toBe(true);
        // ...and it actually tracked the focus point rather than staying put.
        expect(pool.some((l, i) => !l.position.equals(nearby[i]))).toBe(true);
    });

    it('lamps are downward cones whose target tracks the light (T61)', () => {
        RenderSystem3D.init();
        const pool = RenderSystem3D.streetLights;
        expect(RenderSystem3D.streetLightMode).toBe('spot');
        expect(pool.every(l => l.isSpotLight)).toBe(true);
        // A SpotLight aims at its target's world position, so a target outside
        // the light's own scene graph would silently keep the cone pointing at
        // the origin — no world matrix update, no error.
        expect(pool.every(l => l.parent && l.target.parent === l.parent)).toBe(true);

        RenderSystem3D.updateStreetLightPool(110, 110);
        for (const light of pool) {
            if (light.position.y < 0) continue; // parked surplus
            expect(light.target.position.x).toBeCloseTo(light.position.x);
            expect(light.target.position.z).toBeCloseTo(light.position.z);
            expect(light.target.position.y).toBe(0);
        }
    });

    it('keeps the pre-T61 isotropic bulb available as ?lamp=point', () => {
        RenderSystem3D.init();
        // The pool is built once per renderer lifetime, so exercise the other
        // branch on a fresh pool rather than by re-initialising the scene.
        const spotPool = RenderSystem3D.streetLights;
        RenderSystem3D.streetLights = [];
        try {
            const pool = RenderSystem3D.initStreetLightPool('point');
            expect(pool.length).toBe(STREET_LIGHT_POOL_SIZE);
            expect(pool.every(l => l.isPointLight)).toBe(true);
            // No target to move: updateStreetLightPool must not assume one.
            expect(() => RenderSystem3D.updateStreetLightPool(110, 110)).not.toThrow();
        } finally {
            for (const l of RenderSystem3D.streetLights) RenderSystem3D.scene.remove(l);
            RenderSystem3D.streetLights = spotPool;
        }
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
        // Default weather is rain → global wet-sheen base + puddle gloss via roughnessMap
        expect(lane.material.roughness).toBeCloseTo(0.70);
        expect(lane.material.metalness).toBeCloseTo(0.08);
        expect(lane.material.envMapIntensity).toBeCloseTo(1.1);
    });

    it('should dry road materials when weather switches to clear', () => {
        RenderSystem3D.init();
        const lane = RenderSystem3D.laneMarkings[0];
        expect(lane.material.envMapIntensity).toBeCloseTo(1.1);

        TimeOfDaySettings.applyWeather('clear');
        expect(lane.material.roughness).toBe(1);
        expect(lane.material.metalness).toBe(0);
        expect(lane.material.envMapIntensity).toBe(0);

        TimeOfDaySettings.applyWeather('rain');
        expect(lane.material.envMapIntensity).toBeCloseTo(1.1);
        expect(lane.material.metalness).toBeCloseTo(0.08);
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
        // night base: near 50, far 180 at zoom 1
        RenderSystem3D.camera.zoom = 1;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBe(50);
        expect(RenderSystem3D.scene.fog.far).toBe(180);

        RenderSystem3D.camera.zoom = 2;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBeCloseTo(52.5);
        expect(RenderSystem3D.scene.fog.far).toBeCloseTo(189);

        RenderSystem3D.camera.zoom = 0.5;
        RenderSystem3D._applyFogForCurrentZoom();
        expect(RenderSystem3D.scene.fog.near).toBeCloseTo(48.75);
        expect(RenderSystem3D.scene.fog.far).toBeCloseTo(175.5);
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

    // Zoom and look-ahead dynamics themselves (speed ramping, smoothing, input
    // consumption) live in Camera now (see world/Camera.test.js) — this renderer's
    // only remaining job is projecting whatever Camera currently holds into the scene.

    it('projects Camera.focusX/focusY into the camera position using the fixed isometric offset', () => {
        RenderSystem3D.init();

        Camera.focusX = 1000;
        Camera.focusY = 1000;
        RenderSystem3D.update();

        const sFocusX = 1000 * SF;
        const sFocusZ = 1000 * SF;
        const tiltAngle = 35.264 * Math.PI / 180;
        const yawAngle = 45 * Math.PI / 180;
        const distance = 1200 * SF;

        expect(RenderSystem3D.camera.position.x).toBeCloseTo(sFocusX + Math.cos(yawAngle) * Math.cos(tiltAngle) * distance);
        expect(RenderSystem3D.camera.position.z).toBeCloseTo(sFocusZ + Math.sin(yawAngle) * Math.cos(tiltAngle) * distance);
    });

    it('applies Camera.zoom to the THREE.js camera every frame', () => {
        RenderSystem3D.init();

        Camera.zoom = 2.6;
        RenderSystem3D.update();

        expect(RenderSystem3D.camera.zoom).toBeCloseTo(2.6);
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

});
