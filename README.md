# [OriDomi](https://oxism.com/oriDomi)

#### Fold up DOM elements like paper

[Dan Motzenbecker](https://oxism.com), MIT License

[@dcmotz](https://twitter.com/dcmotz)

![oriDomi](https://oxism.com/oriDomi/demo/images/readme/1.png?v=2)

![oriDomi](https://oxism.com/oriDomi/demo/images/readme/4.gif?v=2)

![oriDomi](https://oxism.com/oriDomi/demo/images/readme/2.png?v=2)

![oriDomi](https://oxism.com/oriDomi/demo/images/readme/3.gif?v=2)

[Click here](https://oxism.com/oriDomi) for examples, documentation and notes.

## Installation

```bash
npm install oridomi
```

## Usage

### ESM (recommended)

```js
import OriDomi from 'oridomi';

const el = document.querySelector('#my-element');
const fold = new OriDomi(el, { speed: 500 });
fold.accordion(30);
```

### Server-side rendering (SSR) / frameworks

`import OriDomi from 'oridomi'` is safe in Node and SSR bundles such as Next.js, Nuxt, SvelteKit and Astro. DOM feature detection and stylesheet injection are deferred until first construction, so create instances only in browser-side lifecycle hooks such as React `useEffect`, Vue `onMounted`, or Svelte `onMount`/actions. Call `destroy()` during cleanup.

`OriDomi.isSupported` is safe to read in any environment and returns `false` when there is no `document` or no `preserve-3d` support.

```js
import OriDomi from 'oridomi';

if (OriDomi.isSupported) {
  const fold = new OriDomi(document.querySelector('#my-element'));
  fold.accordion(30);
  fold.destroy();
}
```

For strict CSP setups, pass a `nonce` option, such as `{ nonce: cspNonce }`, for the injected `<style>`, or import the static stylesheet instead:

```js
import 'oridomi/oridomi.css';

const fold = new OriDomi(el, { injectStyles: false });
```

### Awaiting animations

Effect methods remain chainable and return the OriDomi instance. Use `whenSettled()` to await an empty animation queue with no transition in progress.

```js
await fold.accordion(30).whenSettled();

fold.accordion(10);
otherFold.accordion(20);
await Promise.all([fold.whenSettled(), otherFold.whenSettled()]);
```

### Updating content and layouts

OriDomi snapshots content when constructed. Use `setContent(htmlOrElement)` to replace that source content, or `refresh()` after mutating the hidden source clone. Rebuilds preserve options and reset the fold state to a flat `accordion(0)` layout. Set `{ responsive: true }` to opt into debounced `ResizeObserver` refreshes.

```js
fold.setContent('<strong>Updated</strong>');
fold.refresh();
await fold.destroy();
```

### Script tag

For use without a bundler, include the IIFE build which exposes `window.OriDomi`:

```html
<script src="https://unpkg.com/oridomi/dist/oridomi.iife.js"></script>
<script>
  const fold = new OriDomi(document.querySelector('#my-element'));
  fold.accordion(30);
</script>
```

## Effects

Every effect method is chainable, queued, and returns the OriDomi instance. The
signature is `effect(angle?, anchor?, optionsOrCallback?)` for fold effects and
`effect(anchor?, optionsOrCallback?)` for the foldUp/unfold pair. `angle` is in
degrees (positive and negative values fold in opposite directions), `anchor`
defaults to `left` (see [Anchors](#anchors)), and the final argument may be an
[effect options](#effect-options) object or a callback invoked when the
animation settles.

| Method | Signature | Description |
| --- | --- | --- |
| `accordion` | `(angle?, anchor?, opts?)` | Core effect — folds the panels back and forth like a bellows. |
| `curl` | `(angle?, anchor?, opts?)` | Bends the element into a smooth curl. |
| `ramp` | `(angle?, anchor?, opts?)` | Lifts the panel nearest the anchor like a ramp. |
| `foldUp` | `(anchor?, opts?)` | Folds the whole element up toward the anchor until hidden. |
| `unfold` | `(anchor?, opts?)` | Reverses `foldUp` back to flat. |
| `reset` | `(callback?)` | Returns to a flat layout (`accordion(0)`). |
| `reveal` | `(angle?, anchor?, opts?)` | Accordion with the first panel kept flat (`sticky`), revealing content behind it. |
| `stairs` | `(angle?, anchor?, opts?)` | Sticky accordion arranged into a staircase. |
| `fracture` | `(angle?, anchor?, opts?)` | Folds on both axes, fragmenting the element into tiles. |
| `twist` | `(angle?, anchor?, opts?)` | A subtle fractured twist (uses `angle / 10`). |
| `collapse` | `(anchor?, opts?)` | Collapses flat toward the anchor (`-maxAngle`). |
| `collapseAlt` | `(anchor?, opts?)` | Collapses flat away from the anchor (`+maxAngle`). |
| `map` | `(fn)` | Returns a custom effect; `fn(angle, i, len)` computes each panel's angle. |

```js
fold.accordion(30, 'right');
fold.curl(20, 'top');
fold.foldUp('left');

// Custom per-panel angles via map():
fold.map((angle, i, len) => angle * (i / len))(45);
```

### Anchors

Every effect folds toward an anchor edge. Pass the full name or a shorthand:

| Edge | Aliases |
| --- | --- |
| `left` | `l`, `4` |
| `right` | `r`, `2` |
| `top` | `t`, `1` |
| `bottom` | `b`, `3` |

```js
fold.accordion(30, 'right');
fold.accordion(30, 'r'); // equivalent
```

## Options

Pass options as the second argument to the constructor:
`new OriDomi(el, options)`. All are optional.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `vPanels` | `number \| number[]` | `3` | Vertical panel count (or an array of proportional widths) for left/right folds. |
| `hPanels` | `number \| number[]` | `3` | Horizontal panel count (or array of proportional heights) for top/bottom folds. |
| `perspective` | `number` | `1000` | CSS 3D perspective in pixels. |
| `shading` | `'hard' \| 'soft' \| false` | `'hard'` | Gradient shading style applied to folds. |
| `speed` | `number` | `700` | Animation duration in milliseconds. |
| `maxAngle` | `number` | `90` | Maximum fold angle in degrees (also used by `collapse`). |
| `ripple` | `number \| boolean` | `0` | Staggers panel animations for a ripple effect. |
| `oriDomiClass` | `string` | `'oridomi'` | Base class name applied to generated elements. |
| `shadingIntensity` | `number` | `1` | Multiplier (0–1) for shading opacity. |
| `easingMethod` | `string` | `''` | CSS transition timing function (e.g. `'ease-in-out'`). |
| `gapNudge` | `number` | `1.5` | Pixel nudge to hide sub-pixel gaps between panels. |
| `touchEnabled` | `boolean` | `true` | Enable drag/touch folding. |
| `touchSensitivity` | `number` | `0.25` | Multiplier mapping drag distance to fold angle. |
| `touchStartCallback` | `(coord, e) => void` | no-op | Fires on drag start. |
| `touchMoveCallback` | `(angle, e) => void` | no-op | Fires while dragging. |
| `touchEndCallback` | `(coord, e) => void` | no-op | Fires on drag end. |
| `responsive` | `boolean` | `false` | Debounced `ResizeObserver` rebuilds on element resize. |
| `injectStyles` | `boolean` | `true` | Inject the stylesheet automatically (set `false` to import the CSS yourself). |
| `nonce` | `string` | — | CSP nonce for the injected `<style>` element. |

### Effect options

The last argument to an effect method is a per-call options object (distinct
from the constructor options above):

| Field | Type | Description |
| --- | --- | --- |
| `callback` | `(event?, instance?) => void` | Invoked when the effect settles. |
| `sticky` | `boolean` | Keep the first panel flat (as in `reveal`). |
| `stairs` | `boolean` | Staircase layout (as in `stairs`). |
| `fracture` | `boolean` | Fold on both axes (as in `fracture`). |
| `twist` | `boolean` | Twist fragmented panels (as in `twist`). |

## API reference

Beyond the effects, instances expose these control and lifecycle methods (all
chainable unless noted):

| Method | Description |
| --- | --- |
| `setSpeed(ms)` | Change the animation speed. |
| `setRipple(dir?)` | Enable/disable or reverse the ripple stagger. |
| `constrainAngle(deg)` | Set the maximum fold angle. |
| `enableTouch()` / `disableTouch()` | Toggle drag/touch folding. |
| `freeze(callback?)` | Flatten and lock the element, swapping in the static clone. |
| `unfreeze()` | Re-enable folding after `freeze()`. |
| `setContent(htmlOrElement)` | Replace the snapshotted source content and rebuild. |
| `refresh()` | Re-snapshot the source clone and rebuild panels. |
| `modifyContent(fnOrMap)` | Mutate each panel's content/style (text is set safely via `textContent`). |
| `wait(ms)` | Queue a pause between effects. |
| `emptyQueue()` | Cancel queued and in-progress animations. |
| `whenSettled()` | Returns a `Promise` resolving when the queue is empty and no transition is running. |
| `destroy(callback?)` | Tear down the instance and restore the original DOM. Returns a `Promise`; idempotent and safe to await. |

Static members: `OriDomi.isSupported` (boolean getter, SSR-safe) and
`OriDomi.VERSION`. The named export `getStyleSheet()` returns the CSS string.

### Error handling

OriDomi fails soft: the constructor never throws. In an unsupported environment
(no `document` or no `preserve-3d` support) or when given a missing
element/selector, it logs a warning, becomes inert, and every method becomes a
no-op — `whenSettled()` resolves immediately. Gate construction on
`OriDomi.isSupported` when you need to branch behavior.

## Framework integration

Framework wrappers are available as subpath imports. They are SSR-safe: each wrapper constructs OriDomi only after mounting in a browser and cleans it up on unmount.

### React

```tsx
import { useRef } from 'react';
import { useOriDomi } from 'oridomi/react';

export function FoldPanel() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useOriDomi(panelRef, { speed: 500 });

  return (
    <>
      <button onClick={() => instanceRef.current?.accordion(30)}>Fold</button>
      <div ref={panelRef}>Fold me</div>
    </>
  );
}
```

React also provides `OriDomiView`, a forward-ref component for wrapping content directly. The OriDomi instance is created once on mount; pass a `deps` array prop to control when it is recreated, and use the forwarded ref's `instance` to call effects or `setContent()`/`refresh()` after option changes.

### Vue

```vue
<script setup>
import { ref } from 'vue';
import { useOriDomi, vOriDomi } from 'oridomi/vue';

defineOptions({
  directives: {
    oridomi: vOriDomi,
  },
});

const el = ref(null);
const fold = useOriDomi(el, { speed: 500 });
const options = { speed: 500 };

function accordion() {
  fold.value?.accordion(30);
}
</script>

<template>
  <button @click="accordion">Fold</button>
  <div ref="el">Fold me</div>

  <div v-oridomi="options">Directive variant</div>
</template>
```

### Svelte

```svelte
<script>
  import { oridomi } from 'oridomi/svelte';
</script>

<div use:oridomi={{ speed: 500 }}>Fold me</div>
```

### Solid

```jsx
import { createOriDomi } from 'oridomi/solid';

export default function FoldPanel() {
  let el;
  const inst = createOriDomi(() => el, { speed: 500 });

  return (
    <>
      <button onClick={() => inst()?.accordion(30)}>Fold</button>
      <div ref={el}>Fold me</div>
    </>
  );
}
```

### Reacting to option changes

The wrappers differ in how they respond to changed options after mount, so
choose the one that matches your needs:

- **React** — `useOriDomi(ref, options, deps)` and `OriDomiView` recreate the
  instance only when the `deps` array changes (by default it is created once).
- **Vue** — the `v-oridomi` directive calls `refresh()` when its bound value
  changes; `useOriDomi` creates the instance once.
- **Svelte** — the `use:oridomi` action calls `refresh()` when its parameter
  changes.
- **Solid** — `createOriDomi` creates the instance once and does not react to
  later option changes.

For changes that need a full re-init (such as panel counts), recreate the
instance or call `refresh()` via the returned handle.

## Migrating from v1.x

v2 is a TypeScript, ESM-first rewrite of the original CoffeeScript library:

- **ESM default export:** `import OriDomi from 'oridomi'` (plus a `window.OriDomi`
  IIFE build for script tags).
- **Promise-based lifecycle:** `whenSettled()` awaits the animation queue and
  `destroy()` returns a `Promise`; prefer these over callback-only flows.
- **SSR-safe:** the constructor defers all DOM access, so importing the package
  on the server is safe. Construct only in browser lifecycle hooks.
- **Framework wrappers** for React, Vue, Svelte, and Solid ship as subpath
  imports (`oridomi/react`, etc.).
- **Stylesheet:** styles inject automatically; opt out with
  `{ injectStyles: false }` and `import 'oridomi/oridomi.css'`.

The effect and option names are unchanged from v1, so existing effect calls such
as `accordion`, `curl`, `fracture`, and `foldUp` continue to work.

## Development

Requires Node.js 22.

The pinned Node version is declared in both `mise.toml` and `.nvmrc`. If you use
[mise](https://mise.jdx.dev), it will select Node 22 automatically on `cd`:

```bash
mise install    # Installs the Node version from mise.toml
```

[nvm](https://github.com/nvm-sh/nvm) and [fnm](https://github.com/Schniz/fnm)
users can run `nvm use` / `fnm use` to pick up the version from `.nvmrc`.

```bash
npm install
npm run build      # Build ESM + IIFE bundles and dist/oridomi.css
npm run dev        # Watch mode
npm run test:unit  # Run unit tests (Vitest)
npm run test:e2e   # Build, then run visual tests (Playwright)
npm test           # Run unit + e2e tests
npm run lint       # Lint with Biome
npm run typecheck  # Type-check source and tests
```

_The DOM is your oyster._
