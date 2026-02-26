import * as THREE from 'three';

const defaultDestinyMaterialProperties = {
	color: new THREE.Vector4(1, 1, 1, 1),
	detailTransform: new THREE.Vector4(1, 1, 0, 0),
	detailNormalContributionStrength: new THREE.Vector4(0, 0, 0, 0),
	decalAlphaMapTransform: new THREE.Vector4(0, 0, 0, 0),
	decalBlendOption: 0,
	specularProperties: new THREE.Vector4(0, 0, 0, 0),
	subsurfaceScatteringStrength: new THREE.Vector4(0, 0, 0, 0),
};


export function createDestinyEmissiveMaterial(
	albedoMap, gstack,
	diffuses, normals, materials,
	gearDyeChangeColorIndex
)
{
	const material = new THREE.MeshPhongMaterial({
		map: albedoMap,
		side: THREE.FrontSide,//THREE.FrontSide
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: true
	})

	material.onBeforeCompile = (shader) =>
	{
		material.userData.isCompiled = true; // to ensure that material is compiled
		material.userData._shader = shader;
		material.userData._shaderType = "destiny_emissive_shader";

		shader.uniforms.gearDyeChangeColorIndex = { value: gearDyeChangeColorIndex };

		shader.uniforms.gearstack = { value: gstack };

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

			//in vec3 cvWorldNormal;
			in vec3 cvWorldPosition;
			in vec2 vUv;
			in vec2 vUv2;

			// in vec3 vViewNormal;
			// in vec3 vViewPosition;
			uniform int gearDyeChangeColorIndex;
			uniform bool useGstackTransparency;
			uniform float alphaClipTreshold;

			uniform sampler2D gearstack;

			const float gamma_correction_power = 2.2;
			const float gamma_correction_power_inverse = 1.0/2.2;

			struct Material {
				vec4 color;
				vec4 detailTransform;
				vec4 detailNormalContributionStrength;
				vec4 decalAlphaMapTransform;
				int decalBlendOption;
				vec4 specularProperties;
				vec4 subsurfaceScatteringStrength;
			};

			uniform sampler2D armorDiffuse;
			uniform sampler2D armorNormal;
			uniform sampler2D clothDiffuse;
			uniform sampler2D clothNormal;
			uniform sampler2D suitDiffuse;
			uniform sampler2D suitNormal;

			uniform sampler2D lobeLut;

			uniform sampler2D tintLut;

			uniform samplerCube env;

			uniform Material armorPrimaryMaterial;
			uniform Material armorSecondaryMaterial;
			uniform Material clothPrimaryMaterial;
			uniform Material clothSecondaryMaterial;
			uniform Material suitPrimaryMaterial;
			uniform Material suitSecondaryMaterial;


			//// overlay functions ////
			float overlay(float front, float back)
			{
				return front * saturate(back * 4.0) + saturate(back - 0.25);
			}

			float overlayMix(float front, float back, float fac)
			{
				float newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec3 overlay(vec3 front, vec3 back)
			{
				return front * saturate(back * 4.0) + saturate(back - 0.25);
			}

			vec3 overlayMix(vec3 front, vec3 back, float fac)
			{
				vec3 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 overlay(vec4 front, vec4 back)
			{
				return front * saturate(back * 4.0) + saturate(back - 0.25);
			}

			vec4 overlayMix(vec4 front, vec4 back, float fac) {
				vec4 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			//// hardLight functions ////
			float hardLight(float front, float back)
			{
				return back * saturate(front * 4.0) + saturate(front - 0.25);
			}

			float hardLightMix(float front, float back, float fac)
			{
				float newColor = back * saturate(front * 4.0) + saturate(front - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 hardLight(vec4 front, vec4 back)
			{
				return back * saturate(front * 4.0) + saturate(front - 0.25);
			}

			vec4 hardLightMix(vec4 front, vec4 back, float fac)
			{
				vec4 newColor = back * saturate(front * 4.0) + saturate(front - 0.25);
				return mix(front, newColor, fac);
			}

			vec3 FilmicToneMap(vec3 x)
			{
				const float A = 0.22;
				const float B = 0.30;
				const float C = 0.10;
				const float D = 0.20;
				const float E = 0.01;
				const float F = 0.30;
				return ((x*(A*x + C*B) + D*E) / (x*(A*x + B) + D*F)) - E/F;
			}

			vec4 toLinear(vec4 sRGB)
			{
				bvec4 cutoff = lessThan(sRGB, vec4(0.04045));
				vec4 higher = pow((sRGB + vec4(0.055))/vec4(1.055), vec4(2.4));
				vec4 lower = sRGB/vec4(12.92);

				return mix(higher, lower, cutoff);
			}

			${shader.fragmentShader}
		`;

		shader.fragmentShader = shader.fragmentShader.replace(
			"void main() {",
			`void main()
			{
				vec4 gstack = texture2D(gearstack, vUv);
				//gstack = toLinear(gstack); // from srgb

				float transparency = gstack.b;

				Material selectedMaterial;

				int slot = gearDyeChangeColorIndex + 1;

				vec4 detailAlbedo;
				vec4 detailNormal;
				vec4 selectedDyeColor;

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

				selectedDyeColor = selectedMaterial.color;
				float scratchMask = gstack.r;
			`
		);


		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <map_fragment>`,
			`
				vec4 mainAlbedo = texture2D(map, vUv); // texture is in srgb already

				// 1. color mainAlbedo with dye color
				diffuseColor = overlayMix(mainAlbedo, selectedDyeColor, scratchMask);
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;`,
			`vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + diffuseColor.rgb * 1.5;`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <opaque_fragment>`,
			`
			#ifdef OPAQUE
			diffuseColor.a = 1.0;
			#endif
			#ifdef USE_TRANSMISSION
			diffuseColor.a *= material.transmissionAlpha;
			#endif
			gl_FragColor = vec4( FilmicToneMap(outgoingLight), transparency );
			`
		);

		// FRAGMENT SHADER END
		//
	};//onBeforeCompile end

	return material;
}

export function createDestinyMainMaterial(
	albedoMap, normalMap, gstack,
    diffuses, normals, materials,
	lobeLut, tintLut, envMap,
	useGstackTransparency, alphaClipTreshold,
	sides, gearDyeChangeColorIndex
)
{
	albedoMap.colorSpace = THREE.SRGBColorSpace;

	for (let diffuseKey in diffuses)
		diffuses[diffuseKey].colorSpace = THREE.SRGBColorSpace;


	const material = new THREE.MeshPhongMaterial(
		{
			map: albedoMap,
			normalMap: normalMap,
			side: sides
		}
	);

	material.onBeforeCompile = (shader) =>
	{

		material.userData.isCompiled = true; // to ensure that material is compiled
		material.userData._shader = shader;
		material.userData._shaderType = "destiny_gear_shader";

		shader.uniforms.useGstackTransparency = { value: useGstackTransparency };
        shader.uniforms.alphaClipTreshold = { value: alphaClipTreshold };
		shader.uniforms.gearDyeChangeColorIndex = { value: gearDyeChangeColorIndex };

		shader.uniforms.gearstack = { value: gstack };

		shader.uniforms.armorDiffuse = { value: diffuses[0] };
		shader.uniforms.armorNormal = { value: normals[0] };
		shader.uniforms.clothDiffuse = { value: diffuses[1] };
		shader.uniforms.clothNormal = { value: normals[1] };
		shader.uniforms.suitDiffuse = { value: diffuses[2] };
		shader.uniforms.suitNormal = { value: normals[2] };

		shader.uniforms.env = { value: envMap /*THREE.UniformsLib.envmap*/ };

		shader.uniforms.lobeLut = { value: lobeLut };

		shader.uniforms.tintLut = { value: tintLut };

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

		shader.vertexShader = `
			attribute vec2 uv2;
			out vec2 vUv;
			out vec2 vUv2;
			out vec3 cvWorldPosition;

			${shader.vertexShader}
		`;

		shader.vertexShader = shader.vertexShader.replace(
			"void main() {",
			`
			void main() {
				vec4 worldPos = modelMatrix * vec4(position, 1.0);
				cvWorldPosition = worldPos.xyz;
				vUv = uv;
				vUv2 = uv2;
			`
		);

		shader.fragmentShader = `
			#define saturate( a ) clamp( a, 0.0, 1.0 )

			in vec3 cvWorldPosition;
			in vec2 vUv;
			in vec2 vUv2;

			uniform int gearDyeChangeColorIndex;
			uniform bool useGstackTransparency;
            uniform float alphaClipTreshold;

			uniform sampler2D gearstack;

			const float gamma_correction_power = 2.2;
			const float gamma_correction_power_inverse = 1.0/2.2;

			struct Material {
				vec4 color;
				vec4 detailTransform;
				vec4 detailNormalContributionStrength;
				vec4 decalAlphaMapTransform;
				int decalBlendOption;
				vec4 specularProperties;
				vec4 subsurfaceScatteringStrength;
			};

			uniform sampler2D armorDiffuse;
			uniform sampler2D armorNormal;
			uniform sampler2D clothDiffuse;
			uniform sampler2D clothNormal;
			uniform sampler2D suitDiffuse;
			uniform sampler2D suitNormal;

			uniform sampler2D lobeLut;

			uniform sampler2D tintLut;

			uniform samplerCube env;

			uniform Material armorPrimaryMaterial;
			uniform Material armorSecondaryMaterial;
			uniform Material clothPrimaryMaterial;
			uniform Material clothSecondaryMaterial;
			uniform Material suitPrimaryMaterial;
			uniform Material suitSecondaryMaterial;

			vec3 specAccum = vec3(0.0);
			vec3 diffAccum = vec3(0.0);

			//// overlay functions ////
			float overlay(float front, float back)
			{
				return front * saturate(back * 4.0) + saturate(back - 0.25);
			}

			float overlayMix(float front, float back, float fac)
			{
				float newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec3 overlay(vec3 front, vec3 back)
			{
				return front * saturate(back * 4.0) + saturate(back - 0.25);
			}

			vec3 overlayMix(vec3 front, vec3 back, float fac)
			{
				vec3 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 overlay(vec4 front, vec4 back)
			{
				return front * saturate(back * 4.0) + saturate(back - 0.25);
			}

			vec4 overlayMix(vec4 front, vec4 back, float fac) {
				vec4 newColor = front * saturate(back * 4.0) + saturate(back - 0.25);
				return mix(front, newColor, fac);
			}

			//// hardLight functions ////
			float hardLight(float front, float back)
			{
				return back * saturate(front * 4.0) + saturate(front - 0.25);
			}

			float hardLightMix(float front, float back, float fac)
			{
				float newColor = back * saturate(front * 4.0) + saturate(front - 0.25);
				return mix(front, newColor, fac);
			}

			vec4 hardLight(vec4 front, vec4 back)
			{
				return back * saturate(front * 4.0) + saturate(front - 0.25);
			}

			vec4 hardLightMix(vec4 front, vec4 back, float fac)
			{
				vec4 newColor = back * saturate(front * 4.0) + saturate(front - 0.25);
				return mix(front, newColor, fac);
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

			vec3 FilmicToneMap(vec3 x)
			{
				const float A = 0.22;
				const float B = 0.30;
				const float C = 0.10;
				const float D = 0.20;
				const float E = 0.01;
				const float F = 0.30;
				return ((x*(A*x + C*B) + D*E) / (x*(A*x + B) + D*F)) - E/F;
			}

			vec4 FinalCombineFilmCurve(vec4 v)
			{
				vec4 r0, r1, r2, o0;
				r0 = v;

				r1.xyz = r0.xyz * vec3(1.04874694) + vec3(3.13439703);
				r1.xyz = r1.xyz * r0.xyz;

				r2.xyz = r0.xyz * vec3(0.990440011) + vec3(3.24044991);

				r0.xyz = r0.xyz * r2.xyz + vec3(0.651790023);

				o0.xyz = clamp(r1.xyz / r0.xyz, 0.0, 1.0);
				o0.w = 1.0;

				return o0;
			}

			vec4 toLinear(vec4 sRGB)
			{
				bvec4 cutoff = lessThan(sRGB, vec4(0.04045));
				vec4 higher = pow((sRGB + vec4(0.055))/vec4(1.055), vec4(2.4));
				vec4 lower = sRGB/vec4(12.92);

				return mix(higher, lower, cutoff);
			}

			vec4 toSRGB(vec4 linear)
			{
				bvec4 cutoff = lessThan(linear, vec4(0.0031308));
				vec4 higher = vec4(1.055) * pow(linear, vec4(1.0 / 2.4)) - vec4(0.055);
				vec4 lower = linear * vec4(12.92);

				return mix(higher, lower, cutoff);
			}

			// light accumulators
			void lightToAccums(float materialId, float smoothness, vec3 lightRadiance, vec3 N, vec3 H)
			{
				float ndoth = dot(N, H);
				float lobeU = sqrt(clamp(1.0 - ndoth, 0.0, 1.0));
				float lobeV = 0.00312500005 + floor(10.645833 * materialId) * 0.1 + 0.09375 * smoothness;
				vec2 lobe = texture(lobeLut, vec2(lobeU, lobeV)).rg;

				vec3 DDiffuse = vec3(lobe.g);
				vec3 DSpecular = vec3(lobe.r);

				// radiance * D * G
				diffAccum += lightRadiance * DDiffuse;
				specAccum += lightRadiance * DSpecular / (0.3 + dot(H, H));
			}

			${shader.fragmentShader}
		`;

		shader.fragmentShader = shader.fragmentShader.replace(
			"void main() {",
			`
			void main()
			{
				vec4 gstack = texture2D(gearstack, vUv);
				//gstack = toLinear(gstack); // from srgb

				float transparency = !bool(useGstackTransparency) ? 1.0 : gstack.b;

				if (alphaClipTreshold == 0.0)
				{
					// all non-transparent pass
					if (transparency <= 0.0)
					{
						discard;
					}
				}
				else
				{
					// cutout mode, if lower discard else alpha = 1
					if (transparency < alphaClipTreshold)
					{
						discard;
					}
					transparency = 1.0;
				}

				Material selectedMaterial;

				int slot = gearDyeChangeColorIndex + 1;

				vec4 detailAlbedo;
				vec4 detailNormal;
				vec4 selectedDyeColor;

				switch (slot)
				{
					case 1:
						selectedMaterial = armorPrimaryMaterial;
						detailAlbedo = texture2D(armorDiffuse, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						detailNormal = texture2D(armorNormal, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						break;
					case 2:
						selectedMaterial = armorSecondaryMaterial;
						detailAlbedo = texture2D(armorDiffuse, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						detailNormal = texture2D(armorNormal, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						break;
					case 3:
						selectedMaterial = clothPrimaryMaterial;
						detailAlbedo = texture2D(clothDiffuse, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						detailNormal = texture2D(clothNormal, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						break;
					case 4:
						selectedMaterial = clothSecondaryMaterial;
						detailAlbedo = texture2D(clothDiffuse, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						detailNormal = texture2D(clothNormal, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						break;
					case 5:
						selectedMaterial = suitPrimaryMaterial;
						detailAlbedo = texture2D(suitDiffuse, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						detailNormal = texture2D(suitNormal, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						break;
					case 6:
						selectedMaterial = suitSecondaryMaterial;
						detailAlbedo = texture2D(suitDiffuse, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						detailNormal = texture2D(suitNormal, vUv2 * selectedMaterial.detailTransform.xy + selectedMaterial.detailTransform.zw);
						break;
				}

				selectedDyeColor = selectedMaterial.color;
				float smoothness = gstack.g;
				float scratchMask = gstack.r;

				float invScratch = saturate(1. - scratchMask);

				float materialId = selectedMaterial.specularProperties.r;

				vec4 detailNormalContributionStrength = selectedMaterial.detailNormalContributionStrength;
			`
		);


		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <map_fragment>`,
			`
				vec4 mainAlbedo = texture2D(map, vUv); // texture is in srgb already

				// gbuffer fragment shader variant // this one is much better than previous
				vec3 detailAlbedoTinted = overlay(selectedDyeColor.rgb, detailAlbedo.rgb);
				vec3 overlayMainDetailAlbedo = overlay(detailAlbedoTinted, mainAlbedo.rgb);
				vec3 albedoMix1 = mix(overlayMainDetailAlbedo, mainAlbedo.rgb, invScratch); // if invScratch == 1 -> use main | scratch == 0 -> use main
				vec3 resultAlbedo = mix(albedoMix1, mainAlbedo.rgb, invScratch);
				diffuseColor.rgb = resultAlbedo;

				float albedoDot = dot(diffuseColor.rgb, vec3(4.80000019,9.43999958,1.75999999));

				// these transforms are also made with smoothness
				float overlayDetailAlphaSmoothness = overlay(detailAlbedo.a, smoothness);
				float strangeMix1 = mix(overlayDetailAlphaSmoothness, smoothness, invScratch);
				float strangeResult = mix(strangeMix1, smoothness, invScratch);
				smoothness = strangeResult;
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <normal_fragment_maps>`,
			`
				vec4 normalMainTex = texture2D(normalMap, vUv);

				// to vec3 [-1,1]
				vec3 mainNormal = normalMainTex.rgb * 2.0 - 1.0;

				// D1 normals store red and green channels only
				vec2 detailNormalRG = detailNormal.rg;
				vec3 detailNormalUnpacked = vec3(detailNormalRG * 2.0 - 1.0, 0.0); // temp z = 0
				detailNormalUnpacked.z = sqrt(max(0.0, 1.0 - dot(detailNormalUnpacked, detailNormalUnpacked)));
				vec3 combinedNormal = detailNormalUnpacked * detailNormalContributionStrength.x + mainNormal;

				vec3 normalMix1 = mix(combinedNormal, mainNormal, invScratch);
				vec3 normalMix2 = mix(normalMix1, mainNormal, invScratch);
				normal = normalize(tbn * normalMix2);
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <opaque_fragment>`,
			`
				//// adding cubemap ///
				vec3 I = normalize(cvWorldPosition - cameraPosition);

				// reflected vector
				vec3 R = reflect(I, normal);

				// lod selection for default_cubemap
				float lod = (1.0 - smoothness) * 8.0;

				lod = max(5., lod);

				vec4 envMapColor = textureLod(env, R, lod).rgba;
				diffuseColor.rgb = diffuseColor.rgb + diffuseColor.rgb * envMapColor.rgb;

				vec3 V = normalize(cameraPosition - cvWorldPosition); // from frag to cam
				float ndotv = dot(normal, V);

				// light accumulation
				IncidentLight custom_directLight;

				#if ( NUM_DIR_LIGHTS > 0 )
					DirectionalLight custom_directionalLight;
					#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
					DirectionalLightShadow directionalLightShadow;
					#endif
					#pragma unroll_loop_start
					for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
						custom_directionalLight = directionalLights[ i ];
						getDirectionalLightInfo( custom_directionalLight, custom_directLight );
						#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
						directionalLightShadow = directionalLightShadows[ i ];
						custom_directLight.color *= ( custom_directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
						#endif

						vec3 tempV = geometryViewDir;
						vec3 tempL = custom_directLight.direction;
						vec3 tempH = normalize(tempL + tempV);
						vec3 radiance = custom_directLight.color; // color * intensity

						lightToAccums(materialId, smoothness, radiance, normal, tempH);
					}
					#pragma unroll_loop_end
				#endif

				// point light
				// vec3 lightColor = vec3(1.0);
				// float lightIntensity = 5.0;
				// vec3 lightRadiance = lightColor * lightIntensity;
				// vec3 lightPosition = vec3(0.0, 3.0, 4.0);
				// vec3 L = normalize(lightPosition - cvWorldPosition);
				// vec3 H = normalize(L + V);
				//
				// lightToAccums(materialId, smoothness, lightRadiance, normal, H);

				// specular tint [light independent!]
				float specV1 = materialId * 0.99609375 + 0.0009765625;
				float specV2 = materialId * 0.99609375 + 0.0029296875;
				float specU = min(ndotv * ndotv, 1.0);
				vec4 tint1 = texture2D(tintLut, vec2(specU, specV1)).rgba;
				tint1 *= tint1;
				vec4 tint2 = texture2D(tintLut, vec2(specU, specV2)).rgba;
				tint2 *= tint2;

				vec3 FSpecular = tint1.rgb +
					(tint1.a * diffuseColor.rgb) * vec3(16.0) +
					(albedoDot * tint2.rgb);

				vec3 FDiffuse = diffuseColor.rgb * tint2.a;

				vec3 specSwitch = (materialId > 0.93921566) ? vec3(0.0, 0.0, 0.0) : vec3(1.0, 1.0, 1.0);
				vec3 diffuseMul = (materialId > 0.93921566) ?
					vec3(tint1.b) :
					vec3(1.0);

				vec3 diffuseAdd = (materialId > 0.93921566) ? 600.0 * vec3(smoothness * smoothness * tint1.g + tint1.r) : vec3(0.0);

				diffAccum = min(vec3(32.0), diffAccum);
				specAccum = min(vec3(32.0), specAccum);

				vec3 fDiffuse = (diffuseMul * diffAccum + diffuseAdd) * FDiffuse;
				vec3 fSpecular = specSwitch * specAccum * FSpecular;

				vec3 light = fSpecular + fDiffuse;

				light += diffuseColor.rgb * ambientLightColor;
			`
		);

		shader.fragmentShader = shader.fragmentShader.replace(
			`#include <tonemapping_fragment>`,
			`
				gl_FragColor = vec4(
					FilmicToneMap(light),
					1.0
				);
			`
		);
	}

	return material;
}
