import * as THREE from 'three';

export const materialsNoUpdate = [
	"destiny2_ammo_counter_shader",
	"destiny2_sniper_lens_shader",
	"destiny2_ghost_eye_shader",
	"destiny2_hands_and_neck_shader",
	"destiny2_omolon_liquid_shader",
	"destiny2_brave_tiger_shader",
	"destiny2_reticle_shader",
	"destiny2_emissive_shader"
];

export const materialsUsingShaderProperties = ["destiny2_gear_shader"];
const trialsColorKeys = ["red", "gold", "silver"];
const trialsColors = {
	"red": {
		trialsMetalColor: new THREE.Color().setHex( 0xff2400 ),
		trialsGlowColor: new THREE.Color().setHex( 0xff0000 )
	},
	"gold": {
		trialsMetalColor: new THREE.Color().setHex( 0xCBA96E ), //FFED8A
		trialsGlowColor: new THREE.Color().setHex( 0xfaf405 )
	},
	"silver": {
		trialsMetalColor: new THREE.Color().setHex( 0xe1e3e1 ),
		trialsGlowColor: new THREE.Color().setHex( 0x00d9ff )
	}
};

export function updateMaterialMainTextures(material, albedoMap, normalMap, gstack, dyeMap)
{
	const shaderType = material.userData._shaderType;

	material.map = albedoMap;
	material.normalMap = normalMap;
	material.userData._shader.uniforms.dyeMap = { value: dyeMap };
	material.userData._shader.uniforms.gearstack = { value: gstack };

	if (shaderType == "destiny2_gear_shader")
	{
		material.ao = gstack;
	}

	material.needsUpdate = true;
}

export function updateMaterialDyeTextures(material, diffuses, normals, materials)
{
	const shader = material.userData._shader;

	shader.uniforms.armorDiffuse =	{ value: diffuses[0]};
	shader.uniforms.armorNormal =	{ value: normals[0] };
	shader.uniforms.clothDiffuse =	{ value: diffuses[1]};
	shader.uniforms.clothNormal =	{ value: normals[1] };
	shader.uniforms.suitDiffuse =	{ value: diffuses[2]};
	shader.uniforms.suitNormal =	{ value: normals[2] };

	if (materials[0])
		shader.uniforms.armorPrimaryMaterial = { value: materials[0] };
	if (materials[1])
		shader.uniforms.armorSecondaryMaterial = { value: materials[1] };
	if (materials[2])
		shader.uniforms.clothPrimaryMaterial = { value: materials[2] };
	if (materials[3])
		shader.uniforms.clothSecondaryMaterial = { value: materials[3] };
	if (materials[4])
		shader.uniforms.suitPrimaryMaterial = { value: materials[4] };
	if (materials[5])
		shader.uniforms.suitSecondaryMaterial = { value: materials[5] };

	material.needsUpdate = true;
}

export function updateMainMaterialTrialsColor(material, useTrialsMetalness = false, useTrialsGlow = false, trialsColor = "gold")
{
	if (material.userData._shaderType !== "destiny2_gear_shader")
		return;

	if (useTrialsMetalness)
	{
		trialsColor = trialsColorKeys.includes(trialsColor) ? trialsColor : "gold";

		material.userData._shader.uniforms.trialsMetalColor = { value: trialsColors[trialsColor].trialsMetalColor };
		material.userData._shader.uniforms.trialsGlowColor = { value: trialsColors[trialsColor].trialsGlowColor };
		material.userData._shader.uniforms.useTrialsMetalness = { value: true };

		material.userData._shader.uniforms.useTrialsGlow = { value: useTrialsGlow };
	}
	else
	{
		material.userData._shader.uniforms.useTrialsMetalness = { value: false };
		material.userData._shader.uniforms.useTrialsGlow = { value: false };
	}

	material.needsUpdate = true;
}

export function createAmmoCounterMaterial(albedoMap, initialCount, useAdditiveBlending=true)
{
	const uniforms = {
		number: {
			value: new THREE.Vector3(
				Math.floor(initialCount / 100),
				Math.floor((initialCount / 10) % 10),
				initialCount % 10
			)
		},
		digitsTexture: { value: albedoMap },
	};

	const material = new THREE.ShaderMaterial(
		{
			blending: useAdditiveBlending ? THREE.AdditiveBlending : THREE.NormalBlending,
			transparent: true,
			depthWrite: false,
			depthTest: true,
			uniforms,
			vertexShader: `
				varying vec2 vUv;
				void main()
				{
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform vec3 number;
				uniform sampler2D digitsTexture;
				varying vec2 vUv;

				void main()
				{
					// digit rectangle: (1/8,1/3) -> (7/8,2/3)
					vec2 rectMin = vec2(0.125, 0.333333333);//vec2(1.0/8.0, 1.0/3.0);
					vec2 rectMax = vec2(0.875, 0.666666667);

					// is in rectanlge
					if(vUv.x < rectMin.x || vUv.x > rectMax.x || vUv.y < rectMin.y || vUv.y > rectMax.y) {
						gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); // background color
						return;
					}

					// rect local coordiantes
					vec2 local = (vUv - rectMin) / (rectMax - rectMin);

					// digit index: 0, 1, 2
					int digitIndex = int(floor(local.x * 3.0));
					float localX = fract(local.x * 3.0);

					// digit
					float digit = 0.0;
					if (digitIndex == 0)
						digit = number.x;
					else if(digitIndex == 1)
						digit = number.y;
					else
						digit = number.z;

					// digit UV
					vec2 texUV;
					texUV.x = digit * 0.25 + localX * 0.25;
					texUV.y = digit * (0.083333333) + local.y * (0.333333333); // digit * (1.0/12.0) + local.y * (1.0/3.0)

					gl_FragColor = texture2D(digitsTexture, texUV);
				}
			`,
		}
	);

	material.userData._shaderType = "destiny2_ammo_counter_shader";

	return material;
}

export function createRearSightMaterial(
    albedoMap, normalMap, gstack, dyeMap,
    useGstackTransparency, alphaClipTreshold, iridescenceLookup
)
{
	const material = new THREE.MeshStandardMaterial(
		{
			map: albedoMap,
			normalMap: normalMap,
			side: THREE.FrontSide,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: true
		}
	);

	material.onBeforeCompile = (shader) =>
	{
		material.userData.isCompiled = true; // to ensure that material is compiled
		material.userData._shader = shader;
		material.userData._shaderType = "destiny2_reticle_shader";

		shader.uniforms.useGstackTransparency = { value: useGstackTransparency };
		shader.uniforms.alphaClipTreshold = { value: alphaClipTreshold };

		shader.uniforms.dyeMap = { value: dyeMap };
		shader.uniforms.gearstack = { value: gstack };
		shader.uniforms.iridescenceLookup = { value: iridescenceLookup };

		//
		// VERTEX SHADER BEGIN

		shader.vertexShader = `
			attribute vec2 uv2;
			attribute vec4 col;

			out vec2 vUv;
			out vec2 vUv2;
			out float vSlot;
			${shader.vertexShader}
		`;

		shader.vertexShader = shader.vertexShader.replace(
			"void main() {",
			`
				void main() {
					vUv = uv;
					vUv2 = uv2;
			`
		);

		// VERTEX SHADER END
		//

		//
		// FRAGMENT SHADER BEGIN

		shader.fragmentShader = `
			#define saturate( a ) clamp( a, 0.0, 1.0 )

			in vec2 vUv;
			in vec2 vUv2;

			uniform vec3 customColor;
			uniform bool useGstackTransparency;
			uniform float alphaClipTreshold;
			uniform sampler2D iridescenceLookup;

			uniform sampler2D dyeMap;
			uniform sampler2D gearstack;

			float overlay(float front, float back, float fac) {
				float newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 overlay(vec4 front, vec4 back, float fac) {
				vec4 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			float remap (float val, vec4 remap) {
				return clamp(val * remap.y + remap.x, remap.z, remap.z + remap.w);
			}


			vec4 BlendMode_Overlay(vec4 cBase, vec4 cBlend)
			{
				vec4 isLessOrEq = step(cBase, vec4(0.5));
				vec4 cNew = mix(2.0 * cBlend * cBase, 1.0 - (1.0 - 2.0 * (cBase - 0.5)) * (1.0 - cBlend), isLessOrEq);
				return cNew;
			}

			vec3 BlendMode_Overlay(vec3 cBase, vec3 cBlend)
			{
				vec3 isLessOrEq = step(cBase, vec3(0.5));
				vec3 cNew = mix(2.0 * cBlend * cBase, 1.0 - (1.0 - 2.0 * (cBase - 0.5)) * (1.0 - cBlend), isLessOrEq);
				return cNew;
			}
			${shader.fragmentShader}
		`;

		shader.fragmentShader = shader.fragmentShader.replace(
			"void main() {",
			`void main() {
				vec4 diff = texture2D( map, vUv );

				vec4 gstack = texture2D(gearstack, vUv);

				float transparency = !bool(useGstackTransparency) ? 1.0 : saturate(gstack.b * 7.96875);

				float isAlphaCutoutMode = step(0.00001, alphaClipTreshold);
				// alphaClipTreshold == 0.0 -> blend
				// else cutout

				// visibility in different modes
				float blendPixelVisible   = step(0.00001, transparency);
				float cutoutPixelVisible  = step(alphaClipTreshold, transparency);

				// select blend or cutout mode
				float pixelVisible = mix(blendPixelVisible, cutoutPixelVisible, isAlphaCutoutMode);

				float finalAlpha = mix(transparency, 1.0, isAlphaCutoutMode);
				transparency = finalAlpha * pixelVisible;
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <map_fragment>`,
			`
				diffuseColor = diff;
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <opaque_fragment>`,
			`
				gl_FragColor = vec4(diffuseColor.rgb, transparency);
			`
		);

		// FRAGMENT SHADER END
		//
	};//onBeforeCompile end

	return material;
}

export function createHandsMaterial(albedoMap, normalMap, mrcMap) //,  tiledDiffuse, tiledNormal
{
	const material = new THREE.MeshStandardMaterial(
		{
			map: albedoMap,
			normalMap: normalMap,
			aoMap: mrcMap,
			metalnessMap: mrcMap,
			roughnessMap: mrcMap,
			side: THREE.FrontSide,
		}
	);

	material.onBeforeCompile = (shader) =>
	{
		material.userData.isCompiled = true; // to ensure that material is compiled
		material.userData._shader = shader;
		material.userData._shaderType = "destiny2_hands_and_neck_shader";

		// take roughness and metalness from mrc texture
		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <roughnessmap_fragment>`,
			`
			float roughnessFactor = roughness;
			#ifdef USE_ROUGHNESSMAP
				vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
				//roughnessFactor *= texelRoughness.g;
				roughnessFactor = 1.0 - texelRoughness.g;
			#endif
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <metalnessmap_fragment>`,
			`
			float metalnessFactor = metalness;
			#ifdef USE_METALNESSMAP
				vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
				metalnessFactor = texelMetalness.r;
			#endif
			`
		);

		// set ao to blue channel instead of red
		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <aomap_fragment>`,
			`
			#ifdef USE_AOMAP
				float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).b - 1.0 ) * aoMapIntensity + 1.0;
				reflectedLight.indirectDiffuse *= ambientOcclusion;
				#if defined( USE_CLEARCOAT )
					clearcoatSpecularIndirect *= ambientOcclusion;
				#endif
				#if defined( USE_SHEEN )
					sheenSpecularIndirect *= ambientOcclusion;
				#endif
				#if defined( USE_ENVMAP ) && defined( STANDARD )
					float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
					reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
				#endif
			#endif
			`
		);
	}

	return material
}

export function createLensMaterial(albedoMap)
{
	const material = new THREE.MeshStandardMaterial(
		{
			color: "#eba834",
			map: albedoMap,
			metalness: 1,
			roughness: 0.165
		}
	)

	material.userData._shaderType = "destiny2_sniper_lens_shader";

	return material;
}

export function createGhostEyeMaterial(texture1, texture2)
{
	const uniforms = {
		uEyeColor:      { value: new THREE.Vector3(0.0, 0.74, 1.0) },
		uEmission01:    { value: texture1 },
		uEmission02:    { value: texture2 },
		uEmission02_ST: { value: new THREE.Vector4(1, 1, 0, 0) },
		uEyeBlinking:   { value: 0.0 }
	};

	const material = new THREE.ShaderMaterial(
		{
			uniforms,
			vertexShader: `
				varying vec2 vUv;
				varying vec3 vViewDir;

				void main() {
					vUv = uv;
					// vertex world position
					vec4 worldPos = modelMatrix * vec4(position, 1.0);
					// vector from fragment to camera
					vViewDir = normalize(cameraPosition - worldPos.xyz);
					gl_Position = projectionMatrix * viewMatrix * worldPos;
				}
			`,
			fragmentShader: `
				precision mediump float;

				uniform vec3 uEyeColor;
				uniform sampler2D uEmission01;
				uniform sampler2D uEmission02;
				uniform vec4 uEmission02_ST;
				uniform float uEyeBlinking;

				varying vec2 vUv;
				varying vec3 vViewDir;

				void main() {
					// 1) given UV, clamped to [0,1]
					vec2 uv0 = clamp(vUv, 0.0, 1.0);

					// 2) shift UV based on viewDir (parallax)
					// vec2(vViewDir.x, -vViewDir.y) instead of vViewDir.xy - idk why, solved by trial and error
					vec2 off1 = ((0.83 - 1.0) * (vec2(vViewDir.x, -vViewDir.y) / vViewDir.z)) + vUv;
					vec2 uv1  = clamp(off1, 0.0, 1.0);

					vec2 off2 = ((0.5  - 1.0) * (vec2(vViewDir.x, -vViewDir.y) / vViewDir.z)) + vUv;
					vec2 uv2  = clamp(off2, 0.0, 1.0);

					// 3) UV for second texture
					vec2 uvE2 = vUv * uEmission02_ST.xy + uEmission02_ST.zw;

					float s0 = texture2D(uEmission01, uv0).r * 0.1;
					float s1 = texture2D(uEmission01, uv1).r * 2.0;
					float s2 = texture2D(uEmission01, uv2).r * 0.2;
					float combined = s0 + s1 + s2;

					// 5) mask from second texture
					float mask = texture2D(uEmission02, uvE2).r;
					float thresh = uEyeBlinking * 0.3;

					// 6) ?
					float factor = (mask > thresh) ? 1.0 : 0.0;

					// 7) result alpha
					float alpha = combined * factor;

					// 8) emission + alpha
					gl_FragColor = vec4(uEyeColor, alpha);

				}
			`,
			transparent: true,
			depthWrite: false,
			blending: THREE.NormalBlending
		}
	);

	material.userData._shaderType = "destiny2_ghost_eye_shader";

	return material;
}

export function createOmolonLiquidMaterial(color, liquidLevel) //bubblesTexture
{
    const material = new THREE.MeshStandardMaterial(
        {
			color: color,
			emissive: color,
			emissiveIntensity: 0.5,
			metalness: 0.0,
			roughness: 0.0,
			transparent: false,
		}
	);

	material.onBeforeCompile = (shader) =>
	{
		shader.uniforms.uBoundary = { value: 1 - liquidLevel };
		shader.uniforms.uTime = { value: 0.0 };
		shader.uniforms.uAmplitude = { value: 0.05 };
		shader.uniforms.uFrequency = { value: 5.0 };
		shader.uniforms.uSpeed = { value: 1.5 };

		shader.vertexShader = shader.vertexShader.replace(
			'#include <uv_pars_vertex>',
			`
			#include <uv_pars_vertex>
			varying vec2 vUvCustom;
			`
		);

		shader.vertexShader = shader.vertexShader.replace(
			'#include <uv_vertex>',
			`
			#include <uv_vertex>
			vUvCustom = uv;
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <uv_pars_fragment>',
			`
			#include <uv_pars_fragment>
			varying vec2 vUvCustom;
			uniform float uBoundary;
			uniform float uTime;
			uniform float uAmplitude;
			uniform float uFrequency;
			uniform float uSpeed;
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <color_fragment>',
			`
			#include <color_fragment>

			float wave = uAmplitude * sin(vUvCustom.x * uFrequency + uTime * uSpeed);
			float boundary = uBoundary + wave;

			float edge = 0.02;

			// t = 0 at bottom, 1 on top, and smooth transition in between
			float t = smoothstep(boundary - edge, boundary + edge, vUvCustom.y);

			// mix colors
			vec3 colorBottom = vec3(0.0, 0.0, 0.0);
			vec3 colorTop    = diffuseColor.rgb;

			diffuseColor.rgb = mix(colorBottom, colorTop, t);
			`
		);

		material.userData.shader = shader;
	};

	material.userData._shaderType = "destiny2_omolon_liquid_shader";

	return material;
}

export function createBraveTigerMaterial(albedoMap) //,  tiledDiffuse, tiledNormal
{
	const material = new THREE.MeshStandardMaterial(
		{
			map: albedoMap,
			metalnessMap: albedoMap,
			roughnessMap: albedoMap,
			side: THREE.FrontSide,
			transparent: true
		}
	);

	material.onBeforeCompile = (shader) =>
	{
		material.userData.isCompiled = true; // to ensure that material is compiled
		material.userData._shader = shader;
		material.userData._shaderType = "destiny2_brave_tiger_shader";

		shader.fragmentShader = `
			#define saturate( a ) clamp( a, 0.0, 1.0 )

			vec3 bumpFromHeightApprox(
				float height,
				float strength,
				float distance,
				float width,
				vec3 baseNormal
			)
			{
				float gradient = width;
				float offset = strength * distance * gradient;

				// shift
				vec3 bumpedNormal = normalize(baseNormal - vec3(0.0, 0.0, offset));

				return bumpedNormal;
			}
			${shader.fragmentShader}
		`;

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <map_fragment>`,
			`
				#ifdef USE_MAP
					vec4 sampledDiffuseColor = texture2D( map, vMapUv );
					#ifdef DECODE_VIDEO_TEXTURE
						sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
					#endif
					diffuseColor = sampledDiffuseColor.gggg * vec4(0.503, 0.376, 0.109, 1.0);
				#endif

				if (sampledDiffuseColor.z <= 0.0)
					discard;

				diffuseColor.a = sampledDiffuseColor.z;
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <roughnessmap_fragment>`,
			`
			float roughnessFactor = roughness;
			#ifdef USE_ROUGHNESSMAP
				vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
				roughnessFactor = texelRoughness.r;
			#endif
			`
		);
		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <metalnessmap_fragment>`,
			`
			float metalnessFactor = metalness;
			#ifdef USE_METALNESSMAP
				vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
				metalnessFactor = texelMetalness.g;
			#endif
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <normal_fragment_maps>`,
			`
			normal = bumpFromHeightApprox(sampledDiffuseColor.g, 1.0, 0.005, 1.0, nonPerturbedNormal);
			`
		);
	}

	return material
}


/*
material transparency - true
use gstack transparency - true
maskclip value depending on 0x8?
*/
export function createDestiny2EmissiveMaterial(
	albedoMap, normalMap, gstack, dyeMap,
	diffuses, normals, materials,
	materialTransparency, useGstackTransparency, alphaClipTreshold,
	iridescenceLookup
)
{
	let material = new THREE.MeshStandardMaterial(
		{
			map: albedoMap,
			normalMap: normalMap,
			side: THREE.FrontSide,
			transparent: materialTransparency,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: true
		}
	);

	material.onBeforeCompile = (shader) =>
	{
		material.userData.isCompiled = true; // to ensure that material is compiled
		material.userData._shader = shader;
		material.userData._shaderType = "destiny2_emissive_shader";

		shader.uniforms.useGstackTransparency = { value: useGstackTransparency };
		shader.uniforms.alphaClipTreshold = { value: alphaClipTreshold };

		shader.uniforms.dyeMap = { value: dyeMap };
		shader.uniforms.gearstack = { value: gstack };
		shader.uniforms.iridescenceLookup = { value: iridescenceLookup };

		shader.uniforms.armorDiffuse = { value: diffuses[0] };
		shader.uniforms.armorNormal = { value: normals[0] };
		shader.uniforms.clothDiffuse = { value: diffuses[1] };
		shader.uniforms.clothNormal = { value: normals[1] };
		shader.uniforms.suitDiffuse = { value: diffuses[2] };
		shader.uniforms.suitNormal = { value: normals[2] };

		// passing undefined triggers an error so better not to pass, structure will be init by zeroes
		if (materials[0])
			shader.uniforms.armorPrimaryMaterial = { value: materials[0] };
		if (materials[1])
			shader.uniforms.armorSecondaryMaterial = { value: materials[1] };
		if (materials[2])
			shader.uniforms.clothPrimaryMaterial = { value: materials[2] };
		if (materials[3])
			shader.uniforms.clothSecondaryMaterial = { value: materials[3] };
		if (materials[4])
			shader.uniforms.suitPrimaryMaterial = { value: materials[4] };
		if (materials[5])
			shader.uniforms.suitSecondaryMaterial = { value: materials[5] };
		//
		// VERTEX SHADER BEGIN

		shader.vertexShader = `
			attribute vec2 uv2;
			attribute vec4 col;
			attribute float slot;

			out vec2 vUv;
			out vec2 vUv2;
			out float vSlot;
			${shader.vertexShader}

		`;

		shader.vertexShader = shader.vertexShader.replace(
			"void main() {",
			`
				void main() {
					vUv = uv;
					vUv2 = uv2;
					vSlot = slot;
			`
		);

		// VERTEX SHADER END
		//

		//
		// FRAGMENT SHADER BEGIN

		shader.fragmentShader = `
			#define saturate( a ) clamp( a, 0.0, 1.0 )

			in vec2 vUv;
			in vec2 vUv2;
			in float vSlot;

			uniform vec3 customColor;
			uniform bool useGstackTransparency;
			uniform float alphaClipTreshold;

			struct Material {
				vec4 detailDiffuseTransform;
				vec4 detailNormalTransform;
				vec3 color;
				vec4 params;
				vec4 advancedParams;
				vec3 emissiveColor;
				vec4 wearRemap;
				vec3 wornColor;
				vec4 wornParams;
				vec4 roughnessRemap;
				vec4 wornRoughnessRemap;
				int iridescenceId;
			};

			uniform sampler2D armorDiffuse;
			uniform sampler2D armorNormal;
			uniform sampler2D clothDiffuse;
			uniform sampler2D clothNormal;
			uniform sampler2D suitDiffuse;
			uniform sampler2D suitNormal;

			uniform Material armorPrimaryMaterial;
			uniform Material armorSecondaryMaterial;
			uniform Material clothPrimaryMaterial;
			uniform Material clothSecondaryMaterial;
			uniform Material suitPrimaryMaterial;
			uniform Material suitSecondaryMaterial;

			uniform sampler2D iridescenceLookup;

			uniform sampler2D dyeMap;
			uniform sampler2D gearstack;

			float overlay(float front, float back, float fac) {
				float newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec3 overlay(vec3 front, vec3 back, float fac) {
				vec3 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 overlay(vec4 front, vec4 back, float fac) {
				vec4 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec3 overlayBlend(vec3 base, vec3 blend) {
				vec3 result;
				for (int i = 0; i < 3; i++) {
					if (base[i] < 0.5) {
						result[i] = 2.0 * base[i] * blend[i];
					} else {
						result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - blend[i]);
					}
				}
				return result;
			}

			float remap (float val, vec4 remap) {
				return clamp(val * remap.y + remap.x, remap.z, remap.z + remap.w);
			}

			${shader.fragmentShader}
		`;

		shader.fragmentShader = shader.fragmentShader.replace(
			"void main() {",
			`void main() {
				vec4 diff = texture2D( map, vUv );

				vec4 gstack = texture2D(gearstack, vUv);

				float transparency = !bool(useGstackTransparency) ? 1.0 : saturate(gstack.b * 7.96875);

				float isAlphaCutoutMode = step(0.00001, alphaClipTreshold);
				// alphaClipTreshold == 0.0 -> blend
				// else cutout

				// visibility in different modes
				float blendPixelVisible   = step(0.00001, transparency);
				float cutoutPixelVisible  = step(alphaClipTreshold, transparency);

				// select blend or cutout mode
				float pixelVisible = mix(blendPixelVisible, cutoutPixelVisible, isAlphaCutoutMode);

				float finalAlpha = mix(transparency, 1.0, isAlphaCutoutMode);
				transparency = finalAlpha * pixelVisible;

				vec4 dyeslotColor = texture2D(dyeMap, vUv);

				Material selectedMaterial;

				vec3 selectedColor;
				vec3 selectedEmissiveColor;

				vec4 wearRemap; // +
				vec3 wornColor; // +

				int slot = int(vSlot) + 1;

				bool red = dyeslotColor.r > 0.5;
				bool green = dyeslotColor.g > 0.5;
				bool blue = dyeslotColor.b > 0.5;

				if (dyeslotColor.w > 0.5)
				{
					if (red && green && blue)
						slot = 6;
					else if (!red && blue)
						slot = 5;
					else if (red && green && !blue)
						slot = 4;
					else if (!red && green && !blue)
						slot = 3;
					else if (red && !green)
						slot = 2;
					else if (red || green)
						slot = 1;
				}

				switch (slot)
				{
					case 1:
						selectedMaterial = armorPrimaryMaterial;
						break;
					case 2:
						selectedMaterial = armorSecondaryMaterial;
						break;
					case 3:
						selectedMaterial = clothPrimaryMaterial;
						break;
					case 4:
						selectedMaterial = clothSecondaryMaterial;
						break;
					case 5:
						selectedMaterial = suitPrimaryMaterial;
						break;
					case 6:
						selectedMaterial = suitSecondaryMaterial;
						break;
				}

				selectedColor = selectedMaterial.color;
				selectedEmissiveColor = selectedMaterial.emissiveColor;
				wornColor = selectedMaterial.wornColor;
				wearRemap = selectedMaterial.wearRemap;

				float wearmask = saturate((gstack.a - 0.18823529411) * 1.23188405797);
				float mappedWear = remap(wearmask, wearRemap);
				vec3 dyeColor = mix(wornColor, selectedColor, mappedWear);

				float emit = saturate((gstack.b - 0.15686274509) * 1.18604);
			`
		);


		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <opaque_fragment>`,
			`
				vec3 baseColor = diff.rgb;

				vec3 overlayResult = overlayBlend(baseColor.xyz, selectedEmissiveColor); // * emit

				gl_FragColor = vec4(overlayResult, transparency);

			`
		);

		// FRAGMENT SHADER END
		//
	};//onBeforeCompile end

	return material;
}

function makeDefaultMaterialStruct()
{
	return {
		detailDiffuseTransform: new THREE.Vector4(0, 0, 0, 0),
		detailNormalTransform: new THREE.Vector4(0, 0, 0, 0),
		color: new THREE.Vector3(1, 1, 1),
		params: new THREE.Vector4(0, 0, 0, 0),
		advancedParams: new THREE.Vector4(0, 0, 0, 0),
		emissiveColor: new THREE.Vector3(0, 0, 0),
		wearRemap: new THREE.Vector4(0, 1, 0, 1),
		wornColor: new THREE.Vector3(1, 1, 1),
		wornParams: new THREE.Vector4(0, 0, 0, 0),
		roughnessRemap: new THREE.Vector4(0, 1, 0, 1),
		wornRoughnessRemap: new THREE.Vector4(0, 1, 0, 1),
		iridescenceId: 0
	};
}


export function createDestiny2MainMaterial(
	albedoMap, normalMap, gstack, dyeMap,
	diffuses, normals, materials,
	materialTransparency, useGstackTransparency, alphaClipTreshold,
	iridescenceLookup, sides, gearDyeChangeColorIndex,
	useTrialsMetalness = false, useTrialsGlow = false, trialsColor = "gold"
)
{
	let material = new THREE.MeshStandardMaterial( ///MeshStandardMaterial
		{
			map: albedoMap,
			normalMap: normalMap,
			aoMap: gstack,
			side: sides,
			transparent: materialTransparency,
		}
	);

	material.onBeforeCompile = (shader) =>
	{
		material.userData.isCompiled = true; // to ensure that material is compiled
		material.userData._shader = shader;
		material.userData._shaderType = "destiny2_gear_shader";

		if (useTrialsMetalness)
		{
			trialsColor = trialsColorKeys.includes(trialsColor) ? trialsColor : "gold";

			shader.uniforms.trialsMetalColor = { value: trialsColors[trialsColor].trialsMetalColor };
			shader.uniforms.trialsGlowColor = { value: trialsColors[trialsColor].trialsGlowColor };

			shader.uniforms.useTrialsMetalness = { value: true };
			shader.uniforms.useTrialsGlow = { value: useTrialsGlow };
		}
		else
		{
			shader.uniforms.trialsMetalColor = { value: trialsColors["gold"].trialsMetalColor };
			shader.uniforms.trialsGlowColor = { value: trialsColors["gold"].trialsGlowColor };

			shader.uniforms.useTrialsMetalness = { value: false };
			shader.uniforms.useTrialsGlow = { value: false };
		}

		shader.uniforms.useGstackTransparency = { value: useGstackTransparency };
		shader.uniforms.alphaClipTreshold = { value: alphaClipTreshold };
		shader.uniforms.gearDyeChangeColorIndex = { value: gearDyeChangeColorIndex };

		shader.uniforms.dyeMap = { value: dyeMap };
		shader.uniforms.gearstack = { value: gstack };
		shader.uniforms.iridescenceLookup = { value: iridescenceLookup };

		shader.uniforms.armorDiffuse = { value: diffuses[0] };
		shader.uniforms.armorNormal = { value: normals[0] };
		shader.uniforms.clothDiffuse = { value: diffuses[1] };
		shader.uniforms.clothNormal = { value: normals[1] };
		shader.uniforms.suitDiffuse = { value: diffuses[2] };
		shader.uniforms.suitNormal = { value: normals[2] };

		// passing undefined triggers an error so better not to pass, structure will be init by zeroes
		if (materials[0])
			shader.uniforms.armorPrimaryMaterial = { value: materials[0] };
		if (materials[1])
			shader.uniforms.armorSecondaryMaterial = { value: materials[1] };
		if (materials[2])
			shader.uniforms.clothPrimaryMaterial = { value: materials[2] };
		if (materials[3])
			shader.uniforms.clothSecondaryMaterial = { value: materials[3] };
		if (materials[4])
			shader.uniforms.suitPrimaryMaterial = { value: materials[4] };
		if (materials[5])
			shader.uniforms.suitSecondaryMaterial = { value: materials[5] };

		//
		// VERTEX SHADER BEGIN

		shader.vertexShader = `
			attribute vec2 uv2;
			attribute vec4 col;
			attribute float slot;

			out vec2 vUv;
			out vec2 vUv2;
			out float vSlot;
			${shader.vertexShader}
		`;

		shader.vertexShader = shader.vertexShader.replace(
			"void main() {",
			`
			void main() {
				vUv = uv;
				vUv2 = uv2;
				vSlot = slot;
			`
		);

		// VERTEX SHADER END
		//

		//
		// FRAGMENT SHADER BEGIN

		shader.fragmentShader = `
			#define saturate( a ) clamp( a, 0.0, 1.0 )

			in vec2 vUv;
			in vec2 vUv2;
			in float vSlot;
			uniform int gearDyeChangeColorIndex;

			uniform vec3 customColor;
			uniform bool useGstackTransparency;
			uniform float alphaClipTreshold;

			struct Material {
				vec4 detailDiffuseTransform;
				vec4 detailNormalTransform;
				vec3 color;
				vec4 params;
				vec4 advancedParams;
				vec3 emissiveColor;
				vec4 wearRemap;
				vec3 wornColor;
				vec4 wornParams;
				vec4 roughnessRemap;
				vec4 wornRoughnessRemap;
				int iridescenceId;
			};

			uniform sampler2D iridescenceLookup;

			uniform sampler2D armorDiffuse;
			uniform sampler2D armorNormal;
			uniform sampler2D clothDiffuse;
			uniform sampler2D clothNormal;
			uniform sampler2D suitDiffuse;
			uniform sampler2D suitNormal;

			uniform Material armorPrimaryMaterial;
			uniform Material armorSecondaryMaterial;
			uniform Material clothPrimaryMaterial;
			uniform Material clothSecondaryMaterial;
			uniform Material suitPrimaryMaterial;
			uniform Material suitSecondaryMaterial;

			uniform sampler2D dyeMap;
			uniform sampler2D gearstack;

			uniform vec3 trialsMetalColor;
			uniform vec3 trialsGlowColor;
			uniform bool useTrialsMetalness;
			uniform bool useTrialsGlow;

			bool useDyemap = true;

			float overlay(float front, float back, float fac) {
				float newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec3 overlay(vec3 front, vec3 back, float fac) {
				vec3 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 overlay(vec4 front, vec4 back, float fac) {
				vec4 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			float hardLight(float front, float back, float fac) {
				float newColor = back * saturate(front * 4.0) + saturate(front - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 hardLight(vec4 front, vec4 back, float fac) {
				vec4 newColor = back * saturate(front * 4.0) + saturate(front - 0.25);
				return mix(front, newColor, fac);
			}

			float remap (float val, vec4 remap) {
				return clamp(val * remap.y + remap.x, remap.z, remap.z + remap.w);
			}

			// photoshop overlay
			vec4 BlendMode_Overlay(vec4 cBase, vec4 cBlend)
			{
				vec4 isLessOrEq = step(cBase, vec4(0.5));
				vec4 cNew = mix(2.0 * cBlend * cBase, 1.0 - (1.0 - 2.0 * (cBase - 0.5)) * (1.0 - cBlend), isLessOrEq);
				return cNew;
			}

			vec3 BlendMode_Overlay(vec3 cBase, vec3 cBlend)
			{
				vec3 isLessOrEq = step(cBase, vec3(0.5));
				vec3 cNew = mix(2.0 * cBlend * cBase, 1.0 - (1.0 - 2.0 * (cBase - 0.5)) * (1.0 - cBlend), isLessOrEq);
				return cNew;
			}

			float fresnelTerm(float F0, float cosA) {
				float t = pow(1.0 - cosA, 5.0); // Schlick's approximation
				return F0 + (1.0 - F0) * t;
			}

			//trials glow functions start
			float colorRamp(float fac)
			{
				float t = clamp((fac - 0.0) / (0.127 - 0.0), 0.0, 1.0);
				return mix(0.0, 1.0, t);
			}

			vec3 mix_add(vec3 color1, vec3 color2, float factor)
			{
				return color1 + color2 * factor;
			}

			float mix_add(float a, float b, float factor)
			{
				return a + b * factor;
			}
			//trials glow functions end

			${shader.fragmentShader}
		`;

		shader.fragmentShader = shader.fragmentShader.replace(
			"void main() {",
			`void main() {
				vec4 gstack = texture2D(gearstack, vUv);

				float transparency = !bool(useGstackTransparency) ? 1.0 : saturate(gstack.b * 7.96875);

				if (alphaClipTreshold == 0.0)
				{
					// all except transparent pass
					if (transparency <= 0.0)
					{
						discard;
					}
				}
				else
				{
					// cutout if less discard, else alpha = 1
					if (transparency < alphaClipTreshold)
					{
						discard;
					}
					transparency = 1.0;
				}

				vec4 diff = texture2D( map, vUv );
				vec4 dyeslotColor = texture2D(dyeMap, vUv);

				//
				//// trials metalness glow start

				if (gstack.a < 0.156862745 && gstack.b >= 0.05 && useTrialsMetalness) // if un-dyed metalness
				{
					float rampResult = colorRamp(gstack.b);

					float newGstackG = mix_add(gstack.g, 0.347, rampResult); // smoothenss + 0.347 with factor
					float newGstackA = mix_add(gstack.a, 0.104, rampResult);
					vec3 newDiffuse = mix(diffuse.rgb, trialsMetalColor, rampResult);

					gstack.g = newGstackG; // changing smoothness
					gstack.a = newGstackA; // changing metalness
					diff = vec4(newDiffuse, diff.a);
				}

				//// trials metalness glow end
				//

				Material selectedMaterial;

				vec3 selectedColor;
				vec3 selectedEmissiveColor;
				vec4 wearRemap;
				vec3 wornColor;
				float wornDiffBlend;
				float diffBlend;
				float wornRoughBlend;
				float wornNormBlend;
				float roughBlend;
				float normBlend;
				float wornMetal;
				float metal;
				float iridescenceID;
				vec4 detailDiff;
				vec4 detailNorm;
				float fuzz;
				float transmission;
				vec4 roughnessRemap;
				vec4 wornRoughRemap;

				int slot = int(vSlot) + 1;
				//slot = gearDyeChangeColorIndex + 1;

				bool red = dyeslotColor.r > 0.5;
				bool green = dyeslotColor.g > 0.5;
				bool blue = dyeslotColor.b > 0.5;

				if (dyeslotColor.w > 0.5)
				{
					if (red && green && blue)
						slot = 6;
					else if (!red && blue)
						slot = 5;
					else if (red && green && !blue)
						slot = 4;
					else if (!red && green && !blue)
						slot = 3;
					else if (red && !green)
						slot = 2;
					else if (red || green)
						slot = 1;
				}

				switch (slot)
				{
					case 1:
						selectedMaterial = armorPrimaryMaterial;
						detailDiff = texture2D(armorDiffuse, vUv2 * selectedMaterial.detailDiffuseTransform.xy + selectedMaterial.detailDiffuseTransform.zw);
						detailNorm = texture2D(armorNormal, vUv2 * selectedMaterial.detailNormalTransform.xy + selectedMaterial.detailNormalTransform.zw);
						break;
					case 2:
						selectedMaterial = armorSecondaryMaterial;
						detailDiff = texture2D(armorDiffuse, vUv2 * selectedMaterial.detailDiffuseTransform.xy + selectedMaterial.detailDiffuseTransform.zw);
						detailNorm = texture2D(armorNormal, vUv2 * selectedMaterial.detailNormalTransform.xy + selectedMaterial.detailNormalTransform.zw);
						break;
					case 3:
						selectedMaterial = clothPrimaryMaterial;
						detailDiff = texture2D(clothDiffuse, vUv2 * selectedMaterial.detailDiffuseTransform.xy + selectedMaterial.detailDiffuseTransform.zw);
						detailNorm = texture2D(clothNormal, vUv2 * selectedMaterial.detailNormalTransform.xy + selectedMaterial.detailNormalTransform.zw);
						break;
					case 4:
						selectedMaterial = clothSecondaryMaterial;
						detailDiff = texture2D(clothDiffuse, vUv2 * selectedMaterial.detailDiffuseTransform.xy + selectedMaterial.detailDiffuseTransform.zw);
						detailNorm = texture2D(clothNormal, vUv2 * selectedMaterial.detailNormalTransform.xy + selectedMaterial.detailNormalTransform.zw);
						break;
					case 5:
						selectedMaterial = suitPrimaryMaterial;
						detailDiff = texture2D(suitDiffuse, vUv2 * selectedMaterial.detailDiffuseTransform.xy + selectedMaterial.detailDiffuseTransform.zw);
						detailNorm = texture2D(suitNormal, vUv2 * selectedMaterial.detailNormalTransform.xy + selectedMaterial.detailNormalTransform.zw);
						break;
					case 6:
						selectedMaterial = suitSecondaryMaterial;
						detailDiff = texture2D(suitDiffuse, vUv2 * selectedMaterial.detailDiffuseTransform.xy + selectedMaterial.detailDiffuseTransform.zw);
						detailNorm = texture2D(suitNormal, vUv2 * selectedMaterial.detailNormalTransform.xy + selectedMaterial.detailNormalTransform.zw);
						break;
				}

				selectedColor = selectedMaterial.color;
				selectedEmissiveColor = selectedMaterial.emissiveColor;
				diffBlend = selectedMaterial.params.x;
				normBlend = selectedMaterial.params.y;
				roughBlend = selectedMaterial.params.z;
				metal = selectedMaterial.params.w;
				iridescenceID = selectedMaterial.advancedParams.x;
				int iridescenceIDInt = int(round(iridescenceID)); // for easier comparison by modulo 2
				fuzz = selectedMaterial.advancedParams.y;
				transmission = selectedMaterial.advancedParams.z;

				roughnessRemap = selectedMaterial.roughnessRemap;

				wearRemap = selectedMaterial.wearRemap;
				wornColor = selectedMaterial.wornColor;

				wornRoughRemap = selectedMaterial.wornRoughnessRemap;
				wornDiffBlend = selectedMaterial.wornParams.x;
				wornNormBlend = selectedMaterial.wornParams.y;
				wornRoughBlend = selectedMaterial.wornParams.z;
				wornMetal = selectedMaterial.wornParams.w;

				float emit = saturate((gstack.b - 0.15686274509) * 1.18604);
				float dyemask = step(0.15686274509, gstack.a);
				float undyedMetal = saturate(gstack.a * 7.96875);
				float wearmask = saturate((gstack.a - 0.18823529411) * 1.23188405797);

				float mappedWear = remap(wearmask, wearRemap);
				vec3 dyeColor = mix(wornColor, selectedColor, mappedWear);

				float dyeDiffuseBlend = mix(wornDiffBlend, diffBlend, mappedWear);
				float dyeRoughBlend = mix(wornRoughBlend, roughBlend, mappedWear);
				float dyeNormalBlend = mix(wornNormBlend, normBlend, mappedWear);
				float dyeMetal = mix(wornMetal, metal, mappedWear);

				//quick fixes
				dyeMetal = saturate(dyeMetal);

			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <map_fragment>`,
			`
				diffuseColor = overlay(diff, vec4(dyeColor, 1.0), dyemask);
				diffuseColor = hardLight(diffuseColor, detailDiff, dyemask * dyeDiffuseBlend);
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <emissivemap_fragment>`,
			`
				// if not glow - black, else color * intensity
				vec3 trialsGlowResult = mix(vec3(0.0, 0.0, 0.0), emit * trialsGlowColor, float(useTrialsGlow));
				// if use metalness use glow, else base glow
				totalEmissiveRadiance = mix(emit * selectedEmissiveColor, trialsGlowResult, float(useTrialsMetalness));
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <roughnessmap_fragment>`,
			`
				float roughnessFactor = roughness;

				float detailedRoughness = mix(gstack.g, overlay(gstack.g, detailDiff.a, dyemask), dyeRoughBlend);
				float mainRough = remap(detailedRoughness, roughnessRemap);
				float wornRough = remap(detailedRoughness, wornRoughRemap);
				float dyeRoughness = mix(wornRough, mainRough, mappedWear);
				dyeRoughness = dyeRoughness * mix(0.86, fuzz * 2.0, step(dyeRoughness, 0.0));

				roughnessFactor = 1.0 - mix(gstack.g, dyeRoughness, dyemask);
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <metalnessmap_fragment>`,
			`
				float metalnessFactor = mix(undyedMetal, dyeMetal, dyemask);

				// another try ( it fixes alpha lupi!)
				float lum = dot(dyeColor.rgb, vec3(0.2126, 0.7152, 0.0722));
				float iridescenceStrength = (1.0 - lum) * float(iridescenceIDInt != -1) * dyemask;

				// if iridescence is for metals -> shift metalness
				if (iridescenceIDInt % 2 == 0)
				{
					metalnessFactor = mix(metalnessFactor, 1.0, iridescenceStrength);
				}
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <normal_fragment_maps>`,
			`
				vec4 normalMain = texture2D( normalMap, vUv );
				float cavity = mix(normalMain.z, normalMain.z * detailNorm.z, dyemask * dyeNormalBlend);
				//cavity = saturate(cavity)
				vec3 mapN = (mix(normalMain, BlendMode_Overlay(normalMain, detailNorm), dyemask * dyeNormalBlend)).xyz * 2.0 - 1.0;
				normal = normalize( tbn * mapN );

				vec3 V = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
				float nDotV = saturate( dot( normal,  ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition )) );

				/// term freshen logic
				vec3 N = normal;

				float index = (0.5 + iridescenceID) / 128.0;
				vec2 irUV = vec2( saturate( nDotV ), index );
				vec4 iridescenceColor = texture2D(iridescenceLookup, irUV);

				diffuseColor *= mix(1.0, iridescenceColor.a, dyemask); // before or after???

				// if iridescence is for metals -> shift diffuseColor
				if (iridescenceIDInt % 2 == 0)
				{
					diffuseColor.xyz = mix(diffuseColor.xyz, iridescenceColor.xyz, iridescenceStrength);
				}

				vec3 specColor = (
					mix(
						vec3(0.0),
						diffuseColor.xyz,
						metalnessFactor
					)
				) + (
					mix(
						mix(
							vec3(0.0),
							iridescenceColor.rgb,
							iridescenceStrength
						),
						vec3(0.0),
						metalnessFactor
					)
				);

				//specColor *= cavity;
				//specColor = saturate(specColor);
			`
		);

		//last version uses this
		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <lights_physical_fragment>',
			`
			PhysicalMaterial material;
			material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
			//metalnessFactor = saturate(metalnessFactor + iridescenceMask);
			vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
			float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
			material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
			material.roughness = min( material.roughness, 1.0 );
			#ifdef IOR
				material.ior = ior;
				#ifdef USE_SPECULAR
					float specularIntensityFactor = specularIntensity;
					vec3 specularColorFactor = specularColor;
					#ifdef USE_SPECULAR_COLORMAP
						specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
					#endif
					#ifdef USE_SPECULAR_INTENSITYMAP
						specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
					#endif
					material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
				#else
					float specularIntensityFactor = 1.0;
					vec3 specularColorFactor = vec3( 1.0 );
					material.specularF90 = 1.0;
				#endif
				material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
			#else
				// splicing specular color into default shader code
				material.specularColor = specColor; // mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor ); //
				material.specularF90 = 1.0;
			#endif
			#ifdef USE_CLEARCOAT
				material.clearcoat = clearcoat;
				material.clearcoatRoughness = clearcoatRoughness;
				material.clearcoatF0 = vec3( 0.04 );
				material.clearcoatF90 = 1.0;
				#ifdef USE_CLEARCOATMAP
					material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
				#endif
				#ifdef USE_CLEARCOAT_ROUGHNESSMAP
					material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
				#endif
				material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
				material.clearcoatRoughness += geometryRoughness;
				material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
			#endif
			#ifdef USE_DISPERSION
				material.dispersion = dispersion;
			#endif
			#ifdef USE_IRIDESCENCE
				material.iridescence = iridescence;
				material.iridescenceIOR = iridescenceIOR;
				#ifdef USE_IRIDESCENCEMAP
					material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
				#endif
				#ifdef USE_IRIDESCENCE_THICKNESSMAP
					material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
				#else
					material.iridescenceThickness = iridescenceThicknessMaximum;
				#endif
			#endif
			#ifdef USE_SHEEN
				material.sheenColor = sheenColor;
				#ifdef USE_SHEEN_COLORMAP
					material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
				#endif
				material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
				#ifdef USE_SHEEN_ROUGHNESSMAP
					material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
				#endif
			#endif
			#ifdef USE_ANISOTROPY
				#ifdef USE_ANISOTROPYMAP
					mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
					vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
					vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
				#else
					vec2 anisotropyV = anisotropyVector;
				#endif
				material.anisotropy = length( anisotropyV );
				if( material.anisotropy == 0.0 ) {
					anisotropyV = vec2( 1.0, 0.0 );
				} else {
					anisotropyV /= material.anisotropy;
					material.anisotropy = saturate( material.anisotropy );
				}
				material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
				material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
				material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
			#endif
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <opaque_fragment>`,
			`
				gl_FragColor = vec4(outgoingLight, transparency);

				// ------------- left for quick debugging --------------------
				// vec3 iridescenceDebug = outgoingLight.xyz;
				// if (mod(iridescenceID, 2.0) == 0.0)
				// {
				//     iridescenceDebug.xyz = vec3(1.0, 0.0, 0.0); // red for even
				// }
				// else if (iridescenceID != -1.0)
				// {
				//     iridescenceDebug.xyz = vec3(0.0, 1.0, 0.0); // green for uneven
				// }

				//gl_FragColor = vec4(vec3(iridescenceStrength), transparency);
				//gl_FragColor = vec4(dyeslotColor.rgb, transparency);

				// if (red && green && blue) // 6
				//     gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
				// else if (!red && blue)
				//     gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
				// else if (red && green && !blue)
				//     gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
				// else if (!red && green && !blue)
				//     gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
				// else if (red && !green)
				//     gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
				// else if (red || green) // 1
				//     gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
				// else
				//     gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);

				// if (slot == 1) // 6
				//     gl_FragColor = vec4(0.0, 0.0, 1.0, transparency); // blue
				// else if (slot == 2)
				//     gl_FragColor = vec4(0.0, 1.0, 0.0, transparency); // green
				// else if (slot == 3)
				//     gl_FragColor = vec4(0.0, 1.0, 1.0, transparency); // teal
				// else if (slot == 4)
				//     gl_FragColor = vec4(1.0, 0.0, 0.0, transparency); // red
				// else if (slot == 5)
				//     gl_FragColor = vec4(1.0, 0.0, 1.0, transparency); // pink
				// else if (slot == 6) // 1
				//     gl_FragColor = vec4(1.0, 1.0, 0.0, transparency); // yellow
				// else
				//     gl_FragColor = vec4(1.0, 1.0, 1.0, transparency); // white

				//gl_FragColor = vec4(step(0.5, dyeslotColor.rgb), transparency);
				//gl_FragColor = vec4(selectedColor.rgb, transparency);
				//gl_FragColor = vec4(dyeColor.rgb, transparency);
			`
		);

		// FRAGMENT SHADER END
		//
	};//onBeforeCompile end

	return material;
}


