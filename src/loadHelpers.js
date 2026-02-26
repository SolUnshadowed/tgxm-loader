export async function loadHandsGeometry(config)
{
	const { source } = config;

	if (source === "syncHandler")
	{
		try
		{
			const arrayBuffer = config.syncGeometryHandler();

			return {
				ok: true,
				arrayBuffer
			};
		}
		catch (err)
		{
			return {
				ok: false,
				message: `hands syncGeometryHandler threw error: ${err.message}`
			}
		}
	}
	else if (source === "asyncHandler")
	{
		try
		{
			const arrayBuffer = await config.asyncGeometryHandler();

			return {
				ok: true,
				arrayBuffer
			};
		}
		catch (err)
		{
			return {
				ok: false,
				message: `hands asyncGeometryHandler threw error: ${err.message}`
			}
		}
	}

	return {
		ok: false,
		message: `Unknown hands source: ${source}`
	}
}

export async function loadHandsTextures(textureNames, config)
{
	const { source } = config;

	if (source === "syncHandler")
	{
		try
		{
			const arrayBuffers = textureNames.map(
				(name) =>
				{
					const arrayBuffer = config.syncTexturesHandler(name);

					return [name.replace(/\.png$/i, ""), arrayBuffer];
				}
			);

			return {
				arrayBuffers,
				ok: true
			}
		}
		catch (err)
		{
			return {
				ok: false,
				message: `hands syncTexturesHandler threw error: ${err.message}`
			}
		}
	}
	if (source === "asyncHandler")
	{
		try
		{
			const arrayBuffers = await Promise.all(
				textureNames.map(
					async (name) =>
					{
						const arrayBuffer = await config.asyncTexturesHandler(name);

						return [name.replace(/\.png$/i, ""), arrayBuffer];
					}
				)
			);

			return {
				ok: true,
				arrayBuffers
			}
		}
		catch (err)
		{
			return {
				ok: false,
				message: `hands asyncTexturesHandler threw error: ${err.message}`
			}
		}
	}

	return {
		ok: false,
		message: `Unknown hands source: ${source}`
	}
}

export async function loadInventoryItemDefinition(itemHash, game, config)
{
	let inventoryDefinition;
	if (game === "destiny2")
	{
		inventoryDefinition = config.Destiny2InventoryDefinition
	}
	else
	{
		inventoryDefinition = config.DestinyInventoryDefinition
	}

	const source = inventoryDefinition.source;

	if (source == "syncHandler")
	{
		try
		{
			return {
				ok: true,
				DestinyInventoryDefinition: inventoryDefinition.syncHandler(itemHash)

			}
		}
		catch (err)
		{
			return {
				ok: false,
				message: `DestinyInventoryDefinition syncHandler for ${game} threw error: ${err.message}`
			}
		}
	}
	else if (source == "asyncHandler")
	{
		try
		{
			return {
				ok: true,
				DestinyInventoryDefinition: await inventoryDefinition.asyncHandler(itemHash)
			}
		}
		catch (err)
		{
			return {
				ok: false,
				message: `DestinyInventoryDefinition asyncHandler for ${game} threw error: ${err.message}`
			}
		}
	}
	else
	{
		return {
			ok: false,
			message: `Unknown DestinyInventoryDefinition source: ${source}`
		};
	}
}

export async function loadGearAssetDefinition(itemHash, game, config)
{
	let gearAssetDefinition;
	let source;

	if (game === "destiny2")
	{
		gearAssetDefinition = config.Destiny2GearAssetDefinition
		source = gearAssetDefinition.source;
	}
	else
	{
		gearAssetDefinition = config.DestinyGearAssetDefinition
		source = gearAssetDefinition.source;
	}

	if (source == "syncHandler")
	{
		try
		{
			return {
				DestinyGearAssetDefinition: gearAssetDefinition.syncHandler(itemHash),
				ok: true
			};
		}
		catch (err)
		{
			return {
				ok: false,
				message: `DestinyGearAssetDefinition syncHandler for ${game} threw error: ${err.message}`
			};
		}

	}
	else if (source == "asyncHandler")
	{
		try
		{
			return {
				DestinyGearAssetDefinition: await gearAssetDefinition.asyncHandler(itemHash),
				ok: true
			};
		}
		catch (err)
		{
			return {
				ok: false,
				message: `DestinyGearAssetDefinition syncHandler for ${game} threw error: ${err.message}`
			};
		}
	}
	else
	{
		return {
			ok: false,
			message: `Unknown DestinyGearAssetDefinition source: ${source}`
		};
	}
}
