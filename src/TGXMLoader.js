import * as THREE from 'three';
import BufferPack from "bufferpack";

import { parseTGX } from "./parseTGX.js";
import { parseTCHCHeader, buildGeometryFromTCHC } from "./parseTCHC.js";
import { TGXModelContainer } from "./TGXModelContainer.js";
import {
	loadHandsTextures, loadHandsGeometry,
	loadInventoryItemDefinition, loadGearAssetDefinition
} from "./loadHelpers.js";
import {
	createEmptyImage,
	imageBytesToPNG, insertImage
} from './imageUtilities.js';
import { RenderMesh } from "./renderMesh.js";
import {
	materialsUsingShaderProperties,
	updateMaterialDyeTextures,
	updateMainMaterialTrialsColor,
	createRearSightMaterial,
	createDestiny2EmissiveMaterial,
	createHandsMaterial,
	createDestiny2MainMaterial,
	createLensMaterial,
	createGhostEyeMaterial,
	createOmolonLiquidMaterial,
	createBraveTigerMaterial,
	createAmmoCounterMaterial
} from "./TGXMaterialsDestiny2.js";
import {
	createDestinyMainMaterial,
	createDestinyEmissiveMaterial,
} from "./TGXMaterialsDestiny.js";
import {
	createFOTCDecalMaterial, createGhostCoreMaterial,
	createGhostEyeBackgroundMaterial, createOverridenEmissiveMaterial,
	createReticleMaterial
} from "./TGXMaterialsCommon.js";

import { parseSeleton, skeletonJson } from "./parseSkeleton.js";
import {
	dataTypeAlias, parsePosition,
	parseNormal, parseTexcoord0,
	parseTexcoord2, parseBlendindices,
	parseBlendweights, parseTangent,
	addDataDrivenBufferData, addSkinBufferData,
	parseIndexBuffer,
} from "./TGXBufferUtilities.js";
import {
	decompose,
	loadDestinyInventoryItemDefinition,
	isSubstrInArray, findFirstSubstrInArray,
	/*consoleLogRGB, consoleLogImage,*/
} from "./helperFunctions.js";
import {
	filterDestiny2StagePartsToRender,
	filterDestinyStagePartsToRender,
} from "./stagePartFilter.js";
import {
	dummyDyeslot, dummyWhite,
	dummyNormal, dummyDiffuse,
} from "./commonTextures.js";
import { parseAnimation } from "./parseAnimation.js";
import {
	buildDestinyMaterialProperties,
	buildDestiny2MaterialProperties,
	getDyeChannelHash,
	ShaderItemTypes,
	getInventoryItemType,
	ChannelHashToData
} from "./TGXMaterialUtilities.js";
import { TGXCache } from "./TGXItemCache.js";
import { BungieAPI } from "./BungieAPI.js";
import {
	ghostEyeBackgroundSignature, countVertices,
	checkSignatureFromIndices
} from "./ghostEyeBackgoundDetection.js";
import {
	createModelConfig, createGlobalConfig, createHandsConfig
} from "./TGXLoaderConfig.js";
import {
	destiny2AllowedTransparentTextures, destiny2DecalTextureNames,
	destinyAllowedTransparentTextures, destinyDecalTextureNames,
	counterTextures, HandsAndNeckTextures
} from "./TGXLoaderTextureNames.js";


const destiny2CDN = {
    Geometry:       "/common/destiny2_content/geometry/platform/mobile/geometry",
    Texture:        "/common/destiny2_content/geometry/platform/mobile/textures",
    PlateRegion:    "/common/destiny2_content/geometry/platform/mobile/plated_textures",
    Gear:           "/common/destiny2_content/geometry/gear",
    //Shader:       "/common/destiny2_content/geometry/platform/mobile/shaders", // not used anywhere
    Animation:      "/common/destiny_content/animations"
};

const destinyCDN = {
	Geometry: 		"/common/destiny_content/geometry/platform/mobile/geometry",
	Texture: 		"/common/destiny_content/geometry/platform/mobile/textures",
	PlateRegion: 	"/common/destiny_content/geometry/platform/mobile/plated_textures",
	Gear: 			"/common/destiny_content/geometry/gear",
	Shader: 		"/common/destiny_content/geometry/platform/mobile/shaders",
	Animation:  	"/common/destiny_content/animations"
};

export class TGXMLoader
{
	constructor(options)
	{
		// options
		this.config = {};
		if (typeof options != 'object')
			options = {};

		this.config = createGlobalConfig(options);

		this.regionIndexesToNotLoad = {
			//"0": 0,   // main part of the gun, may include barrel (or may not)
			//"1": 1,   // some additional gun details (like leather on breakneck), or can be a barrel
			//"2": 2,   // hud????
			//"3": 3    // scope, like a frame or rearsights
			//"4": 4,   // stocks or parts of them, but sometimes stocks are part of region 1
			//"5": 5,   // magazine/arrows
			//"6": 6,   // ammo ??
			//"17": 17, // reticle, seems both red dot and holo-part
			//"19": 19, // is a part of a ship
			//"21": 21  // ??
		};

		this.cache = new TGXCache();

		this.cache.initEntry("global", "global");

		// for skinning magic
		this.skinningIdentityMatrix = new THREE.Matrix4();

		// animations
		this.animations = {};

		this.textureLoader = new THREE.TextureLoader();

		// preparing common images
		this.iridescenceLookup = this.textureLoader.load(this.config.iridescenceLookupPath);
		this.iridescenceLookup.flipY = false;// - breaks textures and makes them purple
		this.iridescenceLookup.colorSpace = THREE.SRGBColorSpace;
		this.iridescenceLookup.minFilter = THREE.LinearFilter;
		this.iridescenceLookup.magFilter = THREE.LinearFilter;
		this.iridescenceLookup.wrapS = THREE.RepeatWrapping;
		this.iridescenceLookup.wrapT = THREE.RepeatWrapping;
		this.cache.addThreeTexture("global:global", "iridescenceLookup", this.iridescenceLookup);

		this.specularTintLookup = this.textureLoader.load(this.config.specularTintPath);
		this.specularTintLookup.flipY = false;
		this.specularTintLookup.colorSpace = THREE.NoColorSpace;//THREE.NoColorSpace;
		this.specularTintLookup.minFilter = THREE.LinearFilter;//THREE.LinearFilter;
		this.specularTintLookup.magFilter = THREE.LinearFilter;
		this.specularTintLookup.wrapS = THREE.ClampToEdgeWrapping;
		this.specularTintLookup.wrapT = THREE.ClampToEdgeWrapping;
		this.cache.addThreeTexture("global:global", "specularTintLookup", this.specularTintLookup);

		this.specularLobeLookup = this.textureLoader.load(this.config.specularLobePath);
		this.specularLobeLookup.flipY = false;
		this.specularLobeLookup.colorSpace = THREE.NoColorSpace;//THREE.NoColorSpace;
		this.specularLobeLookup.minFilter = THREE.LinearFilter;
		this.specularLobeLookup.magFilter = THREE.LinearFilter;
		this.specularLobeLookup.wrapS = THREE.ClampToEdgeWrapping;
		this.specularLobeLookup.wrapT = THREE.ClampToEdgeWrapping;
		this.cache.addThreeTexture("global:global", "specularLobeLookup", this.specularLobeLookup);

		const cloader = new THREE.CubeTextureLoader();
		this.defaultMonocromeCubemap = cloader.load(this.config.cubemapPaths);
		this.cache.addThreeTexture("global:global", "defaultMonocromeCubemap", this.defaultMonocromeCubemap);

		// triangle winding order
		this.evenOrder = [0, 1, 2];
		this.oddOrder = [1, 0, 2];

		this.api = BungieAPI;
	}

	async loadSkeleton(type)
	{
		if (type == "guardian") // only one supported for now
		{
			try
			{
				const resJson = await this.api.fetchAnimation(destinyCDN, "destiny_player_skeleton.js");

				let [skeleton, rootBone, boneNames] = parseSeleton(resJson);

				return {
					skeleton,
					rootBone,
					boneNames
				};
			}
			catch (err)
			{
				console.error("TGXMLoader // loadSkeleton: Error wile loading skeleton");
				throw new Error("Error wile loading skeleton");
			}
		}
		else
			return {};
	}

	// frees resources allocated by THREE.js, if no hash provided - frees all resources
	dispose(id = null)
	{
		if (id === null)
		{
			this.cache.reset(true);
		}
		else
		{
			this.cache.disposeSingleItem(id);
		}
	}

	reset()
	{
		this.cache.reset();
	}

	#skipRegion(regionIndex)
	{
		return  ( ( regionIndex + "" in this.regionIndexesToNotLoad ) || (regionIndex < -1 || regionIndex > 26) );
	}

	async #initItem(itemHash, prefix="destiny2")
	{
		const inventoryDefinitionLoadResult = await loadInventoryItemDefinition(itemHash, prefix, this.config);

		if (!inventoryDefinitionLoadResult.ok)
		{
			console.error("TGXMLoader // initItem: Error while loading DestinyInventoryItemDefinition:", inventoryDefinitionLoadResult.message);
			return null;
		}

		const DestinyInventoryItemDefinition = inventoryDefinitionLoadResult.DestinyInventoryDefinition;
		const itemType = getInventoryItemType(DestinyInventoryItemDefinition, prefix);

		console.log(`TGXMLoader // initItem: Item Type for item [hash=${itemHash}]:`, itemType)

		const assetDefinitionLoadResult = await loadGearAssetDefinition(itemHash, prefix, this.config);

		if (!assetDefinitionLoadResult.ok)
		{
			console.error("TGXMLoader // initItem: Error while loading gearAssetDefinition:", assetDefinitionLoadResult.message);
			return null;
		}

		const gearAssetDefinition = assetDefinitionLoadResult.DestinyGearAssetDefinition;

		const uniqueId = this.cache.initEntry(itemHash, prefix, itemType, DestinyInventoryItemDefinition, gearAssetDefinition);

		console.log("uniqueId:", uniqueId);

		if (itemType == ShaderItemTypes.Weapon && prefix === "destiny2" && uniqueId)
		{
			// defaultDamageType:1 // enum DamageType "Kinetic"
			// defaultDamageType:2 // enum DamageType "Arc"
			// defaultDamageType:3 // enum DamageType "Thermal"
			// defaultDamageType:4 // enum DamageType "Void"
			// defaultDamageType:6 // enum DamageType "Stasis"
			// defaultDamageType:7 // enum DamageType "Strand"

			let liquid_color = "#00a4ff"; // arc as deafult
			switch (DestinyInventoryItemDefinition.defaultDamageType)
			{
				case 3:
					liquid_color = "#ff9900";
					break;
				case 4:
					liquid_color = "#b229ff";
					break;
				case 6:
					liquid_color = "#9998ec";
					break;
				case 7:
					liquid_color = "#1a9543";
					break;
			}

			this.cache.setOmolonLiquidColor(uniqueId, liquid_color);
		}

		return uniqueId;
	}

	async loadShader(shaderHash, game)
	{
		if (typeof shaderHash !== "string")
		{
			shaderHash = String(shaderHash);
		}

		let shaderId;

		if ( ! this.cache.hasEntry(shaderHash, game) )
		{
			shaderId = await this.#initItem(shaderHash, game);

			if (shaderId === null)
				return null;
		}
		else
			shaderId = this.cache.createId(shaderHash, game);

		if (this.config.shaders.source == "api")
		{
			await this.#loadShaderAPI(shaderId);
		}
		else if (this.config.shaders.source == "custom")
		{
			await this.#loadShaderSelfHosted(shaderId, shaderHash);
		}
		else
			return null;

		return shaderId;
	}

	async #loadShaderAPI(shaderId)
	{
		const assetManifest = this.#filterFilesToLoad(shaderId);

		if (!assetManifest)
		{
			console.error("Error while filtering files");
			return null;
		}

		const loadItemFilesCheck = await this.#loadItemFiles(shaderId, assetManifest);

		if (!loadItemFilesCheck)
		{
			console.error("Error while downloading files");
			return null;
		}

		const gearAssetDefinition = this.cache.getGearAssetDefinition(shaderId);

		if (gearAssetDefinition.gear.length > 1)
		{
			console.warn(`Shader [hash=${shaderId}] has multiple gear files!`);
		}

		const gearFileName = gearAssetDefinition.gear[0];
		this.cache.setGearFileName(shaderId, gearFileName);

		this.#processGearDyes(shaderId);
		// deafult dyes do not change, so can do it only one time
	}

	// legacy
	async #loadShaderSelfHosted(shaderId, shaderHash)
	{
		const gearFileName = `${shaderHash}.json`;
		let shaderJSON;

		try
		{

			let response = await fetch(`${this.config.shaders.gearUrlPrefix}/${gearFileName}`);

			if (!response.ok)
			{
				throw new Error(`Error while loading file: ${response.status}`);
			}

			shaderJSON = await response.json();
		}
		catch (err)
		{
			console.error("Networking error while loading", err);
			return;

		}

		this.cache.addGearFile(shaderId, gearFileName, shaderJSON);
		this.cache.setGearFileName(shaderId, gearFileName);

		try
		{
			const arrayBuffers = await Promise.all(
				Object.entries(shaderJSON.all_textures).map(
					async ([textureIndex, textureFileName]) =>
					{
						// loading textures and returning array of arrayBuffer
						const response = await fetch(`${this.config.shaders.texturesUrlPrefix}/${textureFileName}`);

						if (!response.ok)
						{
							throw new Error(`Error while loading file: ${response.status}`);
						}

						const buf = await response.arrayBuffer()

						return [textureFileName.replace(/\.png$/i, ""), new Uint8Array(buf)]; // removing .png because of how texture names stored in dye definiton
					}
				)
			);

			// processing each arrayBuffer to textures in base64 and file bytes
			// base64 for debug purposes

			for (let [textureFileName, textureArrayBuffer] of arrayBuffers)
			{
				const imageData = imageBytesToPNG(textureArrayBuffer);

				this.cache.addTextureData(
					shaderId,
					textureFileName,
					{
						name: textureFileName,
						//textureFileBytes: textureArrayBuffer,  // this is raw bytes, not pixels
						imageData: imageData
					}
				)
			}
		}
		catch (error)
		{
			throw new Error('Error while downloading textures files for shader:' + error);
		}

		this.#processGearDyes(shaderId);
	}

	// itemId - DestinyInventoryItemDefinition.hash
	// options - object of options
	// onProgress - callback function that provides loading progress
	async load(
		options={},
		onProgress=(value) =>
		{
			console.log(value)
		}
	)
	{
		const st = performance.now();
		const totalSteps = 9;

		// Step #1
		// Prepare item description and parse options
		onProgress({loaded: 0, total: totalSteps, text: "Configuring item..."});

		let itemHash = options.itemHash;
		const game = options.game;

		if (game !== "destiny2" && game !== "destiny")
		{
			console.error(`TGXMLoader // load: Game is not provided or is unsupported: ${game}`)
			throw new Error(`Game is not provided or is unsupported: ${game}`);
		}

		if (typeof itemHash !== "string")
		{
			itemHash = String(itemHash);
		}

		let itemId;
		// if item haven't been loaded before -> init cache storage
		if (!this.cache.hasEntry(itemHash, game))
		{
			itemId = await this.#initItem(itemHash, game);

			if (itemId === null)
			{
				console.error(`TGXMLoader // load: Could not init cache for item [itemHash = ${itemHash}, game = ${game}]`)
				throw new Error(`Could not init cache for item [itemHash = ${itemHash}, game = ${game}]`);
			}
		}
		else
			itemId = this.cache.createId(itemHash, game);

		// creating container
		let container;

		if (options.container)
		{
			console.log(`TGXMLoader // load: Container is provided for item [itemId = ${itemId}]`)
			container = options.container;

			if (container.isDisposed)
			{
				console.error(
					`TGXMLoader // load: Provided container [container.itemId = ${container.itemId}] is disposed, cannot use it`
				);
				throw new Error(`Provided container [container.itemId = ${container.itemId}] is disposed, cannot use it`);
			}

			if (container.itemId !== itemId || container.game !== game)
			{
				console.error(
					`TGXMLoader // load: Item and container data mismatch: [container.itemId = ${container.itemId}], [itemId = ${itemId}]`
				);
				throw new Error(`Item and container data mismatch: [container.itemId = ${container.itemId}], [itemId = ${itemId}]`);
			}
		}
		else
		{
			console.log(`TGXMLoader // load: A container is not provided for item [itemId = ${itemId}, game = ${game}], creating it`)
			container = new TGXModelContainer(itemId, game);
		}

		const config = createModelConfig(options, this.config);
		const skeleton = config.skeleton;

		console.log(
			"Loading item:\n",
			`\tHash: ${itemHash}, game: ${game} -> itemId: ${itemId}\n`,
			`\tUse Female arrangement: ${config.isFemale}\n`,
			`\tUse trials metal color: ${config.useTrialsMetalness}, use trials glow: ${config.useTrialsGlow}, trials color: ${config.trialsColor}\n`,
			`\tLevel of Detail: ${config.lod}\n`,
			"\tUse render stages:", config.allowedRenderStages
		);

		// Step #2
		// filtering file names allows to take only those .tgx file that make up current item configuration
		// this stage is for downloading files, we do not have their identifiers, yet
		// to get ids we need to open file, which is impossible before downloading it
		onProgress({loaded: 1, total: totalSteps, text: "Filtering files..."});

		const filteredFileNames = this.#filterFilesToLoad(itemId, config);

		if (!filteredFileNames)
		{
			console.error("TGXMLoader // load: Could not filter files to load");
			throw new Error("Could not filter files to load");
		}

		// Step #3
		// Load previously selected files
		onProgress({loaded: 2, total: totalSteps, text: "Downloading files..."});
		const loadItemFilesResult = await this.#loadItemFiles(itemId, filteredFileNames);

		if (!loadItemFilesResult)
		{
			console.error("TGXMLoader // load: Files download finished with error");
			throw new Error("Files download finished with error");
		}

		if (config.shaderHash)
		{
			config.shaderId = await this.loadShader(config.shaderHash, game);
		}

		console.time("Steps 3 - 9 took");
		// Step #4
		// Select gear file
		onProgress( {loaded: 3, total: totalSteps, text: "Parsing files..."});
		const gearAssetDefinition = this.cache.getGearAssetDefinition(itemId);

		if (gearAssetDefinition.gear.length > 1)
			console.log("TGXMLoader // load: Multiple gear files are present");

		// Should iterate this, but its never has more than one
		// based on gear asset definition we take the 0th gear file
		// assume it can relate to that in D1 there were mobile and web content
		const gearFileName = gearAssetDefinition.gear[0];
		this.cache.setGearFileName(itemId, gearFileName);

		// Step #5
		// moved this stage up because dyes do not depend on plated textures and geometries
		// loading default gear dyes, they are saved into cache for following use
		onProgress( {loaded: 4, total: totalSteps, text: "Parsing dyes..."});
		this.#processGearDyes(itemId);

		// deafult dyes do not change, so can do it only one time
		if (!this.cache.getResolvedDefaultDyes(itemId))
			this.cache.setResolvedDefaultDyes(itemId, this.#resolveGearDyes(itemId))

		// Step #7
		// Select arrangement
		onProgress( {loaded: 5, total: totalSteps, text: "Selecting arrangement..."});
		const artRegionPatterns = this.#selectArrangement(itemId, config);

		// Step #8
		// Parse geometries
		onProgress( {loaded: 6, total: totalSteps, text: "Parsing geometries..."});
		this.#parseGeometries(itemId, artRegionPatterns, config);

		// Step #7
		// Parse textures
		onProgress( {loaded: 7, total: totalSteps, text: "Parsing textures..."});
		this.#parseTextures(itemId, artRegionPatterns, container);

		onProgress( {loaded: 8, total: totalSteps, text: "Making 3D Model..."});
		this.#makeModel(itemId, artRegionPatterns, container, skeleton, config);

		onProgress( {loaded: 9, total: totalSteps, text: "Finished!"});
		console.timeEnd("Steps 3 - 9 took");
		console.log("TGXMLoader: Load total time", performance.now() - st)

		return container;
	}

	#filterFilesToLoad(itemId, options={})
	{
		console.log("TGXMLoader // filterFilesToLoad")
		const gearAssetDefinition = this.cache.getGearAssetDefinition(itemId);
		//  ***************************************
		//  *** Part 1: selecting content entry ***
		//  ***************************************

		const contentArray = gearAssetDefinition.content;

		// I assume it is because of D1, that had mobile and web contents
		if ( contentArray.length > 1 )
		{
			console.warn("TGXMLoader // filterFilesToLoad: Warning: gearAssetDefinition has more than 1 content entry");
		}

		// selecting entry, platform is always mobile
		const contentArrayEntry = contentArray.find(element => element.platform == "mobile");

		if ( contentArrayEntry === null )
		{
			console.warn("TGXMLoader // filterFilesToLoad: Error: No mobile content entry, something is wrong");
			return null;
		}

		//  *******************************************
		//  *** Part 2: gathering all index sets    ***
		//  *******************************************

		const indexSets = [];  // or filteredRegionIndexSets in lowline's implementation

		// dye_index_set is for textures
		if ( contentArrayEntry.dye_index_set )
		{
			indexSets.push(contentArrayEntry.dye_index_set);
		}
		// geometry related index sets
		if ( contentArrayEntry.region_index_sets )
		{
			const regionsIndexSets = contentArrayEntry.region_index_sets;
			for ( let [regionIndex, region] of Object.entries(regionsIndexSets) )
			{
				console.log(`Region [index = ${regionIndex}]`);
				// region index is a string!
				if ( !this.#skipRegion(regionIndex) )
				{
					const regionIndexNumber = parseInt(regionIndex);
					const patternAlterIndex = options.regionIndexOptions[regionIndexNumber];
					const patternResultIndex = (patternAlterIndex && patternAlterIndex < region.length) ? patternAlterIndex : 0;
					console.log(`\toptions pattern index = ${patternAlterIndex}, selected pattern index = ${patternResultIndex}, region has ${region.length } options`)

					if ( region.length > 0 )
					{
						indexSets.push(region[patternResultIndex]);
					}
					else
					{
						console.warn(`Region ${regionIndex} has empty pattern list! Ignoring it`);
					}
				}
				else
				{
					console.log(`\tSkip region [index = ${regionIndex}]`);
				}
			}
		}
		else if (contentArrayEntry.female_index_set && contentArrayEntry.male_index_set)
		{
			if (options.isFemale)
			{
				indexSets.push(contentArrayEntry.female_index_set);
			}
			else
			{
				indexSets.push(contentArrayEntry.male_index_set);
			}
		}

		// ************************************************************
		// *** Part 3: gathering all files mentioned in index sets  ***
		// ************************************************************

		const filteredFileNames = { //used to be called "contentRegions"
			geometry: {},  // fileIndex: fileName
			textures: {},  // fileIndex: fileName
			platedTextures: {},  // fileIndex: fileName
			gearFiles: []
		}

		// here by going through each index set we add only those textures/geometry files, etc. whose index is in an index_set,
		// so we'll download only those files that we need

		for (let indexSet of indexSets)
		{
			if (indexSet.geometry)
			{
				for (let index of indexSet.geometry)
				{
					if (!this.cache.checkGeometryDataLoaded(itemId, index)) // if it was not loaded before
						filteredFileNames.geometry[index] = contentArrayEntry.geometry[index];
					else
						console.log(`geometry TGX with index [${index}] for item with itemId [${itemId}] is already loaded`);
				}
			}

			if (indexSet.textures)
			{
				for (let index of indexSet.textures)
				{
					if (!this.cache.checkTextureTGXLoaded(itemId, index)) // if it was not loaded before
						filteredFileNames.textures[index] = contentArrayEntry.textures[index];
					else
						console.log(`texture TGX with index [${index}] for item with id [${itemId}] is already loaded`);
				}
			}

			if (indexSet.plate_regions)
			{
				for (let index of indexSet.plate_regions)
				{
					filteredFileNames.platedTextures[index] = contentArrayEntry.plate_regions[index];
				}
			}
		}

		filteredFileNames.gearFiles = gearAssetDefinition.gear;

		return filteredFileNames;
	}

	async #loadItemFiles(itemId, filteredFileNames)
	{
		console.time("Downloading resources took");
		console.log("TGXMLoader // loadItemFiles: Downloading start")

		const game = this.cache.getItemPrefix(itemId);

		const cdn = (game === "destiny") ? destinyCDN : destiny2CDN;

		let geometryArrayBuffers, textureArrayBuffers, gearJsons;

		try
		{
			const geometryPromises = Object.entries(filteredFileNames.geometry).map(
				async ([index, geometryContainerFileName]) =>
				{
					const arrayBuffer = await this.api.fetchGeometry(cdn, geometryContainerFileName);
					return { index, arrayBuffer };
				}
			);

			const texturePromises = Object.entries(filteredFileNames.textures).map(
				async ([index, textureContainerFileName]) =>
				{
					const arrayBuffer = await this.api.fetchTexture(cdn, textureContainerFileName);
					return { index, arrayBuffer };
				}
			);

			const gearPromises = filteredFileNames.gearFiles.map(
				async (fileName) =>
				{
					const json = await this.api.fetchGearJson(cdn, fileName);
					return [fileName, json];
				}
			);

			[
				geometryArrayBuffers,
				textureArrayBuffers,
				gearJsons
			] = await Promise.all(
				[
					Promise.all(geometryPromises),
					Promise.all(texturePromises),
					Promise.all(gearPromises),
				]
			);
		}
		catch (error)
		{
			console.log(error)
			console.error('TGXMLoader // loadItemFiles: Error while downloading files:', error);
			console.timeEnd("Downloading resources took");
			return false;
		}

		// processing geometries
		for (let { index, arrayBuffer } of geometryArrayBuffers)
		{
			const TGXStruct = parseTGX(arrayBuffer);

			const fileId = TGXStruct.fileIdentifier;
			this.cache.addGeometryData(itemId, fileId, TGXStruct);
			this.cache.markGeometryDataLoaded(itemId, index);
			console.log('\tLoaded geometry:', fileId);
		}
		// processing textures
		for (let { index, arrayBuffer } of textureArrayBuffers)
		{
			const TGXStruct = parseTGX(arrayBuffer);

			for (let [textureFileName, textureArrayBuffer] of Object.entries(TGXStruct.files))
			{
				const imageData = imageBytesToPNG(textureArrayBuffer);

				this.cache.addTextureData(
					itemId,
					textureFileName,
					{
						name: textureFileName,
						imageData: imageData
					}
				);

				console.log('\tLoaded texture:', textureFileName);
			}

			this.cache.markTextureTGXLoaded(itemId, index);
		}

		for (let [gearFileName, gearJson] of gearJsons)
		{
			this.cache.addGearFile(itemId, gearFileName, gearJson);
		}

		console.timeEnd("Downloading resources took");
		return true;
	}

    // so here we selecting geometries (but now using hash to refer to them)
    // according to arrangement it creates, but does not take textures in consideration
    // only geometries
    // logic is the same as in filterFilesToLoad
	#selectArrangement(itemId, options={})
	{
		const gear = this.cache.getGearFile(itemId);
		//console.log(gear)
		// art_content is default arrangement of an item
		// arrangement structure:
		// gear_set: {   // why is it called gear_set????
		//   regions: [
		//       {
		//           region_index: <index>,
		//           pattern_list: [             #   if pattern list contains many entries it means they are
		//                                       #   alternatives to each other like different scopes on weapon
		//               { <- this is one entry
		//                   geometry_hashes: [
		//                       <XXXXXXXXXX-X>,
		//                       ......
		//                   ]
		//               }
		//           ]
		//       }
		//       .....
		//   ]
		// }

		//   base arrangement if it is present
		let artContent = gear.art_content;

		//   contain array of values like {classHash: <>, arrangement}
		//   iterating through them and if class hash matches use this arrangement
		const artContentSets = gear.art_content_sets;

		//   so if there's no base arrangement -> try iterate over artContentSets
		if (artContentSets && artContentSets.length > 1)  // if more than one need to choose by checking class hash
		{
			for (let artContentSet of artContentSets)
			{
				if (artContentSet.classHash == options.classHash)
				{
					artContent = artContentSet.arrangement;
					break;
				}
			}
		}
		else if (artContentSets && artContentSets.length > 0)  // if only one -> using it
		{
			artContent = artContentSets[0].arrangement;
		}
		//   we selected arrangement we will use, if it is possible

		const artRegionPatterns = {};
		// has following structure of item
		// {
		//     hash: - hash of a pattern, IDK for what
		//     artRegion: u - index in order of succession in regions (for example:
		//                    artRegion[1] can be the first in the list => u = 0)
		//     selectedPatternIndex: p - index in order of succession in pattern_list
		//     regionIndex: index of artRegion, for artRegion[0] - 0
		//     geometry: - list of geometry file hashes
		// }

		if (artContent)  // if we have an arrangement
		{
			//   going through arrangement -> gear_set -> regions
			const gearSet = artContent.gear_set;
			const regions = artContent.gear_set.regions;

			if (regions.length > 0)
			{
				for (let region of regions)
				{
					const regionIndex = region.region_index;

					/// this matches check in filterFilesToLoad(), they must be synced!!!!!
					if ( !this.#skipRegion(regionIndex) )
					{
						const regionIndexNumber = parseInt(regionIndex);
						const patternList = region.pattern_list;

						const patternIndexAlternative = options.regionIndexOptions[regionIndexNumber];
						const patternIndexResulting = (patternIndexAlternative && patternIndexAlternative < patternList.length) ? patternIndexAlternative : 0;
						console.log(`region index: ${regionIndex}, options pattern index: ${patternIndexAlternative}, resulting index: ${patternIndexResulting}`)

						if (patternList.length > 0)
						{
							const pattern = patternList[patternIndexResulting];

							artRegionPatterns[regionIndex] = {
								regionIndex: regionIndex, // for this region
								selectedPattern: {
									index: patternIndexResulting,
									hash: pattern.hash,
									geometryHashes: pattern.geometry_hashes,
								}
							}
						}
						else
						{
							console.warn(`Region ${regionIndex} has empty pattern list! Check #2`);
						}
					}
				}
			}
			else
			{
				//  if no regions
				//  this can be a separate block of code not an else branch
				//  but weapons do not have male/female option and armor do not have regionIndex sets so leaving it as it is for now
				//  --
				//  decide to use female version or base art arrangement,
				let overrideArtArrangement;

				if (options.isFemale)
				{
					overrideArtArrangement = gearSet.female_override_art_arrangement;
				}
				else
				{
					overrideArtArrangement = gearSet.base_art_arrangement;
				}

				artRegionPatterns[-1] = {
					regionIndex: -1,
					selectedPattern: {
						index: -1,
						hash: overrideArtArrangement.hash,
						geometryHashes:  overrideArtArrangement.geometry_hashes,
					}
				}
			}
		}

		return artRegionPatterns;
	}

	#parseGeometries(itemId, artRegionPatterns, config)
	{
		console.time("Parsing geometries took");
		for (let [regionIndex, region] of Object.entries(artRegionPatterns))
		{
			const selectedPattern = region.selectedPattern;
			for (let geometryHash of selectedPattern.geometryHashes)
			{
				let tgxStruct = this.cache.getGeometryData(itemId, geometryHash);

				// obtain geometry's metadata
				const jsonString = new TextDecoder('ascii').decode(tgxStruct.files["render_metadata.js"]);
				let metadata = JSON.parse(jsonString);

				// if geometry is not parsed and metadata has textures
				if (!this.cache.hasParsedGeometryData(itemId, geometryHash) && metadata.texture_plates.length > 0)
				{
					console.log("TGXMLoader // parseGeometries: Geometry with hash:", geometryHash, "is not parsed");
					const renderMeshDescArray = this.#parseGeometryBuffers(itemId, geometryHash, config);
					const renderMeshes = this.#makeGeometries(itemId, geometryHash, renderMeshDescArray);

					// saving which textures are used by this geometry
					const plates = {};

					for (let [plateType, plateContents] of Object.entries(metadata.texture_plates[0].plate_set))
					{
						plates[plateType] = `${plateType}_${plateContents.plate_index}`;
					}

					this.cache.addParsedGeometryData(
						itemId,
						geometryHash,
						{
							geometryHash: geometryHash,
							renderMeshes: renderMeshes,
							platedTextures: plates,
							regionIndex: region.regionIndex,
							metadata: metadata,
						}
					);
				}
				else if (metadata.texture_plates.length === 0)
				{
					console.log("TGXMLoader // parseGeometries: Geometry with hash:", geometryHash, "cannot be parsed as it is missing textures!");
					console.log(this.cache.hasParsedGeometryData(itemId, geometryHash))
				}
				else
				{
					console.log("TGXMLoader // parseGeometries: Geometry with hash:", geometryHash, "is already parsed!");
				}
			}
		}
		console.timeEnd("Parsing geometries took");
	}

	    // returns an array of render meshes for given geometry
	#parseGeometryBuffers(itemId, geometryHash, config)
	{
		console.log("TGXMLoader // parseGeometryBuffers");
		const tgxStruct = this.cache.getGeometryData(itemId, geometryHash);
		const renderMeshArray = [];

		const jsonString = new TextDecoder('ascii').decode(tgxStruct.files["render_metadata.js"]);
        const metadata = JSON.parse(jsonString);

		// geometry -> array of render meshes
		// render mesh - > array of stage parts

		for (let i = 0; i < metadata.render_model.render_meshes.length; i++)
		{
			const renderMeshData = metadata.render_model.render_meshes[i];

			const mesh = new RenderMesh(renderMeshData, geometryHash, i);

			const positionOffset = mesh.positionOffset;
			const positionScale = mesh.positionScale;
			const texcoordOffset = mesh.textureOffset;
			const texcoordScale = mesh.textureScale;

			const VertexBufferFileBytesArray = [];

			for ( let vertexBufferIndex = 0; vertexBufferIndex < mesh.vertexBufferMetadatas.length; vertexBufferIndex++)
			{
				const bufferMetadata = mesh.vertexBufferMetadatas[vertexBufferIndex];
				const indexBufferFileName = bufferMetadata.fileName;
				const indexBufferFileBytes = tgxStruct.files[indexBufferFileName];
				VertexBufferFileBytesArray.push(indexBufferFileBytes);
			}

			const vertexCount = Math.floor(mesh.vertexBufferMetadatas[0].byteSize / mesh.vertexBufferMetadatas[0].strideByteSize);
			console.log("TGXMLoader // parseGeometryBuffers: VertexCount = ", vertexCount);

			// hasColor is not needed as typedArrays are init by 0 (not like in C)
			const buffers = {
				position: 			{ data: new Float32Array(vertexCount * 3), elementLen: 3 },
				positionW:			{ data: new Float32Array(vertexCount * 1), elementLen: 1 },
				normal: 			{ data: new Float32Array(vertexCount * 3), elementLen: 3 },
				dyeslot:			{ data: new Float32Array(vertexCount * 1), elementLen: 1 }, // normalW
				tangent: 			{ data: new Float32Array(vertexCount * 4), elementLen: 4 },
				texcoord0: 			{ data: new Float32Array(vertexCount * 2), elementLen: 2 },
				texcoord2:			{ data: new Float32Array(vertexCount * 2), elementLen: 2 },
				blendindices:		{ data: new Float32Array(vertexCount * 4), elementLen: 4 },
				blendweight: 		{ data: new Float32Array(vertexCount * 4), elementLen: 4 },
				color: 				{ data: new Float32Array(vertexCount * 4), elementLen: 4 },
				uvScaleStrideIndex: { data: new Uint8Array(vertexCount * 1), elementLen: 1 },
				// flags
				hasBlendindices:	{ data: new Uint8Array(vertexCount * 1), elementLen: 1 },
				hasBlendweight:		{ data: new Uint8Array(vertexCount * 1), elementLen: 1 },
				hasTexcoord2:		{ data: new Uint8Array(vertexCount * 1), elementLen: 1 },
			}

			const uvScaleStrideIndex = {
				min: 100000000000,
				max: 0
			};

			for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++)
			{
				for (let bufferIndex = 0; bufferIndex < mesh.attributes.length; bufferIndex++)
				{
					const format = mesh.attributes[bufferIndex];

					const bufferStrideSize = mesh.vertexBufferMetadatas[bufferIndex].strideByteSize;
					const strideOffset = vertexIndex * bufferStrideSize;

					for (const element of format)
					{
						const alias = dataTypeAlias[element.elementTypeName];
						const count = element.foundElementValueCount;
						const strideElementOffset = strideOffset + element.byteOffset;

						// little endian
						const parsedFormatElement = BufferPack.unpack(`< ${count}${alias}`, VertexBufferFileBytesArray[bufferIndex], strideElementOffset);

						if (element.semantic == "position")
						{
							parsePosition(buffers, vertexIndex, parsedFormatElement, positionScale, positionOffset);
						}
						else if (element.semantic == "tangent")
						{
							parseTangent(buffers, vertexIndex, parsedFormatElement, element);
						}
						else if (element.semantic == "normal")
						{
							parseNormal(buffers, vertexIndex, parsedFormatElement, element, uvScaleStrideIndex);
						}
						else if (element.semantic == "texcoord" && element.semanticIndex === 0)
						{
							parseTexcoord0(buffers, vertexIndex, parsedFormatElement, element, texcoordScale, texcoordOffset);
						}
						else if (element.semantic == "texcoord" && element.semanticIndex === 2)
						{
							parseTexcoord2(buffers, vertexIndex, parsedFormatElement, element);
						}
						else if (element.semantic == "blendindices")
						{
							parseBlendindices(buffers, vertexIndex, parsedFormatElement, element);
						}
						else if (element.semantic == "blendweight")
						{
							parseBlendweights(buffers, vertexIndex, parsedFormatElement, element);
						}
					}
				}
			}

			if (uvScaleStrideIndex.max == uvScaleStrideIndex.min)
				console.warn("TGXMLoader // parseGeometryBuffers: No UV scales section!");

			console.log(`TGXMLoader // parseGeometryBuffers: UVScaleStrideIndex [min = ${uvScaleStrideIndex.min}], [max = ${uvScaleStrideIndex.max}]`);

			addDataDrivenBufferData(buffers, renderMeshData.data_driven_vertex_buffer, tgxStruct);

			addSkinBufferData(buffers, vertexCount, renderMeshData.single_pass_skin_vertex_buffer, tgxStruct, uvScaleStrideIndex);

			const game = this.cache.getItemPrefix(itemId);

			if (game === "destiny2")
			{
				for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++)
				{
					if (buffers.hasTexcoord2.data[vertexIndex] === 0)
					{
						const vertexTexcoord2Offset = vertexIndex * buffers.texcoord2.elementLen;
						buffers.texcoord2.data[vertexTexcoord2Offset]     = buffers.texcoord0.data[vertexTexcoord2Offset]     * 4;
						buffers.texcoord2.data[vertexTexcoord2Offset + 1] = buffers.texcoord0.data[vertexTexcoord2Offset + 1] * 4;
					}
				}
			}
			else
			{
				for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++)
				{
					const vertexTexcoord2Offset = vertexIndex * buffers.texcoord2.elementLen;
					if (buffers.hasTexcoord2.data[vertexIndex] === 0)
					{
						buffers.texcoord2.data[vertexTexcoord2Offset]     = buffers.texcoord0.data[vertexTexcoord2Offset];
						buffers.texcoord2.data[vertexTexcoord2Offset + 1] = buffers.texcoord0.data[vertexTexcoord2Offset + 1];
					}
					else
					{
						buffers.texcoord2.data[vertexTexcoord2Offset]     = buffers.texcoord0.data[vertexTexcoord2Offset]     * buffers.texcoord2.data[vertexTexcoord2Offset];
						buffers.texcoord2.data[vertexTexcoord2Offset + 1] = buffers.texcoord0.data[vertexTexcoord2Offset + 1] * buffers.texcoord2.data[vertexTexcoord2Offset + 1];
					}
				}
			}

			const indexBuffer = parseIndexBuffer(mesh.indexBufferMetadata, tgxStruct);

			let renderableParts;

			const LOD = config.lod;
			const allowedRenderStages = config.allowedRenderStages;

			if (game === "destiny2")
				renderableParts = filterDestiny2StagePartsToRender(mesh, LOD, allowedRenderStages);
			else
				renderableParts = filterDestinyStagePartsToRender(mesh, LOD, allowedRenderStages);

			// so there are vertex and index buffers and renderable parts for renderMesh
			const renderMeshBuffers = {
				vertexBuffers: buffers,
				vertexCount: vertexCount,
				indexBuffer: indexBuffer,
				renderableParts: renderableParts
			}

			renderMeshArray.push(renderMeshBuffers);
		}

		return renderMeshArray
	}

    // geometry file has renderMeshes
    // renderMesh consists of stageParts
    // this function flattens this nested structire to 1D array of stageParts per WHOLE geometry file
	#makeGeometries(itemId, geometryHash, renderMeshDescArray)
	{
		console.log("TGXMLoader // makeGeometries");
		const renderMeshes = [];

		for (let renderMeshDesc of renderMeshDescArray)
		{
			const vertexBuffers = renderMeshDesc.vertexBuffers;
			const vertexCount = renderMeshDesc.vertexCount;
			const indexBuffer = renderMeshDesc.indexBuffer;

			// console.log(vertexBuffers.blendindices.data)
			// console.log(vertexBuffers.blendweight.data)

			const positionAttribute =		new THREE.BufferAttribute(vertexBuffers.position.data, 	vertexBuffers.position.elementLen);
			const normalAttribute =			new THREE.BufferAttribute(vertexBuffers.normal.data,	vertexBuffers.normal.elementLen);
			const tangentAttribute = 		new THREE.BufferAttribute(vertexBuffers.tangent.data,	vertexBuffers.tangent.elementLen);
			const uvAttribute =				new THREE.BufferAttribute(vertexBuffers.texcoord0.data,	vertexBuffers.texcoord0.elementLen);
			const uv2Attribute =			new THREE.BufferAttribute(vertexBuffers.texcoord2.data,	vertexBuffers.texcoord2.elementLen);
			const colorAttribute =			new THREE.BufferAttribute(vertexBuffers.color.data,		vertexBuffers.color.elementLen);
			const slotAttribute =			new THREE.BufferAttribute(vertexBuffers.dyeslot.data,	vertexBuffers.dyeslot.elementLen);
			const blendIndicesAttribute = 	new THREE.BufferAttribute(vertexBuffers.blendindices.data,	vertexBuffers.blendindices.elementLen);
			const blnedWeightsAttribute = 	new THREE.BufferAttribute(vertexBuffers.blendweight.data, 	vertexBuffers.blendweight.elementLen);

			const stageParts = [];
			for (let renderablePartDesc of renderMeshDesc.renderableParts)
			{
				if (!this.cache.hasThreeGeometry(itemId, renderablePartDesc.id))
				{
					console.log(`TGXMLoader // makeGeometries: Three.Geometry for part [id = ${renderablePartDesc.id}] does not exist, creating` );

					const start = renderablePartDesc.startIndex;
					let count = renderablePartDesc.indexCount;
					let increment = 3;

					if (renderablePartDesc.primitiveType == 5)
					{
						increment = 1;
						count -= 2;
					}

					const indexBufferPerPart = [];
					let oddEvenControl = 0

					for (let i = 0; i < count; i += increment)
					{
						let faceIndex = start + i;

						if (indexBuffer[ faceIndex ] == 65535 || indexBuffer[ faceIndex + 1 ] == 65535 || indexBuffer[ faceIndex + 2 ] == 65535)
						{
							oddEvenControl = 0;
							continue
						}

						let tri = ( renderablePartDesc.primitiveType == 3 || (oddEvenControl % 2 == 0) ) ? this.evenOrder : this.oddOrder;
						// triangle strip -> triangles
						for (let j = 0; j < 3; j++)
						{
							let index = indexBuffer[faceIndex + tri[j]]
							if (index >= vertexCount)
							{
								console.log(`Missing vertex[${index}]`)
								i = count
								break
							}
							indexBufferPerPart.push(index);
						}

						oddEvenControl += 1
					}

					const geometry = new THREE.BufferGeometry();
					const indexAttribute = new THREE.BufferAttribute(new Uint16Array(indexBufferPerPart), 1);

					geometry.setAttribute('position',   positionAttribute);
					geometry.setAttribute('normal',     normalAttribute);
					geometry.setAttribute('tangent',    tangentAttribute);
					geometry.setAttribute('uv',         uvAttribute);
					geometry.setAttribute('uv2',        uv2Attribute);
					geometry.setAttribute('col',        colorAttribute);
					geometry.setAttribute('slot',    	slotAttribute);
					geometry.setAttribute('skinIndex',  blendIndicesAttribute);
					geometry.setAttribute('skinWeight', blnedWeightsAttribute);
					geometry.setIndex(indexAttribute);

					stageParts.push(renderablePartDesc);

					this.cache.addThreeGeometry(itemId, renderablePartDesc.id, geometry);
				}
				else
				{
					console.log(`TGXMLoader // makeGeometries: Three.Geometry for part [id=${renderablePartDesc.id}] already exists`);
				}

				console.log(`TGXMLoader // makeGeometries: Part [id = ${renderablePartDesc.id}] will be rendered, its properties:`);
				console.log("\tFlags: [", decompose(renderablePartDesc.flags).join(", "), "] check 0x8:", Boolean(renderablePartDesc.flags & 0x8));
				console.log(
					"\tRender stages: \n",
					renderablePartDesc.renderStages.map(
						(x) => `\t\t${x[0]}: ${x[1]}`
					).join("\n")
				);
				console.log("\tLOD", renderablePartDesc.lodCategory.name, "lod run", renderablePartDesc.lodRun);
				console.log('\tPart index', renderablePartDesc.stagePartIndex);
				console.log("\tStatic textures", renderablePartDesc.staticTextures);
				console.log("\tShader type", renderablePartDesc.shader.type);
				console.log("\tgearDyeChangeColorIndex:", renderablePartDesc.gearDyeChangeColorIndex)
				console.log("\tvariantShaderIndex:", renderablePartDesc.variantShaderIndex)
			}

			renderMeshes.push(stageParts);
		}

		return renderMeshes;
	}

	#parseTextures(itemId, artRegionPatterns, container)
	{
		console.log("TGXMLoader // parseTextures");
		console.time("Parsing textures took");

		const comparison = container.compareArtRegionPatterns(artRegionPatterns);
		const texturesToBeUpdated = new Set();

		for (const [regionIndex, region] of Object.entries(comparison))
		{
			const { add } = region;

			for (const geometryHash of add)
			{
				if (this.cache.hasParsedGeometryData(itemId, geometryHash))
				{
					const parsedGeometryData = this.cache.getParsedGeometryData(itemId, geometryHash);
					const texturePlates = parsedGeometryData.metadata.texture_plates;

					if (texturePlates.length === 0)
						continue;

					if (texturePlates.length > 1)
					{
						console.warn(`TGXMLoader // Geometry [${geometryHash}] has multiple plate sets`);
					}

					this.#processPlates(itemId, texturePlates[0], container, texturesToBeUpdated);
				}
			}
		}

		// updating all modified textures
		for (const id of texturesToBeUpdated)
		{
			const tex = container.getTexture(id).texture;
			tex.needsUpdate = true;

			console.log(`TGXMLoader // parseTextures: Texture ${id} updated`);
		}

		console.timeEnd("Parsing textures took");
	}

	// creates texture plates and places textures onto them
	#processPlates(itemId, plateDescription, container, texturesToBeUpdated)
	{
		for (const [plateType, plateContents] of Object.entries(plateDescription.plate_set))
		{
			// plateType = "diffuse" | "normal" | "gearstack" | "dyeslot"

			const plateUniqueId = `${plateType}_${plateContents.plate_index}`;
			const divider = (plateType === "dyeslot") ? 4 : 1;

			if (!container.hasTexture(plateUniqueId)) // multiple geometries can reference same plate, so creating only once
			{
				this.#createPlate(container, plateUniqueId, plateContents, plateType, divider);
			}

			console.log(`on plate ${plateUniqueId}`);
			this.#insertPlacements(itemId, plateContents, container.getTexture(plateUniqueId).data);
			texturesToBeUpdated.add(plateUniqueId);
		}
	}

	// creates new plated texture
	#createPlate(container, plateUniqueId, plateContents, plateType, divider)
	{
		// dye slot texture placements are 4 times smaller than plate, so making it small too
		const width = Math.floor(plateContents.plate_size[0] / divider);
		const height = Math.floor(plateContents.plate_size[1] / divider);

		const textureData = {
			plateType,
			imageData: createEmptyImage(width, height),
		};

		const threeTexture = this.#createPlatedThreeTexture(textureData);
		container.addTexture(plateUniqueId, textureData, threeTexture);

		console.log(`TGXMLoader // Created plate [${plateUniqueId}]`);
	}

	// Creates Three.Texture object for plated texture
	// they do not live in a cache as they are made per instance
	#createPlatedThreeTexture(textureData)
	{
		const tex = new THREE.DataTexture(
			textureData.imageData.data,
			textureData.imageData.width,
			textureData.imageData.height
		);

		tex.flipY = false;
		tex.colorSpace = (textureData.plateType === "diffuse")
			? THREE.SRGBColorSpace
			: THREE.NoColorSpace;

		tex.minFilter = THREE.LinearMipmapLinearFilter;
		tex.magFilter = THREE.LinearFilter;

		return tex;
	}

	// put textures onto plate
	#insertPlacements(itemId, plateContents, plate)
	{
		if (plateContents.texture_placements.length === 0)
		{
			console.debug("TGXMLoader // Empty placement");
			return;
		}

		for (const placement of plateContents.texture_placements)
		{
			const texData = this.cache.getTextureData(
				itemId,
				placement.texture_tag_name
			)

			if (!texData)
			{
				console.warn(`\ttexture [${placement.texture_tag_name}] not found, skipping`);
				continue;
			}
			else
			{
				console.log(`\tplace ${placement.texture_tag_name}`);
			}

			insertImage(plate.imageData, texData.imageData, placement.position_x, placement.position_y);
		}
	}

	#resolveGearDyes(itemId, shaderId=null) // by default itemType is weapon
	{
		const gearDyeGroups = this.cache.getDyes(itemId);
		// {
		// 	<custom|default|locked>Dyes: [{}, {}, {}]
		// }

		let shaderDyeGroups;
		const targetItemType = this.cache.getItemType(itemId);

		// ShaderItemTypes.Default is used as indicator that we need to use item's default dyes
		if (shaderId !== null)
		{
			if (this.cache.hasEntryById(shaderId))
			{
				console.log("\tShader hash:", shaderId, "and it is loaded");
				shaderDyeGroups = this.cache.getDyes(shaderId);
			}
			else
			{
				console.log("\tShader id:", shaderId, "but it is not loaded, using default dyes!");
				shaderDyeGroups = gearDyeGroups;
			}
		}
		else
		{
			console.log("\tNo shader hash, using default dyes!");
			shaderDyeGroups = gearDyeGroups;
		}

		console.log("\tTarget ItemType", targetItemType.toString());

		const resolvedDyes = {};
		const dyeTypeOrder = ['defaultDyes', 'customDyes', 'lockedDyes'];

		for (let dyeType of dyeTypeOrder)
		{
			let dyes = [];
			switch (dyeType)
			{
				case 'defaultDyes':
					dyes = gearDyeGroups[dyeType];
					break;
				case 'customDyes':
					dyes = shaderDyeGroups[dyeType];
					break;
				case 'lockedDyes':
					dyes = gearDyeGroups[dyeType];
					break;
			}

			for ( let j = 0; j < dyes.length; j++)
			{
				const dye = dyes[j];
				if (dye.itemType == targetItemType)
				{
					console.log("\tOverride dyes for slot", dye.slotTypeIndex);
					resolvedDyes[dye.slotTypeIndex] = dye;
				}
			}
		}
		return resolvedDyes;
	}

	#processGearDyes(itemId)
	{
		if (this.cache.getDyes(itemId))
			return;

		const gear = this.cache.getGearFile(itemId);

		const game = this.cache.getItemPrefix(itemId);

		const block = (game === "destiny2") ? "translationBlock" : "equippingBlock";

		const translationBlock = this.cache.getDestinyInventoryItemDefinition(itemId)[block] ?? {};

		const dyeGroupKeys = [
			["customDyes", "custom_dyes"],
			["defaultDyes", "default_dyes"],
			["lockedDyes", "locked_dyes"]
		];

		const gearDyeGroups = {};

		// camelKey is used in InventoryItemDefinition, snakeKey in item's gear.js file
		for (const [camelKey, snakeKey] of dyeGroupKeys)
		{
			const translationGroup = translationBlock[camelKey] ?? [];
			const gearGroup = gear[snakeKey] ?? [];

			// dyeHash is in translation/equipping block is equivalent to investmentHash in gear.js
			const dyeHashToChannel = new Map(
				translationGroup.map(
					item => [item.dyeHash, item.channelHash]
				)
			);

			gearDyeGroups[camelKey] = gearGroup.map(
				dye => this.#buildGearDye(itemId, dye, dyeHashToChannel)
			);
		}

		this.cache.setDyes(itemId, gearDyeGroups);
	}

	// creates single dye description
	#buildGearDye(itemId, dye, dyeHashToChannel)
	{
		const gearDye = {
			hash: dye.hash,
			investmentHash: dye.investment_hash,
			slotTypeIndex: dye.slot_type_index,
			isCloth: dye.cloth,
			itemType: null,
			materialPrimaryProperties: null,
			materialSecondaryProperties: null,
			materialTextures: null,
		};

		// find channel hash
		const channelHash = getDyeChannelHash(dye, dyeHashToChannel);

		if (channelHash)
		{
			gearDye.itemType = ChannelHashToData[channelHash].itemType;
			gearDye.slotTypeIndex = ChannelHashToData[channelHash].slotTypeIndex;
		}

		// build material properties
		const game = this.cache.getItemPrefix(itemId);
		const props = dye.material_properties;

		if (game === "destiny")
		{
			gearDye.materialPrimaryProperties = buildDestinyMaterialProperties(props, "primary");
			gearDye.materialSecondaryProperties = buildDestinyMaterialProperties(props, "secondary");
		}
		else
		{
			gearDye.materialPrimaryProperties = buildDestiny2MaterialProperties(props, "primary");
			gearDye.materialSecondaryProperties = buildDestiny2MaterialProperties(props, "secondary");
		}

		// collect textures
		const textures = this.#collectTextures(itemId, dye.textures);

		console.log("material textures", textures.diffuse, textures.normal);

		gearDye.materialTextures = {
			itemId, // because dye can be from item or shader, so storing item id here for cache inquiry
			normal: textures.normal,
			diffuse: textures.diffuse,
			decal: textures.decal,
			primaryDiffuse: textures.primary_diffuse,
			secondaryDiffuse: textures.secondary_diffuse
		};

		return gearDye;
	}

	// Collects dye textures
	#collectTextures(itemId, dyeTextures)
	{
		const result = {
			normal: null,
			diffuse: null,
			decal: null
		};

		for (const [textureType, textureDescription] of Object.entries(dyeTextures))
		{
			if (textureDescription.name && this.cache.hasTextureData(itemId, textureDescription.name))
			{
				result[textureType] = textureDescription.name;

				// create texture immediately
				const useSRGBColorSpace = textureType === "diffuse";
				this.#getTexture(itemId, textureDescription.name, useSRGBColorSpace, true);
			}

			if (textureType === "decal")
				console.log("dye has decal texture", textureDescription.name);
			else if (textureType === "primary_diffuse")
				console.log("dye has primary_diffuse texture", textureDescription.name);
			else if (textureType === "secondary_diffuse")
				console.log("dye has secondary_diffuse texture", textureDescription.name);
		}

		return result;
	}

	#removeObsoleteGeometry(container, geometryHash)
	{
		const itemId = container.itemId;

		if (this.cache.hasParsedGeometryData(itemId, geometryHash))
		{
			const geometryDescription = this.cache.getParsedGeometryData(itemId, geometryHash)

			for (let renderMesh of geometryDescription.renderMeshes)
			{
				for (let renderablePartDesc of renderMesh)
				{
					console.log(`TGXMLoader // makeModel: Removing mesh and material for part [partId = ${renderablePartDesc.id}]`);
					container.removePart(renderablePartDesc.id);
				}
			}
		}
		else
			console.warn("TGXMLoader // makeModel: geometry is present in container, but is not present in cache!");
	}

	#arrangeMaterials(itemId, shaderId=null)
	{
		const dyes = shaderId != null
			? this.#resolveGearDyes(itemId, shaderId)
			: this.cache.getResolvedDefaultDyes(itemId);

		const materials = {};
		const normals = {};
		const diffuses = {};
		const decals = {};

		for (let [slot, dye] of Object.entries(dyes))
		{
			materials[dye.slotTypeIndex * 2] = dye.materialPrimaryProperties;
			materials[dye.slotTypeIndex * 2 + 1] = dye.materialSecondaryProperties;

			if (dye.materialTextures.normal)
				normals[dye.slotTypeIndex] = this.cache.getThreeTexture(dye.materialTextures.itemId, dye.materialTextures.normal);
			else
				normals[dye.slotTypeIndex] = this.dummyNormal;

			if (dye.materialTextures.diffuse)
				diffuses[dye.slotTypeIndex] = this.cache.getThreeTexture(dye.materialTextures.itemId, dye.materialTextures.diffuse);
			else
				diffuses[dye.slotTypeIndex] = this.dummyDiffuse;

			if (dye.materialTextures.decal)
				decals[dye.slotTypeIndex] = this.cache.getThreeTexture(dye.materialTextures.itemId, dye.materialTextures.decal);
			else
				decals[dye.slotTypeIndex] = this.dummyDiffuse;
		}

		return {
			materials,
			normals,
			diffuses,
			decals
		};
	}

	// get texture from cache or create
	#getTexture(itemId, textureName, useSRGBColorSpace=true, useWrapping=false)
	{
		// check if texture data  is present
		const plate = this.cache.getTextureData(itemId, textureName)

		if (!plate)
		{
			console.warn(`TGXMLoader // getOrCreateCachedTexture: texture [${textureName}] missing data, using dummy`);
			return this.dummyDiffuse;
		}

		if (!this.cache.hasThreeTexture(itemId, textureName))
		{
			const threeTexture = new THREE.DataTexture(
				plate.imageData.data,
				plate.imageData.width,
				plate.imageData.height
			);

			threeTexture.flipY = false;
			threeTexture.colorSpace = useSRGBColorSpace ? THREE.SRGBColorSpace : THREE.NoColorSpace;
			threeTexture.minFilter = THREE.LinearMipmapLinearFilter;
			threeTexture.magFilter = THREE.LinearFilter;

			if (useWrapping)
			{
				threeTexture.wrapS = THREE.RepeatWrapping;
				threeTexture.wrapT = THREE.RepeatWrapping;
			}

			threeTexture.needsUpdate = true;
			this.cache.addThreeTexture(itemId, textureName, threeTexture)
		}

		return this.cache.getThreeTexture(itemId, textureName);
	}

	#makeModel(itemId, artRegionPatterns, container, skeleton, config)
	{
		console.time("Making model took");

		const comparison = container.compareArtRegionPatterns(artRegionPatterns);

		const shaderId = config.shaderId

		const {
			materials,
			normals,
			diffuses,
			decals,
		} = this.#arrangeMaterials(itemId);

		console.log("shaderId",  shaderId)
		const {
			materials: materialsShader,
			normals: normalsShader,
			diffuses: diffusesShader,
			decals: decalsShader
		} = this.#arrangeMaterials(itemId, shaderId);

		for (let [regionIndex, region] of Object.entries(comparison))
		{
			const { add, remove, stay } = region;

			for (let geometryHash of remove)
			{
				this.#removeObsoleteGeometry(container, geometryHash);
			}

			for (let geometryHash of stay)
			{
				if (this.cache.hasParsedGeometryData(itemId, geometryHash))
				{
					const geometryDescription = this.cache.getParsedGeometryData(itemId, geometryHash);

					for (let renderMesh of geometryDescription.renderMeshes)
					{
						for (let renderablePartDesc of renderMesh)
						{
							console.log(`\tmaterial for part [id = ${renderablePartDesc.id}] already exists`);

							const material = container.getPart(renderablePartDesc.id).material;
							const materialType = material.userData._shaderType;

							if (materialsUsingShaderProperties.includes(materialType) || materialType === "destiny_gear_shader")
							{
								console.log(`\tmaterial ${renderablePartDesc.id} have shaderHash !== null, updating dyes`);
								updateMaterialDyeTextures(material, diffusesShader, normalsShader, materialsShader);
							}

							if (materialsUsingShaderProperties.includes(materialType))
							{
								console.log(`\tmaterial ${renderablePartDesc.id} have shaderHash !== null, updating trials colors`);
								updateMainMaterialTrialsColor(material, config.useTrialsMetalness, config.useTrialsGlow, config.trialsColor);
							}
						}
					}
				}
				else
					console.warn("TGXMLoader // #makeModel: Contaier has geometry with no parsed data!")
			}

			for (let geometryHash of add)
			{
				if (this.cache.hasParsedGeometryData(itemId, geometryHash))
				{
					const geometryDescription = this.cache.getParsedGeometryData(itemId, geometryHash);

					console.log("\tTEXTURES USED", geometryDescription.platedTextures.normal, geometryDescription.platedTextures.diffuse, geometryDescription.platedTextures.gearstack)

					const normalMap = container.getTexture(geometryDescription.platedTextures.normal).texture;
					const albedoMap = container.getTexture(geometryDescription.platedTextures.diffuse).texture;
					const gstack =    container.getTexture(geometryDescription.platedTextures.gearstack).texture;
					const dyeMap =    container.getTexture(geometryDescription.platedTextures.dyeslot).texture ?? dummyDyeslot;

					for (let renderMesh of geometryDescription.renderMeshes)
					{
						for (let renderablePartDesc of renderMesh)
						{
							const material = this.#selectMaterial(
								itemId, geometryDescription.regionIndex, renderablePartDesc,
								albedoMap, normalMap, gstack, dyeMap,
								diffuses, normals, decals, materials,
								diffusesShader, normalsShader, materialsShader,
								config
							);

							console.log(`TGXMLoader // makeModel: Mesh for part [partId = ${renderablePartDesc.id}], does not exist, creating`);
							const mesh = this.#createMesh(itemId, renderablePartDesc, material, skeleton);

							container.addPart(renderablePartDesc.id, mesh, material);

						}
					}
				}
			}
		}

		// update state
		container.updateArtRegionPatterns(artRegionPatterns);

		console.timeEnd("Making model took");
		return container;
	}

	#selectMaterial(
		itemId, geometryRegionIndex, renderablePartDesc,
		albedoMap, normalMap, gstack, dyeMap,
		diffuses, normals, decals, materials,
		diffusesShader, normalsShader, materialsShader,
		config
	)
	{
		let material;
		const game = this.cache.getItemPrefix(itemId);
		const sides = renderablePartDesc.sides;

		console.log(`TGXMLoader // makeModel: part [id = ${renderablePartDesc.id}]`)
		console.log("\tgeometryDescription.regionIndex", geometryRegionIndex)

		if (game === "destiny2")
		{
			const useAlphaClip = Boolean(renderablePartDesc.flags & 0x8);

			console.log(`\tMaterial for part [id = ${renderablePartDesc.id}] does not exist, creating`);
			console.log("\tMaterial uses alpha clip:", useAlphaClip)

			// fotc decals
			const FOTCtextureName = findFirstSubstrInArray(renderablePartDesc.staticTextures, destiny2DecalTextureNames);

			if (FOTCtextureName)
			{
				console.log("\tUsing FOTC decals material");
				const FOTCTexture = this.#getTexture(itemId, FOTCtextureName);
				material = createFOTCDecalMaterial(FOTCTexture);
			}
			else if (isSubstrInArray(renderablePartDesc.staticTextures, "tiger_lofi"))
			{
				console.log("\tUsing Destiny 2 Brave Tiger material");
				const tigerLofiTextureName = renderablePartDesc.staticTextures.find(str => (str.includes("tiger_lofi")));
				const tigerTexture = this.#getTexture(itemId, tigerLofiTextureName);
				material = createBraveTigerMaterial(tigerTexture);
			}
			else if (
				ShaderItemTypes.Ghost == this.cache.getItemType(itemId) &&
				isSubstrInArray(renderablePartDesc.staticTextures, "ghost_eye_decal")
			)
			{
				console.log("\tUsing Destiny 2 ghost eye material");
				const ghostEyeDecalMainglowTextureName = renderablePartDesc.staticTextures.find(
					str => (str.includes("ghost_eye_decal") && (str.includes("mainglow") || str.includes("heart")))
				);
				const ghostEyeDecalIrisTextureName = renderablePartDesc.staticTextures.find(
					str => (str.includes("ghost_eye_decal") && str.includes("iris_wipe_a"))
				);

				const ghostEyeDecalMainglowTexture = this.#getTexture(itemId, ghostEyeDecalMainglowTextureName);
				const ghostEyeDecalIrisTexture = this.#getTexture(itemId, ghostEyeDecalIrisTextureName);

				material = createGhostEyeMaterial(ghostEyeDecalMainglowTexture, ghostEyeDecalIrisTexture);
			}
			else if (
				ShaderItemTypes.Ghost == this.cache.getItemType(itemId) &&
				isSubstrInArray(renderablePartDesc.staticTextures, "gho_global_norm")
			)
			{
				console.log("\tUsing Ghost core material")
				const ghostNormalTextureName = renderablePartDesc.staticTextures.find(
					str => (str.includes("gho_global_norm"))
				);
				const ghostNormalTexture = this.#getTexture(itemId, ghostNormalTextureName, false);

				material = createGhostCoreMaterial(ghostNormalTexture);
			}
			else if (this.#isGhostEyeBackgroundGeometry(itemId, renderablePartDesc))
			{
				console.log("\tUsing Ghost eye background material");
				material = createGhostEyeBackgroundMaterial();
			}
			else if (this.#isOmolonLiquidContainer(itemId, renderablePartDesc))
			{
				console.log("\tUsing Destiny Omolon liquid material");
				material = createOmolonLiquidMaterial(this.cache.getOmolonLiquidColor(itemId), 0.6);
			}
			else if (
				geometryRegionIndex == 3 && ShaderItemTypes.Weapon == this.cache.getItemType(itemId) &&
				(
					isSubstrInArray(renderablePartDesc.staticTextures, "gear_detail_crust1_overdif") ||
					isSubstrInArray(renderablePartDesc.staticTextures, "gear_detail_crust2_overdif")
				)
			)
			{
				console.log("\tUsing Destiny 2 sniper lens material");
				material = createLensMaterial(this.dummyDiffuse);
			}
			else if (
				renderablePartDesc.renderStagesIndices.includes(16) &&
				Array.isArray(renderablePartDesc.staticTextures) &&
				renderablePartDesc.staticTextures.some(str => (str.toLowerCase().includes("reticle")))
			)
			{
				console.log("\tUsing Destiny 2 test reticle material");
				const reticleTextureName = renderablePartDesc.staticTextures.find(str => (str.toLowerCase().includes("reticle")));
				const reticleTexture = this.#getTexture(itemId, reticleTextureName);

				material = createReticleMaterial(reticleTexture)
			}
			else if (geometryRegionIndex == 17 && ShaderItemTypes.Weapon == this.cache.getItemType(itemId))
			{
				if (findFirstSubstrInArray(renderablePartDesc.staticTextures, counterTextures))
				{
					console.log("\tUsing Destiny 2 tranparent ammo counter material");
					const FotcNumbersTextureName = findFirstSubstrInArray(renderablePartDesc.staticTextures, counterTextures);
					const FotcNumbersTexture = this.#getTexture(itemId, FotcNumbersTextureName, true, true);

					material = createAmmoCounterMaterial(FotcNumbersTexture, 99);
				}
				else
				{
					console.log("\tUsing Destiny 2 rear sight material");
					material = createRearSightMaterial(
						albedoMap, normalMap, gstack, dyeMap,
						useAlphaClip,
						0.0,
						this.iridescenceLookup
					);
				}
			}
			else if (renderablePartDesc.renderStagesIndices.includes(7)) // transparents
			{
				let allowedTextureName = findFirstSubstrInArray(renderablePartDesc.staticTextures, destiny2AllowedTransparentTextures);

				if (findFirstSubstrInArray(renderablePartDesc.staticTextures, counterTextures))
				{
					console.log("\tUsing Destiny 2 transparent ammo counter material");
					let FotcNumbersTextureName = findFirstSubstrInArray(renderablePartDesc.staticTextures, counterTextures);
					let FotcNumbersTexture = this.#getTexture(itemId, FotcNumbersTextureName, true, true);

					material = createAmmoCounterMaterial(FotcNumbersTexture, 99);
				}
				else if (allowedTextureName)
				{
					console.log("\tUsing Destiny 2 emissive material with overriden texture");
					let localAlbedoMapTransparent = albedoMap; // by default
					localAlbedoMapTransparent = this.#getTexture(itemId, allowedTextureName, true, true);

					material = createOverridenEmissiveMaterial(localAlbedoMapTransparent);
				}
				else
				{
					console.log("\tUsing Destiny 2 emissive material");
					material = createDestiny2EmissiveMaterial(
						albedoMap, normalMap, gstack, dyeMap,
						diffuses, normals, materials,
						true, // materialTransparency, is needed so three js will draw them after opaque geometry
						true, // useGstackTransparency, if true will break some warlock bonds, because they have shfted gstack.b
						useAlphaClip ? 0.5 : 0.0, // basically does not matter
						this.iridescenceLookup,
						renderablePartDesc.gearDyeChangeColorIndex
					);
				}
			}
			else if (renderablePartDesc.renderStagesIndices.includes(1))  // decals that need gstack.b check, used to be renderablePartDesc.flags & 0x20
			{
				console.log("\tUsing Destiny 2 decal modification of main material", renderablePartDesc.gearDyeChangeColorIndex);
				// because in D2's deferred pipeline decals are wirtten in g-buffer over parts from stage GenerateGbuffer
				// here material should be transparent for appropriate blending
				material = createDestiny2MainMaterial(
					albedoMap, normalMap, gstack, dyeMap,
					diffusesShader, normalsShader, materialsShader,
					true, // for decal material is always true ?
					true, //useGstackTransparency
					0.0, //alphaClipTreshold
					this.iridescenceLookup,
					THREE.FrontSide, // for optimisation
					renderablePartDesc.gearDyeChangeColorIndex,
					config.useTrialsMetalness, config.useTrialsGlow, config.trialsColor
				);
			}
			else
			{
				if (findFirstSubstrInArray(renderablePartDesc.staticTextures, counterTextures))
				{
					console.log("\tUsing Destiny 2 non-transparent ammo counter material");

					let FotcNumbersTextureName = findFirstSubstrInArray(renderablePartDesc.staticTextures, counterTextures);
					let FotcNumbersTexture = this.#getTexture(itemId, FotcNumbersTextureName, true, true);

					material = createAmmoCounterMaterial(FotcNumbersTexture, 99, false);
				}
				else
				{
					console.log("\tUsing Destiny 2 main material");
					// material transparency == true and alphaClipTreshold = 0.0 work together OR
					// material transparency == false and alphaClipTreshold = 0.5
					// first has smoother edges but more resources
					// second less recources but shareper edges
					material = createDestiny2MainMaterial(
						albedoMap, normalMap, gstack, dyeMap,
						diffusesShader, normalsShader, materialsShader,
						false, //
						useAlphaClip, //useGstackTransparency
						0.5, //useAlphaClip ? 0.5 : 0.0, //alphaClipTreshold
						this.iridescenceLookup,
						sides,
						renderablePartDesc.gearDyeChangeColorIndex,
						config.useTrialsMetalness, config.useTrialsGlow, config.trialsColor
					);
				}
			}
		}
		else
		{
			// as opaque geometry cannot use mixing map in gstack.g it can only use it as fringe map
			const useAlphaClip = (
				Boolean(renderablePartDesc.flags & 0x10) || // flag
				renderablePartDesc.renderStagesIndices.includes(1) // or decal
			);

			const FOTCtextureName = findFirstSubstrInArray(renderablePartDesc.staticTextures, destinyDecalTextureNames);

			if (FOTCtextureName)
			{
				console.log("\tUsing Destiny FOTC decals material");
				const FOTCTexture = this.#getTexture(itemId, FOTCtextureName);

				material = createFOTCDecalMaterial(FOTCTexture);
			}
			else if (this.#isOmolonLiquidContainer(itemId, renderablePartDesc))
			{
				console.log("\tUsing Destiny Omolon liquid material");
				material = createOmolonLiquidMaterial(this.cache.getOmolonLiquidColor(itemId), 0.6);
			}
			else if (renderablePartDesc.renderStagesIndices.includes(7))
			{
				const allowedTextureName = findFirstSubstrInArray(
					renderablePartDesc.staticTextures,
					destinyAllowedTransparentTextures
				);

				if (allowedTextureName)
				{
					console.log("\tUsing Destiny emissive material with overriden texture");
					let localAlbedoMapTransparent = albedoMap; // by default
					localAlbedoMapTransparent = this.#getTexture(itemId, allowedTextureName, true, true);

					material = createOverridenEmissiveMaterial(localAlbedoMapTransparent);
				}
				else
				{
					console.log("\tUsing Destiny emissive material");

					material = createDestinyEmissiveMaterial(
						albedoMap, gstack,
						diffuses, normals, materials,
						renderablePartDesc.gearDyeChangeColorIndex
					);
				}
			}
			else
			{
				console.log("\tUsing Destiny main material");

				material = createDestinyMainMaterial(
					albedoMap, normalMap, gstack,
					diffusesShader, normalsShader, materialsShader,
					this.specularLobeLookup, this.specularTintLookup, this.defaultMonocromeCubemap,
					useAlphaClip ? true : false,
					0.5,
					sides, renderablePartDesc.gearDyeChangeColorIndex,
				);
			}
		}

		return material;
	}

	#isOmolonLiquidContainer(itemId, renderablePartDesc)
	{
		return (
			ShaderItemTypes.Weapon == this.cache.getItemType(itemId) &&
			isSubstrInArray(renderablePartDesc.staticTextures, "weapon_omolon_liquid")
		);
	}

	#isGhostEyeBackgroundGeometry(itemId, renderablePartDesc)
	{
		if (ShaderItemTypes.Ghost !== this.cache.getItemType(itemId))
			return false;

		const partThreeGeometry = this.cache.getThreeGeometry(itemId, renderablePartDesc.id);

		if (countVertices(partThreeGeometry) !== 31)
			return false;

		if (!checkSignatureFromIndices(partThreeGeometry, ghostEyeBackgroundSignature, 0.05))
			return false;

		return true;
	}

	#createMesh(itemId, renderablePartDesc, material, skeleton)
	{
		const partThreeGeometry = this.cache.getThreeGeometry(itemId, renderablePartDesc.id);
		console.log("TGXMLoader // createMesh:", this.cache.getItemType(itemId));

		let mesh;

		if (skeleton && this.cache.getItemType(itemId) == ShaderItemTypes.Armor)
		{
			mesh = new THREE.SkinnedMesh(partThreeGeometry, material);
			mesh.bindMode = THREE.DetachedBindMode; // works without it
			mesh.bind(skeleton, this.skinningIdentityMatrix);//, mesh.matrixWorld);
		}
		else
		{
			mesh = new THREE.Mesh(partThreeGeometry, material);
		}

		return mesh;
	}

	async loadAnimation(animationHash, animationFileName, boneNames)
	{
		if (!boneNames)
		{
			console.error("TGXMLoader // loadAnimation: ");
			throw new Error("boneNames are not provided");
		}

		if (this.animations[animationHash])
		{
			if (this.animations[animationHash].clip) // if clip return it
				return this.animations[animationHash].clip;

			this.animations[animationHash].clip = parseAnimation(this.animations[animationHash].json, boneNames);
			return this.animations[animationHash].clip;
		}
		else
		{
			try
			{
				console.log("loading animation with hash:", animationHash);
				const resJson = await this.api.fetchAnimation(destinyCDN, animationFileName);

				// save animation data
				this.animations[animationHash] = {
					json: resJson,
					clip: parseAnimation(resJson[0], boneNames)
				};

				return this.animations[animationHash].clip;
			}
			catch (err)
			{
				console.error("TGXMLoader // loadAnimation: Error wile loading animation");
				throw new Error("Error wile loading animation");
			}
		}
	}

	async loadHands(options)
	{
		if (this.config.hands.source === "none")
		{
			console.error("TGXMLoader // loadHands: Hands options were not provided during loader creation!");
			throw new Error("Hands options were not provided during loader creation");
		}

		console.log(`TGXMLoader // loadHands`);
		const config = createHandsConfig(options);
		const storeId = "hands";
		const skeleton = config.skeleton;

		let handsId;

		if (!this.cache.hasEntry(storeId, "global"))
		{
			// hands have no defs so calling it directly
			handsId = this.cache.initEntry(storeId, "global");

			if (handsId === null)
			{
				console.error(`TGXMLoader // loadHands: Could not init cache for hands [storeId = ${storeId}]`)
				throw new Error(`Could not init cache for hands [storeId = ${storeId}]`);
			}

		}
		else
			handsId = this.cache.createId(storeId, "global");

		// creating container
		let container;

		if (config.container)
		{
			console.log(`TGXMLoader // loadHands: A container is provided for hands [handsId = ${handsId}]`)
			container = config.container;

			if (container.isDisposed)
			{
				console.error(
					`TGXMLoader // load: Provided container [container.itemId = ${container.itemId}] is disposed, cannot use it`
				);
				throw new Error(`Provided container [container.itemId = ${container.itemId}] is disposed, cannot use it`);
			}

			if (container.itemId !== handsId)
			{
				console.error(`TGXMLoader // loadHands: Error: Item id mismatch: [container.itemId = ${container.itemId}], [handsId = ${handsId}]`);
				throw new Error(`Item id mismatch: [container.itemId = ${container.itemId}], [handsId = ${handsId}]`);
			}
		}
		else
		{
			console.log(`TGXMLoader // loadHands: A container is not provided for item [handsId = ${storeId}], creating it`)
			container = new TGXModelContainer(handsId, "global");
		}

		if (!this.cache.hasGeometryData(handsId, "hands"))
		{
			console.log("TGXMLoader // loadHands: Loading hands data");
			const { ok, arrayBuffer, message } = await loadHandsGeometry(this.config.hands);

			if (!ok)
			{
				console.error(`TGXMLoader // loadHands: Error while loading hands geomerty data: ${message}`);
				throw new Error(`Error while loading hands geomerty data: ${message}`);
			}

			const handData = parseTCHCHeader(arrayBuffer);
			this.cache.addGeometryData(handsId, "hands", handData);
		}
		else
		{
			console.log(`TGXMLoader // loadHands: Hand data is already loaded`);
		}

		const filteredTextures = HandsAndNeckTextures.filter(
			(textureName) => !this.cache.hasTextureData(handsId, textureName.replace(/\.png$/i, ""))
		);

		const { ok, arrayBuffers, message } = await loadHandsTextures(filteredTextures, this.config.hands)

		if (!ok)
		{
			console.error(`TGXMLoader // loadHands: Error while loading hands textures data: ${message}`);
			throw new Error(`Error while loading hands textures data: ${message}`);
		}

		// processing each arrayBuffer to textures in base64 and file bytes
		// base64 for debug purposes
		// console.log('processing', arrayBuffers)
		for (let [textureFileName, textureArrayBuffer] of arrayBuffers)
		{
			const imageData = imageBytesToPNG(new Uint8Array(textureArrayBuffer));

			console.log('\tloaded texture:', textureFileName);
			this.cache.addTextureData(
				handsId,
				textureFileName,
				{
					name: textureFileName,
					imageData: imageData
				}
			)

			// creating textures immediately
			if (textureFileName.includes("Diffuse"))
				this.#getTexture(handsId, textureFileName, true, true);
			else
				this.#getTexture(handsId, textureFileName, false, true);
		}

		let hands;
		const handsMale = ["Male FK Hands", "Male FK Neck"];
		const handsFemale = ["Female FK Hands", "Female FK Neck"];

		const pseudeoArtRegionPatterns = {};

		if (config.isFemale)
		{
			pseudeoArtRegionPatterns["-1"] = {
				regionIndex: "-1",
				selectedPattern: {
					index: 0,
					hash: "female",
					geometryHashes: handsFemale,
				},
			};

			hands = handsFemale;
		}
		else
		{
			pseudeoArtRegionPatterns["-1"] = {
				regionIndex: "-1",
				selectedPattern: {
					index: 0,
					hash: "male",
					geometryHashes: handsMale,
				},
			};

			hands = handsMale;
		}

		const comparison = container.compareArtRegionPatterns(pseudeoArtRegionPatterns);

		// as hands do not change, no need to dispose materials, they can be reused after switching back
		const { add, remove } = comparison['-1'];

		for (let geometrHashToRemove of remove)
		{
			console.log(`TGXMLoader // loadHands: Removing mesh [id = ${geometrHashToRemove}]`);
			container.removePart(geometrHashToRemove)
		}

		const geometryData = this.cache.getGeometryData(handsId, "hands");

		// basically, because hands do not have plated textures or variants except male/female
		// their meshes can be just removed as they will never change
		// and added back when needed to replace others

		for (let key of hands)
		{
			console.time("hands");

			if (!this.cache.hasThreeGeometry(handsId, key))
			{
				console.log(`TGXMLoader // loadHands: Geometry [id = ${key}] does not exist, creating`)
				const geometry = buildGeometryFromTCHC(geometryData.buffer, geometryData.regions[key]);
				this.cache.addThreeGeometry(handsId, key, geometry)
			}
			else
			{
				console.log(`TGXMLoader // loadHands: Geometry [id = ${key}] already exists`)
			}

			console.timeEnd("hands");
		}

		for (let key of add)
		{
			if (container.hasPart(key))
			{
				console.log(`TGXMLoader // loadHands: Material [id = ${key}] already exists`)
				console.log(`TGXMLoader // loadHands: Mesh [id = ${key}] already exists`)
			}
			else
			{
				let material
				console.log(`TGXMLoader // loadHands: Material [id = ${key}] does not exist, creating`)
				if (key.includes("Hand"))
				{
					material = createHandsMaterial(
						this.cache.getThreeTexture(handsId, "DefaultHands_Diffuse"),
						this.cache.getThreeTexture(handsId, "DefaultHands_Normal"),
						this.cache.getThreeTexture(handsId, "DefaultHands_MRC"),
					);
				}
				else
				{
					material = createHandsMaterial(
						this.cache.getThreeTexture(handsId, "Neck Piece_Diffuse"),
						this.cache.getThreeTexture(handsId, "Neck Piece_Normal"),
						this.cache.getThreeTexture(handsId, "Neck Piece_MRC"),
					);
				}

				let mesh;
				const geometry = this.cache.getThreeGeometry(handsId, key);

				console.log(`TGXMLoader // loadHands: Mesh [id = ${key}] do not exist, creating`)
				if (skeleton)
				{
					mesh = new THREE.SkinnedMesh(geometry, material);
					/// as testing showes binding should have come AFTER rotation to the same as rootBone
					mesh.bindMode = THREE.DetachedBindMode; // works without it
					mesh.bind(skeleton, this.skinningIdentityMatrix);//, mesh.matrixWorld);
				}
				else
				{
					mesh = new THREE.Mesh(geometry, material);
				}

				console.log(`TGXMLoader // loadHands: Adding mesh [id = ${key}]`)
				container.addPart(key, mesh, material);
			}
		}

		// saving new configuration
		container.updateArtRegionPatterns(pseudeoArtRegionPatterns);

		return container;
	}

	applyTrialsGlow(container, useTrialsMetalness = false, useTrialsGlow = false, trialsColor = "gold")
	{
		const itemId = container.itemId;
		const model = container.groupObject;

		console.log(`TGXMLoader // applyTrialsGlow: Apply trials glow [hash = ${trialsColor}], to item [id = ${itemId}]`)

		for (let part of model.children)
		{
			if (part.material.userData._shaderType == "destiny2_gear_shader")
			{
				updateMainMaterialTrialsColor(part.material, useTrialsMetalness, useTrialsGlow, trialsColor);
			}
		}
	}

	async applyShaderToModel(container, shaderHash)
	{
		console.log("applyShaderToModel", container.itemId, shaderHash);

		const itemId = container.itemId;
		const prefix = this.cache.getItemPrefix(itemId);

		if (shaderHash)
		{
			const shaderId = await this.loadShader(shaderHash, prefix);

			if (shaderId === null)
			{
				return;
			}

			this.#updateMaterialDyes(container, shaderId);
		}
		else // default dyes of an item
		{
			this.#updateMaterialDyes(container);
		}
	}

	#updateMaterialDyes(container, shaderId=null)
	{
		const itemId = container.itemId;
		const model = container.groupObject;

		console.log(`TGXMLoader // applyShaderMaterials: Apply shader [id = ${shaderId}], to item [id = ${itemId}]`)
		const gearDyes = this.#resolveGearDyes(itemId, shaderId);

		const materials = {};
		const normals = {};
		const diffuses = {};

		for (let [slot, dye] of Object.entries(gearDyes))
		{
			materials[dye.slotTypeIndex * 2] = dye.materialPrimaryProperties;
			materials[dye.slotTypeIndex * 2 + 1] = dye.materialSecondaryProperties;

			if (dye.materialTextures.normal)
				normals[dye.slotTypeIndex] = this.cache.getThreeTexture(dye.materialTextures.itemId, dye.materialTextures.normal);
			else
				normals[dye.slotTypeIndex] = dummyNormal;

			if (dye.materialTextures.diffuse)
				diffuses[dye.slotTypeIndex] = this.cache.getThreeTexture(dye.materialTextures.itemId, dye.materialTextures.diffuse);
			else
				diffuses[dye.slotTypeIndex] = dummyDiffuse;
		}

		for (let part of model.children)
		{
			if (part.material.userData._shaderType == "destiny2_gear_shader" ||
				part.material.userData._shaderType == "destiny_gear_shader"
			)
			{
				updateMaterialDyeTextures(part.material, diffuses, normals, materials);
			}
		}
	}
}
