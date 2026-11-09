# Balanza Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add «Balanza», the first Logic game (generated, provably unique balance puzzles, 90 s), plus a level-up
notice in the shared game frame for every training game.

**Architecture:** A pure puzzle core (`figures` → `solver` → `generator` → `engine`) under `src/games/balance/`, drawn
with SVG views shared by the game and its guided practice. The level-up notice lives in `GameFrame` and uses two new
synthesized tones from `src/core/sound.ts`.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + Testing Library, Playwright, CSS modules, Supabase SQL migration.

**Spec:** `docs/superpowers/specs/2026-11-04-light-balanza-design.md`

**Execution:** the owner asked to plan and implement everything; native execution in this session, then one
whole-branch review.

## Global Constraints

- id `balance`, area `logic`, `referenceScore` 600, `maxScore` 4000, `BALANCE_DURATION_MS = 90_000`.
- Correct: `10 + level + speedBonus(rt, windowMs(level))`, `windowMs = round(3000 + (level − 1) · 6000 / 9)`; wrong: −15; floor 0; answers < `MIN_RT_MS` (150) after `shownAt` ignored.
- Answer pause: 600 ms after a correct answer, 1 200 ms after a wrong one; no answers accepted during it.
- Figures: 0 circle `#ffb52e`, 1 square `#3fd4ff`, 2 triangle `#ff5fd2`, 3 diamond `#8dff6a`, 4 star `#ff8f5e`, 5 hexagon `#eef1ff`.
- ≤ 6 figures per pan; secret weights 1–10; solver domain 1–20.
- Logic color: `#00b9a0` (Luz and dark menus), `#00776a` (light menus).
- Level-up: badge «¡Nivel N!» / «Más difícil», 1.6 s, `pointer-events: none`, tone `levelUp`, `VIBRATION.levelUp = [16, 40, 16, 40, 32]`; never on first render or on a level drop; `levelUp={false}` in the quiz.
- Every user-visible text in `es.json` and `en.json`; no new dependencies.
- Commit messages end with the session attribution lines.

## Review Focus

1. A level-up and a correct answer in the same tap: both tones play without the arpeggio masking the hit (levelUp starts at 120 ms) — covered by the sound table, checked by ear in the e2e run.
2. Pausing (✕ or hidden tab) during the answer pause: the pause timer must freeze with the game clock, and the next challenge must not appear while paused — Game test «the answer pause freezes while paused».
3. Double tap on an answer button: the second tap lands in the answer pause and is ignored (no double penalty) — engine test «answers during the pause are ignored».
4. Narrow phone (320 × 568) at level 10 (3 clues + question + 3 buttons) and at level 4 (5 figure buttons): no scroll, targets ≥ 44 px — e2e narrow/touch tests seeded at those levels.
5. Generator stalls: a seed where 200 attempts fail would freeze the UI — generator test asserts the fallback is never used across 2 000 seeds per level and that `makeChallenge` stays under 20 ms on average.

---

### Task 1: Logic area plumbing and color

**Files:**
- Modify: `src/games/types.ts` (rename `V1_AREAS` → `TRAINING_AREAS`, add `'logic'`), `src/app/contrast.test.ts`, `src/games/registry.test.ts`
- Modify: `src/app/theme.css` (4 blocks: `--area-logic`), `src/games/shared/luz/luz.css` (`[data-luz][data-area='logic']`), `src/games/shared/GameThumb.module.css`, `src/screens/Games.module.css`, `src/screens/Progress.module.css`, and any other `[data-area='math']` list found with `grep -rn "data-area='math'" src`

**Interfaces:** Produces `TRAINING_AREAS: readonly Area[]` = `['memory','attention','speed','flexibility','math','logic']`.

- [ ] Step 1: Rename and extend; contrast test now covers `area-logic` (light 4.5:1 on bg/surface, Luz uniqueness).
- [ ] Step 2: Add colors. Run `npx vitest run src/app/contrast.test.ts` → PASS (registry test still passes: no logic game yet is fine since it checks `toContain`).
- [ ] Step 3: Commit `feat(theme): a color for the Logic area`.

### Task 2: Tones and vibration

**Files:** Modify `src/core/sound.ts`, `src/core/sound.test.ts`, `src/core/vibrate.ts`, `src/core/vibrate.test.ts`

**Interfaces:** Produces `ToneKind = 'correct' | 'wrong' | 'finish' | 'tilt' | 'levelUp'` (exported); `VIBRATION.levelUp`.

- [ ] Step 1: Tests: `playTone('tilt')` and `playTone('levelUp')` don't throw without AudioContext; with a fake `AudioContext` (stub `createOscillator`/`createGain` recording `type`, frequency ramps, `start` times) `levelUp` schedules 4 notes, the first at `currentTime + 0.12`, and `tilt` sets `type = 'triangle'` and calls `exponentialRampToValueAtTime(120, …)` on frequency. `VIBRATION.levelUp` equals `[16, 40, 16, 40, 32]`.
- [ ] Step 2: Extend note spec `{ freq; start; duration; type?: OscillatorType; endFreq?: number; gain?: number }` (defaults sine, no ramp, 0.12) and the table from spec §5.3. Run `npx vitest run src/core` → PASS.
- [ ] Step 3: Commit `feat(sound): tilt and level-up tones`.

### Task 3: Level-up notice in GameFrame

**Files:** Modify `src/games/shared/GameFrame.tsx`, `GameFrame.module.css`, `GameFrame.test.tsx`, `src/games/quiz/Game.tsx`, `src/i18n/es.json`, `src/i18n/en.json`

**Interfaces:** `GameFrameProps.levelUp?: boolean` (default true). Badge element: `data-testid="level-up"`, text `t('game.levelUp.badge', { n })` + `t('game.levelUp.harder')`. Live region text `t('game.levelUp.announce', { n })`. Keys: es «¡Nivel {{n}}!», «Más difícil», «Subiste al nivel {{n}}»; en «Level {{n}}!», «Harder», «You reached level {{n}}».

- [ ] Step 1: Tests in `GameFrame.test.tsx`: rerender level 3→4 shows badge «¡Nivel 4!» and announces; first render at 5 shows none; 4→3 shows none; `levelUp={false}` 3→4 none; with sound on, `playTone` (mocked module) called with `'levelUp'`; badge gone after 1 600 ms (fake timers).
- [ ] Step 2: Implement: previous level kept in state and adjusted during render (like the float); notice `{ level, id }`; effect on `id` plays tone/vibration via `useSettings`, sets a 1 600 ms timer to clear. Badge positioned absolutely at the top of `.stage`, `pointer-events: none`, keyframes pop-in/out; reduced-motion fade only; the level `dd` gets `data-bump` keyed animation.
- [ ] Step 3: Quiz passes `levelUp={false}` on its `GameFrame`s. Run `npx vitest run src/games` → PASS.
- [ ] Step 4: Commit `feat(play): announce a level-up in every training game`.

### Task 4: Figures and solver

**Files:** Create `src/games/balance/figures.ts`, `solver.ts`, `solver.test.ts`

**Interfaces:**
- `type FigureId = 0|1|2|3|4|5; type Pan = FigureId[]; type Outcome = 'left'|'right'|'level'; interface Balance { left: Pan; right: Pan; outcome: Outcome }`
- `FIGURES: readonly { id: FigureId; shape: 'circle'|'square'|'triangle'|'diamond'|'star'|'hexagon'; color: string }[]`
- `panWeight(pan, w: Record<number, number>): number`; `outcomeOf(left, right, w): Outcome`
- `consistentWeights(figures: FigureId[], clues: Balance[], max = 20): number[][]` (each vector indexed like `figures`)
- `uniqueHeaviest(figures, clues): FigureId | null`; `determinedOutcome(figures, clues, question: {left, right}): Outcome | null`

- [ ] Step 1: Tests: `outcomeOf([0],[1,1],{0:4,1:2})` = `'level'`; chain 0>1,1>2 → heaviest 0; 0>1, 2>1 → null; equivalence 0=1·1… `{0=[1,1]}` question `[0]` vs `[1,1,1]` → `'right'`; with clue `2 > 0` and `0 = 1 1`, question `[2]` vs `[1]` → `'left'`, `[2]` vs `[1,1,1]` → null.
- [ ] Step 2: Implement with pruned enumeration (assign figure by figure, check each clue once all its figures have weights). Run `npx vitest run src/games/balance/solver.test.ts` → PASS.
- [ ] Step 3: Commit `feat(balance): figures and a solver for balance puzzles`.

### Task 5: Generator

**Files:** Create `src/games/balance/generator.ts`, `generator.test.ts`

**Interfaces:** `type Challenge` (spec §7); `makeChallenge(level: number, rng: Rng): Challenge`; `challengeKind(level): 'heaviest'|'tilt'` (1–4 heaviest); `figureCountForLevel(level): number` (3,3,4,5,2,3,3,3,4,4); `FALLBACKS: Record<number, Challenge>` (exported for the test).

- [ ] Step 1: Tests per level 1–10 over seeds 1..2000: kind/figure count/clue count per spec §3.4; figures distinct; every pan 1..6 figures; every clue's outcome equals `outcomeOf` under some consistent weights and the answer equals the solver's unique answer; heaviest clues one figure per pan and never level; level 1 heaviest figure on the left in every clue; only levels 8 and 10 may have a tilted clue in tilt mode (level 8 exactly one); tilt levels: each outcome 25–42 %; no challenge is a fallback (`!Object.values(FALLBACKS).includes(c)`); question never equals a clue; average time < 20 ms. Fallbacks themselves are valid by the solver.
- [ ] Step 2: Implement recipes (spec §3.4): heaviest — random order of k figures, clue pairs (chain for 1–3, random spanning tree for 4), sides per recipe, order shuffled from level 2; tilt — base weights from multipliers (keep ≤ 10), clue equivalences as `[a]` vs `m×[b]` (side random), level-8/10 inequality clue `[c]` vs `[a]` with `c > a`; target outcome first, then up to 60 random questions (counts per side 1..6, classes per recipe) until `determinedOutcome === target`; up to 200 attempts, then fallback.
- [ ] Step 3: Run `npx vitest run src/games/balance/generator.test.ts` → PASS. Commit `feat(balance): generate unique puzzles for each level`.

### Task 6: Engine

**Files:** Create `src/games/balance/engine.ts`, `engine.test.ts`; Modify `src/games/shared/guessing.test.ts`

**Interfaces:** constants `BALANCE_DURATION_MS`, `BALANCE_WRONG_PENALTY = 15`, `BALANCE_REFERENCE_SCORE = 600`, `BALANCE_MAX_SCORE = 4000`, `CORRECT_PAUSE_MS = 600`, `WRONG_PAUSE_MS = 1200`; `balanceWindowMs(level)`; `type Choice = FigureId | Outcome`; `BalanceState` (spec §7); `createBalanceGame(startLevel, rng, now)`; `answerBalance(state, choice, now, rng): { state; correct: boolean | null }`; `challengeOnScreen(state, now): { challenge; last: BalanceState['last'] }`; `balanceResult(state, durationMs): GameResult`.

- [ ] Step 1: Tests: window 3000 at 1, 9000 at 10; correct at rt 0.5 s level 1 → `10+1+speedBonus(500,3000)`; wrong → −15, floor 0; answer at `shownAt + 100` → `correct: null`; answer during pause (before new `shownAt`) → null; new `shownAt = now + 600/1200`; `challengeOnScreen` returns `last` before `until`, new challenge after; staircase steps; result accuracy/maxLevel. Guessing test entry: random choice at rt 200 ms averages < 1.5 per answer; 90 % accuracy at 2 s > 5.
- [ ] Step 2: Implement. Run `npx vitest run src/games/balance src/games/shared/guessing.test.ts` → PASS. Commit `feat(balance): game engine`.

### Task 7: Views, controls and the game screen

**Files:** Create `BalanceView.tsx`, `ChallengeView.tsx`, `Controls.tsx`, `Game.tsx`, `Game.test.tsx`, `balance.module.css`; Modify i18n.

**Interfaces:**
- `BalanceView({ balance, question?: boolean, revealed?: boolean, big?: boolean })` — SVG 200×120, `role="img"`, `aria-label` from `describeBalance(balance, t, question)`; tilt angle −10/0/10 applied via CSS var `--tilt`; question unrevealed shows «?» and 0°.
- `ChallengeView({ challenge, revealed })` — `data-testid="balance-challenge"`, `data-kind`, `data-answer` (string), clues grid + question + prompt text.
- `Controls({ challenge, chosen?: Choice, onChoose(choice) })` — heaviest: one button per figure (`aria-label` figure name, `data-state` `chosen-right|chosen-wrong|correct`); tilt: three buttons.
- `BalanceGame(props: GameProps)`.
- i18n `games.balance`: `title` Balanza/Balance, `skill` Razonamiento lógico/Logical reasoning, `description`, `heaviest` «¿Cuál pesa más?»/«Which is heaviest?», `tilt` «¿Hacia dónde se inclina?»/«Which way will it tip?», `left`, `equal`, `right`, `figures.<shape>_one/_other` («{{count}} círculo ámbar» / «{{count}} círculos ámbar»), `against` «{{left}} frente a {{right}}», `and` « y »/« and », `outcome.left|right|level|unknown` («baja la izquierda», «baja la derecha», «quedan iguales», «?»), `levelHeaviest`/`levelTilt` («{{n}} figuras · ¿Cuál pesa más?»).

- [ ] Step 1: Game tests (fake timers, seeded via `vi.mock` of `randomSeed`): renders a challenge and a 90 s time bar; clicking the `data-answer` choice adds points and plays `correct`; a wrong choice marks the correct button; a second click during the pause is ignored; keys `1`, `ArrowLeft`/`=`/`ArrowRight` answer; after 90 s `onFinish` gets `durationMs: 90000`; the answer pause freezes while `paused`.
- [ ] Step 2: Implement; pause timer with `useTrialTimeout(clock, last.until - pauseMs, pauseMs, paused, rerender)`; `tilt` tone when a tilt question is revealed (sound setting). CSS: layout per spec §5.2, animations, reduced motion.
- [ ] Step 3: Run `npx vitest run src/games/balance` → PASS. Commit `feat(balance): the game screen`.

### Task 8: Practice, thumb, definition, registry, migration, docs

**Files:** Create `Practice.tsx`, `Practice.test.tsx`, `Thumb.tsx`, `index.ts`, `supabase/migrations/20261104000000_balance.sql`; Modify `src/games/registry.ts`, `registry.test.ts`, `penaltyCopy.test.ts`, `src/screens/GamesScreen.test.tsx`, i18n (`games.balance.practice.*` per spec §6), `supabase/tests/01_core_schema.test.sql`, `SETUP.md`, `README.md`.

**Interfaces:** `balanceGame: GameDefinition` with `Practice`, `Thumb`, `describeLevel`.

- [ ] Step 1: Practice tests: 4 rounds with the spec's scenes; wrong answer in round 1 (■) shows hint 1; right answers advance; round 3 right reveals tilt; `onComplete` after round 4; skip calls `onSkip`.
- [ ] Step 2: Implement; register; penalty test: recap matches `\b15\b` and `\b90\b` in es/en; GamesScreen test finds «Balanza» under «Lógica».
- [ ] Step 3: `npm test`, `npm run lint`, `npm run typecheck` → all PASS. Commit `feat(balance): practice, thumbnail and registration`.

### Task 9: End-to-end coverage

**Files:** Modify `e2e/luz.spec.ts`, `e2e/practice.spec.ts`, `e2e/touch-targets.spec.ts`, `e2e/helpers.ts`; add a level-up e2e in `e2e/luz.spec.ts`.

- [ ] Step 1: `balance` in Luz GAMES with `answerSome` reading `data-answer`; helpers' 90 s games run 91 s; practice GAMES + `answerWrong` (second figure button in round 1); touch targets at levels 4 and 10 (seed `gameLevels`); level-up test: answer correctly 4 times → `[data-testid="level-up"]` visible.
- [ ] Step 2: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e` → PASS; review screenshots of Balanza (game, narrow, practice, level-up).
- [ ] Step 3: Commit `test(e2e): Balanza and the level-up notice`; push.
