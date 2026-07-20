import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RenderSystem3D } from './RenderSystem3D.js';
import { WorldMetrics } from '../world/WorldMetrics.js';
import { RetroFilmSettings } from './RetroFilmSettings.js';
import { TimeOfDaySettings } from './TimeOfDaySettings.js';
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

        // Fog + post-processing + IBL environment (default TOD = dusk)
        expect(RenderSystem3D.scene.fog).toBeDefined();
        expect(RenderSystem3D.scene.fog.near).toBe(60);
        expect(RenderSystem3D.scene.fog.far).toBe(220);
        expect(RenderSystem3D.scene.environment).toBeDefined();
        expect(RenderSystem3D.composer).toBeDefined();
        expect(RenderSystem3D.ambientLight.intensity).toBeCloseTo(0.42);
        expect(RenderSystem3D._streetLightMult).toBeCloseTo(0.6);
        expect(RenderSystem3D.tiltShiftPass).toBeDefined();
        expect(RenderSystem3D.retroFilmPass).toBeDefined();
        expect(RenderSystem3D.retroFilmPass.uniforms.intensity).toBeDefined();
        expect(RenderSystem3D.retroFilmPass.enabled).toBe(true);

        expect(RenderSystem3D.groundPlane).toBeDefined();
        expect(RenderSystem3D.asphaltPlane).toBeDefined();
        expect(RenderSystem3D.sidewalks.length).toBe(9);
        expect(RenderSystem3D.buildingZones.length).toBe(9);
        expect(RenderSystem3D.buildings.length).toBe(24); // cluster building count
        expect(RenderSystem3D.laneMarkings.length).toBeGreaterThan(0);
        expect(RenderSystem3D.zebras.length).toBeGreaterThan(0);
        expect(RenderSystem3D.box5u).toBeDefined();

        expect(RenderSystem3D.trees.length).toBeGreaterThanOrEqual(18);
        expect(RenderSystem3D.trees.length).toBeLessThanOrEqual(25);
        expect(RenderSystem3D.billboards.length).toBe(2);
        expect(RenderSystem3D.props.length).toBeGreaterThanOrEqual(18);
        expect(RenderSystem3D.props.length).toBeLessThanOrEqual(22);
        expect(RenderSystem3D.streetLights.length).toBeGreaterThan(0);
        expect(RenderSystem3D.streetLights.length).toBeLessThanOrEqual(16);
        expect(RenderSystem3D.box5u.visible).toBe(false);
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
        expect(lane.material.roughness).toBe(1);
        expect(lane.material.envMapIntensity).toBe(0);
    });

    it('should handle update cycles and sync camera', () => {
        RenderSystem3D.init();
        
        RenderSystem3D.update();

        // box5u motion function should have moved it
        expect(RenderSystem3D.box5u.position.x).not.toBe(RenderSystem3D.originX * SF);

        expect(RenderSystem3D.renderer.render).toHaveBeenCalled();
    });

    it('should sync retro film pass with settings and disable when off', () => {
        RenderSystem3D.init();
        expect(RenderSystem3D.retroFilmPass.enabled).toBe(true);
        expect(RenderSystem3D.retroFilmPass.uniforms.sepia.value).toBeCloseTo(0.35);

        RetroFilmSettings.applyPreset('off');
        EventBus.emit('retro_settings_change', RetroFilmSettings.toJSON());

        expect(RenderSystem3D.retroFilmPass.enabled).toBe(false);
        expect(RenderSystem3D.retroFilmPass.uniforms.intensity.value).toBe(0);

        RetroFilmSettings.applyPreset('subtle');
        RenderSystem3D.applyRetroSettings();
        expect(RenderSystem3D.retroFilmPass.enabled).toBe(true);
        expect(RenderSystem3D.retroFilmPass.uniforms.vignette.value).toBeCloseTo(0.25);
    });

    it('should lerp lighting when time of day changes', () => {
        RenderSystem3D.init();
        expect(RenderSystem3D.ambientLight.intensity).toBeCloseTo(0.42); // dusk

        TimeOfDaySettings.applyPreset('night');
        expect(RenderSystem3D._todTo).toBeDefined();
        expect(RenderSystem3D._todT).toBe(0);

        // Halfway through 1.5s transition
        RenderSystem3D.updateTimeOfDay(0.75);
        expect(RenderSystem3D._todT).toBeCloseTo(0.5);
        expect(RenderSystem3D.ambientLight.intensity).toBeGreaterThan(0.22);
        expect(RenderSystem3D.ambientLight.intensity).toBeLessThan(0.42);

        // Finish transition
        RenderSystem3D.updateTimeOfDay(1.0);
        expect(RenderSystem3D._todTo).toBeNull();
        expect(RenderSystem3D.ambientLight.intensity).toBeCloseTo(0.22);
        expect(RenderSystem3D.scene.fog.near).toBe(40);
        expect(RenderSystem3D._streetLightMult).toBeCloseTo(1.0);
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
});
