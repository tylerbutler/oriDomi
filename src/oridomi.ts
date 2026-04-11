// # OriDomi
// ### Fold up the DOM like paper.
// 2.0.0

// [Demos / docs](https://oxism.com/oriDomi)
// #### by [Dan Motzenbecker](https://oxism.com)

// Copyright 2014, MIT License

const libName = 'OriDomi';

// Utility Functions

const defer = (fn: () => void): number => setTimeout(fn, 0);

const noOp = (): void => {};

const capitalize = (s: string): string => s[0].toUpperCase() + s.slice(1);

// CSS constants — vendor prefixes no longer needed for modern browsers.
const GRADIENT_FN = 'linear-gradient';
const CURSOR_GRAB = 'grab';
const CURSOR_GRABBING = 'grabbing';
const TRANSITION_END = 'transitionend';

// Anchor lists and their axis pairs.
const anchorList: Anchor[] = ['left', 'right', 'top', 'bottom'];
const anchorListV: Anchor[] = anchorList.slice(0, 2) as Anchor[];
const anchorListH: Anchor[] = anchorList.slice(2) as Anchor[];

function isVerticalAnchor(anchor: Anchor): boolean {
  return anchorListV.includes(anchor);
}

const anchorShorthands: Record<string, Anchor> = {
  left: 'left', l: 'left', '4': 'left',
  right: 'right', r: 'right', '2': 'right',
  top: 'top', t: 'top', '1': 'top',
  bottom: 'bottom', b: 'bottom', '3': 'bottom',
};

const baseName = libName.toLowerCase();

// CSS classes used by style rules, namespaced to prevent collisions.
const elClasses: Record<string, string> = {
  active: 'active',
  clone: 'clone',
  holder: 'holder',
  stage: 'stage',
  stageLeft: 'stage-left',
  stageRight: 'stage-right',
  stageTop: 'stage-top',
  stageBottom: 'stage-bottom',
  content: 'content',
  mask: 'mask',
  maskH: 'mask-h',
  maskV: 'mask-v',
  panel: 'panel',
  panelH: 'panel-h',
  panelV: 'panel-v',
  shader: 'shader',
  shaderLeft: 'shader-left',
  shaderRight: 'shader-right',
  shaderTop: 'shader-top',
  shaderBottom: 'shader-bottom',
};

for (const k of Object.keys(elClasses)) {
  elClasses[k] = `${baseName}-${elClasses[k]}`;
}

// Types

type Anchor = 'left' | 'right' | 'top' | 'bottom';
type ShadingMode = 'hard' | 'soft' | false;

interface EffectOptions {
  callback?: ((event?: Event, instance?: OriDomi) => void) | undefined;
  sticky?: boolean;
  stairs?: boolean;
  fracture?: boolean;
  twist?: boolean;
}

export interface OriDomiOptions {
  vPanels: number | number[];
  hPanels: number | number[];
  perspective: number;
  shading: ShadingMode | true;
  speed: number;
  maxAngle: number;
  ripple: number | boolean;
  oriDomiClass: string;
  shadingIntensity: number;
  easingMethod: string;
  gapNudge: number;
  touchEnabled: boolean;
  touchSensitivity: number;
  touchStartCallback: (coord: number, e: Event) => void;
  touchMoveCallback: (angle: number, e: Event) => void;
  touchEndCallback: (coord: number, e: Event) => void;
}

interface LastOperation {
  anchor: Anchor;
  angle?: number;
  fn?: EffectFn;
  options?: EffectOptions;
  reset?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EffectFn = (this: OriDomi, ...args: any[]) => void;
type QueueEntry = [EffectFn, number, Anchor, EffectOptions];
type PanelIteratorFn = (panel: HTMLDivElement, i: number, len: number) => void;

// Style Generation

let styleBuffer = '';

function addStyle(selector: string, rules: Record<string, string>): void {
  let style = `.${selector}{`;
  for (const [prop, val] of Object.entries(rules)) {
    style += `${prop.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}:${val};`;
  }
  styleBuffer += style + '}';
}

function getGradient(anchor: string): string {
  return `${GRADIENT_FN}(${anchor}, rgba(0, 0, 0, .5) 0%, rgba(255, 255, 255, .35) 100%)`;
}

function createEl(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = elClasses[className];
  return el;
}

function cloneEl(parent: HTMLElement, deep: boolean, className: string): HTMLDivElement {
  const el = parent.cloneNode(deep) as HTMLDivElement;
  el.classList.add(elClasses[className]);
  return el;
}

function hideEl(el: HTMLElement): void {
  el.style.transform = 'translate3d(-99999px, 0, 0)';
}

function showEl(el: HTMLElement): void {
  el.style.transform = 'translate3d(0, 0, 0)';
}

// Check for preserve-3d support.
let isSupported = true;
{
  const p3d = 'preserve-3d';
  const testEl = document.createElement('div');
  testEl.style.transformStyle = p3d;
  if (testEl.style.transformStyle !== p3d) {
    console?.warn(`${libName}: Missing support for \`${p3d}\`.`);
    isSupported = false;
  }
}

// Generate the stylesheet if supported.
if (isSupported) {
  const p3d = 'preserve-3d';
  const i = (s: string): string => s + ' !important';

  addStyle(elClasses.active, {
    backgroundColor: i('transparent'),
    backgroundImage: i('none'),
    boxSizing: i('border-box'),
    border: i('none'),
    outline: i('none'),
    padding: i('0'),
    transformStyle: i(p3d),
    mask: i('none'),
    position: 'relative',
  });

  addStyle(elClasses.clone, {
    margin: i('0'),
    boxSizing: i('border-box'),
    overflow: i('hidden'),
    display: i('block'),
  });

  addStyle(elClasses.holder, {
    width: '100%',
    position: 'absolute',
    top: '0',
    bottom: '0',
    transformStyle: p3d,
  });

  addStyle(elClasses.stage, {
    width: '100%',
    height: '100%',
    position: 'absolute',
    transform: 'translate3d(-9999px, 0, 0)',
    margin: '0',
    padding: '0',
    transformStyle: p3d,
  });

  const perspectiveOrigins: Record<string, string> = {
    Left: '0% 50%',
    Right: '100% 50%',
    Top: '50% 0%',
    Bottom: '50% 100%',
  };
  for (const [k, v] of Object.entries(perspectiveOrigins)) {
    addStyle(elClasses['stage' + k], { perspectiveOrigin: v });
  }

  addStyle(elClasses.shader, {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: '0',
    top: '0',
    left: '0',
    pointerEvents: 'none',
    transitionProperty: 'opacity',
  });

  for (const anchor of anchorList) {
    addStyle(elClasses['shader' + capitalize(anchor)], {
      background: getGradient(anchor),
    });
  }

  addStyle(elClasses.content, {
    margin: i('0'),
    position: i('relative'),
    float: i('none'),
    boxSizing: i('border-box'),
    overflow: i('hidden'),
  });

  addStyle(elClasses.mask, {
    width: '100%',
    height: '100%',
    position: 'absolute',
    overflow: 'hidden',
    transform: 'translate3d(0, 0, 0)',
    outline: '1px solid transparent',
  });

  addStyle(elClasses.panel, {
    width: '100%',
    height: '100%',
    padding: '0',
    position: 'absolute',
    transitionProperty: 'transform',
    transformOrigin: 'left',
    transformStyle: p3d,
  });

  addStyle(elClasses.panelH, { transformOrigin: 'top' });
  addStyle(`${elClasses.stageRight} .${elClasses.panel}`, { transformOrigin: 'right' });
  addStyle(`${elClasses.stageBottom} .${elClasses.panel}`, { transformOrigin: 'bottom' });

  const styleEl = document.createElement('style');
  styleEl.type = 'text/css';
  styleEl.appendChild(document.createTextNode(styleBuffer));
  document.head.appendChild(styleEl);
}

// Defaults

const defaults: OriDomiOptions = {
  vPanels: 3,
  hPanels: 3,
  perspective: 1000,
  shading: 'hard',
  speed: 700,
  maxAngle: 90,
  ripple: 0,
  oriDomiClass: baseName,
  shadingIntensity: 1,
  easingMethod: '',
  gapNudge: 1.5,
  touchEnabled: true,
  touchSensitivity: 0.25,
  touchStartCallback: noOp,
  touchMoveCallback: noOp,
  touchEndCallback: noOp,
};

// The `prep` decorator normalizes arguments for effect methods, manages the
// queue, and makes methods chainable.
function prep(fn: EffectFn): (this: OriDomi, ...args: unknown[]) => OriDomi {
  return function (this: OriDomi, ...args: unknown[]): OriDomi {
    if ((this as any)._touchStarted) {
      fn.apply(this, args);
      return this;
    }

    const [a0, a1, a2] = args;
    let opt: EffectOptions = {};
    let angle: number | null = null;
    let anchor: string | null = null;

    switch (fn.length) {
      case 1:
        opt.callback = a0 as EffectOptions['callback'];
        break;
      case 2:
        if (typeof a0 === 'function') {
          opt.callback = a0 as EffectOptions['callback'];
        } else {
          anchor = a0 as string;
          opt.callback = a1 as EffectOptions['callback'];
        }
        break;
      case 3:
        angle = a0 as number;
        if (args.length === 2) {
          if (typeof a1 === 'object' && a1 !== null) {
            opt = a1 as EffectOptions;
          } else if (typeof a1 === 'function') {
            opt.callback = a1 as EffectOptions['callback'];
          } else {
            anchor = a1 as string;
          }
        } else if (args.length >= 3) {
          anchor = a1 as string;
          if (typeof a2 === 'object' && a2 !== null) {
            opt = a2 as EffectOptions;
          } else if (typeof a2 === 'function') {
            opt.callback = a2 as EffectOptions['callback'];
          }
        }
        break;
    }

    if (angle == null) {
      angle = (this as any)._lastOp.angle || 0;
    }
    anchor ||= (this as any)._lastOp.anchor;

    (this as any)._queue.push([
      fn,
      (this as any)._normalizeAngle(angle),
      (this as any)._getLonghandAnchor(anchor),
      opt,
    ] as QueueEntry);
    (this as any)._step();
    return this;
  };
}

// OriDomi Class

class OriDomi {
  static VERSION = '2.0.0';
  static isSupported = isSupported;

  el!: HTMLElement;

  // Public state
  isFrozen = false;
  isFoldedUp = false;

  // Internal config
  private _config: OriDomiOptions = { ...defaults };
  private _queue: QueueEntry[] = [];
  private _panels: Record<Anchor, HTMLDivElement[]> = {} as any;
  private _stages: Record<Anchor, HTMLDivElement> = {} as any;
  private _shaders: Record<Anchor, Record<Anchor, HTMLDivElement[]>> = {} as any;
  private _lastOp: LastOperation = { anchor: 'left' };
  private _shading: ShadingMode = 'hard';
  private _inTrans = false;
  private _touchEnabled = false;
  private _touchStarted = false;
  private _touchAxis: 'x' | 'y' = 'x';
  private _stageHolder!: HTMLDivElement;
  private _cloneEl!: HTMLDivElement;

  // Touch tracking state
  private _xLast = 0;
  private _yLast = 0;
  private _x1 = 0;
  private _y1 = 0;
  private _origParentTransformStyle = '';

  constructor(el: string | HTMLElement, options: Partial<OriDomiOptions> = {}) {
    if (!isSupported) return;

    if (typeof el === 'string') {
      this.el = document.querySelector(el) as HTMLElement;
    } else {
      this.el = el;
    }

    if (!this.el?.nodeType || this.el.nodeType !== 1) {
      console?.warn(`${libName}: First argument must be a DOM element`);
      return;
    }

    // Fill in passed options with defaults.
    this._config = { ...defaults, ...options } as OriDomiOptions;

    this._config.ripple = Number(this._config.ripple);
    this._queue = [];
    this._panels = {} as Record<Anchor, HTMLDivElement[]>;
    this._stages = {} as Record<Anchor, HTMLDivElement>;
    this._lastOp = { anchor: anchorList[0] };
    this._shading = this._config.shading as ShadingMode;
    if (this._shading === (true as any)) {
      this._shading = 'hard';
    }

    let shaderProtos: Record<string, HTMLDivElement> = {};
    if (this._shading) {
      this._shaders = {} as Record<Anchor, Record<Anchor, HTMLDivElement[]>>;
      shaderProtos = {};
    }

    const stageProto = createEl('stage');
    stageProto.style.perspective = this._config.perspective + 'px';

    for (const anchor of anchorList) {
      this._panels[anchor] = [];
      this._stages[anchor] = cloneEl(stageProto, false, 'stage' + capitalize(anchor));
      if (this._shading) {
        this._shaders[anchor] = {} as Record<Anchor, HTMLDivElement[]>;
        const sides = isVerticalAnchor(anchor) ? anchorListV : anchorListH;
        for (const side of sides) {
          this._shaders[anchor][side] = [];
        }
        const shaderProto = createEl('shader');
        shaderProto.style.transitionDuration = this._config.speed + 'ms';
        shaderProto.style.transitionTimingFunction = this._config.easingMethod;
        shaderProtos[anchor] = cloneEl(shaderProto, false, 'shader' + capitalize(anchor));
      }
    }

    const contentHolder = cloneEl(this.el, true, 'content');

    const maskProto = createEl('mask');
    maskProto.appendChild(contentHolder);

    const panelProto = createEl('panel');
    panelProto.style.transitionDuration = this._config.speed + 'ms';
    panelProto.style.transitionTimingFunction = this._config.easingMethod;

    const offsets: Record<string, number[]> = { left: [], top: [] };

    for (const axis of ['x', 'y'] as const) {
      let anchorSet: Anchor[];
      let metric: 'width' | 'height';
      let classSuffix: string;

      if (axis === 'x') {
        anchorSet = anchorListV as Anchor[];
        metric = 'width';
        classSuffix = 'V';
      } else {
        anchorSet = anchorListH as Anchor[];
        metric = 'height';
        classSuffix = 'H';
      }

      const panelKey = (classSuffix.toLowerCase() + 'Panels') as 'vPanels' | 'hPanels';
      let panelConfig = this._config[panelKey];
      let count: number;

      if (typeof panelConfig === 'number') {
        count = Math.max(1, Math.abs(parseInt(String(panelConfig), 10)));
        const percent = 100 / count;
        panelConfig = Array.from({ length: count }, () => percent);
        (this._config as any)[panelKey] = panelConfig;
      } else {
        count = (panelConfig as number[]).length;
        const sum = (panelConfig as number[]).reduce((p, c) => p + c, 0);
        if (sum < 99 || sum > 100.1) {
          throw new Error(`${libName}: Panel percentages do not sum to 100`);
        }
        if ((panelConfig as number[]).some(p => p <= 0)) {
          throw new Error(`${libName}: All panel percentages must be positive`);
        }
      }

      const panelConfigArr = panelConfig as number[];

      const mask = cloneEl(maskProto, true, 'mask' + classSuffix);
      if (this._shading) {
        for (const a of anchorSet) {
          mask.appendChild(shaderProtos[a]);
        }
      }

      const proto = cloneEl(panelProto, false, 'panel' + classSuffix);
      proto.appendChild(mask);

      for (let rightOrBottom = 0; rightOrBottom < anchorSet.length; rightOrBottom++) {
        const anchor = anchorSet[rightOrBottom];
        for (let panelN = 0; panelN < count; panelN++) {
          const panel = proto.cloneNode(true) as HTMLDivElement;
          const content = (panel.children[0] as HTMLElement).children[0] as HTMLElement;
          content.style.width = content.style.height = '100%';

          let index: number;
          let prev: number;

          if (rightOrBottom) {
            index = panelConfigArr.length - panelN - 1;
            prev = index + 1;
          } else {
            index = panelN;
            prev = index - 1;
            if (panelN === 0) {
              offsets[anchor].push(0);
            } else {
              offsets[anchor].push(
                (offsets[anchor][prev] - 100) * (panelConfigArr[prev] / panelConfigArr[index])
              );
            }
          }

          if (panelN === 0) {
            (panel.style as any)[anchor] = '0';
            (panel.style as any)[metric] = panelConfigArr[index] + '%';
          } else {
            (panel.style as any)[anchor] = '100%';
            (panel.style as any)[metric] =
              (panelConfigArr[index] / panelConfigArr[prev] * 100) + '%';
          }

          if (this._shading) {
            for (let ai = 0; ai < anchorSet.length; ai++) {
              const a = anchorSet[ai];
              this._shaders[anchor][a][panelN] = (panel.children[0] as HTMLElement).children[
                ai + 1
              ] as HTMLDivElement;
            }
          }

          content.style[metric] = (content.style as any)[
            'max' + capitalize(metric)
          ] = (count / panelConfigArr[index] * 10000 / count) + '%';

          (content.style as any)[anchorSet[0]] = offsets[anchorSet[0]][index] + '%';

          this._transformPanel(panel, 0, anchor);
          this._panels[anchor][panelN] = panel;

          if (panelN !== 0) {
            this._panels[anchor][panelN - 1].appendChild(panel);
          }
        }

        this._stages[anchor].appendChild(this._panels[anchor][0]);
      }
    }

    this._stageHolder = createEl('holder');
    this._stageHolder.setAttribute('aria-hidden', 'true');
    for (const anchor of anchorList) {
      this._stageHolder.appendChild(this._stages[anchor]);
    }

    if (window.getComputedStyle(this.el).position === 'absolute') {
      this.el.style.position = 'absolute';
    }

    this.el.classList.add(elClasses.active);
    showEl(this._stages.left);
    this._cloneEl = cloneEl(this.el, true, 'clone');
    this._cloneEl.classList.remove(elClasses.active);
    hideEl(this._cloneEl);
    this.el.innerHTML = '';
    this.el.appendChild(this._cloneEl);
    this.el.appendChild(this._stageHolder);
    this._origParentTransformStyle = (this.el.parentNode as HTMLElement).style.transformStyle;
    (this.el.parentNode as HTMLElement).style.transformStyle = 'preserve-3d';

    this.accordion(0);
    if (this._config.ripple) {
      this.setRipple(this._config.ripple as number);
    }
    if (this._config.touchEnabled) {
      this.enableTouch();
    }
  }

  // Internal Methods (arrow function class fields for bound methods)

  _step = (): void => {
    if (this._inTrans || !this._queue.length) return;
    this._inTrans = true;
    const [fn, angle, anchor, options] = this._queue.shift()!;
    if (this.isFrozen) this.unfreeze();

    const next = (): void => {
      this._setCallback({ angle, anchor, options, fn });
      const args: [number, Anchor, EffectOptions] | [Anchor, EffectOptions] =
        fn.length < 3 ? [anchor, options] : [angle, anchor, options];
      try {
        fn.apply(this, args);
      } catch (err) {
        this._inTrans = false;
        console?.warn(`${libName}: Effect execution failed`, err);
      }
    };

    if (this.isFoldedUp) {
      if (fn.length === 2) {
        next();
      } else {
        this._unfold(() => {
          this._setCallback({ angle, anchor, options, fn });
          // Don't re-call fn — unfold already did its work.
        });
      }
    } else if (anchor !== this._lastOp.anchor) {
      this._stageReset(anchor, next);
    } else {
      next();
    }
  };

  private _isIdenticalOperation(op: LastOperation & { options: EffectOptions }): boolean {
    if (!this._lastOp.fn) return true;
    if (this._lastOp.reset) return false;
    for (const key of ['angle', 'anchor', 'fn'] as const) {
      if ((this._lastOp as any)[key] !== (op as any)[key]) return false;
    }
    for (const [k, v] of Object.entries(op.options)) {
      if (k !== 'callback' && v !== (this._lastOp.options as any)?.[k]) return false;
    }
    return true;
  }

  private _setCallback(operation: {
    angle: number;
    anchor: Anchor;
    options: EffectOptions;
    fn: EffectFn;
  }): void {
    if (!this._config.speed || this._isIdenticalOperation(operation as any)) {
      this._conclude(operation.options.callback);
    } else {
      this._panels[this._lastOp.anchor][0].addEventListener(
        TRANSITION_END,
        this._onTransitionEnd,
        false
      );
    }
    (this._lastOp = operation as any).reset = false;
  }

  _onTransitionEnd = (e: Event): void => {
    (e.currentTarget as HTMLElement).removeEventListener(
      TRANSITION_END,
      this._onTransitionEnd,
      false
    );
    this._conclude(this._lastOp.options?.callback, e);
  };

  _conclude = (cb?: EffectOptions['callback'], event?: Event): void => {
    defer(() => {
      this._inTrans = false;
      this._step();
      cb?.(event, this);
    });
  };

  private _transformPanel(
    el: HTMLDivElement,
    angle: number,
    anchor: Anchor,
    fracture?: boolean
  ): void {
    let x = 0;
    let y = 0;
    let z = 0;
    let transPrefix = '';

    switch (anchor) {
      case 'left':
        y = angle;
        transPrefix = 'X(-';
        break;
      case 'right':
        y = -angle;
        transPrefix = 'X(';
        break;
      case 'top':
        x = -angle;
        transPrefix = 'Y(-';
        break;
      case 'bottom':
        x = angle;
        transPrefix = 'Y(';
        break;
    }

    if (fracture) {
      x = y = z = angle;
    }

    el.style.transform = `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg) translate${transPrefix}${this._config.gapNudge}px)`;
  }

  private _normalizeAngle(angle: number): number {
    angle = parseFloat(String(angle));
    const max = this._config.maxAngle;
    if (isNaN(angle)) return 0;
    if (angle > max) return max;
    if (angle < -max) return -max;
    return angle;
  }

  private _setTrans(duration: number, delay: number, anchor: Anchor = this._lastOp.anchor): void {
    this._iterate(anchor, (panel, i, len) => {
      this._setPanelTrans(anchor, panel, i, len, duration, delay);
    });
  }

  private _setPanelTrans(
    anchor: Anchor,
    panel: HTMLDivElement,
    i: number,
    len: number,
    duration: number,
    delay: number
  ): number {
    let delayMs: number;
    switch (delay) {
      case 0:
        delayMs = 0;
        break;
      case 1:
        delayMs = this._config.speed / len * i;
        break;
      case 2:
        delayMs = this._config.speed / len * (len - i - 1);
        break;
      default:
        delayMs = 0;
    }

    panel.style.transitionDuration = duration + 'ms';
    panel.style.transitionDelay = delayMs + 'ms';

    if (this._shading) {
      const sides = isVerticalAnchor(anchor) ? anchorListV : anchorListH;
      for (const side of sides) {
        const shader = this._shaders[anchor][side][i];
        shader.style.transitionDuration = duration + 'ms';
        shader.style.transitionDelay = delayMs + 'ms';
      }
    }

    return delayMs;
  }

  private _setShader(n: number, anchor: Anchor, angle: number): void {
    const abs = Math.abs(angle);
    let opacity = (abs / 90) * this._config.shadingIntensity;

    if (this._shading === 'hard') {
      opacity *= 0.15;
      angle = this._lastOp.angle! < 0 ? abs : -abs;
    } else {
      opacity *= 0.4;
    }

    const isVert = isVerticalAnchor(anchor);
    const [sideA, sideB]: [Anchor, Anchor] = isVert ? ['left', 'right'] : ['top', 'bottom'];
    const negative = isVert ? (angle < 0) : (angle >= 0);
    (this._shaders[anchor][sideA][n].style as any).opacity = negative ? opacity : 0;
    (this._shaders[anchor][sideB][n].style as any).opacity = negative ? 0 : opacity;
  }

  private _showStage(anchor: Anchor): void {
    if (anchor !== this._lastOp.anchor) {
      hideEl(this._stages[this._lastOp.anchor]);
      this._lastOp.anchor = anchor;
      this._lastOp.reset = true;

      let translateVal: string;
      switch (anchor) {
        case 'left':
          translateVal = '0, 0, 0)';
          break;
        case 'right':
          translateVal = `${-(this._config.vPanels as number[]).length}px, 0, 0)`;
          break;
        case 'top':
          translateVal = '0, 0, 0)';
          break;
        case 'bottom':
          translateVal = `0, ${-(this._config.hPanels as number[]).length}px, 0)`;
          break;
      }
      this._stages[anchor].style.transform = 'translate3d(' + translateVal;
    }
  }

  _stageReset = (anchor: Anchor, cb: () => void): void => {
    const fn = (e?: Event): void => {
      if (e) {
        (e.currentTarget as HTMLElement).removeEventListener(TRANSITION_END, fn, false);
      }
      this._showStage(anchor);
      defer(cb);
    };

    if (this._lastOp.angle === 0) {
      fn();
      return;
    }

    this._panels[this._lastOp.anchor][0].addEventListener(TRANSITION_END, fn, false);
    this._iterate(this._lastOp.anchor, (panel, i) => {
      this._transformPanel(panel, 0, this._lastOp.anchor);
      if (this._shading) {
        this._setShader(i, this._lastOp.anchor, 0);
      }
    });
  };

  private _getLonghandAnchor(shorthand: unknown): Anchor {
    return anchorShorthands[String(shorthand)] ?? 'left';
  }

  private _setCursor(bool: boolean = this._touchEnabled): void {
    this.el.style.cursor = bool ? CURSOR_GRAB : 'default';
  }

  // Touch / Drag Event Handlers

  private _setTouch(toggle: boolean): this {
    if (toggle) {
      if (this._touchEnabled) return this;
    } else {
      if (!this._touchEnabled) return this;
    }

    this._touchEnabled = toggle;
    this._setCursor();

    const listenFn: 'addEventListener' | 'removeEventListener' = toggle
      ? 'addEventListener'
      : 'removeEventListener';

    const eventPairs: [string, string][] = [
      ['TouchStart', 'MouseDown'],
      ['TouchEnd', 'MouseUp'],
      ['TouchMove', 'MouseMove'],
      ['TouchCancel', 'MouseLeave'],
    ];

    const mouseLeaveSupport = 'onmouseleave' in window;

    for (const eventPair of eventPairs) {
      for (const eString of eventPair) {
        if (eString === 'TouchCancel' && !mouseLeaveSupport) {
          this.el[listenFn]('mouseout', this._onMouseOut as EventListener, false);
          break;
        } else {
          this.el[listenFn](
            eString.toLowerCase(),
            (this as any)['_on' + eventPair[0]] as EventListener,
            false
          );
        }
      }
    }
    return this;
  }

  _onTouchStart = (e: MouseEvent | TouchEvent): void => {
    if (!this._touchEnabled || this.isFoldedUp) return;
    e.preventDefault();
    this.emptyQueue();
    this._touchStarted = true;
    this.el.style.cursor = CURSOR_GRABBING;
    this._setTrans(0, 0);

    this._touchAxis = isVerticalAnchor(this._lastOp.anchor) ? 'x' : 'y';

    if (this._touchAxis === 'x') {
      this._xLast = this._lastOp.angle ?? 0;
    } else {
      this._yLast = this._lastOp.angle ?? 0;
    }

    const pageKey = `page${this._touchAxis.toUpperCase()}` as 'pageX' | 'pageY';

    let coord: number;
    if (e.type === 'mousedown') {
      coord = (e as MouseEvent)[pageKey];
    } else {
      const touches = (e as TouchEvent).targetTouches;
      if (!touches?.length) return;
      coord = touches[0][pageKey];
    }

    if (this._touchAxis === 'x') {
      this._x1 = coord;
    } else {
      this._y1 = coord;
    }

    this._config.touchStartCallback(coord, e);
  };

  _onTouchMove = (e: MouseEvent | TouchEvent): void => {
    if (!this._touchEnabled || !this._touchStarted) return;
    e.preventDefault();

    const pageKey = `page${this._touchAxis.toUpperCase()}` as 'pageX' | 'pageY';
    let current: number;
    if (e.type === 'mousemove') {
      current = (e as MouseEvent)[pageKey];
    } else {
      const touches = (e as TouchEvent).targetTouches;
      if (!touches?.length) return;
      current = touches[0][pageKey];
    }

    const startCoord = this._touchAxis === 'x' ? this._x1 : this._y1;
    const lastAngle = this._touchAxis === 'x' ? this._xLast : this._yLast;
    const distance = (current - startCoord) * this._config.touchSensitivity;

    let delta: number;
    if (this._lastOp.angle! < 0) {
      if (this._lastOp.anchor === 'right' || this._lastOp.anchor === 'bottom') {
        delta = lastAngle - distance;
      } else {
        delta = lastAngle + distance;
      }
      if (delta > 0) delta = 0;
    } else {
      if (this._lastOp.anchor === 'right' || this._lastOp.anchor === 'bottom') {
        delta = lastAngle + distance;
      } else {
        delta = lastAngle - distance;
      }
      if (delta < 0) delta = 0;
    }

    this._lastOp.angle = delta = this._normalizeAngle(delta);
    this._lastOp.fn!.call(this, delta, this._lastOp.anchor, this._lastOp.options);
    this._config.touchMoveCallback(delta, e);
  };

  _onTouchEnd = (e: Event): void => {
    if (!this._touchEnabled) return;
    this._touchStarted = this._inTrans = false;
    this.el.style.cursor = CURSOR_GRAB;
    this._setTrans(this._config.speed, this._config.ripple as number);
    const lastCoord = this._touchAxis === 'x' ? this._xLast : this._yLast;
    this._config.touchEndCallback(lastCoord, e);
  };

  _onTouchCancel = (e: Event): void => {
    if (!this._touchEnabled || !this._touchStarted) return;
    this._onTouchEnd(e);
  };

  _onMouseOut = (e: MouseEvent): void => {
    if (!this._touchEnabled || !this._touchStarted) return;
    const related = e.relatedTarget as Node | null;
    if (related && !this.el.contains(related)) {
      this._onTouchEnd(e);
    }
  };

  private _unfold(callback?: () => void): void {
    this._inTrans = true;
    const { anchor } = this._lastOp;
    this._iterate(anchor, (panel, i, len) => {
      const delay = this._setPanelTrans(anchor, panel, i, len, this._config.speed, 1);

      defer(() => {
        this._transformPanel(panel, 0, anchor);
        if (this._shading) {
          this._setShader(i, anchor, 0);
        }

        setTimeout(() => {
          showEl(panel.children[0] as HTMLElement);
          if (i === len - 1) {
            this._inTrans = this.isFoldedUp = false;
            callback?.();
            this._lastOp.fn = this.accordion as unknown as EffectFn;
            this._lastOp.angle = 0;
          }
          defer(() => {
            panel.style.transitionDuration = this._config.speed + 'ms';
          });
        }, delay + this._config.speed * 0.25);
      });
    });
  }

  private _iterate(anchor: Anchor, fn: PanelIteratorFn): void {
    const panels = this._panels[anchor];
    for (let i = 0; i < panels.length; i++) {
      fn.call(this, panels[i], i, panels.length);
    }
  }

  // Public Methods

  enableTouch(): this {
    return this._setTouch(true);
  }

  disableTouch(): this {
    return this._setTouch(false);
  }

  setSpeed(speed: number): this {
    for (const anchor of anchorList) {
      this._setTrans((this._config.speed = speed), this._config.ripple as number, anchor);
    }
    return this;
  }

  freeze(callback?: () => void): this {
    if (this.isFrozen) {
      callback?.();
    } else {
      this._stageReset(this._lastOp.anchor, () => {
        this.isFrozen = true;
        hideEl(this._stageHolder);
        showEl(this._cloneEl);
        this._setCursor(false);
        callback?.();
      });
    }
    return this;
  }

  unfreeze(): this {
    if (this.isFrozen) {
      this.isFrozen = false;
      hideEl(this._cloneEl);
      showEl(this._stageHolder);
      this._setCursor();
      this._lastOp.angle = 0;
    }
    return this;
  }

  destroy(callback?: () => void): null {
    this.emptyQueue();
    // Remove any pending transitionend listener
    this._panels[this._lastOp.anchor]?.[0]?.removeEventListener(
      TRANSITION_END, this._onTransitionEnd, false
    );
    this.freeze(() => {
      this._setTouch(false);
      this.el.innerHTML = this._cloneEl.innerHTML;
      this.el.classList.remove(elClasses.active);
      if (this.el.parentNode) {
        (this.el.parentNode as HTMLElement).style.transformStyle = this._origParentTransformStyle;
      }
      callback?.();
    });
    return null;
  }

  emptyQueue(): this {
    this._queue = [];
    defer(() => {
      this._inTrans = false;
    });
    return this;
  }

  setRipple(dir: number | boolean = 1): this {
    this._config.ripple = Number(dir);
    this.setSpeed(this._config.speed);
    return this;
  }

  constrainAngle(angle: number): this {
    this._config.maxAngle = parseFloat(String(angle)) || defaults.maxAngle;
    return this;
  }

  wait(ms: number): this {
    const fn = (): void => {
      this._inTrans = true;
      setTimeout(this._conclude, ms);
    };
    if (this._inTrans) {
      this._queue.push([fn as unknown as EffectFn, this._lastOp.angle ?? 0, this._lastOp.anchor, this._lastOp.options ?? {}]);
    } else {
      fn();
    }
    return this;
  }

  modifyContent(
    fn:
      | ((el: HTMLElement, i: number, anchor: Anchor) => void)
      | Record<string, string | { content?: string; style?: Record<string, string> }>
  ): this {
    let iteratorFn: (el: HTMLElement, i: number, anchor: Anchor) => void;

    if (typeof fn !== 'function') {
      const selectors = fn;

      const set = (el: HTMLElement, content?: string | null, style?: Record<string, string> | null): void => {
        if (content) el.innerHTML = content;
        if (style) {
          for (const [key, value] of Object.entries(style)) {
            (el.style as any)[key] = value;
          }
        }
      };

      iteratorFn = (el: HTMLElement): void => {
        for (const [selector, value] of Object.entries(selectors)) {
          let content: string | null | undefined = null;
          let style: Record<string, string> | null | undefined = null;

          if (typeof value === 'string') {
            content = value;
          } else {
            ({ content, style } = value as { content?: string; style?: Record<string, string> });
          }

          if (selector === '') {
            set(el, content, style);
            continue;
          }

          for (const match of el.querySelectorAll(selector)) {
            set(match as HTMLElement, content, style);
          }
        }
      };
    } else {
      iteratorFn = fn;
    }

    for (const anchor of anchorList) {
      for (let i = 0; i < this._panels[anchor].length; i++) {
        const panel = this._panels[anchor][i];
        iteratorFn((panel.children[0] as HTMLElement).children[0] as HTMLElement, i, anchor);
      }
    }
    return this;
  }

  // Effect Methods (wrapped in prep decorator)

  accordion = prep(function (this: OriDomi, angle: number, anchor: Anchor, options: EffectOptions): void {
    (this as any)._iterate(anchor, (panel: HTMLDivElement, i: number) => {
      let deg: number;
      if (i % 2 !== 0 && !options.twist) {
        deg = -angle;
      } else {
        deg = angle;
      }

      if (options.sticky) {
        if (i === 0) {
          deg = 0;
        } else if (i > 1 || options.stairs) {
          deg *= 2;
        }
      } else {
        if (i !== 0) deg *= 2;
      }

      if (options.stairs) deg *= -1;

      (this as any)._transformPanel(panel, deg, anchor, options.fracture);

      if ((this as any)._shading) {
        if (options.twist || options.fracture || (i === 0 && options.sticky)) {
          (this as any)._setShader(i, anchor, 0);
        } else if (Math.abs(deg) !== 180) {
          (this as any)._setShader(i, anchor, deg);
        }
      }
    });
  });

  curl = prep(function (this: OriDomi, angle: number, anchor: Anchor, _options: EffectOptions): void {
    const config = (this as any)._config as OriDomiOptions;
    angle /= isVerticalAnchor(anchor)
      ? (config.vPanels as number[]).length
      : (config.hPanels as number[]).length;

    (this as any)._iterate(anchor, (panel: HTMLDivElement, i: number) => {
      (this as any)._transformPanel(panel, angle, anchor);
      if ((this as any)._shading) {
        (this as any)._setShader(i, anchor, 0);
      }
    });
  });

  ramp = prep(function (this: OriDomi, angle: number, anchor: Anchor, _options: EffectOptions): void {
    const panels = (this as any)._panels[anchor];
    if (panels.length < 2) return;
    (this as any)._transformPanel(panels[1], angle, anchor);

    (this as any)._iterate(anchor, (panel: HTMLDivElement, i: number) => {
      if (i !== 1) (this as any)._transformPanel(panel, 0, anchor);
      if ((this as any)._shading) {
        (this as any)._setShader(i, anchor, 0);
      }
    });
  });

  foldUp = prep(function (this: OriDomi, anchor: Anchor, callback?: EffectOptions['callback']): void {
    if ((this as any).isFoldedUp) {
      callback?.();
      return;
    }
    (this as any)._stageReset(anchor, () => {
      (this as any)._inTrans = (this as any).isFoldedUp = true;

      (this as any)._iterate(anchor, (panel: HTMLDivElement, i: number, len: number) => {
        let duration = (this as any)._config.speed;
        if (i === 0) duration /= 2;
        const delay = (this as any)._setPanelTrans(anchor, panel, i, len, duration, 2);

        defer(() => {
          (this as any)._transformPanel(panel, i === 0 ? 90 : 170, anchor);
          setTimeout(() => {
            if (i === 0) {
              (this as any)._inTrans = false;
              callback?.();
            } else {
              hideEl(panel.children[0] as HTMLElement);
            }
          }, delay + (this as any)._config.speed * 0.25);
        });
      });
    });
  });

  unfold = prep(OriDomi.prototype._unfold as unknown as EffectFn);

  // Convenience Methods

  reset(callback?: EffectOptions['callback']): this {
    return this.accordion(0, { callback }) as unknown as this;
  }

  reveal(angle?: number, anchor?: string, options: EffectOptions = {}): this {
    options.sticky = true;
    return this.accordion(angle, anchor, options) as unknown as this;
  }

  stairs(angle?: number, anchor?: string, options: EffectOptions = {}): this {
    options.stairs = options.sticky = true;
    return this.accordion(angle, anchor, options) as unknown as this;
  }

  fracture(angle?: number, anchor?: string, options: EffectOptions = {}): this {
    options.fracture = true;
    return this.accordion(angle, anchor, options) as unknown as this;
  }

  twist(angle?: number, anchor?: string, options: EffectOptions = {}): this {
    options.fracture = options.twist = true;
    return this.accordion((angle ?? 0) / 10, anchor, options) as unknown as this;
  }

  collapse(anchor?: string, options: EffectOptions = {}): this {
    options.sticky = false;
    return this.accordion(-this._config.maxAngle, anchor, options) as unknown as this;
  }

  collapseAlt(anchor?: string, options: EffectOptions = {}): this {
    options.sticky = false;
    return this.accordion(this._config.maxAngle, anchor, options) as unknown as this;
  }

  map(fn: (angle: number, i: number, len: number) => number): (...args: unknown[]) => OriDomi {
    return prep(function (this: OriDomi, angle: number, anchor: Anchor, options: EffectOptions): void {
      (this as any)._iterate(anchor, (panel: HTMLDivElement, i: number, len: number) => {
        (this as any)._transformPanel(panel, fn(angle, i, len), anchor, options.fracture);
      });
    }).bind(this);
  }
}

export default OriDomi;
export { OriDomi };
export type { Anchor, EffectOptions };
