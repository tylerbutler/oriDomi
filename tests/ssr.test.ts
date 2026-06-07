import { afterEach, describe, expect, it, vi } from "vitest";
import type OriDomi from "../src/oridomi";

type OriDomiTestInternals = {
	_inTrans: boolean;
	_queue: unknown[];
};

const createdInstances = new Set<OriDomi>();

function trackOri<T extends OriDomi>(ori: T): T {
	createdInstances.add(ori);
	return ori;
}

function getInternals(ori: OriDomi): OriDomiTestInternals {
	return ori as unknown as OriDomiTestInternals;
}

async function importOriDomi(tag: string): Promise<typeof import("../src/oridomi")> {
	void tag;
	vi.resetModules();
	return import("../src/oridomi");
}

function createTarget(): HTMLDivElement {
	const parent = document.createElement("div");
	const el = document.createElement("div");
	el.textContent = "Test";
	parent.appendChild(el);
	document.body.appendChild(parent);
	return el;
}

async function settlementState(ori: OriDomi): Promise<"settled" | "timeout"> {
	return Promise.race([
		ori.whenSettled().then(() => "settled" as const),
		new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 50)),
	]);
}

describe("SSR-safe initialization", () => {
	afterEach(async () => {
		vi.useRealTimers();
		const instances = Array.from(createdInstances);
		createdInstances.clear();
		await Promise.all(instances.map((ori) => ori.destroy()));
		document.body.innerHTML = "";
	});

	function removeInjectedStyles(): void {
		for (const styleEl of document.head.querySelectorAll("style[data-oridomi]")) {
			styleEl.remove();
		}
	}

	it("imports and exposes isSupported without a document", async () => {
		const originalDocument = globalThis.document;
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.stubGlobal("document", undefined);

		try {
			const { default: OriDomi } = await importOriDomi("ssr");

			expect(() => OriDomi.isSupported).not.toThrow();
			expect(OriDomi.isSupported).toBe(false);

			const ori = trackOri(new OriDomi({} as HTMLElement, { speed: 0, touchEnabled: false }));
			expect(ori.accordion(30).curl(20).ramp(10)).toBe(ori);
			expect(ori.foldUp().unfold().reset()).toBe(ori);
			expect(ori.enableTouch().disableTouch()).toBe(ori);
			expect(ori.setSpeed(100).setRipple(1).constrainAngle(45)).toBe(ori);
			expect(ori.emptyQueue().freeze().unfreeze().wait(1)).toBe(ori);
			expect(ori.modifyContent(() => {})).toBe(ori);
			expect(ori.map((angle) => angle)(10)).toBe(ori);
			await expect(ori.whenSettled()).resolves.toBe(ori);
			await expect(ori.destroy()).resolves.toBeUndefined();
		} finally {
			warnSpy.mockRestore();
			vi.stubGlobal("document", originalDocument);
		}
	});

	it("resolves whenSettled after chained effects finish", async () => {
		document.body.innerHTML = "";
		const { default: OriDomi } = await importOriDomi("settled");
		const ori = trackOri(new OriDomi(createTarget(), { speed: 0, touchEnabled: false }));

		await ori.accordion(30).curl(20).whenSettled();

		expect(getInternals(ori)._inTrans).toBe(false);
		expect(getInternals(ori)._queue).toHaveLength(0);
	});

	it("applies a constructor nonce even after isSupported was read first", async () => {
		document.body.innerHTML = "";
		removeInjectedStyles();
		const { default: OriDomi } = await importOriDomi("nonce");

		expect(OriDomi.isSupported).toBe(true);
		trackOri(new OriDomi(createTarget(), { speed: 0, touchEnabled: false, nonce: "abc123" }));

		expect(document.head.querySelector("style[data-oridomi]")?.getAttribute("nonce")).toBe(
			"abc123",
		);
	});

	it("waits for destroy cleanup before resolving whenSettled", async () => {
		document.body.innerHTML = "";
		const { default: OriDomi } = await importOriDomi("destroy");
		const target = createTarget();
		const ori = trackOri(new OriDomi(target, { speed: 0, touchEnabled: false }));

		ori.destroy();
		await ori.whenSettled();

		expect(target.classList.contains("oridomi-active")).toBe(false);
		expect(target.querySelector(".oridomi-holder")).toBeNull();
	});

	it("settles even when an effect callback throws", async () => {
		document.body.innerHTML = "";
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { default: OriDomi } = await importOriDomi("throwing-effect");
		const ori = trackOri(new OriDomi(createTarget(), { speed: 0, touchEnabled: false }));

		ori.accordion(30, {
			callback: () => {
				throw new Error("effect callback failed");
			},
		});

		await expect(settlementState(ori)).resolves.toBe("settled");
		warnSpy.mockRestore();
	});

	it("settles even when a destroy callback throws", async () => {
		document.body.innerHTML = "";
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { default: OriDomi } = await importOriDomi("throwing-destroy");
		const ori = trackOri(new OriDomi(createTarget(), { speed: 0, touchEnabled: false }));

		ori.destroy(() => {
			throw new Error("destroy callback failed");
		});

		await expect(settlementState(ori)).resolves.toBe("settled");
		warnSpy.mockRestore();
	});
});
