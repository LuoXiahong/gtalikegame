import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RenderSystem3D } from './RenderSystem3D.js';
import { WorldMetrics } from '../world/WorldMetrics.js';

// Mockowanie Three.js WebGLRenderer, ponieważ JSDOM nie posiada wsparcia dla WebGL
vi.mock('three', async () => {
    const original = await vi.importActual('three');
    return {
        ...original,
        WebGLRenderer: class {
            constructor() {
                this.setSize = vi.fn();
                this.setClearColor = vi.fn();
                this.render = vi.fn();
                this.shadowMap = {
                    enabled: false,
                    type: 0
                };
            }
        }
    };
});

// Mockowanie modułów post-processingu Three.js
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

// Mockowanie World
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
        
        // Przygotowanie mocków DOM
        mockParent = {
            clientWidth: 800,
            clientHeight: 600
        };
        
        mockCanvas = {
            parentElement: mockParent
        };
 
        // Podpinamy mock pod document.getElementById
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

        // Sprawdzenie mgły i post-processingu (T-704)
        expect(RenderSystem3D.scene.fog).toBeDefined();
        expect(RenderSystem3D.scene.fog.near).toBe(200);
        expect(RenderSystem3D.scene.fog.far).toBe(350);
        expect(RenderSystem3D.composer).toBeDefined();
        expect(RenderSystem3D.tiltShiftPass).toBeDefined();

        // Sprawdzenie czy poprawnie stworzyliśmy podłoża, chodniki, budynki i pasy drogowe
        expect(RenderSystem3D.groundPlane).toBeDefined();
        expect(RenderSystem3D.asphaltPlane).toBeDefined();
        expect(RenderSystem3D.sidewalks.length).toBe(9);
        expect(RenderSystem3D.buildingZones.length).toBe(9);
        expect(RenderSystem3D.buildings.length).toBe(24); // Zweryfikowana ilość budynków z klastrów
        expect(RenderSystem3D.laneMarkings.length).toBeGreaterThan(0);
        expect(RenderSystem3D.zebras.length).toBeGreaterThan(0);
        expect(RenderSystem3D.box5u).toBeDefined();

        // Sprawdzenie poprawności generowania rekwizytów środowiskowych
        expect(RenderSystem3D.trees.length).toBeGreaterThanOrEqual(18);
        expect(RenderSystem3D.trees.length).toBeLessThanOrEqual(25);
        expect(RenderSystem3D.billboards.length).toBe(2);
    });

    it('should handle update cycles and sync camera', () => {
        RenderSystem3D.init();
        
        RenderSystem3D.update();

        // Sprawdzenie czy pozycja boxa 5u uległa zmianie (funkcja ruchu)
        expect(RenderSystem3D.box5u.position.x).not.toBe(RenderSystem3D.originX * SF);

        // Renderer powinien wywołać render()
        expect(RenderSystem3D.renderer.render).toHaveBeenCalled();
    });

    it('should create custom building types via createBuilding', () => {
        RenderSystem3D.init();
        const initialCount = RenderSystem3D.buildings.length;
        
        RenderSystem3D.createBuilding('skyscraper', 200, 200, 40, 10, 10);
        expect(RenderSystem3D.buildings.length).toBe(initialCount + 1);
        
        const newBuilding = RenderSystem3D.buildings[RenderSystem3D.buildings.length - 1];
        expect(newBuilding.position.x).toBe(200);
        expect(newBuilding.position.z).toBe(200);
        
        // Skyscraper powinien posiadać obiekty składowe (cień kontaktowy, bazę i top setback)
        expect(newBuilding.children.length).toBeGreaterThan(2);
    });

    it('should assign materials with map textures to building components', () => {
        RenderSystem3D.init();
        
        const resBuilding = RenderSystem3D.createBuilding('residential', 300, 300, 20, 10, 10);
        const mesh = resBuilding.children.find(c => c.isMesh && c.geometry.type === 'BoxGeometry');
        expect(mesh).toBeDefined();
        expect(Array.isArray(mesh.material)).toBe(true);
        expect(mesh.material.length).toBe(6);
        
        // Sprawdź czy boki mają mapę tekstury (proceduralną), a góra/dół mają czysty, jednolity kolor (brak mapy)
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
        
        // Drzewo powinno mieć elementy rzucające i przyjmujące cienie
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
