import type { Action, ActionReturn } from "svelte/action";
import type { OriDomiInputOptions } from "./oridomi";
import OriDomiCore from "./oridomi";

type OriDomiActionOptions = Partial<OriDomiInputOptions> | undefined;
type OriDomiActionReturn = ActionReturn<OriDomiActionOptions>;

export function oridomi(
	node: HTMLElement,
	options?: Partial<OriDomiInputOptions>,
): OriDomiActionReturn {
	let currentOptions: OriDomiActionOptions = options;
	let instance: OriDomiCore | undefined;

	if (typeof window !== "undefined" && OriDomiCore.isSupported) {
		instance = new OriDomiCore(node, currentOptions);
	}

	return {
		update(newOptions: OriDomiActionOptions): void {
			currentOptions = newOptions;
			// Recreating would apply new options, but refresh is the pragmatic Svelte update path:
			// it re-syncs content/layout without tearing down OriDomi's DOM.
			instance?.refresh();
		},
		destroy(): void {
			void instance?.destroy();
			instance = undefined;
		},
	};
}

export const oridomiAction: Action<HTMLElement, OriDomiActionOptions> = oridomi;

export type {
	Anchor,
	EffectMethod,
	EffectOptions,
	FoldMethod,
	OriDomiInputOptions,
} from "./oridomi";
export { default, default as OriDomi } from "./oridomi";
