import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { RenderSystem3D } from './RenderSystem3D.js';

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
            }
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

        // Sprawdzenie czy poprawnie stworzyliśmy podłoża, chodniki, budynki i pasy drogowe
        expect(RenderSystem3D.groundPlane).toBeDefined();
        expect(RenderSystem3D.asphaltPlane).toBeDefined();
        expect(RenderSystem3D.sidewalks.length).toBe(9);
        expect(RenderSystem3D.buildingZones.length).toBe(9);
        expect(RenderSystem3D.buildings.length).toBe(24); // Zweryfikowana ilość budynków z klastrów
        expect(RenderSystem3D.laneMarkings.length).toBeGreaterThan(0);
        expect(RenderSystem3D.zebras.length).toBeGreaterThan(0);
        expect(RenderSystem3D.box5u).toBeDefined();
    });

    it('should handle update cycles and sync camera', () => {
        RenderSystem3D.init();
        
        RenderSystem3D.update();

        // Sprawdzenie czy pozycja boxa 5u uległa zmianie (funkcja ruchu)
        expect(RenderSystem3D.box5u.position.x).not.toBe(RenderSystem3D.originX);

        // Renderer powinien wywołać render()
        expect(RenderSystem3D.renderer.render).toHaveBeenCalled();
    });

    it('should create custom building types via createBuilding', () => {
        RenderSystem3D.init();
        const initialCount = RenderSystem3D.buildings.length;
        
        RenderSystem3D.createBuilding('skyscraper', 200, 200, 400, 100, 100);
        expect(RenderSystem3D.buildings.length).toBe(initialCount + 1);
        
        const newBuilding = RenderSystem3D.buildings[RenderSystem3D.buildings.length - 1];
        expect(newBuilding.position.x).toBe(200);
        expect(newBuilding.position.z).toBe(200);
        
        // Skyscraper powinien posiadać obiekty składowe (bazę i top setback)
        expect(newBuilding.children.length).toBeGreaterThan(1);
    });
});
