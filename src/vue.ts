import type { Directive, Ref, ShallowRef } from "vue";
import { onBeforeUnmount, onMounted, shallowRef, unref } from "vue";
import type { OriDomiInputOptions } from "./oridomi";
import OriDomi from "./oridomi";

export function useOriDomi(
	target: Ref<HTMLElement | null | undefined> | (() => HTMLElement | null | undefined),
	options?: Partial<OriDomiInputOptions>,
): ShallowRef<OriDomi | null> {
	const instance = shallowRef<OriDomi | null>(null);

	onMounted(() => {
		const el = typeof target === "function" ? target() : unref(target);
		if (el && isBrowserSupported()) {
			instance.value = new OriDomi(el, options);
		}
	});

	onBeforeUnmount(() => {
		const current = instance.value;
		if (current) {
			void current.destroy();
			instance.value = null;
		}
	});

	return instance;
}

const directiveInstances = new WeakMap<HTMLElement, OriDomi>();

function isBrowserSupported(): boolean {
	return typeof window !== "undefined" && OriDomi.isSupported;
}

export const vOriDomi: Directive<HTMLElement, Partial<OriDomiInputOptions> | undefined> = {
	mounted(el, binding) {
		if (isBrowserSupported()) {
			directiveInstances.set(el, new OriDomi(el, binding.value ?? {}));
		}
	},
	updated(el, binding) {
		if (binding.value !== binding.oldValue) {
			directiveInstances.get(el)?.refresh();
		}
	},
	unmounted(el) {
		const instance = directiveInstances.get(el);
		if (instance) {
			void instance.destroy();
			directiveInstances.delete(el);
		}
	},
};

export type {
	Anchor,
	EffectMethod,
	EffectOptions,
	FoldMethod,
	OriDomiInputOptions,
} from "./oridomi";
export { default, default as OriDomi } from "./oridomi";
