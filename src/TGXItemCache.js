export class TGXCache
{
	#data = {};

	constructor()
	{
		console.log("Cache init!")
	}

	initEntry(itemHash, prefix="destiny2", itemType, inventoryDef=null, gearAssetDef=null)
	{
		const uniqueId = this.createId(itemHash, prefix);

		if (this.#data[uniqueId])
			return uniqueId;

		let geometryLength = 0;
		let textureLength = 0;

		if (prefix !== "global" && !(prefix === "destiny2" && itemHash === "hands"))
		{
			if (inventoryDef === null || gearAssetDef === null)
				return null;

			const contentEntry = gearAssetDef.content?.find(e => e.platform === "mobile");

			if (!contentEntry)
			{
				console.error("TGXMCache // initItem: Item has no content entry with 'mobile' platform");
				return null;
			}

			geometryLength = contentEntry.geometry?.length || 0;
			textureLength = contentEntry.textures?.length || 0;
		}

		this.#data[uniqueId] = {
			prefix: prefix,
			itemHash: itemHash,
			itemType: itemType,
			uniqueId: uniqueId,
			DestinyInventoryItemDefinition: inventoryDef,
			GearAssetDefinition: gearAssetDef,
			// {geometry|texture}[index] = true | false - loaded or not, order as in gearAssetDefinition
			nthGeometryDataLoaded: new Array(geometryLength).fill(false),
			nthTextureTGXLoaded: new Array(textureLength).fill(false),
			gearFileName: "", // used as a <key> for gearFilesData[<key>] to get gear file
			gearFilesData: {},
			geometryData: {},
			texturesData: {},
			threeTextures: {},
			threeGeometries: {},
			parsedGeometryData: {},
			dyes: null,
			resolvedDefaultDyes: null,
			omolonLiquidColor: "#00a4ff"
		}

		return uniqueId;
	}

	createId(itemHash, prefix)
	{
		return `${prefix}:${itemHash}`;
	}

	hasEntry(itemHash, prefix)
	{
		return this.createId(itemHash, prefix) in this.#data;
	}

	hasEntryById(id)
	{
		return id in this.#data;
	}

	getItemType(id)
	{
		return this.#data[id].itemType;
	}

	getItemPrefix(id)
	{
		return this.#data[id].prefix;
	}

	getDestinyInventoryItemDefinition(id)
	{
		return this.#data[id].DestinyInventoryItemDefinition;
	}

	getGearAssetDefinition(id)
	{
		return this.#data[id].GearAssetDefinition;
	}

	checkGeometryDataLoaded(id, index)
	{
		return this.#data[id].nthGeometryDataLoaded[index];
	}

	markGeometryDataLoaded(id, index)
	{
		this.#data[id].nthGeometryDataLoaded[index] = true;
	}

	checkTextureTGXLoaded(id, index)
	{
		return this.#data[id].nthTextureTGXLoaded[index];
	}

	markTextureTGXLoaded(id, index)
	{
		this.#data[id].nthTextureTGXLoaded[index] = true;
	}

	setGearFileName(id, gearFileName)
	{
		this.#data[id].gearFileName = gearFileName;
	}

	addGearFile(id, gearFileName, gearFile)
	{
		this.#data[id].gearFilesData[gearFileName] = gearFile;
	}

	getGearFile(id)
	{
		if (!this.#data[id].gearFileName)
			return null;
		else
			return this.#data[id].gearFilesData[this.#data[id].gearFileName];
	}

	addGeometryData(id, fileId, TGXStruct)
	{
		this.#data[id].geometryData[fileId] = TGXStruct;
	}

	getGeometryData(id, fileId)
	{
		return this.#data[id].geometryData[fileId];
	}

	hasGeometryData(id, fileId)
	{
		return fileId in this.#data[id].geometryData;
	}

	addTextureData(id, fileId, data)
	{
		this.#data[id].texturesData[fileId] = data;
	}

	getTextureData(id, fileId)
	{
		return this.#data[id].texturesData[fileId];
	}

	hasTextureData(id, fileId)
	{
		return fileId in this.#data[id].texturesData;
	}

	///////
	addThreeTexture(id, textureName, data)
	{
		this.#data[id].threeTextures[textureName] = data;
	}

	getThreeTexture(id, textureName)
	{
		return this.#data[id].threeTextures[textureName];
	}

	hasThreeTexture(id, textureName)
	{
		return textureName in this.#data[id].threeTextures;
	}

	addThreeGeometry(id, geometryName, data)
	{
		this.#data[id].threeGeometries[geometryName] = data;
	}

	getThreeGeometry(id, geometryName)
	{
		return this.#data[id].threeGeometries[geometryName];
	}

	hasThreeGeometry(id, geometryName)
	{
		return geometryName in this.#data[id].threeGeometries;
	}

	addParsedGeometryData(id, geometryName, data)
	{
		this.#data[id].parsedGeometryData[geometryName] = data;
	}

	getParsedGeometryData(id, geometryName)
	{
		return this.#data[id].parsedGeometryData[geometryName];
	}

	hasParsedGeometryData(id, geometryName)
	{
		return geometryName in this.#data[id].parsedGeometryData;
	}

	///////
	setDyes(id, dyeData)
	{
		this.#data[id].dyes = dyeData;
	}

	getDyes(id)
	{
		return this.#data[id].dyes;
	}

	setResolvedDefaultDyes(id, dyeData)
	{
		this.#data[id].resolvedDefaultDyes = dyeData;
	}

	getResolvedDefaultDyes(id)
	{
		return this.#data[id].resolvedDefaultDyes;
	}

	setOmolonLiquidColor(id, value)
	{
		this.#data[id].omolonLiquidColor = value;
	}

	getOmolonLiquidColor(id)
	{
		return this.#data[id].omolonLiquidColor;
	}

	disposeSingleEntry(id)
	{
		console.log(`TGXMItemCache // disposeSingleItem(): Disposing data for item [id = ${id}]`);

		for (let [textureName, texture] of Object.entries(this.#data[id].threeTextures))
		{
			console.log(`\tDisposing texture [name = ${textureName}]`);
			texture.dispose();
		}

		for (let [geometryName, geometry] of Object.entries(this.#data[id].threeGeometries))
		{
			console.log(`\tDisposing geometry [name = ${geometryName}]`);
			geometry.dispose();
		}

		delete this.#data[id];
	}

	reset(fullReset=false)
	{
		for (let id of Object.keys(this.#data))
		{
			const entry = this.#data[id];
			if (entry.prefix !== "global" || fullReset)
				this.disposeSingleEntry(entry.uniqueId);
		}

		console.log("Cache items amount:", Object.keys(this.#data).length)
	}
}
