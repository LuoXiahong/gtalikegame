/**
 * Simulation — the gameplay core: entity spawn/reset and the per-tick update
 * that advances World state. Zero DOM, zero rAF — Game.js is the bootstrap
 * (DOM, asset loading, canvas, requestAnimationFrame) that drives this at
 * real frame rate; this module is what actually makes the deterministic
 * unit here `step(dt)`, so it can also be driven headlessly (a fixed dt,
 * many steps in a row) to test real gameplay invariants over time — no
 * mocking World/EventBus/InputSystem, no Playwright.
 */
import { EventBus } from './EventBus.js';
import { EVENTS } from './Events.js';
import { GameConfig } from './GameConfig.js';
import { World } from '../world/World.js';
import { InputSystem } from '../input/InputManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem.js';
import { CharacterAnimationSystem } from '../systems/CharacterAnimationSystem.js';
import { VehiclePhysicsSystem } from '../systems/VehiclePhysicsSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { TrafficSystem } from '../systems/TrafficSystem.js';
import { CollisionSystem } from '../world/CollisionSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { WantedSystem } from '../systems/WantedSystem.js';
import { PoliceSystem } from '../systems/PoliceSystem.js';
import { Player } from '../entities/Player.js';
import { NPC } from '../entities/NPC.js';
import { Car } from '../entities/Car.js';
import { PedestrianPaths } from '../world/PedestrianPaths.js';

export const Simulation = {
    spawnEntities() {
        const p1 = new Player(GameConfig.SPAWN.PLAYER_X, GameConfig.SPAWN.PLAYER_Y);
        World.addEntity(p1);

        VehicleSystem.init(p1);

        // Sidewalk NPCs; some paths cross the street to a neighboring block
        const npcConfigs = [
            { id: 'npc1', row: 0, col: 0, corner: 0, color: '#3d3d3d', cross: false },
            { id: 'npc2', row: 0, col: 0, corner: 2, color: '#5c4033', cross: true },
            { id: 'npc3', row: 0, col: 1, corner: 0, color: '#1a2744', cross: true },
            { id: 'npc4', row: 0, col: 1, corner: 1, color: '#5a5a5a', cross: false },
            { id: 'npc5', row: 0, col: 2, corner: 0, color: '#6b4423', cross: true },
            { id: 'npc6', row: 1, col: 0, corner: 1, color: '#2c3e50', cross: false },
            { id: 'npc7', row: 1, col: 1, corner: 0, color: '#4a3728', cross: true },
            { id: 'npc8', row: 1, col: 2, corner: 3, color: '#4a5560', cross: false },
            { id: 'npc9', row: 2, col: 0, corner: 2, color: '#3e2723', cross: true },
            { id: 'npc10', row: 2, col: 2, corner: 1, color: '#5a5a5a', cross: false }
        ];

        npcConfigs.forEach(cfg => {
            const patrol = PedestrianPaths.buildPatrol(cfg.row, cfg.col, cfg.cross);
            const start = patrol[cfg.corner % Math.min(4, patrol.length)];
            World.addEntity(new NPC(cfg.id, start.x, start.y, cfg.color, patrol));
        });

        // Was '#c0392b' (saturation 0.78) — the single most saturated color in the whole
        // scene, standing out against an otherwise near-monochrome noir palette.
        World.addEntity(new Car('car1', GameConfig.SPAWN.CAR_X, GameConfig.SPAWN.CAR_Y, '#4a4442'));
    },

    /** Fresh world + entities, e.g. on game restart. Renderer-side mesh cleanup is Game's job. */
    reset() {
        World.init();
        PoliceSystem.reset();
        WantedSystem.reset();
        MissionSystem.init();
        InteractionSystem.reset();
        InputSystem.resetAll();
        this.spawnEntities();
        EventBus.emit(EVENTS.UI_SHOW_DIALOGUE, null);
        EventBus.emit(EVENTS.UI_SHOW_ACTION_HINT, null);
        EventBus.emit(EVENTS.SPEED_UPDATE, 0);
        EventBus.emit(EVENTS.VEHICLE_EXITED, { carId: null });
    },

    /** Advances World state by one tick. Caller decides when (real frame rate, or many fixed-dt steps in a test). */
    step(dt) {
        const controlled = World.getControlled();

        if (controlled) {
            if (controlled.type === 'player') {
                PlayerMovementSystem.update(dt, controlled);
            } else if (controlled.type === 'car') {
                VehiclePhysicsSystem.update(dt, controlled);
                EventBus.emit(EVENTS.SPEED_UPDATE, Math.abs(controlled.physics.speed));
            }
        }

        WantedSystem.update(dt);
        PoliceSystem.update(dt);
        TrafficSystem.update(dt);
        MovementSystem.update(dt);
        AISystem.update(dt);
        MissionSystem.update(dt);
        InteractionSystem.update();

        CollisionSystem.update();

        // After collisions so the gait reflects the velocity actually applied.
        CharacterAnimationSystem.update(dt);
    }
};
