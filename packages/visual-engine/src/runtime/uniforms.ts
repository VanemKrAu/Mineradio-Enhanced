import * as THREE from "three";

export interface UniformValue<T = number | THREE.Vector2> {
	value: T;
}

export interface RuntimeUniforms {
	uTime: UniformValue<number>;
	uBass: UniformValue<number>;
	uMid: UniformValue<number>;
	uTreble: UniformValue<number>;
	uBeat: UniformValue<number>;
	uEnergy: UniformValue<number>;
	uMouseXY: UniformValue<THREE.Vector2>;
	uMouseActive: UniformValue<number>;
	uVinylSpin: UniformValue<number>;
	uParticleDim: UniformValue<number>;
	uBurstAmt: UniformValue<number>;
}

export function createRuntimeUniforms(): RuntimeUniforms {
	return {
		uTime: { value: 0 },
		uBass: { value: 0 },
		uMid: { value: 0 },
		uTreble: { value: 0 },
		uBeat: { value: 0 },
		uEnergy: { value: 0 },
		uMouseXY: { value: new THREE.Vector2(0, 0) },
		uMouseActive: { value: 0 },
		uVinylSpin: { value: 0 },
		uParticleDim: { value: 0 },
		uBurstAmt: { value: 0 },
	};
}