import type {
	CSSProperties,
	DependencyList,
	HTMLAttributes,
	JSX,
	ReactElement,
	ReactNode,
	RefObject,
} from "react";
import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Anchor, EffectOptions, OriDomiInputOptions } from "./oridomi";
import CoreOriDomi from "./oridomi";

export type OriDomiReactRef = RefObject<HTMLElement | null>;

type OriDomiEffectInvoker = {
	(angle?: number, options?: EffectOptions): CoreOriDomi | null;
	(angle?: number, callback?: EffectOptions["callback"]): CoreOriDomi | null;
	(angle?: number, anchor?: Anchor | string, options?: EffectOptions): CoreOriDomi | null;
	(
		angle?: number,
		anchor?: Anchor | string,
		callback?: EffectOptions["callback"],
	): CoreOriDomi | null;
};

type OriDomiFoldInvoker = {
	(options?: EffectOptions): CoreOriDomi | null;
	(callback?: EffectOptions["callback"]): CoreOriDomi | null;
	(anchor?: Anchor | string, options?: EffectOptions): CoreOriDomi | null;
	(anchor?: Anchor | string, callback?: EffectOptions["callback"]): CoreOriDomi | null;
};

type OriDomiConvenienceInvoker = (
	angle?: number,
	anchor?: string,
	options?: EffectOptions,
) => CoreOriDomi | null;

type OriDomiResetInvoker = (callback?: EffectOptions["callback"]) => CoreOriDomi | null;

type OriDomiExposedMethod =
	| "accordion"
	| "curl"
	| "ramp"
	| "foldUp"
	| "unfold"
	| "reset"
	| "fracture"
	| "twist";

export interface OriDomiViewHandle {
	readonly instance: CoreOriDomi | null;
	accordion: OriDomiEffectInvoker;
	curl: OriDomiEffectInvoker;
	ramp: OriDomiEffectInvoker;
	foldUp: OriDomiFoldInvoker;
	unfold: OriDomiFoldInvoker;
	reset: OriDomiResetInvoker;
	fracture: OriDomiConvenienceInvoker;
	twist: OriDomiConvenienceInvoker;
	whenSettled: () => Promise<CoreOriDomi | null>;
}

export interface OriDomiViewProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
	as?: keyof JSX.IntrinsicElements;
	options?: Partial<OriDomiInputOptions>;
	deps?: DependencyList;
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
}

/**
 * Creates an OriDomi instance after mount and destroys it on cleanup.
 *
 * The effect uses `deps ?? []`; memoize `options` or pass `deps` when option changes
 * should recreate the instance.
 */
export function useOriDomi(
	ref: RefObject<HTMLElement | null>,
	options?: Partial<OriDomiInputOptions>,
	deps?: DependencyList,
): RefObject<CoreOriDomi | null> {
	const instanceRef = useRef<CoreOriDomi | null>(null);

	useEffect(() => {
		if (typeof window === "undefined" || !CoreOriDomi.isSupported || !ref.current) {
			instanceRef.current = null;
			return;
		}

		const instance = new CoreOriDomi(ref.current, options);
		instanceRef.current = instance;

		return () => {
			instanceRef.current = null;
			void instance.destroy();
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: The adapter intentionally uses caller-supplied dependencies.
	}, deps ?? []);

	return instanceRef;
}

function callInstanceMethod(
	instanceRef: RefObject<CoreOriDomi | null>,
	method: OriDomiExposedMethod,
	args: unknown[],
): CoreOriDomi | null {
	const instance = instanceRef.current;
	if (!instance) {
		return null;
	}

	const methodFn = instance[method] as unknown as (
		this: CoreOriDomi,
		...methodArgs: unknown[]
	) => CoreOriDomi;
	return methodFn.apply(instance, args);
}

function createEffectInvoker(
	instanceRef: RefObject<CoreOriDomi | null>,
	method: "accordion" | "curl" | "ramp",
): OriDomiEffectInvoker {
	return ((...args: unknown[]) =>
		callInstanceMethod(instanceRef, method, args)) as OriDomiEffectInvoker;
}

function createFoldInvoker(
	instanceRef: RefObject<CoreOriDomi | null>,
	method: "foldUp" | "unfold",
): OriDomiFoldInvoker {
	return ((...args: unknown[]) =>
		callInstanceMethod(instanceRef, method, args)) as OriDomiFoldInvoker;
}

function createConvenienceInvoker(
	instanceRef: RefObject<CoreOriDomi | null>,
	method: "fracture" | "twist",
): OriDomiConvenienceInvoker {
	return ((...args: unknown[]) =>
		callInstanceMethod(instanceRef, method, args)) as OriDomiConvenienceInvoker;
}

function createHandle(instanceRef: RefObject<CoreOriDomi | null>): OriDomiViewHandle {
	return {
		get instance() {
			return instanceRef.current;
		},
		accordion: createEffectInvoker(instanceRef, "accordion"),
		curl: createEffectInvoker(instanceRef, "curl"),
		ramp: createEffectInvoker(instanceRef, "ramp"),
		foldUp: createFoldInvoker(instanceRef, "foldUp"),
		unfold: createFoldInvoker(instanceRef, "unfold"),
		reset: ((...args: unknown[]) =>
			callInstanceMethod(instanceRef, "reset", args)) as OriDomiResetInvoker,
		fracture: createConvenienceInvoker(instanceRef, "fracture"),
		twist: createConvenienceInvoker(instanceRef, "twist"),
		whenSettled: () => instanceRef.current?.whenSettled() ?? Promise.resolve(null),
	};
}

/**
 * React view wrapper for OriDomi.
 *
 * Children are snapshotted when OriDomi is constructed. If children change, call
 * `ref.current.instance?.refresh()` / `setContent()` or remount this component.
 */
export const OriDomiView = forwardRef<OriDomiViewHandle, OriDomiViewProps>(function OriDomiView(
	{ as, options, deps, className, style, children, ...passThroughProps },
	forwardedRef,
): ReactElement {
	const innerRef = useRef<HTMLElement | null>(null);
	const oridomiRef = useOriDomi(innerRef, options, deps);
	const elementType = as ?? "div";

	useImperativeHandle(forwardedRef, () => createHandle(oridomiRef), [oridomiRef]);

	return createElement(
		elementType,
		{ ...passThroughProps, ref: innerRef, className, style },
		children,
	);
});

export type {
	Anchor,
	EffectMethod,
	EffectOptions,
	FoldMethod,
	OriDomiInputOptions,
} from "./oridomi";
export { default, default as OriDomi } from "./oridomi";
