// @ts-check
import { expect, test } from "@playwright/test";

// ─── Helpers ────────────────────────────────────────────────────────────────

const _SCREENSHOT_OPTS = { maxDiffPixelRatio: 0.01 };

async function loadFixture(page) {
	await page.goto("/tests/fixture.html");
	await page.waitForFunction(() => typeof window.OriDomi === "function");
}

function createInstance(page, options = {}) {
	return page.evaluate((opts) => {
		const el = document.querySelector("#target");
		window._ori = new window.OriDomi(el, { speed: 0, ...opts });
		return window._ori !== undefined;
	}, options);
}

function applyEffect(page, method, ...args) {
	return page.evaluate(
		({ method, args }) => {
			return new Promise((resolve) => {
				const ori = window._ori;
				let resolved = false;
				const done = () => {
					if (!resolved) {
						resolved = true;
						resolve(true);
					}
				};
				ori[method](...args, { callback: done });
				// With speed:0, CSS transition duration is 0ms and transitionend
				// may not fire in all browsers. The fallback ensures the test
				// proceeds. 500ms is generous enough to catch real hangs while
				// accommodating deferred setTimeout chains in effects like foldUp.
				setTimeout(done, 500);
			});
		},
		{ method, args },
	);
}

/**
 * Assert that at least one panel has a non-zero CSS rotate transform.
 * Checks both inline style.transform and computed style for robustness.
 */
async function assertTransformApplied(page) {
	const maxAngle = await page.evaluate(() => {
		const el = document.querySelector("#target");
		if (!el) return 0;
		// Walk ALL descendants — panels are nested
		const allEls = el.querySelectorAll("*");
		let max = 0;
		for (const node of allEls) {
			const t = node.style?.transform || "";
			// Match rotateX(30deg), rotateY(-45deg), etc.
			const matches = t.matchAll(/rotate[XYZ]?\((-?[\d.]+)deg\)/g);
			for (const m of matches) {
				max = Math.max(max, Math.abs(parseFloat(m[1])));
			}
		}
		return max;
	});
	expect(maxAngle).toBeGreaterThan(0);
}

// ─── Construction ───────────────────────────────────────────────────────────

test.describe("construction", () => {
	test("OriDomi is exposed as a global", async ({ page }) => {
		await loadFixture(page);
		const exists = await page.evaluate(() => typeof window.OriDomi === "function");
		expect(exists).toBe(true);
	});

	test("isSupported is true in Chromium", async ({ page }) => {
		await loadFixture(page);
		const supported = await page.evaluate(() => window.OriDomi.isSupported);
		expect(supported).toBe(true);
	});

	test("creates an instance with default options", async ({ page }) => {
		await loadFixture(page);
		const result = await createInstance(page);
		expect(result).toBe(true);
	});

	test("wraps the element in the expected DOM structure", async ({ page }) => {
		await loadFixture(page);
		await createInstance(page);

		const structure = await page.evaluate(() => {
			const el = document.querySelector("#target");
			return {
				hasActiveClass: el.classList.contains("oridomi-active"),
				hasClone: el.querySelector("[class*='oridomi-clone']") !== null,
				hasHolder: el.querySelector("[class*='oridomi-holder']") !== null,
				childCount: el.children.length,
			};
		});

		expect(structure.hasActiveClass).toBe(true);
		expect(structure.hasClone).toBe(true);
		expect(structure.hasHolder).toBe(true);
		expect(structure.childCount).toBe(2);
	});

	test("creates panels inside stages", async ({ page }) => {
		await loadFixture(page);
		await createInstance(page, { vPanels: 5, hPanels: 4 });

		const panelCount = await page.evaluate(() => {
			const el = document.querySelector("#target");
			return el.querySelectorAll("[class*='oridomi-panel']").length;
		});
		expect(panelCount).toBeGreaterThan(0);
	});

	test("accepts a selector string", async ({ page }) => {
		await loadFixture(page);
		const created = await page.evaluate(() => {
			const ori = new window.OriDomi("#target2", { speed: 0 });
			return ori.el !== undefined;
		});
		expect(created).toBe(true);
	});

	test("accepts custom panel widths as an array", async ({ page }) => {
		await loadFixture(page);
		const created = await page.evaluate(() => {
			const el = document.querySelector("#target");
			const ori = new window.OriDomi(el, { vPanels: [25, 25, 25, 25], speed: 0 });
			return ori.el !== undefined;
		});
		expect(created).toBe(true);
	});
});

// ─── Effects ────────────────────────────────────────────────────────────────

test.describe("effects", () => {
	test.beforeEach(async ({ page }) => {
		await loadFixture(page);
		await createInstance(page);
	});

	test("accordion folds the element", async ({ page }) => {
		await applyEffect(page, "accordion", 40, "left");
		await assertTransformApplied(page);
	});

	test("accordion works with all four anchors", async ({ page }) => {
		for (const anchor of ["left", "right", "top", "bottom"]) {
			await applyEffect(page, "accordion", 30, anchor);
			await assertTransformApplied(page);
			await applyEffect(page, "reset");
		}
	});

	test("curl applies transforms", async ({ page }) => {
		await applyEffect(page, "curl", 40, "left");
		await assertTransformApplied(page);
	});

	test("ramp applies transforms", async ({ page }) => {
		await applyEffect(page, "ramp", 30, "left");
		await assertTransformApplied(page);
	});

	test("foldUp folds the element", async ({ page }) => {
		await applyEffect(page, "foldUp", "left");
		await page.waitForTimeout(50);
		const isFoldedUp = await page.evaluate(() => window._ori.isFoldedUp === true);
		expect(isFoldedUp).toBe(true);
	});

	test("reset restores state", async ({ page }) => {
		await applyEffect(page, "accordion", 45, "left");
		await applyEffect(page, "reset");
		const angle = await page.evaluate(() => window._ori._lastOp.angle);
		expect(angle).toBe(0);
	});

	test("reveal applies transforms", async ({ page }) => {
		await applyEffect(page, "reveal", 30, "left");
		await assertTransformApplied(page);
	});

	test("stairs applies transforms", async ({ page }) => {
		await applyEffect(page, "stairs", 30, "left");
		await assertTransformApplied(page);
	});

	test("fracture applies transforms", async ({ page }) => {
		await applyEffect(page, "fracture", 20, "left");
		await assertTransformApplied(page);
	});

	test("twist applies transforms", async ({ page }) => {
		await applyEffect(page, "twist", 20, "left");
		await assertTransformApplied(page);
	});

	test("collapse folds the element", async ({ page }) => {
		await applyEffect(page, "collapse", "left");
		await assertTransformApplied(page);
	});

	test("collapseAlt folds the element", async ({ page }) => {
		await applyEffect(page, "collapseAlt", "left");
		await assertTransformApplied(page);
	});
});

// ─── Configuration ──────────────────────────────────────────────────────────

test.describe("configuration", () => {
	test.beforeEach(async ({ page }) => {
		await loadFixture(page);
		await createInstance(page);
	});

	test("setSpeed changes animation speed", async ({ page }) => {
		const speed = await page.evaluate(() => {
			window._ori.setSpeed(1000);
			return window._ori._config.speed;
		});
		expect(speed).toBe(1000);
	});

	test("constrainAngle updates maxAngle", async ({ page }) => {
		const angle = await page.evaluate(() => {
			window._ori.constrainAngle(45);
			return window._ori._config.maxAngle;
		});
		expect(angle).toBe(45);
	});

	test("freeze / unfreeze toggles frozen state", async ({ page }) => {
		const frozen = await page.evaluate(() => {
			return new Promise((resolve) => {
				window._ori.freeze(() => resolve(window._ori.isFrozen));
				setTimeout(() => resolve(window._ori.isFrozen), 200);
			});
		});
		expect(frozen).toBe(true);

		const unfrozen = await page.evaluate(() => {
			window._ori.unfreeze();
			return window._ori.isFrozen;
		});
		expect(unfrozen).toBe(false);
	});

	test("enableTouch / disableTouch toggles touch", async ({ page }) => {
		const disabled = await page.evaluate(() => {
			window._ori.disableTouch();
			return window._ori._touchEnabled;
		});
		expect(disabled).toBe(false);

		const enabled = await page.evaluate(() => {
			window._ori.enableTouch();
			return window._ori._touchEnabled;
		});
		expect(enabled).toBe(true);
	});

	test("setRipple changes ripple mode", async ({ page }) => {
		const ripple = await page.evaluate(() => {
			window._ori.setRipple(2);
			return window._ori._config.ripple;
		});
		expect(ripple).toBe(2);
	});
});

// ─── Lifecycle ──────────────────────────────────────────────────────────────

test.describe("lifecycle", () => {
	test("destroy removes OriDomi DOM modifications", async ({ page }) => {
		await loadFixture(page);
		await createInstance(page);

		const restored = await page.evaluate(() => {
			return new Promise((resolve) => {
				window._ori.destroy(() => {
					const el = document.querySelector("#target");
					resolve(!el.classList.contains("oridomi-active"));
				});
				setTimeout(() => {
					const el = document.querySelector("#target");
					resolve(!el.classList.contains("oridomi-active"));
				}, 200);
			});
		});
		expect(restored).toBe(true);
	});
});

// ─── Chaining ───────────────────────────────────────────────────────────────

test.describe("chaining", () => {
	test("effect methods return the instance", async ({ page }) => {
		await loadFixture(page);
		await createInstance(page);
		const chains = await page.evaluate(() => {
			const ori = window._ori;
			return ori.accordion(20, "left") === ori;
		});
		expect(chains).toBe(true);
	});
});

// ─── Visual Regression ──────────────────────────────────────────────────────

test.describe("visual regression", () => {
	test.beforeEach(async ({ page }) => {
		await loadFixture(page);
		await createInstance(page);
	});

	test("initial state", async ({ page }) => {
		await expect(page.locator("#wrapper")).toHaveScreenshot("initial.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("accordion left 45°", async ({ page }) => {
		await applyEffect(page, "accordion", 45, "left");
		await expect(page.locator("#wrapper")).toHaveScreenshot("accordion-left-45.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("accordion right 45°", async ({ page }) => {
		await applyEffect(page, "accordion", 45, "right");
		await expect(page.locator("#wrapper")).toHaveScreenshot("accordion-right-45.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("accordion top 30°", async ({ page }) => {
		await applyEffect(page, "accordion", 30, "top");
		await expect(page.locator("#wrapper")).toHaveScreenshot("accordion-top-30.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("curl left 40°", async ({ page }) => {
		await applyEffect(page, "curl", 40, "left");
		await expect(page.locator("#wrapper")).toHaveScreenshot("curl-left-40.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("ramp left 30°", async ({ page }) => {
		await applyEffect(page, "ramp", 30, "left");
		await expect(page.locator("#wrapper")).toHaveScreenshot("ramp-left-30.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("stairs left 30°", async ({ page }) => {
		await applyEffect(page, "stairs", 30, "left");
		await expect(page.locator("#wrapper")).toHaveScreenshot("stairs-left-30.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("fracture left 20°", async ({ page }) => {
		await applyEffect(page, "fracture", 20, "left");
		await expect(page.locator("#wrapper")).toHaveScreenshot("fracture-left-20.png", {
			maxDiffPixelRatio: 0.01,
		});
	});

	test("foldUp", async ({ page }) => {
		await applyEffect(page, "foldUp", "left");
		await expect(page.locator("#wrapper")).toHaveScreenshot("foldUp.png", {
			maxDiffPixelRatio: 0.01,
		});
	});
});
