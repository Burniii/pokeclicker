# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PokéClicker is a browser idle/clicker game written in TypeScript, using Knockout.js for UI bindings, jQuery + Bootstrap 4 for the UI, and Gulp + Webpack for building. The main development branch is `develop` (CI runs on pushes/PRs to it); `master` is the live site.

## Commands

Node 24 is required (`devEngines` in `package.json`).

```bash
npm run clean            # npm ci + init the src/translations git submodule (first-time setup)
npm start                # clean build + BrowserSync dev server with live reload (serves ./build)
npm run build            # one-off dev build into ./build
npx gulp scripts         # compile only TS (modules via webpack, then scripts via tsc)

npm test                 # gulp scripts + vitest + eslint + stylelint (all, continue on error)
npm run vitest           # run tests with coverage
npm run vitest-nocoverage
npx vitest --run --coverage false src/modules/routes/Routes.test.ts   # single test file
npx vitest --run --coverage false -t "test name"                     # single test by name

npm run eslint           # / eslint-fix   — lints src/scripts and src/modules (.ts)
npm run stylelint        # / stylelint-fix — lints src/**/*.less
```

CI (`.github/workflows/build.yml`) runs: `npm ci`, `gulp scripts`, `npm run eslint`, `npm run stylelint`, `npm run vitest`. The build must succeed for a PR to be reviewed.

Optional local config: copy `_config.js` to `config.js` (gitignored) to set build flags (`DEV_BANNER`, `FEATURE_FLAGS`, `TRANSLATIONS_URL`, etc.). These are used by the HTML `@importif $FLAG` directive and template replacement in `gulpfile.babel.js`.

## Architecture

### Two TypeScript code bases (ongoing migration)

The codebase is mid-migration from global-namespace scripts to ES modules. Understanding how they interact is essential:

- **`src/modules/`** — modern ES modules. Bundled by webpack (`webpack.config.js`, entry `src/modules/index.ts`, tsconfig `src/modules/tsconfig.json`) into `build/scripts/modules.min.js`. All tests live here. New code should go here when practical.
- **`src/scripts/`** — legacy code with no imports/exports; every file declares globals (classes, namespaces) and is concatenated by `gulp-typescript` with the root `tsconfig.json` (`outFile`) into `build/scripts/script.min.js`. Load order is handled by `/// <reference path>` comments.
- **Bridging modules → scripts:**
  - `src/modules/temporaryWindowInjection.ts` imports module exports and assigns them onto `window`, so scripts can use them as globals. A module that scripts need must be added here.
  - The `gulp scripts` task emits `.d.ts` files from the modules into `src/declarations/` (gitignored, generated) and rewrites them into global declarations so `src/scripts` type-checks against them. Running `gulp scripts` is therefore required before eslint or tsc on `src/scripts` will work.
- **Bridging scripts → modules:** modules can't import script code. `src/modules/TemporaryScriptTypes.ts` declares `Tmp*Type` interfaces and global `declare const` for script globals (e.g. `App`, `player`, `Game`) that modules reference; scripts use `satisfies Tmp...Type` / `implements` to stay in sync. When moving something from scripts into modules, update both sides.
- `modules.min.js` loads before `script.min.js` in `src/index.html`.

### Game lifecycle

`src/scripts/App.ts` → `App.start()` runs `Preload`, constructs `Game` (`src/scripts/Game.ts`), calls `game.initialize()` (initializes all subsystems and loads save data), then `ko.applyBindings(App.game)` and `game.start()`, which runs `gameTick()` on an interval (optionally via a web worker). `gameTick` drives battle/dungeon/farm/underground/etc. updates and autosave.

### Save system

- Each persisted subsystem implements `Saveable` (`src/modules/DataStore/common/Saveable.ts`): a `saveKey`, `defaults`, `toJSON()` and `fromJSON()`. `Game` holds these as properties and `Save` (`src/scripts/Save.ts`) serializes them to localStorage, alongside the legacy `player` object.
- **Save migrations** live in `src/scripts/Update.ts` as `updateSteps` keyed by version string; each step mutates `playerData`/`saveData` from older saves. Changes that rename/restructure saved data or IDs (items, Pokémon names, quests, achievements) need a migration step for the next version.

### UI

- `src/index.html` is the shell; it pulls in `src/components/*.html` via a custom `@import "file.html"` / `@importif $CONFIG.KEY "file.html"` directive (implemented in `gulpfile.babel.js`). Components are Knockout templates bound against `App.game` and globals.
- Custom Knockout binding handlers and extenders: `src/modules/koBindingHandlers.ts`, `src/modules/koExtenders.ts`.
- Region map pieces are EJS templates in `src/templates/`; styles are LESS in `src/styles/`.
- Settings are defined/registered in `src/modules/settings/` (`Settings.ts`, plus setting types like `BooleanSetting`, `RangeSetting`).

### Game data

Most content is declared as static data in TypeScript: Pokémon in `src/modules/pokemons/PokemonList.ts`, routes in `src/modules/routes/`, towns/dungeons/gyms/temporary battles in `src/scripts/towns`, `src/scripts/dungeons`, `src/scripts/gym`, `src/scripts/temporaryBattle`, quest lines in `src/scripts/quests`, items in `src/modules/items/`. Unlock conditions use the `Requirement` classes in `src/modules/requirements/`. Shared constants/enums are in `src/modules/GameConstants.ts` and `src/modules/enums/`.

### Translations

`src/translations` is a git submodule (`pokeclicker/pokeclicker-translations`); update with `npm run tl:update`. PRs adding translatable strings should link a matching PR in the translations repo.

### Tests

Vitest with jsdom (`vitest.config.js`). Tests are only picked up from `src/modules/**` (`*.test.ts` or `__tests__/`). `vitest.setup.js` puts `ko` and a mocked `$` on `window`; the global setup forces `TZ=UTC`. Existing tests typically use `vi.useFakeTimers().setSystemTime(...)` and mock `Math.random` inside `vi.hoisted`.

## Conventions

- 4-space indentation, LF, single quotes, semicolons, trailing commas on multiline literals, `prefer-template`, braces required on all blocks (see `.eslintrc.js`, `.editorconfig`).
- Commit messages follow `type(scope): description` (e.g. `fix(farm): ...`, `change(ui): ...`, `chore(...)`).
- Balance changes are only accepted from core developers/contributors; prefer small, focused PRs. Use the PR template in `.github/pull_request_template.md`.
