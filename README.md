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

### Script tag

For use without a bundler, include the IIFE build which exposes `window.OriDomi`:

```html
<script src="https://unpkg.com/oridomi/dist/oridomi.iife.js"></script>
<script>
  const fold = new OriDomi(document.querySelector('#my-element'));
  fold.accordion(30);
</script>
```

## Development

```bash
npm install
npm run build    # Build ESM + IIFE outputs to dist/
npm run dev      # Watch mode
npm test         # Run Playwright tests
```

_The DOM is your oyster._
