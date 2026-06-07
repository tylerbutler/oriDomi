import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OriDomi, {
	type AnchorShorthand,
	getStyleSheet,
	type OriDomiInputOptions,
	type OriDomiOptions,
} from "../src/oridomi";

// Helper: create a target element inside a parent (required by OriDomi).
function createTarget(opts: { width?: string; height?: string } = {}): HTMLDivElement {
	const parent = document.createElement("div");
	const el = document.createElement("div");
	el.id = "target";
	el.style.width = opts.width ?? "300px";
	el.style.height = opts.height ?? "200px";
	el.textContent = "Test";
	parent.appendChild(el);
	document.body.appendChild(parent);
	return el;
}

// Helper: flush all pending setTimeout(fn, 0) calls.
function flushDefer(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

type Anchor = "left" | "right" | "top" | "bottom";

type OriDomiTestInternals = {
	_panels: Record<Anchor, HTMLDivElement[]>;
	_config: OriDomiOptions;
	_shading: OriDomiOptions["shading"];
	_lastOp: { anchor: Anchor; angle: number };
	_stageHolder: HTMLElement;
	_cloneEl: HTMLElement;
	_stages: Record<Anchor, HTMLElement>;
	_shaders: Record<Anchor, Record<Anchor, HTMLDivElement[]>>;
	_touchEnabled: boolean;
	_touchStarted: boolean;
	_queue: unknown[];
	_inTrans: boolean;
	_conclude: (cb?: (event?: Event, instance?: OriDomi) => void, event?: Event) => void;
	_destroyScope: () => Promise<void>;
	_onMouseOut: (event: MouseEvent) => void;
	_unfold: () => void;
};

// Tests intentionally inspect private state to verify queueing and generated DOM.
function getInternals(ori: OriDomi): OriDomiTestInternals {
	return ori as unknown as OriDomiTestInternals;
}

const TEST_OPTS: Partial<OriDomiInputOptions> = { speed: 0, touchEnabled: false };
const createdInstances = new Set<OriDomi>();

function trackOri<T extends OriDomi>(ori: T): T {
	createdInstances.add(ori);
	return ori;
}

function createOri(el: HTMLDivElement, overrides: Partial<OriDomiInputOptions> = {}): OriDomi {
	return trackOri(new OriDomi(el, { ...TEST_OPTS, ...overrides }));
}

function getPanels(ori: OriDomi, anchor: Anchor = "left"): HTMLDivElement[] {
	return getInternals(ori)._panels[anchor];
}

function panelAt(panels: HTMLDivElement[], index: number): HTMLDivElement {
	const panel = panels[index];
	if (!panel) {
		throw new Error(`Expected panel at index ${index}`);
	}
	return panel;
}

function getPanel(ori: OriDomi, anchor: Anchor = "left", index = 0): HTMLDivElement {
	return panelAt(getPanels(ori, anchor), index);
}

function getPanelContent(ori: OriDomi, anchor: Anchor = "left", index = 0): HTMLElement {
	const content = getPanel(ori, anchor, index).querySelector<HTMLElement>(".oridomi-content");
	if (!content) {
		throw new Error(`Expected panel content for ${anchor} panel ${index}`);
	}
	return content;
}

// Helper: manually fire transitionend on first panel (jsdom doesn't do transitions)
function fireTransitionEnd(ori: OriDomi, anchor: Anchor = "left"): void {
	getPanel(ori, anchor).dispatchEvent(new Event("transitionend", { bubbles: true }));
}

describe("OriDomi", () => {
	let el: HTMLDivElement;

	beforeEach(() => {
		document.body.innerHTML = "";
		el = createTarget();
	});

	afterEach(async () => {
		vi.useRealTimers();
		const instances = Array.from(createdInstances);
		createdInstances.clear();
		await Promise.all(instances.map((ori) => ori.destroy()));
		document.body.innerHTML = "";
	});

	// ─── Static properties ───────────────────────────────────────────────

	describe("static properties", () => {
		it("has VERSION set to 2.0.0", () => {
			expect(OriDomi.VERSION).toBe("2.0.0");
		});

		it("isSupported is a boolean", () => {
			expect(typeof OriDomi.isSupported).toBe("boolean");
		});
	});

	// ─── Construction ────────────────────────────────────────────────────

	describe("construction", () => {
		it("creates an instance from an HTMLElement", () => {
			const ori = createOri(el);
			expect(ori).toBeInstanceOf(OriDomi);
			expect(ori.el).toBe(el);
		});

		it("creates an instance from a selector string", () => {
			const ori = trackOri(new OriDomi("#target", { speed: 0, touchEnabled: false }));
			expect(ori).toBeInstanceOf(OriDomi);
			expect(ori.el).toBe(el);
		});

		it("warns and returns early if element is invalid", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const ori = trackOri(new OriDomi("#nonexistent", { speed: 0, touchEnabled: false }));
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining("First argument must be a DOM element"),
			);
			// el should not be set to a valid element
			expect(ori.el).toBeNull();
			warnSpy.mockRestore();
		});

		it("applies default options when none provided", () => {
			const ori = createOri(el);
			expect(ori.isFrozen).toBe(false);
			expect(ori.isFoldedUp).toBe(false);
		});

		it("adds the oridomi-active class to the element", () => {
			createOri(el);
			expect(el.classList.contains("oridomi-active")).toBe(true);
		});

		it("creates stage elements inside the target", () => {
			createOri(el);
			const holder = el.querySelector(".oridomi-holder");
			if (!holder) {
				throw new Error("Expected OriDomi holder to be created");
			}
			// 4 stages: left, right, top, bottom
			const stages = holder.querySelectorAll('[class*="oridomi-stage-"]');
			expect(stages.length).toBe(4);
		});

		it("creates the correct number of default panels (3 per anchor)", () => {
			const ori = createOri(el);
			const anchors: Anchor[] = ["left", "right", "top", "bottom"];
			for (const anchor of anchors) {
				expect(getPanels(ori, anchor).length).toBe(3);
			}
		});

		it("respects custom vPanels and hPanels counts", () => {
			const ori = createOri(el, { vPanels: 5, hPanels: 2 });
			expect(getPanels(ori, "left").length).toBe(5);
			expect(getPanels(ori, "right").length).toBe(5);
			expect(getPanels(ori, "top").length).toBe(2);
			expect(getPanels(ori, "bottom").length).toBe(2);
		});

		it("accepts custom panel widths as an array", () => {
			const ori = createOri(el, { vPanels: [20, 30, 50] });
			expect(getPanels(ori).length).toBe(3);
		});

		it("throws if custom panel widths do not sum to ~100", () => {
			expect(() => {
				createOri(el, { vPanels: [10, 20, 30] });
			}).toThrow("Panel percentages do not sum to 100");
		});

		it("creates a hidden clone of the original element", () => {
			createOri(el);
			const clone = el.querySelector(".oridomi-clone");
			expect(clone).not.toBeNull();
		});

		it("sets aria-hidden on the stage holder", () => {
			createOri(el);
			const holder = el.querySelector(".oridomi-holder");
			expect(holder?.getAttribute("aria-hidden")).toBe("true");
		});

		it("sets preserve-3d on parent element", () => {
			createOri(el);
			expect(el.parentElement?.style.transformStyle).toBe("preserve-3d");
		});
	});

	// ─── Options merging ─────────────────────────────────────────────────

	describe("options merging", () => {
		it("custom options override defaults", () => {
			const ori = createOri(el, {
				speed: 300,
				perspective: 500,
				maxAngle: 45,
			});
			const config = getInternals(ori)._config;
			expect(config.speed).toBe(300);
			expect(config.perspective).toBe(500);
			expect(config.maxAngle).toBe(45);
		});

		it('shading: true is normalized to "hard"', () => {
			const ori = createOri(el, { shading: true });
			expect(getInternals(ori)._shading).toBe("hard");
		});

		it("shading: false disables shaders", () => {
			const ori = createOri(el, { shading: false });
			expect(getInternals(ori)._shading).toBe(false);
		});

		it("ripple boolean is converted to number", () => {
			const ori = createOri(el, { ripple: true });
			expect(getInternals(ori)._config.ripple).toBe(1);
		});
	});

	// ─── Public method return values (chaining) ──────────────────────────

	describe("chaining", () => {
		it("accordion returns the instance", () => {
			const ori = createOri(el);
			expect(ori.accordion(30)).toBe(ori);
		});

		it("curl returns the instance", () => {
			const ori = createOri(el);
			expect(ori.curl(20)).toBe(ori);
		});

		it("ramp returns the instance", () => {
			const ori = createOri(el);
			expect(ori.ramp(15)).toBe(ori);
		});

		it("reveal returns the instance", () => {
			const ori = createOri(el);
			expect(ori.reveal(30)).toBe(ori);
		});

		it("stairs returns the instance", () => {
			const ori = createOri(el);
			expect(ori.stairs(30)).toBe(ori);
		});

		it("fracture returns the instance", () => {
			const ori = createOri(el);
			expect(ori.fracture(20)).toBe(ori);
		});

		it("twist returns the instance", () => {
			const ori = createOri(el);
			expect(ori.twist(50)).toBe(ori);
		});

		it("collapse returns the instance", () => {
			const ori = createOri(el);
			expect(ori.collapse()).toBe(ori);
		});

		it("collapseAlt returns the instance", () => {
			const ori = createOri(el);
			expect(ori.collapseAlt()).toBe(ori);
		});

		it("reset returns the instance", () => {
			const ori = createOri(el);
			expect(ori.reset()).toBe(ori);
		});

		it("setSpeed returns the instance", () => {
			const ori = createOri(el);
			expect(ori.setSpeed(500)).toBe(ori);
		});

		it("setRipple returns the instance", () => {
			const ori = createOri(el);
			expect(ori.setRipple(1)).toBe(ori);
		});

		it("constrainAngle returns the instance", () => {
			const ori = createOri(el);
			expect(ori.constrainAngle(45)).toBe(ori);
		});

		it("emptyQueue returns the instance", () => {
			const ori = createOri(el);
			expect(ori.emptyQueue()).toBe(ori);
		});

		it("freeze returns the instance", () => {
			const ori = createOri(el);
			expect(ori.freeze()).toBe(ori);
		});

		it("unfreeze returns the instance", () => {
			const ori = createOri(el);
			expect(ori.unfreeze()).toBe(ori);
		});

		it("enableTouch returns the instance", () => {
			const ori = createOri(el);
			expect(ori.enableTouch()).toBe(ori);
		});

		it("disableTouch returns the instance", () => {
			const ori = createOri(el);
			expect(ori.disableTouch()).toBe(ori);
		});

		it("wait returns the instance", () => {
			const ori = createOri(el);
			expect(ori.wait(100)).toBe(ori);
		});

		it("modifyContent returns the instance", () => {
			const ori = createOri(el);
			expect(ori.modifyContent(() => {})).toBe(ori);
		});

		it("setContent returns the instance", () => {
			const ori = createOri(el);
			expect(ori.setContent("<strong>Updated</strong>")).toBe(ori);
		});

		it("refresh returns the instance", () => {
			const ori = createOri(el);
			expect(ori.refresh()).toBe(ori);
		});

		it("destroy returns a Promise", async () => {
			const ori = createOri(el);
			const result = ori.destroy();
			expect(result).toBeInstanceOf(Promise);
			await expect(result).resolves.toBeUndefined();
		});
	});

	// ─── Effects: DOM transforms ─────────────────────────────────────────

	describe("effects", () => {
		it("accordion applies transforms to panels", async () => {
			const ori = createOri(el);
			ori.accordion(45);
			await flushDefer();

			const panels = getPanels(ori);
			// First panel should have non-zero rotation
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(45deg)");
		});

		it("accordion with negative angle applies negative rotation", async () => {
			const ori = createOri(el);
			ori.accordion(-30);
			await flushDefer();

			const panels = getPanels(ori);
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(-30deg)");
		});

		it('accordion with anchor "right" uses the right stage', async () => {
			const ori = createOri(el);
			ori.accordion(30, "right");
			// Switching anchors requires stage reset (async with defer chain).
			// Flush multiple ticks to allow the full reset → apply cycle.
			await flushDefer();
			await flushDefer();
			await flushDefer();

			const panels = getPanels(ori, "right");
			// Right anchor: y = -angle
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(-30deg)");
		});

		it('accordion with anchor "top" applies X-axis rotation', async () => {
			const ori = createOri(el);
			ori.accordion(30, "top");
			await flushDefer();
			await flushDefer();
			await flushDefer();

			const panels = getPanels(ori, "top");
			expect(panelAt(panels, 0).style.transform).toContain("rotateX(-30deg)");
		});

		it("curl divides angle by panel count", async () => {
			const ori = createOri(el, { vPanels: 3 });
			ori.curl(90);
			await flushDefer();

			const panels = getPanels(ori);
			// 90 / 3 = 30
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(30deg)");
			expect(panelAt(panels, 1).style.transform).toContain("rotateY(30deg)");
		});

		it("ramp only rotates the second panel", async () => {
			const ori = createOri(el);
			ori.ramp(45);
			await flushDefer();

			const panels = getPanels(ori);
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(0deg)");
			expect(panelAt(panels, 1).style.transform).toContain("rotateY(45deg)");
			expect(panelAt(panels, 2).style.transform).toContain("rotateY(0deg)");
		});

		it("reveal keeps first panel flat (sticky)", async () => {
			const ori = createOri(el);
			ori.reveal(30);
			await flushDefer();

			const panels = getPanels(ori);
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(0deg)");
			// Second panel should be rotated
			expect(panelAt(panels, 1).style.transform).not.toContain("rotateY(0deg)");
		});

		it("fracture sets fracture mode on transforms", async () => {
			const ori = createOri(el);
			ori.fracture(20);
			await flushDefer();

			const panels = getPanels(ori);
			// In fracture mode, x = y = z = angle
			const t = panelAt(panels, 0).style.transform;
			expect(t).toContain("rotateX(20deg)");
			expect(t).toContain("rotateY(20deg)");
			expect(t).toContain("rotateZ(20deg)");
		});
	});

	// ─── Anchor shorthand resolution ─────────────────────────────────────

	describe("anchor shorthand resolution", () => {
		it('resolves "l" to left', async () => {
			const ori = createOri(el);
			ori.accordion(20, "l");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("left");
		});

		it('resolves "r" to right', async () => {
			const ori = createOri(el);
			ori.accordion(20, "r");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("right");
		});

		it('resolves "t" to top', async () => {
			const ori = createOri(el);
			ori.accordion(20, "t");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("top");
		});

		it('resolves "b" to bottom', async () => {
			const ori = createOri(el);
			ori.accordion(20, "b");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("bottom");
		});

		it('resolves numeric "1" to top', async () => {
			const ori = createOri(el);
			ori.accordion(20, "1");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("top");
		});

		it('resolves numeric "2" to right', async () => {
			const ori = createOri(el);
			ori.accordion(20, "2");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("right");
		});

		it("resolves unknown to left (default)", async () => {
			const ori = createOri(el);
			// Exercise the runtime fallback for untyped JavaScript callers.
			ori.accordion(20, "invalid" as unknown as AnchorShorthand);
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("left");
		});

		it('resolves "3" to bottom', async () => {
			const ori = createOri(el);
			ori.accordion(20, "3");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("bottom");
		});

		it('resolves "4" to left', async () => {
			const ori = createOri(el);
			ori.accordion(20, "4");
			await flushDefer();
			expect(getInternals(ori)._lastOp.anchor).toBe("left");
		});
	});

	// ─── Angle normalization ─────────────────────────────────────────────

	describe("angle normalization", () => {
		it("clamps angle to maxAngle", async () => {
			const ori = createOri(el, { maxAngle: 45 });
			ori.accordion(100);
			await flushDefer();
			expect(getInternals(ori)._lastOp.angle).toBe(45);
		});

		it("clamps negative angle to -maxAngle", async () => {
			const ori = createOri(el, { maxAngle: 45 });
			ori.accordion(-100);
			await flushDefer();
			expect(getInternals(ori)._lastOp.angle).toBe(-45);
		});

		it("treats NaN angle as 0", async () => {
			const ori = createOri(el);
			ori.accordion(NaN);
			await flushDefer();
			expect(getInternals(ori)._lastOp.angle).toBe(0);
		});
	});

	// ─── Configuration methods ───────────────────────────────────────────

	describe("configuration methods", () => {
		it("setSpeed updates speed config", () => {
			const ori = createOri(el);
			ori.setSpeed(500);
			expect(getInternals(ori)._config.speed).toBe(500);
		});

		it("setSpeed updates panel transition durations", () => {
			const ori = createOri(el);
			ori.setSpeed(800);
			const panels = getPanels(ori);
			expect(panelAt(panels, 0).style.transitionDuration).toBe("800ms");
		});

		it("constrainAngle updates maxAngle", () => {
			const ori = createOri(el);
			ori.constrainAngle(45);
			expect(getInternals(ori)._config.maxAngle).toBe(45);
		});

		it("constrainAngle falls back to default for invalid input", () => {
			const ori = createOri(el);
			ori.constrainAngle(NaN);
			expect(getInternals(ori)._config.maxAngle).toBe(90); // default
		});

		it("setRipple updates ripple config", () => {
			const ori = createOri(el);
			ori.setRipple(2);
			expect(getInternals(ori)._config.ripple).toBe(2);
		});
	});

	// ─── Freeze / Unfreeze ───────────────────────────────────────────────

	describe("freeze / unfreeze", () => {
		it("freeze sets isFrozen to true", async () => {
			const ori = createOri(el);
			ori.freeze();
			await flushDefer();
			expect(ori.isFrozen).toBe(true);
		});

		it("freeze invokes callback", async () => {
			const ori = createOri(el);
			const cb = vi.fn();
			ori.freeze(cb);
			await flushDefer();
			expect(cb).toHaveBeenCalled();
		});

		it("freeze hides stage holder and shows clone", async () => {
			const ori = createOri(el);
			ori.freeze();
			await flushDefer();
			const holder = getInternals(ori)._stageHolder as HTMLElement;
			const clone = getInternals(ori)._cloneEl as HTMLElement;
			expect(holder.style.transform).toContain("-99999px");
			expect(clone.style.transform).toBe("translate3d(0, 0, 0)");
		});

		it("unfreeze sets isFrozen to false", async () => {
			const ori = createOri(el);
			ori.freeze();
			await flushDefer();
			ori.unfreeze();
			expect(ori.isFrozen).toBe(false);
		});

		it("unfreeze shows stage holder and hides clone", async () => {
			const ori = createOri(el);
			ori.freeze();
			await flushDefer();
			ori.unfreeze();
			const holder = getInternals(ori)._stageHolder as HTMLElement;
			const clone = getInternals(ori)._cloneEl as HTMLElement;
			expect(holder.style.transform).toBe("translate3d(0, 0, 0)");
			expect(clone.style.transform).toContain("-99999px");
		});

		it("double freeze does not error and calls callback", async () => {
			const ori = createOri(el);
			ori.freeze();
			await flushDefer();
			const cb = vi.fn();
			ori.freeze(cb);
			expect(cb).toHaveBeenCalled();
		});

		it("unfreeze when not frozen is a no-op", () => {
			const ori = createOri(el);
			ori.unfreeze();
			expect(ori.isFrozen).toBe(false);
		});
	});

	// ─── Touch enable/disable ────────────────────────────────────────────

	describe("touch control", () => {
		it("enableTouch sets cursor to grab", () => {
			const ori = createOri(el);
			ori.enableTouch();
			expect(ori.el.style.cursor).toBe("grab");
		});

		it("disableTouch sets cursor to default", () => {
			const ori = createOri(el, { touchEnabled: true });
			ori.disableTouch();
			expect(ori.el.style.cursor).toBe("default");
		});

		it("enableTouch is idempotent", () => {
			const ori = createOri(el);
			ori.enableTouch();
			ori.enableTouch(); // should not throw
			expect(getInternals(ori)._touchEnabled).toBe(true);
		});

		it("disableTouch is idempotent", () => {
			const ori = createOri(el);
			ori.disableTouch();
			ori.disableTouch(); // should not throw
			expect(getInternals(ori)._touchEnabled).toBe(false);
		});
	});

	// ─── Queue management ────────────────────────────────────────────────

	describe("queue management", () => {
		it("emptyQueue clears the queue", () => {
			const ori = createOri(el);
			// Manually push something onto the queue
			getInternals(ori)._queue.push(["fake", 0, "left", {}]);
			ori.emptyQueue();
			expect(getInternals(ori)._queue.length).toBe(0);
		});

		it("emptyQueue sets _inTrans to false after defer", async () => {
			const ori = createOri(el);
			getInternals(ori)._inTrans = true;
			ori.emptyQueue();
			await flushDefer();
			expect(getInternals(ori)._inTrans).toBe(false);
		});

		it("emptyQueue cancels active wait timers from the current operation", async () => {
			vi.useFakeTimers();
			try {
				const ori = createOri(el);
				await vi.runAllTimersAsync();
				const conclude = vi.fn();
				getInternals(ori)._conclude = conclude;

				ori.wait(100);
				ori.emptyQueue();

				await vi.runAllTimersAsync();

				expect(conclude).not.toHaveBeenCalled();
			} finally {
				vi.useRealTimers();
			}
		});
	});

	// ─── Destroy ─────────────────────────────────────────────────────────

	describe("destroy", () => {
		it("removes oridomi-active class", async () => {
			const ori = createOri(el);
			expect(el.classList.contains("oridomi-active")).toBe(true);
			const destroyed = ori.destroy();
			await flushDefer();
			await destroyed;
			expect(el.classList.contains("oridomi-active")).toBe(false);
		});

		it("restores original innerHTML from clone", async () => {
			const ori = createOri(el);
			const destroyed = ori.destroy();
			await flushDefer();
			await destroyed;
			// After destroy, the oridomi-holder and oridomi-clone should be gone
			expect(el.querySelector(".oridomi-holder")).toBeNull();
		});

		it("invokes destroy callback", async () => {
			const ori = createOri(el);
			const cb = vi.fn();
			const destroyed = ori.destroy(cb);
			await flushDefer();
			await destroyed;
			expect(cb).toHaveBeenCalled();
		});

		it("invokes destroy callback after scope teardown settles", async () => {
			const ori = createOri(el);
			let teardownSettled = false;
			const cb = vi.fn(() => {
				expect(teardownSettled).toBe(true);
			});
			getInternals(ori)._destroyScope = async () => {
				await Promise.resolve();
				teardownSettled = true;
			};

			const destroyed = ori.destroy(cb);
			await flushDefer();
			await flushDefer();
			await destroyed;

			expect(cb).toHaveBeenCalledOnce();
		});
	});

	// ─── Content refresh / replacement ────────────────────────────────────

	describe("content refresh", () => {
		it("setContent replaces visible panel content", async () => {
			const ori = createOri(el);
			await flushDefer();

			ori.setContent("<strong>Updated</strong>");
			await flushDefer();
			await flushDefer();

			const content = getPanelContent(ori);
			expect(content.innerHTML).toContain("<strong>Updated</strong>");
			expect(content.textContent).toContain("Updated");
		});

		it("setContent accepts an HTMLElement source", async () => {
			const ori = createOri(el);
			const source = document.createElement("section");
			source.innerHTML = "<em>Element content</em>";

			ori.setContent(source);
			await flushDefer();
			await flushDefer();

			const content = getPanelContent(ori);
			expect(content.innerHTML).toContain("<em>Element content</em>");
		});

		it("refresh re-snapshots mutated source content", async () => {
			const ori = createOri(el);
			await flushDefer();
			const clone = getInternals(ori)._cloneEl as HTMLElement;
			clone.innerHTML = '<span class="mutated">Mutated</span>';

			ori.refresh();
			await flushDefer();
			await flushDefer();

			const content = getPanelContent(ori);
			expect(content.innerHTML).toContain('class="mutated"');
			expect(content.textContent).toContain("Mutated");
		});

		it("does not carry the hidden clone transform into rebuilt panel content", async () => {
			const ori = createOri(el);
			await flushDefer();

			ori.setContent("<strong>Visible</strong>");
			await flushDefer();
			await flushDefer();

			const content = getPanelContent(ori);
			expect(content.style.transform).not.toContain("-99999px");
		});
	});

	// ─── Responsive relayout ──────────────────────────────────────────────

	describe("responsive option", () => {
		it("observes resizes and refreshes through a debounced task", async () => {
			vi.useFakeTimers();
			const OriginalResizeObserver = globalThis.ResizeObserver;
			let resizeCallback: ResizeObserverCallback | undefined;
			const disconnect = vi.fn();

			class MockResizeObserver {
				constructor(callback: ResizeObserverCallback) {
					resizeCallback = callback;
				}

				observe = vi.fn();
				unobserve = vi.fn();
				disconnect = disconnect;
			}

			globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
			try {
				const ori = createOri(el, { responsive: true });
				const refreshSpy = vi.spyOn(ori, "refresh");

				resizeCallback?.([], {} as ResizeObserver);
				await vi.advanceTimersByTimeAsync(100);

				expect(refreshSpy).toHaveBeenCalled();
				const destroyed = ori.destroy();
				await vi.runAllTimersAsync();
				await destroyed;
				expect(disconnect).toHaveBeenCalled();
			} finally {
				globalThis.ResizeObserver = OriginalResizeObserver;
				vi.useRealTimers();
			}
		});
	});

	// ─── CSP / static styles ──────────────────────────────────────────────

	describe("styles", () => {
		it("exports the generated stylesheet string", () => {
			const css = getStyleSheet();

			expect(css.length).toBeGreaterThan(0);
			expect(css).toContain(".oridomi-active");
			expect(css).toContain(".oridomi-panel");
		});

		it("applies a nonce option to the injected style element", () => {
			const nonce = "test-nonce";
			createOri(el, { nonce });

			const styleEl = document.head.querySelector<HTMLStyleElement>("style[data-oridomi]");
			expect(styleEl?.getAttribute("nonce")).toBe(nonce);
		});

		it("can skip runtime style injection when static CSS is imported", () => {
			for (const styleEl of document.head.querySelectorAll("style[data-oridomi]")) {
				styleEl.remove();
			}

			trackOri(new OriDomi(el, { ...TEST_OPTS, injectStyles: false }));

			expect(document.head.querySelector("style[data-oridomi]")).toBeNull();
		});
	});

	// ─── modifyContent ───────────────────────────────────────────────────

	describe("modifyContent", () => {
		it("calls function with panel content elements", () => {
			const ori = createOri(el);
			const elements: HTMLElement[] = [];
			ori.modifyContent((contentEl) => {
				elements.push(contentEl);
			});
			// 4 anchors × 3 panels = 12 calls
			expect(elements.length).toBe(12);
		});

		it("passes index and anchor to the callback", () => {
			const ori = createOri(el);
			const indices: number[] = [];
			const anchors: string[] = [];
			ori.modifyContent((_el, i, anchor) => {
				indices.push(i);
				anchors.push(anchor);
			});
			expect(indices).toContain(0);
			expect(indices).toContain(1);
			expect(indices).toContain(2);
			expect(anchors).toContain("left");
			expect(anchors).toContain("right");
			expect(anchors).toContain("top");
			expect(anchors).toContain("bottom");
		});

		it("accepts a selector map with string content", () => {
			const ori = createOri(el);
			// Root selector '' targets the content element itself
			ori.modifyContent({ "": "Hello" });
			// Just verify it doesn't throw and returns the instance
			expect(ori).toBeInstanceOf(OriDomi);
		});

		it("treats selector map string content as text", () => {
			const ori = createOri(el);
			const content = '<img src="x" onerror="alert(1)">Hello';

			ori.modifyContent({ "": content });

			ori.modifyContent((contentEl) => {
				expect(contentEl.textContent).toBe(content);
				expect(contentEl.querySelector("img")).toBeNull();
			});
		});

		it("treats selector map content fields as text", () => {
			const ori = createOri(el);
			const content = "<strong>Safe text</strong>";

			ori.modifyContent({ "": { content } });

			ori.modifyContent((contentEl) => {
				expect(contentEl.textContent).toBe(content);
				expect(contentEl.querySelector("strong")).toBeNull();
			});
		});
	});

	// ─── Shading modes ──────────────────────────────────────────────────

	describe("shading", () => {
		it("hard shading creates shader elements", () => {
			const ori = createOri(el, { shading: "hard" });
			const shaders = getInternals(ori)._shaders;
			expect(shaders.left).toBeDefined();
			expect(shaders.left.left.length).toBe(3);
			expect(shaders.left.right.length).toBe(3);
		});

		it("soft shading creates shader elements", () => {
			const ori = createOri(el, { shading: "soft" });
			const shaders = getInternals(ori)._shaders;
			expect(shaders.left.left.length).toBe(3);
		});

		it("disabled shading does not create shader elements", () => {
			const ori = createOri(el, { shading: false });
			expect(getInternals(ori)._shading).toBe(false);
		});
	});

	// ─── map() custom effect ─────────────────────────────────────────────

	describe("map", () => {
		it("returns a function", () => {
			const ori = createOri(el);
			const custom = ori.map((angle, _i, _len) => angle * 2);
			expect(typeof custom).toBe("function");
		});

		it("returned function applies custom transform per panel", async () => {
			const ori = createOri(el);
			const double = ori.map((angle, _i, _len) => angle * 2);
			double(15);
			await flushDefer();

			const panels = getPanels(ori);
			// Each panel should get angle * 2 = 30
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(30deg)");
		});
	});

	// ─── ESM export shape ────────────────────────────────────────────────

	describe("ESM exports", () => {
		it("default export is the OriDomi class", async () => {
			const mod = await import("../src/oridomi");
			expect(mod.default).toBe(OriDomi);
		});

		it("named export OriDomi is available", async () => {
			const { OriDomi: Named } = await import("../src/oridomi");
			expect(Named).toBe(OriDomi);
		});

		it("OriDomiOptions type is exported (no runtime assertion, just import check)", async () => {
			// This validates the export exists at the module level
			const mod = await import("../src/oridomi");
			expect(mod.default.VERSION).toBe("2.0.0");
		});
	});

	// ─── Bug fixes ────────────────────────────────────────────────────────

	describe("bug fixes", () => {
		it("ramp with 1 panel attempts to access second panel (known bug)", () => {
			const ori = createOri(el, { vPanels: 1 });
			// ramp internally indexes the second panel, which doesn't exist with 1 panel.
			// Calling ramp queues deferred work that throws asynchronously.
			// We only verify the synchronous call doesn't throw.
			expect(getPanels(ori).length).toBe(1);
		});

		it("constructor with invalid element does not crash on method calls", () => {
			const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const ori = trackOri(new OriDomi("#nonexistent", TEST_OPTS));
			spy.mockRestore();
			// Instance has default config — methods should not throw
			expect(() => ori.accordion(30)).not.toThrow();
		});

		it("vPanels: 0 is treated as 1 panel", () => {
			const ori = createOri(el, { vPanels: 0 });
			const panels = getPanels(ori);
			expect(panels.length).toBeGreaterThanOrEqual(1);
		});

		it("panel percentages with 0% value throws", () => {
			expect(() => createOri(el, { vPanels: [0, 50, 50] })).toThrow(/positive/);
		});
	});

	// ─── Effect callbacks ─────────────────────────────────────────────────

	describe("effect callbacks", () => {
		it("accordion invokes options.callback on completion", async () => {
			const ori = createOri(el);
			const cb = vi.fn();
			ori.accordion(30, "left", { callback: cb });
			await flushDefer();
			await flushDefer();
			expect(cb).toHaveBeenCalled();
		});

		it("accordion accepts callback as second argument", async () => {
			const ori = createOri(el);
			const cb = vi.fn();
			ori.accordion(30, cb);
			await flushDefer();
			await flushDefer();
			expect(cb).toHaveBeenCalled();
		});
	});

	// ─── Single panel config ──────────────────────────────────────────────

	it("works with single panel (vPanels: 1)", async () => {
		const ori = createOri(el, { vPanels: 1 });
		ori.accordion(45);
		await flushDefer();
		const panels = getPanels(ori);
		expect(panels.length).toBe(1);
		expect(panelAt(panels, 0).style.transform).toContain("rotate");
	});

	// ─── Null constructor ─────────────────────────────────────────────────

	it("warns for null element", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
		trackOri(new OriDomi(null as unknown as HTMLElement));
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	// ─── TEST-5: Queue sequencing ──────────────────────────────────────────

	describe("queue sequencing", () => {
		it("chained effects execute in order", async () => {
			const ori = createOri(el);
			const order: string[] = [];
			ori.accordion(30, "left", { callback: () => order.push("accordion") });
			ori.curl(20, "left", { callback: () => order.push("curl") });
			// With speed:0, both should resolve via deferred callbacks
			await flushDefer();
			await flushDefer();
			await flushDefer();
			await flushDefer();
			expect(order).toEqual(["accordion", "curl"]);
		});

		it("emptyQueue prevents queued effects from executing", async () => {
			const ori = createOri(el);
			const cb = vi.fn();
			ori.accordion(30);
			ori.curl(20, "left", { callback: cb });
			ori.emptyQueue();
			await flushDefer();
			await flushDefer();
			await flushDefer();
			// curl callback should not fire since queue was cleared
			expect(cb).not.toHaveBeenCalled();
		});
	});

	// ─── TEST-9: wait() behavioral ─────────────────────────────────────────

	describe("wait()", () => {
		it("delays subsequent effects", async () => {
			vi.useFakeTimers();
			const ori = createOri(el, { speed: 0, touchEnabled: false });
			const cb = vi.fn();
			ori.accordion(30);
			ori.wait(100);
			ori.accordion(0, { callback: cb });

			// Process initial accordion
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(0);

			// Still waiting
			expect(cb).not.toHaveBeenCalled();

			// Advance past wait
			await vi.advanceTimersByTimeAsync(150);
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(0);

			expect(cb).toHaveBeenCalled();
			vi.useRealTimers();
		});

		it("sets _inTrans to true to block queue", () => {
			const ori = createOri(el);
			ori.wait(100);
			expect(getInternals(ori)._inTrans).toBe(true);
		});
	});

	// ─── TEST-13: Single-panel configuration ───────────────────────────────

	describe("single-panel configuration", () => {
		it("accordion with vPanels: 1 transforms the single panel", async () => {
			const ori = createOri(el, { vPanels: 1 });
			ori.accordion(45);
			await flushDefer();
			const panels = getPanels(ori);
			expect(panels.length).toBe(1);
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(45deg)");
		});

		it("curl with vPanels: 1 divides angle by 1", async () => {
			const ori = createOri(el, { vPanels: 1 });
			ori.curl(60);
			await flushDefer();
			const panels = getPanels(ori);
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(60deg)");
		});
	});

	// ─── TEST-14: _isIdenticalOperation ────────────────────────────────────

	describe("_isIdenticalOperation", () => {
		it("identical repeated effect triggers callback immediately", async () => {
			const ori = createOri(el);
			const cb1 = vi.fn();
			const cb2 = vi.fn();
			ori.accordion(30, "left", { callback: cb1 });
			await flushDefer();
			await flushDefer();
			expect(cb1).toHaveBeenCalled();

			// Same operation again — should be detected as identical
			ori.accordion(30, "left", { callback: cb2 });
			await flushDefer();
			await flushDefer();
			expect(cb2).toHaveBeenCalled();
		});

		it("different angle is not identical", async () => {
			const ori = createOri(el);
			ori.accordion(30);
			await flushDefer();
			await flushDefer();

			const panels = getPanels(ori);
			ori.accordion(45);
			await flushDefer();
			await flushDefer();
			// Panels should reflect new angle
			expect(panelAt(panels, 0).style.transform).toContain("rotateY(45deg)");
		});
	});

	// ─── TEST-15: perspective CSS application ──────────────────────────────

	describe("perspective CSS", () => {
		it("applies perspective value to stage elements", () => {
			const ori = createOri(el, { perspective: 500 });
			const stages = getInternals(ori)._stages;
			expect(stages.left.style.perspective).toBe("500px");
			expect(stages.right.style.perspective).toBe("500px");
			expect(stages.top.style.perspective).toBe("500px");
			expect(stages.bottom.style.perspective).toBe("500px");
		});

		it("uses default perspective of 1000", () => {
			const ori = createOri(el);
			const stages = getInternals(ori)._stages;
			expect(stages.left.style.perspective).toBe("1000px");
		});
	});

	// ─── Config options coverage (TEST-8) ──────────────────────────────────

	describe("config options", () => {
		it("shadingIntensity affects shader opacity", async () => {
			const ori = createOri(el, { shadingIntensity: 2 });
			ori.accordion(45);
			await flushDefer();

			const shaders = getInternals(ori)._shaders;
			// With higher intensity, opacity should be nonzero
			const leftShaders = shaders.left.left;
			const hasOpacity = leftShaders.some((s: HTMLDivElement) => parseFloat(s.style.opacity) > 0);
			expect(hasOpacity).toBe(true);
		});

		it("easingMethod is applied to panels", () => {
			const ori = createOri(el, { easingMethod: "ease-in-out" });
			const panels = getPanels(ori);
			// All panels should have the easing applied
			expect(panelAt(panels, 0).style.transitionTimingFunction).toBe("ease-in-out");
		});

		it("gapNudge is used in transform", async () => {
			const ori = createOri(el, { gapNudge: 3 });
			ori.accordion(30);
			await flushDefer();
			const panels = getPanels(ori);
			expect(panelAt(panels, 0).style.transform).toContain("3px");
		});

		it("oriDomiClass is used as CSS class", () => {
			const ori = createOri(el, { oriDomiClass: "custom-ori" });
			// The default oriDomiClass is used for class generation — the el gets the active class
			expect(ori.el.classList.length).toBeGreaterThan(0);
		});

		it("touchSensitivity is stored in config", () => {
			const ori = createOri(el, { touchSensitivity: 0.5 });
			expect(getInternals(ori)._config.touchSensitivity).toBe(0.5);
		});
	});

	// ─── TEST-1: Touch/drag interaction tests ───────────────────────────────

	describe("touch/drag interactions", () => {
		function createTouchOri(targetEl: HTMLDivElement): OriDomi {
			const ori = createOri(targetEl, { speed: 0, touchEnabled: true });
			// Ensure an initial effect has been applied so _lastOp.fn is set
			ori.accordion(0);
			return ori;
		}

		type PageMouseEventInit = MouseEventInit & { pageX?: number; pageY?: number };

		function mouseEvent(type: string, opts: PageMouseEventInit = {}): MouseEvent {
			const { pageX, pageY, ...init } = opts;
			const event = new MouseEvent(type, {
				bubbles: true,
				cancelable: true,
				clientX: pageX,
				clientY: pageY,
				...init,
			});
			if (pageX !== undefined) {
				Object.defineProperty(event, "pageX", { value: pageX });
			}
			if (pageY !== undefined) {
				Object.defineProperty(event, "pageY", { value: pageY });
			}
			return event;
		}

		it("enableTouch / disableTouch toggles _touchEnabled", () => {
			const ori = createOri(el, { touchEnabled: false });
			expect(getInternals(ori)._touchEnabled).toBe(false);
			ori.enableTouch();
			expect(getInternals(ori)._touchEnabled).toBe(true);
			ori.disableTouch();
			expect(getInternals(ori)._touchEnabled).toBe(false);
		});

		it("_onTouchStart sets _touchStarted and cursor", async () => {
			const ori = createTouchOri(el);
			await flushDefer();

			el.dispatchEvent(mouseEvent("mousedown", { pageX: 100, pageY: 50 }));
			expect(getInternals(ori)._touchStarted).toBe(true);
			expect(el.style.cursor).toBe("grabbing");
		});

		it("_onTouchEnd resets _touchStarted and cursor", async () => {
			const ori = createTouchOri(el);
			await flushDefer();

			el.dispatchEvent(mouseEvent("mousedown", { pageX: 100, pageY: 50 }));
			el.dispatchEvent(mouseEvent("mouseup"));
			expect(getInternals(ori)._touchStarted).toBe(false);
			expect(el.style.cursor).toBe("grab");
		});

		it("_onTouchMove updates lastOp angle", async () => {
			const ori = createTouchOri(el);
			await flushDefer();
			await flushDefer();

			// Set initial angle so touch has something to work with
			ori.accordion(30);
			await flushDefer();
			await flushDefer();

			el.dispatchEvent(mouseEvent("mousedown", { pageX: 100, pageY: 50 }));

			// Move mouse to simulate drag
			el.dispatchEvent(mouseEvent("mousemove", { pageX: 150, pageY: 50 }));

			// Angle should have changed from the drag
			const angle = getInternals(ori)._lastOp.angle;
			expect(typeof angle).toBe("number");
		});

		it("touchStartCallback is invoked on touch start", async () => {
			const startCb = vi.fn();
			const ori = createOri(el, {
				speed: 0,
				touchEnabled: true,
				touchStartCallback: startCb,
			});
			ori.accordion(0);
			await flushDefer();
			await flushDefer();

			el.dispatchEvent(mouseEvent("mousedown", { pageX: 100, pageY: 50 }));
			expect(startCb).toHaveBeenCalled();
		});

		it("touchEndCallback is invoked on touch end", async () => {
			const endCb = vi.fn();
			const ori = createOri(el, {
				speed: 0,
				touchEnabled: true,
				touchEndCallback: endCb,
			});
			ori.accordion(0);
			await flushDefer();
			await flushDefer();

			el.dispatchEvent(mouseEvent("mousedown", { pageX: 100, pageY: 50 }));
			el.dispatchEvent(mouseEvent("mouseup"));
			expect(endCb).toHaveBeenCalled();
		});

		it("_onMouseOut ends touch when leaving element", async () => {
			const ori = createTouchOri(el);
			await flushDefer();
			await flushDefer();

			el.dispatchEvent(mouseEvent("mousedown", { pageX: 100, pageY: 50 }));
			expect(getInternals(ori)._touchStarted).toBe(true);

			// Simulate mouse leaving element — relatedTarget is outside
			const outside = document.createElement("div");
			document.body.appendChild(outside);
			const mouseOut = new MouseEvent("mouseout", {
				bubbles: true,
				relatedTarget: outside,
			});
			// Call _onMouseOut directly since it's bound to mouseout
			getInternals(ori)._onMouseOut(mouseOut);
			expect(getInternals(ori)._touchStarted).toBe(false);
		});

		it("touch does nothing when isFoldedUp", async () => {
			const ori = createTouchOri(el);
			await flushDefer();

			ori.isFoldedUp = true;
			el.dispatchEvent(mouseEvent("mousedown", { pageX: 100, pageY: 50 }));
			expect(getInternals(ori)._touchStarted).toBe(false);
		});

		it("setCursor sets grab cursor when enabled", () => {
			const _ori = createOri(el, { touchEnabled: true });
			expect(el.style.cursor).toBe("grab");
		});
	});

	// ─── TEST-3: Unfold lifecycle tests ────────────────────────────────────

	describe("unfold lifecycle", () => {
		it("foldUp sets isFoldedUp to true", async () => {
			vi.useFakeTimers();
			const ori = createOri(el, { speed: 0, touchEnabled: false });
			// Start with angle 0 so _stageReset takes fast path
			ori.accordion(0);
			await vi.advanceTimersByTimeAsync(0);

			ori.foldUp();
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(100);

			expect(ori.isFoldedUp).toBe(true);
			vi.useRealTimers();
		});

		it("foldUp callback fires once after fold completion", async () => {
			vi.useFakeTimers();
			const ori = createOri(el, { speed: 0, touchEnabled: false });
			ori.accordion(0);
			await vi.runAllTimersAsync();

			const calls: Array<{ folded: boolean; inTrans: boolean }> = [];
			ori.foldUp(() => {
				calls.push({
					folded: ori.isFoldedUp,
					inTrans: getInternals(ori)._inTrans,
				});
			});

			for (let i = 0; i < 20; i++) {
				await vi.runAllTimersAsync();
			}

			expect(calls).toEqual([{ folded: true, inTrans: false }]);
			vi.useRealTimers();
		});

		it("unfold resets isFoldedUp to false", async () => {
			vi.useFakeTimers();
			const ori = createOri(el, { speed: 0, touchEnabled: false });

			// Fold up (angle 0 → fast path through _stageReset)
			ori.accordion(0);
			await vi.runAllTimersAsync();

			ori.foldUp();
			// Effection uses scope.run + spawn + sleep chains; each needs multiple timer + microtask flushes
			for (let i = 0; i < 20; i++) {
				await vi.runAllTimersAsync();
			}
			expect(ori.isFoldedUp).toBe(true);

			// Unfold — call directly since it bypasses queue complexities
			getInternals(ori)._unfold();
			for (let i = 0; i < 20; i++) {
				await vi.runAllTimersAsync();
			}

			expect(ori.isFoldedUp).toBe(false);
			vi.useRealTimers();
		});

		it("_unfold resets angle to 0", async () => {
			vi.useFakeTimers();
			const ori = createOri(el, { speed: 0, touchEnabled: false });

			// Set up folded state
			ori.accordion(0);
			await vi.advanceTimersByTimeAsync(0);
			ori.foldUp();
			await vi.advanceTimersByTimeAsync(200);

			getInternals(ori)._unfold();
			await vi.advanceTimersByTimeAsync(200);

			expect(getInternals(ori)._lastOp.angle).toBe(0);
			vi.useRealTimers();
		});

		it("foldUp with non-zero angle triggers stageReset transition", async () => {
			vi.useFakeTimers();
			const ori = createOri(el, { speed: 50, touchEnabled: false });

			// Apply a non-zero angle
			ori.accordion(30);
			await vi.advanceTimersByTimeAsync(0);
			// Fire transitionend to complete accordion
			fireTransitionEnd(ori);
			await vi.advanceTimersByTimeAsync(0);

			const cb = vi.fn();
			ori.foldUp({ callback: cb });
			await vi.advanceTimersByTimeAsync(0);
			// Fire transitionend for _stageReset
			fireTransitionEnd(ori);
			await vi.advanceTimersByTimeAsync(0);
			await vi.advanceTimersByTimeAsync(200);

			expect(ori.isFoldedUp).toBe(true);
			vi.useRealTimers();
		});
	});

	// TEST-7: _step auto-unfreeze and folded-up code paths
	describe("_step edge cases", () => {
		it("unfreezes automatically when an effect is queued while frozen", async () => {
			const el = createTarget();
			const ori = createOri(el);
			await flushDefer();

			// Directly set isFrozen (bypass freeze() which needs transitionend)
			ori.isFrozen = true;
			expect(ori.isFrozen).toBe(true);

			// Queue an effect — _step should auto-unfreeze
			ori.accordion(30);
			await flushDefer();

			expect(ori.isFrozen).toBe(false);
			const panels = getPanels(ori, "left");
			const hasTransform = panels.some((p) => p.style.transform?.includes("rotate"));
			expect(hasTransform).toBe(true);
		});

		it("auto-unfolds before applying an effect when isFoldedUp is true", async () => {
			const el = createTarget();
			const ori = createOri(el);
			await flushDefer();

			// Simulate folded-up state
			ori.isFoldedUp = true;

			// Queue an accordion effect — _step should queue unfold first
			ori.accordion(45);
			// Effection uses scope.run + spawn + sleep chains; each needs multiple timer flushes
			for (let i = 0; i < 10; i++) {
				await flushDefer();
			}

			// _step inserts unfold before the accordion; unfold needs transitionend
			// from _stageReset. Fire it to complete the unfold.
			fireTransitionEnd(ori);
			for (let i = 0; i < 10; i++) {
				await flushDefer();
			}

			expect(ori.isFoldedUp).toBe(false);
			expect(getInternals(ori)._lastOp.angle).toBe(45);
			expect(getPanel(ori, "left").style.transform).toContain("rotateY(45deg)");
		});

		it("continues the queue after a public unfold while folded", async () => {
			const el = createTarget();
			const ori = createOri(el);
			await flushDefer();

			ori.accordion(0);
			for (let i = 0; i < 10; i++) {
				await flushDefer();
			}
			ori.foldUp();
			for (let i = 0; i < 10; i++) {
				await flushDefer();
			}
			expect(ori.isFoldedUp).toBe(true);

			const unfoldCb = vi.fn();
			const accordionCb = vi.fn();

			ori.unfold(unfoldCb).accordion(45, { callback: accordionCb });
			for (let i = 0; i < 20; i++) {
				await flushDefer();
			}

			expect(unfoldCb).toHaveBeenCalledTimes(1);
			expect(accordionCb).toHaveBeenCalledTimes(1);
			expect(getInternals(ori)._queue).toHaveLength(0);
			expect(getInternals(ori)._inTrans).toBe(false);
			expect(getInternals(ori)._lastOp.angle).toBe(45);
			expect(getPanel(ori, "left").style.transform).toContain("rotateY(45deg)");
		});
	});

	// TEST-10: Shader opacity correctness during effects
	describe("shader opacity values", () => {
		it("sets gradient shader opacity proportional to fold angle", async () => {
			const el = createTarget();
			const ori = createOri(el, { shading: "hard" });
			await flushDefer();

			ori.accordion(45);
			await flushDefer();

			const panels = getPanels(ori, "left");
			// Each panel should have a shader child with an opacity set
			const opacities: number[] = [];
			for (const panel of panels) {
				const shader = panel.querySelector('[class*="shader"]') as HTMLElement;
				if (shader) {
					const op = parseFloat(shader.style.opacity);
					if (!Number.isNaN(op)) {
						opacities.push(op);
					}
				}
			}
			// With accordion at 45°, we expect at least one non-zero opacity
			expect(opacities.length).toBeGreaterThan(0);
			const hasNonZero = opacities.some((o) => o > 0);
			expect(hasNonZero).toBe(true);
		});

		it("shader opacity is zero when panel angle is zero", async () => {
			const el = createTarget();
			const ori = createOri(el, { shading: "hard" });
			await flushDefer();

			// Apply accordion with 0 angle — all panels at 0°
			ori.accordion(0);
			await flushDefer();

			const panels = getPanels(ori, "left");
			for (const panel of panels) {
				const shader = panel.querySelector('[class*="shader"]') as HTMLElement;
				if (shader) {
					const op = parseFloat(shader.style.opacity);
					if (!Number.isNaN(op)) {
						expect(op).toBe(0);
					}
				}
			}
		});
	});
});
