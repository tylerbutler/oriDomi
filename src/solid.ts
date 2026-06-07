import type { Accessor } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";
import type { OriDomiInputOptions } from "./oridomi";
import OriDomi from "./oridomi";

export function createOriDomi(
	element: HTMLElement | Accessor<HTMLElement | null | undefined> | null | undefined,
	options?: Partial<OriDomiInputOptions>,
): Accessor<OriDomi | null> {
	const [instance, setInstance] = createSignal<OriDomi | null>(null);

	onMount(() => {
		const el = typeof element === "function" ? element() : element;

		if (el && OriDomi.isSupported && typeof window !== "undefined") {
			setInstance(new OriDomi(el, options));
		}
	});

	onCleanup(() => {
		instance()?.destroy();
		setInstance(null);
	});

	return instance;
}

export type {
	Anchor,
	EffectMethod,
	EffectOptions,
	FoldMethod,
	OriDomiInputOptions,
} from "./oridomi";
export { default, default as OriDomi } from "./oridomi";
