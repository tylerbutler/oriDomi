import { describe, expect, it } from "vitest";
import CoreOriDomi from "../src/oridomi";
import ReactOriDomi, {
	OriDomiView,
	OriDomi as ReactOriDomiNamed,
	useOriDomi as useReactOriDomi,
} from "../src/react";
import SolidOriDomi, { createOriDomi, OriDomi as SolidOriDomiNamed } from "../src/solid";
import SvelteOriDomi, {
	oridomi,
	oridomiAction,
	OriDomi as SvelteOriDomiNamed,
} from "../src/svelte";
import VueOriDomi, { useOriDomi, OriDomi as VueOriDomiNamed, vOriDomi } from "../src/vue";

function createTarget(): HTMLDivElement {
	const parent = document.createElement("div");
	const el = document.createElement("div");
	el.textContent = "Fold me";
	parent.appendChild(el);
	document.body.appendChild(parent);
	return el;
}

function expectCoreExport(moduleDefault: typeof CoreOriDomi): void {
	expect(moduleDefault).toBe(CoreOriDomi);
	expect(typeof moduleDefault.isSupported).toBe("boolean");
}

describe("framework wrapper module surfaces", () => {
	it("loads the React wrapper exports", () => {
		expect(typeof useReactOriDomi).toBe("function");
		expect(OriDomiView).toBeDefined();
		expect(ReactOriDomi).toBe(ReactOriDomiNamed);
		expectCoreExport(ReactOriDomi);
	});

	it("loads the Vue wrapper exports", () => {
		expect(typeof useOriDomi).toBe("function");
		expect(typeof vOriDomi).toBe("object");
		expect(VueOriDomi).toBe(VueOriDomiNamed);
		expectCoreExport(VueOriDomi);
	});

	it("loads the Svelte wrapper exports", () => {
		expect(typeof oridomi).toBe("function");
		expect(oridomiAction).toBe(oridomi);
		expect(SvelteOriDomi).toBe(SvelteOriDomiNamed);
		expectCoreExport(SvelteOriDomi);
	});

	it("loads the Solid wrapper exports", () => {
		expect(typeof createOriDomi).toBe("function");
		expect(SolidOriDomi).toBe(SolidOriDomiNamed);
		expectCoreExport(SolidOriDomi);
	});

	it("runs the Svelte action lifecycle without a Svelte component tree", () => {
		document.body.innerHTML = "";
		const el = createTarget();

		const action = oridomi(el, { speed: 0, touchEnabled: false });

		expect(typeof action.destroy).toBe("function");
		if (action.update) {
			expect(typeof action.update).toBe("function");
			expect(() => action.update?.({ speed: 0, touchEnabled: false })).not.toThrow();
		}
		expect(() => action.destroy?.()).not.toThrow();
	});
});
