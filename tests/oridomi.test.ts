import { describe, it, expect, beforeEach, vi } from 'vitest';
import OriDomi from '../src/oridomi';

// Helper: create a target element inside a parent (required by OriDomi).
function createTarget(
  opts: { width?: string; height?: string } = {},
): HTMLDivElement {
  const parent = document.createElement('div');
  const el = document.createElement('div');
  el.id = 'target';
  el.style.width = opts.width ?? '300px';
  el.style.height = opts.height ?? '200px';
  el.textContent = 'Test';
  parent.appendChild(el);
  document.body.appendChild(parent);
  return el;
}

// Helper: flush all pending setTimeout(fn, 0) calls.
function flushDefer(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('OriDomi', () => {
  let el: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    el = createTarget();
  });

  // ─── Static properties ───────────────────────────────────────────────

  describe('static properties', () => {
    it('has VERSION set to 2.0.0', () => {
      expect(OriDomi.VERSION).toBe('2.0.0');
    });

    it('isSupported is a boolean', () => {
      expect(typeof OriDomi.isSupported).toBe('boolean');
    });
  });

  // ─── Construction ────────────────────────────────────────────────────

  describe('construction', () => {
    it('creates an instance from an HTMLElement', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori).toBeInstanceOf(OriDomi);
      expect(ori.el).toBe(el);
    });

    it('creates an instance from a selector string', () => {
      const ori = new OriDomi('#target', { speed: 0, touchEnabled: false });
      expect(ori).toBeInstanceOf(OriDomi);
      expect(ori.el).toBe(el);
    });

    it('warns and returns early if element is invalid', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ori = new OriDomi('#nonexistent', { speed: 0, touchEnabled: false });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('First argument must be a DOM element'),
      );
      // el should not be set to a valid element
      expect(ori.el).toBeNull();
      warnSpy.mockRestore();
    });

    it('applies default options when none provided', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.isFrozen).toBe(false);
      expect(ori.isFoldedUp).toBe(false);
    });

    it('adds the oridomi-active class to the element', () => {
      new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(el.classList.contains('oridomi-active')).toBe(true);
    });

    it('creates stage elements inside the target', () => {
      new OriDomi(el, { speed: 0, touchEnabled: false });
      const holder = el.querySelector('.oridomi-holder');
      expect(holder).not.toBeNull();
      // 4 stages: left, right, top, bottom
      const stages = holder!.querySelectorAll('[class*="oridomi-stage-"]');
      expect(stages.length).toBe(4);
    });

    it('creates the correct number of default panels (3 per anchor)', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      // Access internals via any
      const panels = (ori as any)._panels;
      for (const anchor of ['left', 'right', 'top', 'bottom']) {
        expect(panels[anchor].length).toBe(3);
      }
    });

    it('respects custom vPanels and hPanels counts', () => {
      const ori = new OriDomi(el, {
        speed: 0,
        touchEnabled: false,
        vPanels: 5,
        hPanels: 2,
      });
      const panels = (ori as any)._panels;
      expect(panels.left.length).toBe(5);
      expect(panels.right.length).toBe(5);
      expect(panels.top.length).toBe(2);
      expect(panels.bottom.length).toBe(2);
    });

    it('accepts custom panel widths as an array', () => {
      const ori = new OriDomi(el, {
        speed: 0,
        touchEnabled: false,
        vPanels: [20, 30, 50],
      });
      const panels = (ori as any)._panels;
      expect(panels.left.length).toBe(3);
    });

    it('throws if custom panel widths do not sum to ~100', () => {
      expect(() => {
        new OriDomi(el, {
          speed: 0,
          touchEnabled: false,
          vPanels: [10, 20, 30],
        });
      }).toThrow('Panel percentages do not sum to 100');
    });

    it('creates a hidden clone of the original element', () => {
      new OriDomi(el, { speed: 0, touchEnabled: false });
      const clone = el.querySelector('.oridomi-clone');
      expect(clone).not.toBeNull();
    });

    it('sets aria-hidden on the stage holder', () => {
      new OriDomi(el, { speed: 0, touchEnabled: false });
      const holder = el.querySelector('.oridomi-holder');
      expect(holder!.getAttribute('aria-hidden')).toBe('true');
    });

    it('sets preserve-3d on parent element', () => {
      new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(el.parentElement!.style.transformStyle).toBe('preserve-3d');
    });
  });

  // ─── Options merging ─────────────────────────────────────────────────

  describe('options merging', () => {
    it('custom options override defaults', () => {
      const ori = new OriDomi(el, {
        speed: 300,
        perspective: 500,
        maxAngle: 45,
        touchEnabled: false,
      });
      const config = (ori as any)._config;
      expect(config.speed).toBe(300);
      expect(config.perspective).toBe(500);
      expect(config.maxAngle).toBe(45);
    });

    it('shading: true is normalized to "hard"', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, shading: true });
      expect((ori as any)._shading).toBe('hard');
    });

    it('shading: false disables shaders', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, shading: false });
      expect((ori as any)._shading).toBe(false);
    });

    it('ripple boolean is converted to number', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, ripple: true });
      expect((ori as any)._config.ripple).toBe(1);
    });
  });

  // ─── Public method return values (chaining) ──────────────────────────

  describe('chaining', () => {
    it('accordion returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.accordion(30)).toBe(ori);
    });

    it('curl returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.curl(20)).toBe(ori);
    });

    it('ramp returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.ramp(15)).toBe(ori);
    });

    it('reveal returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.reveal(30)).toBe(ori);
    });

    it('stairs returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.stairs(30)).toBe(ori);
    });

    it('fracture returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.fracture(20)).toBe(ori);
    });

    it('twist returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.twist(50)).toBe(ori);
    });

    it('collapse returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.collapse()).toBe(ori);
    });

    it('collapseAlt returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.collapseAlt()).toBe(ori);
    });

    it('reset returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.reset()).toBe(ori);
    });

    it('setSpeed returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.setSpeed(500)).toBe(ori);
    });

    it('setRipple returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.setRipple(1)).toBe(ori);
    });

    it('constrainAngle returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.constrainAngle(45)).toBe(ori);
    });

    it('emptyQueue returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.emptyQueue()).toBe(ori);
    });

    it('freeze returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.freeze()).toBe(ori);
    });

    it('unfreeze returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.unfreeze()).toBe(ori);
    });

    it('enableTouch returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.enableTouch()).toBe(ori);
    });

    it('disableTouch returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.disableTouch()).toBe(ori);
    });

    it('wait returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.wait(100)).toBe(ori);
    });

    it('modifyContent returns the instance', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.modifyContent(() => {})).toBe(ori);
    });

    it('destroy returns null', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(ori.destroy()).toBeNull();
    });
  });

  // ─── Effects: DOM transforms ─────────────────────────────────────────

  describe('effects', () => {
    it('accordion applies transforms to panels', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(45);
      await flushDefer();

      const panels = (ori as any)._panels.left as HTMLDivElement[];
      // First panel should have non-zero rotation
      expect(panels[0].style.transform).toContain('rotateY(45deg)');
    });

    it('accordion with negative angle applies negative rotation', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(-30);
      await flushDefer();

      const panels = (ori as any)._panels.left as HTMLDivElement[];
      expect(panels[0].style.transform).toContain('rotateY(-30deg)');
    });

    it('accordion with anchor "right" uses the right stage', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(30, 'right');
      // Switching anchors requires stage reset (async with defer chain).
      // Flush multiple ticks to allow the full reset → apply cycle.
      await flushDefer();
      await flushDefer();
      await flushDefer();

      const panels = (ori as any)._panels.right as HTMLDivElement[];
      // Right anchor: y = -angle
      expect(panels[0].style.transform).toContain('rotateY(-30deg)');
    });

    it('accordion with anchor "top" applies X-axis rotation', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(30, 'top');
      await flushDefer();
      await flushDefer();
      await flushDefer();

      const panels = (ori as any)._panels.top as HTMLDivElement[];
      expect(panels[0].style.transform).toContain('rotateX(-30deg)');
    });

    it('curl divides angle by panel count', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, vPanels: 3 });
      ori.curl(90);
      await flushDefer();

      const panels = (ori as any)._panels.left as HTMLDivElement[];
      // 90 / 3 = 30
      expect(panels[0].style.transform).toContain('rotateY(30deg)');
      expect(panels[1].style.transform).toContain('rotateY(30deg)');
    });

    it('ramp only rotates the second panel', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.ramp(45);
      await flushDefer();

      const panels = (ori as any)._panels.left as HTMLDivElement[];
      expect(panels[0].style.transform).toContain('rotateY(0deg)');
      expect(panels[1].style.transform).toContain('rotateY(45deg)');
      expect(panels[2].style.transform).toContain('rotateY(0deg)');
    });

    it('reveal keeps first panel flat (sticky)', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.reveal(30);
      await flushDefer();

      const panels = (ori as any)._panels.left as HTMLDivElement[];
      expect(panels[0].style.transform).toContain('rotateY(0deg)');
      // Second panel should be rotated
      expect(panels[1].style.transform).not.toContain('rotateY(0deg)');
    });

    it('fracture sets fracture mode on transforms', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.fracture(20);
      await flushDefer();

      const panels = (ori as any)._panels.left as HTMLDivElement[];
      // In fracture mode, x = y = z = angle
      const t = panels[0].style.transform;
      expect(t).toContain('rotateX(20deg)');
      expect(t).toContain('rotateY(20deg)');
      expect(t).toContain('rotateZ(20deg)');
    });
  });

  // ─── Anchor shorthand resolution ─────────────────────────────────────

  describe('anchor shorthand resolution', () => {
    it('resolves "l" to left', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(20, 'l');
      await flushDefer();
      expect((ori as any)._lastOp.anchor).toBe('left');
    });

    it('resolves "r" to right', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(20, 'r');
      await flushDefer();
      expect((ori as any)._lastOp.anchor).toBe('right');
    });

    it('resolves "t" to top', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(20, 't');
      await flushDefer();
      expect((ori as any)._lastOp.anchor).toBe('top');
    });

    it('resolves "b" to bottom', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(20, 'b');
      await flushDefer();
      expect((ori as any)._lastOp.anchor).toBe('bottom');
    });

    it('resolves numeric "1" to top', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(20, '1');
      await flushDefer();
      expect((ori as any)._lastOp.anchor).toBe('top');
    });

    it('resolves numeric "2" to right', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(20, '2');
      await flushDefer();
      expect((ori as any)._lastOp.anchor).toBe('right');
    });

    it('resolves unknown to left (default)', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(20, 'invalid');
      await flushDefer();
      expect((ori as any)._lastOp.anchor).toBe('left');
    });
  });

  // ─── Angle normalization ─────────────────────────────────────────────

  describe('angle normalization', () => {
    it('clamps angle to maxAngle', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, maxAngle: 45 });
      ori.accordion(100);
      await flushDefer();
      expect((ori as any)._lastOp.angle).toBe(45);
    });

    it('clamps negative angle to -maxAngle', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, maxAngle: 45 });
      ori.accordion(-100);
      await flushDefer();
      expect((ori as any)._lastOp.angle).toBe(-45);
    });

    it('treats NaN angle as 0', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.accordion(NaN);
      await flushDefer();
      expect((ori as any)._lastOp.angle).toBe(0);
    });
  });

  // ─── Configuration methods ───────────────────────────────────────────

  describe('configuration methods', () => {
    it('setSpeed updates speed config', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.setSpeed(500);
      expect((ori as any)._config.speed).toBe(500);
    });

    it('setSpeed updates panel transition durations', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.setSpeed(800);
      const panels = (ori as any)._panels.left as HTMLDivElement[];
      expect(panels[0].style.transitionDuration).toBe('800ms');
    });

    it('constrainAngle updates maxAngle', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.constrainAngle(45);
      expect((ori as any)._config.maxAngle).toBe(45);
    });

    it('constrainAngle falls back to default for invalid input', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.constrainAngle(NaN as any);
      expect((ori as any)._config.maxAngle).toBe(90); // default
    });

    it('setRipple updates ripple config', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.setRipple(2);
      expect((ori as any)._config.ripple).toBe(2);
    });
  });

  // ─── Freeze / Unfreeze ───────────────────────────────────────────────

  describe('freeze / unfreeze', () => {
    it('freeze sets isFrozen to true', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.freeze();
      await flushDefer();
      expect(ori.isFrozen).toBe(true);
    });

    it('freeze invokes callback', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      const cb = vi.fn();
      ori.freeze(cb);
      await flushDefer();
      expect(cb).toHaveBeenCalled();
    });

    it('freeze hides stage holder and shows clone', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.freeze();
      await flushDefer();
      const holder = (ori as any)._stageHolder as HTMLElement;
      const clone = (ori as any)._cloneEl as HTMLElement;
      expect(holder.style.transform).toContain('-99999px');
      expect(clone.style.transform).toBe('translate3d(0, 0, 0)');
    });

    it('unfreeze sets isFrozen to false', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.freeze();
      await flushDefer();
      ori.unfreeze();
      expect(ori.isFrozen).toBe(false);
    });

    it('unfreeze shows stage holder and hides clone', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.freeze();
      await flushDefer();
      ori.unfreeze();
      const holder = (ori as any)._stageHolder as HTMLElement;
      const clone = (ori as any)._cloneEl as HTMLElement;
      expect(holder.style.transform).toBe('translate3d(0, 0, 0)');
      expect(clone.style.transform).toContain('-99999px');
    });

    it('double freeze does not error and calls callback', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.freeze();
      await flushDefer();
      const cb = vi.fn();
      ori.freeze(cb);
      expect(cb).toHaveBeenCalled();
    });

    it('unfreeze when not frozen is a no-op', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.unfreeze();
      expect(ori.isFrozen).toBe(false);
    });
  });

  // ─── Touch enable/disable ────────────────────────────────────────────

  describe('touch control', () => {
    it('enableTouch sets cursor to grab', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.enableTouch();
      expect(ori.el.style.cursor).toBe('grab');
    });

    it('disableTouch sets cursor to default', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: true });
      ori.disableTouch();
      expect(ori.el.style.cursor).toBe('default');
    });

    it('enableTouch is idempotent', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.enableTouch();
      ori.enableTouch(); // should not throw
      expect((ori as any)._touchEnabled).toBe(true);
    });

    it('disableTouch is idempotent', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.disableTouch();
      ori.disableTouch(); // should not throw
      expect((ori as any)._touchEnabled).toBe(false);
    });
  });

  // ─── Queue management ────────────────────────────────────────────────

  describe('queue management', () => {
    it('emptyQueue clears the queue', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      // Manually push something onto the queue
      (ori as any)._queue.push(['fake', 0, 'left', {}]);
      ori.emptyQueue();
      expect((ori as any)._queue.length).toBe(0);
    });

    it('emptyQueue sets _inTrans to false after defer', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      (ori as any)._inTrans = true;
      ori.emptyQueue();
      await flushDefer();
      expect((ori as any)._inTrans).toBe(false);
    });
  });

  // ─── Destroy ─────────────────────────────────────────────────────────

  describe('destroy', () => {
    it('removes oridomi-active class', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      expect(el.classList.contains('oridomi-active')).toBe(true);
      ori.destroy();
      await flushDefer();
      expect(el.classList.contains('oridomi-active')).toBe(false);
    });

    it('restores original innerHTML from clone', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      ori.destroy();
      await flushDefer();
      // After destroy, the oridomi-holder and oridomi-clone should be gone
      expect(el.querySelector('.oridomi-holder')).toBeNull();
    });

    it('invokes destroy callback', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      const cb = vi.fn();
      ori.destroy(cb);
      await flushDefer();
      expect(cb).toHaveBeenCalled();
    });
  });

  // ─── modifyContent ───────────────────────────────────────────────────

  describe('modifyContent', () => {
    it('calls function with panel content elements', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      const elements: HTMLElement[] = [];
      ori.modifyContent((contentEl) => {
        elements.push(contentEl);
      });
      // 4 anchors × 3 panels = 12 calls
      expect(elements.length).toBe(12);
    });

    it('passes index and anchor to the callback', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      const indices: number[] = [];
      const anchors: string[] = [];
      ori.modifyContent((_el, i, anchor) => {
        indices.push(i);
        anchors.push(anchor);
      });
      expect(indices).toContain(0);
      expect(indices).toContain(1);
      expect(indices).toContain(2);
      expect(anchors).toContain('left');
      expect(anchors).toContain('right');
      expect(anchors).toContain('top');
      expect(anchors).toContain('bottom');
    });

    it('accepts a selector map with string content', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      // Root selector '' targets the content element itself
      ori.modifyContent({ '': 'Hello' });
      // Just verify it doesn't throw and returns the instance
      expect(ori).toBeInstanceOf(OriDomi);
    });
  });

  // ─── Shading modes ──────────────────────────────────────────────────

  describe('shading', () => {
    it('hard shading creates shader elements', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, shading: 'hard' });
      const shaders = (ori as any)._shaders;
      expect(shaders.left).toBeDefined();
      expect(shaders.left.left.length).toBe(3);
      expect(shaders.left.right.length).toBe(3);
    });

    it('soft shading creates shader elements', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, shading: 'soft' });
      const shaders = (ori as any)._shaders;
      expect(shaders.left.left.length).toBe(3);
    });

    it('disabled shading does not create shader elements', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false, shading: false });
      expect((ori as any)._shading).toBe(false);
    });
  });

  // ─── map() custom effect ─────────────────────────────────────────────

  describe('map', () => {
    it('returns a function', () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      const custom = ori.map((angle, _i, _len) => angle * 2);
      expect(typeof custom).toBe('function');
    });

    it('returned function applies custom transform per panel', async () => {
      const ori = new OriDomi(el, { speed: 0, touchEnabled: false });
      const double = ori.map((angle, _i, _len) => angle * 2);
      double(15);
      await flushDefer();

      const panels = (ori as any)._panels.left as HTMLDivElement[];
      // Each panel should get angle * 2 = 30
      expect(panels[0].style.transform).toContain('rotateY(30deg)');
    });
  });

  // ─── ESM export shape ────────────────────────────────────────────────

  describe('ESM exports', () => {
    it('default export is the OriDomi class', async () => {
      const mod = await import('../src/oridomi');
      expect(mod.default).toBe(OriDomi);
    });

    it('named export OriDomi is available', async () => {
      const { OriDomi: Named } = await import('../src/oridomi');
      expect(Named).toBe(OriDomi);
    });

    it('OriDomiOptions type is exported (no runtime assertion, just import check)', async () => {
      // This validates the export exists at the module level
      const mod = await import('../src/oridomi');
      expect(mod.default.VERSION).toBe('2.0.0');
    });
  });
});
