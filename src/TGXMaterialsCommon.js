import * as THREE from 'three';

export function createFOTCDecalMaterial(FOTCTexture)
{
	const material = new THREE.MeshStandardMaterial(
		{
			map: FOTCTexture,
			transparent: true,
			roughness: 0.5,
		}
	);

	material.userData._shaderType = "common_fotc_decals_shader";

	return material;
}

export function createGhostCoreMaterial(ghostNormalTexture)
{
	const material = new THREE.MeshStandardMaterial(
		{
			normalMap: ghostNormalTexture,
			roughness: 0.5,
			metalness: 0.9,
			color: "#e0e5e5"
		}
	);

	material.userData._shaderType = "common_ghost_core_shader";

	return material;
}

export function createGhostEyeBackgroundMaterial()
{
	const material = new THREE.MeshStandardMaterial(
		{
			color: 0x000000,      // black color
			metalness: 0.0,       // not metal
			roughness: 0.05,      // almost mirror
			envMapIntensity: 1.0, // reflections
		}
	);

	material.userData._shaderType = "common_ghost_eye_background_shader";

	return material;
}

export function createOverridenEmissiveMaterial(overrideTexture)
{
	const material = new THREE.MeshStandardMaterial(
		{
			map: overrideTexture,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		}
	);

	material.userData._shaderType = "common_overriden_emissive_shader";

	return material;
}

export function createReticleMaterial(reticleTexture)
{
	const material = new THREE.MeshStandardMaterial(
		{
			map: reticleTexture,
			blending: THREE.AdditiveBlending,
			transparent: true
		}
	);

	material.userData._shaderType = "common_reticle_shader";

	return material;
}
