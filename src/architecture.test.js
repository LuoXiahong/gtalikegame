/**
 * Machine-checks for the "enforced by convention, not tooling" rules in
 * CLAUDE.md. Convention alone is invisible to an agent editing this repo
 * cold — this file is the tripwire.
 *
 * Known, pre-existing breaks are listed explicitly in the FROZEN_* sets below
 * rather than silently allowed by a loose rule. That keeps the ratchet
 * one-directional: a new violation must be fixed, or consciously added here
 * with a reason — it can never slip in by accident. Shrink these sets as the
 * underlying debt (see meta/raport-architektura-ecs.md) gets paid off.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.dirname(fileURLToPath(import.meta.url));

function listFiles(dir) {
    return fs.readdirSync(path.join(SRC, dir))
        .filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));
}

function readSource(relPath) {
    return fs.readFileSync(path.join(SRC, relPath), 'utf-8');
}

// Matches both `import X from 'y';` and multi-line `import { a, b } from 'y';`.
function importPaths(source) {
    const re = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"];/g;
    const out = [];
    let m;
    while ((m = re.exec(source))) out.push(m[1]);
    return out;
}

function walk(dir, exclude = new Set()) {
    const abs = path.join(SRC, dir);
    let out = [];
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        if (exclude.has(entry.name)) continue;
        const rel = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            out = out.concat(walk(rel, exclude));
        } else if (entry.name.endsWith('.js')) {
            out.push(rel);
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Rule 1 (CLAUDE.md #4): systems never call each other directly. A systems/
// file may import another systems/ file only if the target is a stateless
// visual/generation helper (factories, generators, shaders, settings,
// builders...), not a gameplay system.
// ---------------------------------------------------------------------------
const ALLOWED_HELPER_TARGETS = new Set([
    'ContactShadow.js', 'FacadeGenerator.js', 'NPCModelFactory.js', 'PropFactory.js',
    'TreeFactory.js', 'VehicleModelFactory.js', 'RoadTextureGenerator.js', 'RoadBuilder3D.js',
    'CityBuilder3D.js', 'RetroFilmSettings.js', 'RetroFilmShader.js', 'TiltShiftShader.js',
    'TimeOfDaySettings.js', 'StaticInstancer.js', 'PuddleReflector.js', 'RainSystem.js',
    'ScreenshotCapture.js', 'RenderSync3D.js',
]);

const FROZEN_SYSTEM_IMPORTS = new Set([
    // Renderers draw the mission target directly instead of the mission system
    // publishing a world-entity marker. See raport-architektura-ecs.md § C2.
    'RenderSync3D.js=>MissionSystem.js',
    'RenderSystem.js=>MissionSystem.js',
    // Reads PoliceSystem.isActive directly instead of going through EventBus/World.
    'WantedSystem.js=>PoliceSystem.js',
    // STREET_LIGHT_BASE is defined in the renderer and imported back into the
    // factory that seeds it — the constant belongs in a shared module instead.
    'PropFactory.js=>RenderSystem3D.js',
    // Zoom-toggle input is read directly in the render loop instead of a
    // CameraSystem owning it. See raport-architektura-ecs.md § C1.
    'RenderSystem3D.js=>InputManager.js',
]);

describe('systems/ never import each other except visual/generation helpers', () => {
    for (const file of listFiles('systems')) {
        it(`${file} only imports whitelisted systems/ helpers`, () => {
            const source = readSource(`systems/${file}`);
            const localImports = importPaths(source).filter(p => p.startsWith('./'));

            for (const imp of localImports) {
                const target = imp.slice(2); // strip './'
                if (ALLOWED_HELPER_TARGETS.has(target)) continue;

                const pairKey = `${file}=>${target}`;
                expect(
                    FROZEN_SYSTEM_IMPORTS.has(pairKey),
                    `${file} imports systems/${target} directly. Cross-system calls should go ` +
                    `through EventBus (CLAUDE.md rule #4). If this is known, existing debt, add ` +
                    `'${pairKey}' to FROZEN_SYSTEM_IMPORTS with a reason instead of importing silently.`
                ).toBe(true);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// Rule 2 (CLAUDE.md #1): entities are pure data — they must not reach into
// systems/ (gameplay logic) or into World.js (the live entity registry).
// ---------------------------------------------------------------------------
describe('entities/ stay pure data', () => {
    for (const file of listFiles('entities')) {
        it(`${file} does not import systems/ or world/World.js`, () => {
            const source = readSource(`entities/${file}`);
            const imports = importPaths(source);

            for (const imp of imports) {
                expect(imp.includes('/systems/'), `${file} imports ${imp} — entities must not depend on gameplay systems`).toBe(false);
                expect(imp.endsWith('/World.js'), `${file} imports ${imp} — entities must not reach into the live World registry`).toBe(false);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// Rule 3 (CLAUDE.md #1): no per-frame update methods on entity classes —
// a constructor is the only method an entity class may define.
// ---------------------------------------------------------------------------
describe('entities/ classes define only a constructor', () => {
    for (const file of listFiles('entities')) {
        it(`${file} has no methods besides constructor`, () => {
            const source = readSource(`entities/${file}`);
            // Class-body methods sit at 4-space indent in this codebase's style;
            // deeper indentation is constructor-body logic, not a sibling method.
            const methodRe = /^ {4}(?:async\s+)?([a-zA-Z_$][\w$]*)\s*\(/gm;
            const methods = [];
            let m;
            while ((m = methodRe.exec(source))) methods.push(m[1]);

            const extra = methods.filter(name => name !== 'constructor');
            expect(extra, `${file} defines method(s) beyond constructor: ${extra.join(', ')}`).toEqual([]);
        });
    }
});

// ---------------------------------------------------------------------------
// Rule 4 (CLAUDE.md #5): renderers stay gameplay-oblivious — transform/visual
// data in, pixels out. No reading input, game state, or mission logic.
// ---------------------------------------------------------------------------
const FORBIDDEN_RENDERER_IMPORTS = [
    { match: p => p.endsWith('/InputManager.js'), label: 'InputSystem' },
    { match: p => p.endsWith('/GameState.js'), label: 'GameState' },
    { match: p => p === './MissionSystem.js', label: 'MissionSystem' },
];

describe('Render*.js stays gameplay-oblivious', () => {
    const renderFiles = listFiles('systems').filter(f => f.startsWith('Render'));

    for (const file of renderFiles) {
        it(`${file} does not import InputSystem, GameState, or MissionSystem`, () => {
            const source = readSource(`systems/${file}`);
            const imports = importPaths(source);

            for (const imp of imports) {
                const hit = FORBIDDEN_RENDERER_IMPORTS.find(f => f.match(imp));
                if (!hit) continue;

                const target = imp.startsWith('./') ? imp.slice(2) : imp.split('/').pop();
                const pairKey = `${file}=>${target}`;
                expect(
                    FROZEN_SYSTEM_IMPORTS.has(pairKey),
                    `${file} imports ${hit.label} (${imp}) — renderers must stay gameplay-oblivious ` +
                    `(CLAUDE.md rule #5). If this is known, existing debt, add '${pairKey}' to ` +
                    `FROZEN_SYSTEM_IMPORTS with a reason instead of importing silently.`
                ).toBe(true);
            }
        });
    }
});

// ---------------------------------------------------------------------------
// Rule 5 (testing conventions): every source file has a co-located test.
// ---------------------------------------------------------------------------
const TEST_EXEMPT = new Set([
    'main.js',                      // bootstrap one-liner, delegates to Game.init()
    'i18n/locales.js',               // pure translation-string data
    'dev/screenshotScenarios.js',    // dev-only fixture data
]);

// Known, tracked gaps — not exempt in principle, just not cheap to close yet.
const FROZEN_MISSING_TESTS = new Set([
    'core/Game.js',           // DOM/rAF-coupled orchestrator; needs the Simulation
                               // extraction (raport-architektura-ecs.md § B2) to be unit-testable
    'ui/FilmGateOverlay.js',
    'ui/MenuScreen.js',
]);

describe('every source file has a co-located *.test.js sibling', () => {
    const files = walk('', new Set(['dist', 'node_modules'])).filter(f => {
        if (f.endsWith('.test.js')) return false;
        if (f === 'vite.config.js') return false;
        return true;
    });

    for (const file of files) {
        it(`${file} has a test, is exempt, or is a tracked gap`, () => {
            const testPath = path.join(SRC, file.replace(/\.js$/, '.test.js'));
            const hasTest = fs.existsSync(testPath);

            expect(
                hasTest || TEST_EXEMPT.has(file) || FROZEN_MISSING_TESTS.has(file),
                `${file} has no test and isn't in TEST_EXEMPT or FROZEN_MISSING_TESTS. ` +
                `Add a *.test.js sibling, or if coverage is deliberately deferred, add it to ` +
                `FROZEN_MISSING_TESTS with a reason.`
            ).toBe(true);
        });
    }

    it('TEST_EXEMPT and FROZEN_MISSING_TESTS do not list files that already have a test', () => {
        for (const file of [...TEST_EXEMPT, ...FROZEN_MISSING_TESTS]) {
            const testPath = path.join(SRC, file.replace(/\.js$/, '.test.js'));
            expect(fs.existsSync(testPath), `${file} is listed as untested but a test now exists — remove it from the exemption list`).toBe(false);
        }
    });
});
