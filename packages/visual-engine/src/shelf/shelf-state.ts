export type ShelfMode = "side" | "stage" | "off";

export type ShelfPane = "mine" | "fav";

export interface ShelfState {
	centerIdx: number;
	centerTarget: number;
	centerSmooth: number;
	openCardIdx: number;
	paneMemory: { mine: number; fav: number };
	paneSwitchAt: number;
	paneSwitchDir: number;
	mode: ShelfMode;
	lastSig: string;
	selectedIdx: number;
	shelfPane: ShelfPane;
	collectionReveal: number;
	lastUpdate: number;
	lastCardRedrawAt: number;
	lastCardPulseBucket: number;
	shelfVisibility: number;
	shelfOpenAnimAt: number;
}

export function createShelfState(): ShelfState {
	return {
		centerIdx: 0,
		centerTarget: 0,
		centerSmooth: 0,
		openCardIdx: -1,
		paneMemory: { mine: 0, fav: 0 },
		paneSwitchAt: -10,
		paneSwitchDir: 1,
		mode: "side",
		lastSig: "",
		selectedIdx: -1,
		shelfPane: "mine",
		collectionReveal: 0,
		lastUpdate: 0,
		lastCardRedrawAt: -10,
		lastCardPulseBucket: -1,
		shelfVisibility: 0,
		shelfOpenAnimAt: -10,
	};
}