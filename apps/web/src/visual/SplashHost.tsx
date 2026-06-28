import { useEffect, useRef, type ReactElement } from "react";
import { createSplashEngine, type SplashEngine } from "@mineradio/visual-engine";

export type SplashHostProps = {
	onReady?: () => void;
	onDismissed?: () => void;
};

export function SplashHost(props: SplashHostProps): ReactElement | null {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const engineRef = useRef<SplashEngine | null>(null);
	const onReadyRef = useRef(props.onReady);
	const onDismissedRef = useRef(props.onDismissed);
	onReadyRef.current = props.onReady;
	onDismissedRef.current = props.onDismissed;

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		const engine = createSplashEngine(root, {
			onReadyToEnter: () => onReadyRef.current?.(),
			onDismissed: () => onDismissedRef.current?.(),
		});
		engineRef.current = engine;

		return () => {
			engine.dispose();
			engineRef.current = null;
		};
	}, []);

	return <div ref={rootRef} className="visual-splash-root" />;
}
