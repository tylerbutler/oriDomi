# OriDomi Comprehensive Code Review

**Date:** 2026-04-11
**Scope:** src/oridomi.ts (1327 lines), tests/oridomi.spec.js (384 lines), tests/oridomi.test.ts (742 lines)

---

## 🔴 Bugs

### HIGH Severity

#### BUG-1: `unfold()` double-executes → TypeError crash
- **File:** `src/oridomi.ts:619–624, 1279, 1015–1042`
- **Description:** When `unfold()` is called on a folded instance, `_step` detects `fn.length === 1` and calls `this._unfold(next)` directly (line 623). After the unfold animation completes, `callback()` invokes `next()`, which calls `_setCallback(...)` and then `fn.apply(this, args)`. Since `fn.length < 3`, args are `[anchor, options]`. This calls `_unfold(anchor, options)` a **second time**, where the anchor string (e.g., `'left'`) is received as the `callback` parameter. When `_unfold` reaches line 1032 (`callback?.()`), it attempts to call a string as a function → **TypeError: callback is not a function**.
- **Status:** [x] Fixed

#### BUG-2: `ramp()` with 1 panel → TypeError crash
- **File:** `src/oridomi.ts:1239`
- **Description:** The `ramp` effect unconditionally accesses `this._panels[anchor][1]` (the second panel). If `vPanels: 1`, the array has length 1, so `_panels[anchor][1]` is `undefined`. Calling `_transformPanel(undefined, ...)` → **TypeError: Cannot read properties of undefined**.
- **Status:** [x] Fixed

#### BUG-3: Half-constructed instance crashes on any method call
- **File:** `src/oridomi.ts:395–407`
- **Description:** When the constructor receives an invalid element or `isSupported` is false, it returns early. `_config` is declared with `!:` (definite assignment assertion) and **never initialized**. Any subsequent method call accesses `this._config.maxAngle` etc. → **TypeError: Cannot read properties of undefined**.
- **Status:** [x] Fixed

### MEDIUM Severity

#### BUG-4: `vPanels: 0` causes division by zero + crash
- **File:** `src/oridomi.ts:488–492, 653`
- **Description:** `vPanels: 0` → `count = 0` → `100 / 0 = Infinity` → empty panel arrays → `_panels[anchor][0]` is `undefined` in `_setCallback` → crash. No input validation rejects 0.
- **Status:** [x] Fixed

#### BUG-5: `_unfold` timers not cancellable by `emptyQueue()`
- **File:** `src/oridomi.ts:1015–1043, 1105–1111`
- **Description:** `_unfold` uses `defer()` + nested `setTimeout()` without storing timer IDs. `emptyQueue()` clears the queue and defers `_inTrans = false`, but in-flight timers continue running, potentially corrupting state.
- **Status:** [x] Fixed

#### BUG-6: `destroy()` leaks `transitionend` listeners
- **File:** `src/oridomi.ts:1095–1103`
- **Description:** If a transition is in progress when `destroy()` is called, the `transitionend` listener registered at line 653 is never removed. The handler could fire on a destroyed instance.
- **Status:** [x] Fixed

#### BUG-7: `destroy()` doesn't restore parent's `transformStyle`
- **File:** `src/oridomi.ts:593 (set), 1095–1103 (not restored)`
- **Description:** Constructor sets `parentNode.style.transformStyle = 'preserve-3d'`. `destroy()` doesn't reset it.
- **Status:** [x] Fixed

#### BUG-8: `_inTrans` permanently stuck if effect function throws
- **File:** `src/oridomi.ts:608–616`
- **Description:** `_step` sets `_inTrans = true` then calls `fn.apply(this, args)` with no try/catch. If the effect throws, `_inTrans` stays `true` forever — the instance is bricked.
- **Status:** [x] Fixed

### LOW Severity

#### BUG-9: `_onMouseOut` uses non-standard `toElement` property
- **File:** `src/oridomi.ts:1010`
- **Description:** `(e as any).toElement` is non-standard (Chrome/IE). Firefox doesn't support it. Should use `e.relatedTarget`.
- **Status:** [x] Fixed

#### BUG-10: Invalid CSS `style.right = "right"` (dead code)
- **File:** `src/oridomi.ts:524`
- **Description:** For right/bottom panels, sets `style.right = "right"` (invalid CSS value). Immediately overwritten by lines 540/543, so no functional harm.
- **Status:** [x] Fixed

#### BUG-11: `_onTouchMove` crashes if `targetTouches` is empty
- **File:** `src/oridomi.ts:965`
- **Description:** `targetTouches[0][pageKey]` assumes at least one touch point. Edge cases could cause empty `targetTouches` → TypeError.
- **Status:** [x] Fixed

#### BUG-12: `'touchleave'` event listener is dead code
- **File:** `src/oridomi.ts:905–916`
- **Description:** No standard `touchleave` event exists. The `addEventListener` call succeeds silently but the handler never fires. Should be `touchcancel`.
- **Status:** [x] Fixed

#### BUG-13: 0% panel percentage allows division by zero
- **File:** `src/oridomi.ts:494–499, 545`
- **Description:** Panel validation only checks sum ≈ 100. Individual 0% values → `Infinity` in panel sizing math.
- **Status:** [x] Fixed

#### BUG-14: `wait()` doesn't set `_inTrans = true`, so queue isn't blocked
- **File:** `src/oridomi.ts:1124–1133`
- **Description:** When `wait(ms)` is called while `_inTrans` is false, it calls `setTimeout(this._conclude, ms)` without setting `_inTrans = true`, so other operations can start during the wait.
- **Status:** [x] Fixed

---

## 🟡 Type Safety Issues

### HIGH Priority

#### TYPE-1: `prep()` erases `this` typing — 40+ `(this as any)` casts
- **File:** `src/oridomi.ts:301–360, 1191–1322`
- **Description:** The `prep()` decorator accepts `EffectFn` with `...args: any[]` and returns `(this: OriDomi, ...args: unknown[]) => OriDomi`. Effect methods use `function()` syntax, losing class `this` typing. Every internal access requires `(this as any)._iterate(...)`, etc.
- **Impact:** 40 of 57 `as any` casts. Typos/wrong args invisible to compiler.
- **Status:** [ ] Not fixed

#### TYPE-2: `.d.ts` output exposes internals, core methods have `...args: unknown[]`
- **File:** `dist/oridomi.d.ts`
- **Description:** Consumer-facing types show `accordion: (this: OriDomi, ...args: unknown[]) => OriDomi` — no autocomplete, no parameter validation. Internal `_step`, `_onTransitionEnd`, `_conclude`, `_stageReset`, `_onTouchStart` etc. leak as public.
- **Status:** [ ] Not fixed

#### TYPE-3: `Anchor` and `EffectOptions` types not exported
- **File:** `src/oridomi.ts:1326–1327`
- **Description:** Consumers can't import `Anchor` or `EffectOptions` types to use with the library's API.
- **Status:** [x] Fixed

### MEDIUM Priority

#### TYPE-4: `{} as any` for record initialization (3 occurrences)
- **File:** `src/oridomi.ts:377–379`
- **Description:** `_panels`, `_stages`, `_shaders` initialized as `{} as any`. If constructor returns early, all subsequent accesses hit `undefined`.
- **Status:** [x] Fixed

#### TYPE-5: Dynamic `CSSStyleDeclaration` access via `as any` (12 occurrences)
- **File:** `src/oridomi.ts:524, 540–544, 557–561, 789–801, 1150`
- **Description:** `(panel.style as any)[anchor]` bypasses CSS property validation.
- **Status:** [x] Fixed

#### TYPE-6: Non-standard `toElement` instead of `relatedTarget`
- **File:** `src/oridomi.ts:1010`
- **Description:** Same as BUG-9. `toElement` requires `as any` cast; `relatedTarget` is properly typed.
- **Status:** [x] Fixed

#### TYPE-7: Missing `noUncheckedIndexedAccess` in tsconfig
- **File:** `tsconfig.json`
- **Description:** Array indexing like `panels[0]` assumes non-undefined return. Would surface ~15-20 unsafe index accesses.
- **Status:** [ ] Not fixed

#### TYPE-8: Dynamic handler lookup `(this as any)['_on' + eventPair[0]]`
- **File:** `src/oridomi.ts:911–913`
- **Description:** String-based method lookup is completely unchecked. Renaming a handler wouldn't produce a compile error.
- **Status:** [x] Fixed

### LOW Priority

#### TYPE-9: Options merging uses `as any` instead of spread
- **File:** `src/oridomi.ts:411–413`
- **Description:** Manual loop with 2 `as any` casts. Could be `{ ...defaults, ...options }`.
- **Status:** [x] Fixed

#### TYPE-10: `_isIdenticalOperation` uses `as any` for property comparison
- **File:** `src/oridomi.ts:632–641`
- **Description:** 3 `as any` casts for property access that could be direct.
- **Status:** [x] Fixed

#### TYPE-11: `_setCallback` double cast pattern
- **File:** `src/oridomi.ts:650, 659`
- **Description:** `(this._lastOp = operation as any).reset = false` is hard to read and masks type mismatches.
- **Status:** [x] Fixed

#### TYPE-12: `shading: ShadingMode | true` needs separate input vs resolved types
- **File:** `src/oridomi.ts:93, 420–422`
- **Description:** `true` is accepted then normalized to `'hard'` with `(true as any)` comparison.
- **Status:** [x] Fixed

#### TYPE-13: `elClasses` uses `Record<string, string>` instead of known keys
- **File:** `src/oridomi.ts:49–74`
- **Description:** Accessed by dynamic string keys; a typed key union would catch typos.
- **Status:** [x] Fixed

---

## 🔵 DRY Violations

### HIGH Priority

#### DRY-1: Axis resolution duplicated 5+ times
- **Files:** `src/oridomi.ts:442, 758, 780, 930, 1226`
- **Description:** Pattern `anchorListV.includes(anchor) ? X : Y` repeated across constructor, `_setPanelTrans`, `_setShader`, `_onTouchStart`, and `curl`. Should extract `isVerticalAnchor()` and `sidesForAnchor()` helpers.
- **Status:** [x] Fixed

#### DRY-2: Transform+shade iteration pattern duplicated in all 4 effects
- **Files:** `src/oridomi.ts:1192–1221, 1230–1235, 1241–1246, 845–850`
- **Description:** Each effect uses the same `_iterate` → `_transformPanel` → optional `_setShader` skeleton. Should extract `_applyTransformAndShade()`.
- **Status:** [ ] Not fixed

#### DRY-3: 78 identical `new OriDomi(el, { speed: 0, touchEnabled: false })` in tests
- **File:** `tests/oridomi.test.ts`
- **Description:** Nearly every test creates an identical instance. Should use shared `beforeEach` or factory helper.
- **Status:** [x] Fixed

### MEDIUM Priority

#### DRY-4: Dead `shaderProto` code in constructor (lines 429–431)
- **File:** `src/oridomi.ts:429–431`
- **Description:** `shaderProto` created and configured but never used — shadowed by inner-scope variable at line 451.
- **Status:** [x] Fixed

#### DRY-5: Transition duration/timing assignment repeated 3× in constructor
- **File:** `src/oridomi.ts:430–431, 452–453, 464–465`
- **Description:** Same two-line pattern applied to shaderProto (dead), inner shaderProto, and panelProto.
- **Status:** [x] Fixed

#### DRY-6: `_setShader` has two near-identical 10-line branches
- **File:** `src/oridomi.ts:780–802`
- **Description:** Vertical and horizontal branches differ only in which shader pair and polarity.
- **Status:** [x] Fixed

#### DRY-7: Touch coordinate extraction duplicated
- **Files:** `src/oridomi.ts:941–944, 962–965`
- **Description:** Identical mouse-vs-touch coordinate extraction in `_onTouchStart` and `_onTouchMove`.
- **Status:** [x] Fixed

#### DRY-8: E2E `innerHTML.includes("rotate")` repeated 9 times
- **File:** `tests/oridomi.spec.js:123–210`
- **Description:** Every effect test uses the same weak assertion pattern.
- **Status:** [x] Fixed

#### DRY-9: E2E screenshot options `{ maxDiffPixelRatio: 0.01 }` repeated 9 times
- **File:** `tests/oridomi.spec.js:324–382`
- **Description:** Should be a shared constant.
- **Status:** [x] Fixed

### LOW Priority

#### DRY-10: `anchor === 'right' || anchor === 'bottom'` repeated in `_onTouchMove`
- **File:** `src/oridomi.ts:974, 981`
- **Description:** Same "is reversed anchor" condition used twice.
- **Status:** [x] Fixed

#### DRY-11: 10 duplicated `(ori as any)._panels` accessor casts in unit tests
- **File:** `tests/oridomi.test.ts:300, 310, 323, ...`
- **Description:** Should extract a `getPanels()` test helper.
- **Status:** [x] Fixed

---

## 🟢 Simplification Opportunities

### HIGH Priority

#### SIMP-1: `css` property map is 90% dead indirection
- **File:** `src/oridomi.ts:21–39`
- **Description:** 9 of 14 entries are identity mappings (`transform: 'transform'`). Vestige of vendor-prefix era. Only 4 entries serve a purpose: `gradientProp`, `grab`, `grabbing`, `transitionEnd`.
- **Status:** [x] Fixed

#### SIMP-2: IIFE closures in `_unfold`/`foldUp` (pre-`let` pattern)
- **File:** `src/oridomi.ts:1021–1041, 1262–1274`
- **Description:** IIFEs used to capture loop variables, unnecessary with `const`/`let`. Adds confusing nesting.
- **Status:** [x] Fixed

#### SIMP-3: Options merging via manual loop instead of spread
- **File:** `src/oridomi.ts:410–413`
- **Description:** `for (const [k, v] of Object.entries(defaults)) { ... }` → `{ ...defaults, ...options }`.
- **Status:** [x] Fixed

### MEDIUM Priority

#### SIMP-4: `_getLonghandAnchor` 21-line switch → 1-line lookup
- **File:** `src/oridomi.ts:853–874`
- **Description:** 12-case switch could be a simple object lookup with `?? 'left'` fallback.
- **Status:** [x] Fixed

#### SIMP-5: `_showStage` 16-line switch → 3-line computation
- **File:** `src/oridomi.ts:805–828`
- **Description:** Switch computing `translate3d` values. `left` and `top` produce the same value. Can compute x/y offsets directly.
- **Status:** [x] Fixed

#### SIMP-6: `elClasses` built via mutation loop
- **File:** `src/oridomi.ts:49–74`
- **Description:** Object created then mutated in a loop to add prefix. Could build prefixed values directly.
- **Status:** [x] Fixed

#### SIMP-7: Delay magic numbers in `_setPanelTrans`
- **File:** `src/oridomi.ts:739–752`
- **Description:** `delay` parameter is `0`, `1`, or `2` with no documentation. Should use named constants.
- **Status:** [x] Fixed

### LOW Priority

#### SIMP-8: `_iterate` wraps a simple `forEach`
- **File:** `src/oridomi.ts:1045–1050`
- **Description:** Custom loop exists only to pass `panels.length` as third arg. Could use `forEach` directly.
- **Status:** [ ] Not fixed

#### SIMP-9: `_transformPanel` switch could use data-driven lookup
- **File:** `src/oridomi.ts:690–707`
- **Description:** Switch mapping anchor → rotation axis + translate direction could be an object.
- **Status:** [x] Fixed

---

## 🧪 Test Coverage Gaps

### HIGH Priority (Entire untested subsystems)

#### TEST-1: Zero touch/drag interaction tests
- **Description:** `_onTouchStart`, `_onTouchMove`, `_onTouchEnd`, `_onTouchLeave`, `_onMouseOut` (~80 lines) have zero behavioral coverage.
- **Status:** [ ] Not fixed

#### TEST-2: Effect callbacks never tested
- **Description:** `prep` decorator's callback extraction from various argument positions is untested. No test verifies `accordion(30, 'left', { callback: fn })` actually invokes `fn`.
- **Status:** [x] Fixed

#### TEST-3: `unfold()` and foldUp↔unfold lifecycle untested
- **Description:** `_unfold` has complex nested timers. No behavioral test for the fold lifecycle.
- **Status:** [ ] Not fixed

#### TEST-4: E2E `applyEffect` fallback timeout masks failures
- **File:** `tests/oridomi.spec.js:25–38`
- **Description:** 150ms `setTimeout` fallback means tests pass even if effect callback mechanism is broken.
- **Status:** [ ] Not fixed

#### TEST-5: Queue sequencing untested
- **Description:** Multiple chained effects (`accordion().wait().curl().reset()`) — entire queue system has zero behavioral coverage.
- **Status:** [x] Fixed

### MEDIUM Priority

#### TEST-6: E2E assertions use weak `includes("rotate")`
- **File:** `tests/oridomi.spec.js:123–210`
- **Description:** Would pass with wrong axis, wrong angle, or wrong panel targeting.
- **Status:** [ ] Not fixed

#### TEST-7: `_step` auto-unfreeze and folded-up paths untested
- **Description:** Two conditional branches in the core loop with no coverage.
- **Status:** [ ] Not fixed

#### TEST-8: 5 config options with zero test coverage
- **Description:** `shadingIntensity`, `easingMethod`, `gapNudge`, `touchSensitivity`, `oriDomiClass` — regressions invisible.
- **Status:** [x] Fixed

#### TEST-9: `wait()` behavioral test missing
- **Description:** Only chaining tested, not actual delay behavior.
- **Status:** [x] Fixed

#### TEST-10: Shader opacity values during effects untested
- **Description:** Shading tests check existence, not correctness of computed opacity.
- **Status:** [ ] Not fixed

#### TEST-11: `accordion works with all four anchors` E2E test has zero assertions
- **File:** `tests/oridomi.spec.js:129–134`
- **Description:** Test passes as long as nothing throws but doesn't verify any behavior.
- **Status:** [x] Fixed

### LOW Priority

#### TEST-12: Anchor shorthands "3" and "4" untested
- **Description:** `_getLonghandAnchor` handles these but only "1" and "2" are tested.
- **Status:** [x] Fixed

#### TEST-13: Single-panel configuration untested
- **Description:** `vPanels: 1` is a degenerate case where accordion alternation never fires for i > 0.
- **Status:** [x] Fixed

#### TEST-14: `_isIdenticalOperation` optimization path untested
- **Description:** Duplicate effect detection — subtle bugs could cause duplicate transitions or missed callbacks.
- **Status:** [x] Fixed

#### TEST-15: `perspective` CSS application never verified on DOM
- **Description:** Config value is stored but never checked that it's applied to stage elements.
- **Status:** [x] Fixed

#### TEST-16: Constructor with `null`/non-Element untested
- **Description:** Defensive edge cases for invalid inputs.
- **Status:** [x] Fixed
