# lowge - Lightweight Open World Game Engine 🚗💥

[![GitHub Pages Deployment](https://github.com/LuoXiahong/lowge/actions/workflows/deploy.yml/badge.svg)](https://github.com/LuoXiahong/lowge/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Play_Now!-brightgreen?style=flat-square&logo=gamepad)](https://luoxiahong.github.io/lowge/)

This project is an experiment in building a **lightweight open-world game engine** in modern vanilla JavaScript. It started with early top-down open-world games (GTA 1/2) and PS2-era design principles as a spark — and grew into a noir, 1930s–40s city sandbox focused on architecture, procedural content, and the illusion of a living world rather than photorealism or recreating any commercial title.

Built around an **ECS-lite (Entity-Component-System)** core, it shares one world state across classic 2D Canvas and Three.js 3D, with a live, tweakable film / kinescope post-process — grain, flicker, scratches, and all.

🎮 **[Play the Lfive Demo](https://luoxiahong.github.io/lowge/)**

In ~15 seconds, this README should answer:

1. **What is it?** — A modular open-world sandbox engine (2D Canvas + 3D Three.js) on one shared world state.
2. **Why does it exist?** — To explore and showcase lightweight game-engine architecture, procedural content generation and performance-oriented design in modern JavaScript.
3. **What does it demonstrate?** — See the section below.

## What this project demonstrates

*   ECS-lite architecture design
*   Game loop design
*   Event-driven systems
*   2D and 3D rendering pipelines sharing one world
*   Three.js post-processing
*   Procedural content generation
*   Automated testing (including UI security regression)
*   Internationalization (custom catalog, 5 locales)
*   CI/CD deployment (GitHub Pages)
*   Performance-oriented, separation-of-concerns design

## Screenshots

<p align="center">
  <img src="docs/screenshots/street-intersection.png" alt="Noir rainy night street intersection" width="48%" />
  &nbsp;
  <img src="docs/screenshots/city-overview.png" alt="Noir rainy night city overview" width="48%" />
</p>

---

## ✨ Features

*   **Procedural 1930s–40s vehicles** — `VehicleModelFactory` builds sedans, coupes, and panel vans from data-driven archetypes (rounded fenders, running boards, exposed round headlamps, whitewall tires) instead of licensed or overly detailed 3D assets.
*   **Retro film / kinescope post-processing** — a custom `ShaderPass` with film grain, gate jitter, flicker, animated scratches, dust, and vignette, plus four live-tweakable presets (`off`, `subtle`, `classic`, `ruined`).
*   **Full internationalization** — UI strings across 5 locales (`pl`, `en`, `de`, `es`, `fr`) via a small custom `I18n` catalog system.
*   **Adaptive input UI** — on-screen touch controls auto-detected via pointer/hover media queries, with manual override in Settings.
*   **Dual rendering modes** — 2D top-down Canvas and full 3D (Three.js) sharing the same ECS world/state.
*   **Security-conscious UI layer** — HUD rendering has dedicated regression tests guarding against XSS through entity/display data.

---

## 📁 Directory Structure

```
/game
├── src/                    # Source code of the engine & demo sandbox
│   ├── core/               # Engine core (Game Loop, Time, EventBus, GameState)
│   ├── entities/           # Data-only entities (Entity, Player, NPC, Car)
│   ├── systems/            # Logic systems (Movement, AI, Render, Mission, Audio, Vehicle Models, Retro Film, etc.)
│   ├── world/              # Environment (World, Camera, Tilemap, Waypoints, Grid)
│   ├── input/              # Input management (InputManager)
│   ├── i18n/               # Translation catalogs & I18n helper (pl/en/de/es/fr)
│   ├── ui/                 # UI layers (HUD, MenuScreen, Options, UISettings)
│   └── main.js             # Application entry point / bootstrap
└── .github/
    └── workflows/          # CI/CD workflows (GitHub Pages deployment)
```

---

## 🏗️ ECS-lite Architecture

The core design strictly separates data from logic, allowing flexibility and targeted optimization.

### Core Concepts

*   **Entities** are purely containers of data components (such as `transform`, `physics`, `visual`, `ai`). They **do not contain** gameplay logic.
*   **Systems** are stateless, single-purpose logic processors. They query and manipulate components from entities stored in the `World` but do not store state themselves.
*   **EventBus** acts as the central decoupled communication layer. Systems communicate exclusively using events (`EventBus.publish` / `subscribe`), preventing hard coupling.

### Strict Architectural Rules

1.  **Entities contain ZERO gameplay logic.** No update loops inside entity classes.
2.  **Systems are stateless.** They do not store entity states; they perform transformations on the data they receive from the current `World` tick.
3.  **Extensibility through composition.** New mechanics or features must always be introduced as **new Systems**, rather than modifying existing ones.
4.  **No direct coupling.** System-to-system communications are managed **only** via the `EventBus`.
5.  **RenderSystem separation.** The renderer (both 2D and 3D) is purely a visualizer—it reads transform/visual data and renders it, remaining completely oblivious to gameplay logic.

---

## Performance Philosophy

The engine intentionally favors inexpensive visual and architectural techniques over heavy simulation.

Examples include:
- Procedural vehicle generation instead of detailed meshes.
- Shared world state across 2D and 3D renderers.
- Stateless systems for predictable updates.
- Event-driven communication to reduce coupling.
- Lightweight post-processing effects designed for rapid iteration.

The goal is not photorealism, but maximizing perceived world complexity per unit of computational cost.

---

## ⚡ Technical Stack

*   **Logic & Runtime**: Vanilla ES Modules JavaScript
*   **Graphics (2D)**: HTML5 Canvas API
*   **Graphics (3D)**: Three.js (custom `EffectComposer` post-processing pipeline)
*   **Internationalization**: Custom lightweight `I18n` catalog system (5 locales)
*   **Build Tool & Dev Server**: Vite
*   **Testing Suite**: Vitest + JSDOM

---

## 🚀 Getting Started

### Prerequisites

*   **Node.js** (v20 or higher recommended)
*   **npm** (comes bundled with Node)

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Running Locally

Start the Vite development server:

```bash
npm run dev
```

The application will be running locally at `http://localhost:5173/` (or the port specified in terminal output).

### Building for Production

Compile the production bundle (emitted into `src/dist`):

```bash
npm run build
```

---

## 🧪 Testing

I employ a robust testing suite using **Vitest** and **JSDOM** to ensure logic correctness across all layers of the ECS engine — including dedicated security regression tests (e.g. XSS-injection guards on HUD text rendering).

### Run Tests

Run all unit and integration tests:

```bash
npm test
```

Watch for changes (during development):

```bash
npm run test:watch
```

### Testing Strategy

| Layer | What is Tested | Method |
|---|---|---|
| **Core** (`EventBus`, `Time`, `GameState`) | 100% public API functionality | Unit testing, argument validation |
| **Entities** | Default components upon instantiation | Constructor verification (e.g., does `Car` have `physics`?) |
| **Systems** | Logic behavior inside `update(dt)` | Mock entities with components, assert state changes after update |
| **Renderers** | Sorting logic, layers, and viewport culling | Logical checks via unit tests; visual correctness verified manually |
| **UI Security** | Injection safety in dynamically rendered text (HUD) | Regression tests with malicious payloads (`<img onerror>`, `<svg onload>`, etc.) |

---

## 🎯 Design & Philosophy

> **"Low effort / High impact"** — maximize the illusion of a living, breathing 1930s–40s city with minimal computational complexity.

*   **Retro inspiration (PS2 era + golden-age noir)**: procedural geometry, canvas-based facades, and shader post-processing instead of heavy simulation or licensed art.
*   **Arcade feel**: vehicle and character controls prioritize player expectations over strict real-world physics.
*   **Rapid iteration**: get a feature working first, polish visually, optimize only when bottlenecks appear.
*   **Engine over clone**: the sandbox demos architecture — modular systems, shared world state, extensible pipelines. Early open-world games were only a starting inspiration; the result is its own noir city experiment.
