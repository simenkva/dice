# Design And Coding Principles

## Design Direction
- Theme: retro-futurist ship-computer interface inspired by late-70s sci-fi terminals.
- Visual tone: dark industrial panels, phosphor-green readouts, amber action accents, and subtle CRT scan/noise overlays.
- Layout principle: high-contrast utility split with controls on the left and simulation as the main operational display.
- Atmosphere details: grid table markings, glowing text, thin panel borders, and restrained motion to mimic diagnostic equipment.

## UI Principles
- Inputs are explicit and constrained: each die type uses a slider with fixed `0-6` range.
- Primary action is singular and obvious: one `Roll!` trigger for the simulation cycle.
- Feedback is immediate: HUD states for idle, rolling, invalid selection, and final results.
- Keyboard support: spacebar triggers a roll for quick iteration.

## Simulation Principles
- Physics engine: Cannon-ES drives rigid body behavior with gravity, contact friction, restitution, and sleep states.
- Scene engine: Three.js handles camera perspective, lighting, materials, and rendering loop.
- Collision domain: a static table plane plus boundary walls keep all dice constrained in view.
- Dice construction: each die type (`d4`, `d6`, `d8`, `d10`, `d20`) is represented by a convex polyhedron.
- Numbering: every die face is assigned a unique value (`1..N`) and rendered as a face-aligned label.

## Architecture Principles
- Modular source files:
  - `src/ui.js`: controls and input events.
  - `src/dice-data.js`: die definitions, palette, and constants.
  - `src/dice-factory.js`: geometry, labels, and rigid body creation.
  - `src/simulation.js`: world setup, animation loop, rolling, and result evaluation.
  - `src/main.js`: app bootstrap and module wiring.
- Single responsibility: each module has one clear role to keep behavior testable and maintainable.
- Resource lifecycle: dice meshes/materials/textures are disposed when rerolling to avoid GPU memory leaks.

## Coding Principles
- Keep implementation browser-native with ES modules and minimal setup overhead.
- Prefer deterministic data structures for polyhedra and face indexing.
- Keep UI logic and simulation logic decoupled through callback interfaces.
- Use clear naming and small helper functions for geometry processing and physics state checks.
