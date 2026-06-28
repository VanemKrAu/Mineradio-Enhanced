import type { ShelfPane } from "@mineradio/visual-engine";

export interface ShelfPaneWheelSwitcherOptions {
	getPane: () => ShelfPane;
	getMergeCollections: () => boolean;
	getMineCount: () => number;
	getFavCount: () => number;
	getCenterTarget: () => number;
	setPane: (pane: ShelfPane) => void;
}

export interface ShelfPaneWheelSwitcher {
	step(direction: number): boolean;
	reset(): void;
}

export function createShelfPaneWheelSwitcher(opts: ShelfPaneWheelSwitcherOptions): ShelfPaneWheelSwitcher {
	let collectionReveal = 0;
	const reset = () => {
		collectionReveal = 0;
	};

	return {
		step(direction) {
			const dir = direction > 0 ? 1 : direction < 0 ? -1 : 0;
			if (dir === 0 || opts.getMergeCollections()) {
				reset();
				return false;
			}
			const pane = opts.getPane();
			const mineCount = opts.getMineCount();
			const favCount = opts.getFavCount();
			const centerTarget = opts.getCenterTarget();
			const atEnd = centerTarget >= Math.max(0, (pane === "mine" ? mineCount : favCount) - 1) && dir > 0;
			const atStart = centerTarget <= 0 && dir < 0;

			if (pane === "mine" && atEnd && favCount > 0) {
				collectionReveal += Math.min(1.5, Math.abs(direction));
				if (collectionReveal >= 3) {
					reset();
					opts.setPane("fav");
				}
				return true;
			}
			if (pane === "fav" && atStart && mineCount > 0) {
				collectionReveal += Math.min(1.5, Math.abs(direction));
				if (collectionReveal >= 3) {
					reset();
					opts.setPane("mine");
				}
				return true;
			}

			reset();
			return false;
		},
		reset,
	};
}
