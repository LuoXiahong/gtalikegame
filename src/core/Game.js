/**
 * CORE: Game - Orkiestrator gry
 * Inicjalizuje systemy i uruchamia główną pętlę.
 */
import { Time } from './Time.js';
import { World } from '../world/World.js';
import { Camera } from '../world/Camera.js';
import { InputSystem } from '../input/InputManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem.js';
import { VehiclePhysicsSystem } from '../systems/VehiclePhysicsSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { InteractionSystem } from '../systems/InteractionSystem.js';
import { VehicleSystem } from '../systems/VehicleSystem.js';
import { TrafficSystem } from '../systems/TrafficSystem.js';
import { CollisionSystem } from '../world/CollisionSystem.js';
import { RenderSystem } from '../systems/RenderSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { MissionSystem } from '../systems/MissionSystem.js';
import { WantedSystem } from '../systems/WantedSystem.js';
import { PoliceSystem } from '../systems/PoliceSystem.js';
import { UISystem } from '../ui/HUD.js';
import { Player } from '../entities/Player.js';
import { NPC } from '../entities/NPC.js';
import { Car } from '../entities/Car.js';

import { GameState, GAME_STATES } from './GameState.js';
import { MenuScreen } from '../ui/MenuScreen.js';

export const Game = {
    init() {
        World.init();
        InputSystem.init();
        RenderSystem.init();
        AudioSystem.init();
        UISystem.init();
        MenuScreen.init();
        MissionSystem.init();
        WantedSystem.init();
        PoliceSystem.init();

        // Inicjalizacja instancji
        const p1 = new Player(1000, 1500);
        World.addEntity(p1);

        VehicleSystem.init(p1);

        World.addEntity(new NPC('npc1', 1450, 1550, '#8e44ad'));
        World.addEntity(new NPC('npc2', 1700, 1400, '#27ae60'));
        World.addEntity(new NPC('npc3', 1250, 1800, '#c0392b'));

        World.addEntity(new Car('car1', 2050, 1600, '#c0392b'));

        // Start w MENU
        GameState.setState(GAME_STATES.MENU);

        requestAnimationFrame((ts) => this.loop(ts));
    },

    loop(timestamp) {
        Time.update(timestamp);
        const dt = Time.delta;
        const currentState = GameState.getState();

        if (currentState === GAME_STATES.PLAY) {
            const controlled = VehicleSystem.getControlledEntity();

            // 1. Zbieranie wejścia i aplikacja intencji ruchu (zależy od typu sterowanej encji)
            if (controlled) {
                if (controlled.type === 'player') {
                    PlayerMovementSystem.update(dt, controlled);
                } else if (controlled.type === 'car') {
                    VehiclePhysicsSystem.update(dt, controlled);
                }
            }

            // 2. Aktualizacja systemów logiki i fizyki podstawowej
            WantedSystem.update(dt);
            PoliceSystem.update(dt);
            TrafficSystem.update(dt);
            MovementSystem.update(dt);
            AISystem.update(dt);
            InteractionSystem.update();

            // 3. Rozwiązywanie kolizji
            CollisionSystem.update();

            // 4. Aktualizacja punktu widzenia
            if (controlled) Camera.follow(controlled, dt);
        }

        // 5. Renderowanie stanu końcowego na klatkę (zawsze, dla efektów tła)
        RenderSystem.update();

        requestAnimationFrame((ts) => this.loop(ts));
    }
};
