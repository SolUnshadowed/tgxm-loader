import * as THREE from 'three';

import {
	dummyDyeslotBase64, dummyWhiteBase64,
	dummyNormalBase64, dummyDiffuseBase64,
} from "./assetsBase64.js";

const textureLoader = new THREE.TextureLoader();
const cubemapLoader = new THREE.CubeTextureLoader();

export const dummyDyeslot = textureLoader.load(dummyDyeslotBase64);
export const dummyWhite = textureLoader.load(dummyWhiteBase64);
export const dummyNormal = textureLoader.load(dummyNormalBase64);
export const dummyDiffuse = textureLoader.load(dummyDiffuseBase64);
