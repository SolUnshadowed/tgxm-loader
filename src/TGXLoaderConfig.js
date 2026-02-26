import * as THREE from 'three';
import { TGXModelContainer } from "./TGXModelContainer.js";

const ignoredRenderStageIndexes = [3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const defaultAllowedRenderStageIndices = [0, 1, 2, 6, 7];
const defaultLOD = 0;

function verifyLOD(options, defalutLOD)
{
	const lod = Number(options.lod);
	return (lod < 4 && lod > -1) ? lod : defalutLOD;
}

function verifyAllowedRenderStageIndices(options, defaultValue)
{
	const optionsStages = Array.isArray(options.allowedRenderStages) ? options.allowedRenderStages : defaultValue;

	const result = [];

	for (let stageIndex of optionsStages)
	{
		const num = Number(stageIndex);
		if (num > -1 && num < 24)
			result.push(num);
	}

	return result;
}

function validateSource(option, name)
{
	const source = option.source ?? "none";

	if (source === "none")
		return { source: "none" };
	if (source === "api")
		return { source: "api" };
	if (source === "syncHandler" && typeof option.syncHandler === "function")
		return { source: "syncHandler", syncHandler: option.syncHandler };
	if (source === "asyncHandler"  && typeof option.asyncHandler === "function")
		return { source: "asyncHandler", asyncHandler: option.asyncHandler };

	throw new Error(`Invalid ${name}.source: ${source}`);
}

function validateShaders(shaders = {})
{
	const source = shaders.source ?? "none";

	if (source === "none")
		return { source: "none" };
	if (source === "api")
		return { source: "api" };
	if (source === "custom")
	{
		if (typeof shaders.gearUrlPrefix !== "string" || typeof shaders.texturesUrlPrefix !== "string")
		{
			throw new Error("Missing required URLs for shaders.load");
		}

		return { source: "custom", gearUrlPrefix: shaders.gearUrlPrefix, texturesUrlPrefix: shaders.texturesUrlPrefix };
	}

	throw new Error(`Invalid shaders.source: ${source}`);
}

function validateHands(hands = {})
{
	const source = hands.source ?? "none";

	if (source === "none")
		return { source: "none" };
	if (source === "syncHandler" && typeof hands.syncTexturesHandler === "function" && typeof hands.syncGeometryHandler === "function")
	{
		return { source: "syncHandler", syncTexturesHandler: hands.syncTexturesHandler, syncGeometryHandler: hands.syncGeometryHandler };
	}
	if (source === "asyncHandler"&& typeof hands.asyncTexturesHandler === "function" && typeof hands.asyncGeometryHandler === "function")
	{
		return { source: "asyncHandler", asyncTexturesHandler: hands.asyncTexturesHandler, asyncGeometryHandler: hands.asyncGeometryHandler };
	}

	throw new Error(`Invalid hands.source: ${source}`);
}


export function createGlobalConfig(options)
{
	try
	{
		const config = {};

		config.shaders = validateShaders(options.shaders);

		// Inventory definitions
		const inventoryDefs = ["DestinyInventoryDefinition", "Destiny2InventoryDefinition"];
		for (let invKey of inventoryDefs)
		{
			if (options[invKey])
			{
				config[invKey] = validateSource(options[invKey], invKey);

				if (config[invKey].source === "api" && !options.X_API_KEY)
				{
					console.warn(`${invKey} is set to 'api', but X_API_KEY is missing!`);
				}
			}
		}

		// Gear asset definitions
		const gearDefs = ["DestinyGearAssetDefinition", "Destiny2GearAssetDefinition"];
		for (let gearKey of gearDefs)
		{
			if (options[gearKey])
			{
				config[gearKey] = validateSource(options[gearKey], gearKey);
			}
		}

		// Hands / neck
		config.hands = validateHands(options.hands);

		// X_API_KEY
		config.X_API_KEY = typeof options.X_API_KEY === "string" ? options.X_API_KEY : "";
		if (!config.X_API_KEY)
			console.warn("X_API_KEY not provided, options with value 'api' may not work");

		config.lod = verifyLOD(options, defaultLOD);
		config.allowedRenderStages = verifyAllowedRenderStageIndices(options, defaultAllowedRenderStageIndices);
		config.specularTintPath = options.specularTintPath || "";
		config.specularLobePath = options.specularLobePath || "";
		config.iridescenceLookupPath = options.iridescenceLookupPath || "";
		config.cubemapPaths = options.cubemapPaths || [];

		return config;
	}
	catch (err)
	{
		console.error("Loader options error:", err);
		throw new Error("Loader options error:", { cause: err });
	}
}

export function createModelConfig(options, globalConfig)
{
	const config = {};

	if (typeof options != 'object')
		options = {};

	config.skeleton = (options.skeleton instanceof THREE.Skeleton) ? options.skeleton : null;

	config.shaderHash = options.shaderHash;
	config.useTrialsMetalness = Boolean(options.useTrialsMetalness);
	config.useTrialsGlow = Boolean(options.useTrialsGlow);
	config.trialsColor = options.trialsColor;
	config.classHash = ("classHash" in options) ? options.classHash : 0;
	config.isFemale = Boolean(options.isFemale);
	config.lod = verifyLOD(options, globalConfig.lod);
	config.allowedRenderStages = verifyAllowedRenderStageIndices(options, globalConfig.allowedRenderStages);

	config.regionIndexOptions = {};

	if (options.regionIndexOptions)
	{
		for (let [regionIndex, indexOption] of Object.entries(options.regionIndexOptions))
		{
			config.regionIndexOptions[parseInt(regionIndex)] = parseInt(indexOption);
		}
	}

	return config;
}

export function createHandsConfig(options)
{
	const config = {};

	if (typeof options != 'object')
		options = {};

	if (options.container instanceof TGXModelContainer)
	{
		config.container = options.container;
	}
	else
	{
		console.warn("Provided container is not instance of TGXModelContainer, a new contaienr will be created");
		config.container = null;
	}

	config.skeleton = (options.skeleton instanceof THREE.Skeleton) ? options.skeleton : null;
	config.isFemale = Boolean(options.isFemale);

	return config;
}
