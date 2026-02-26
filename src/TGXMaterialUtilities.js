import * as THREE from 'three';

// types of items has to be exact hence using symbol
// used for right shader application
export const ShaderItemTypes = Object.freeze(
	{
		Armor: Symbol("armor"),
		Weapon: Symbol("weapon"),
		Ship: Symbol("ship"),
		Sparrow: Symbol("sparrow"),
		Shader: Symbol("shader"),
		Ghost: Symbol("ghost"),
		Default: Symbol("default")  // Default is used as indicator that we need to use item's default dyes (shader data and textures)
	}
);


/*  shader channel hash to material index 0, 1, 2 [slot]
    i   usage               hash of DestinyArtDyeChannelDefinition
    0 - ArmorPlate          662199250
    1 - ArmorCloth          1367384683
    2 - ArmorSuit           218592586
    3 - unknown             515321167
    4 - Weapon1             1667433279
    5 - Weapon2             1667433278
    6 - Weapon3             1667433277
    7 - ShipUpper           3073305669
    8 - ShipDecals          3073305668
    9 - ShipLower           3073305671
    10 - SparrowUpper       1971582085
    11 - SparrowEngine      1971582084
    12 - SparrowLower       1971582087
    13 - GhostMain          373026848
    14 - GhostHighlights    373026849
    15 - GhostDecals        373026850

    // these two exist in api but I've never seen then in shader's translationBlock
    16 - unknown            972368912
    17 - unknown            1113670919
    ///////
    ArmorPlate  GhostMain       ShipUpper   SparrowUpper    Weapon1 - 0
    ArmorCloth  GhostHighlights ShipDecals  SparrowEngine   Weapon2 - 1
    ArmorSuit   GhostDecals     ShipLower   SparrowLower    Weapon3 - 2
*/

export const ChannelHashToData = {
	662199250: { // ArmorPlate
		itemType: ShaderItemTypes.Armor,
		slotTypeIndex: 0
	},
	1367384683: { // ArmorCloth
		itemType: ShaderItemTypes.Armor,
		slotTypeIndex: 1
	},
	218592586: { // ArmorSuit
		itemType: ShaderItemTypes.Armor,
		slotTypeIndex: 2
	},
	1667433279: { // Weapon1
		itemType: ShaderItemTypes.Weapon,
		slotTypeIndex: 0
	},
	1667433278: { // Weapon2
		itemType: ShaderItemTypes.Weapon,
		slotTypeIndex: 1
	},
	1667433277: { // Weapon3
		itemType: ShaderItemTypes.Weapon,
		slotTypeIndex: 2
	},
	3073305669: { // ShipUpper
		itemType: ShaderItemTypes.Ship,
		slotTypeIndex: 0
	},
	3073305668: { // ShipDecals
		itemType: ShaderItemTypes.Ship,
		slotTypeIndex: 1
	},
	3073305671: { // ShipLower
		itemType: ShaderItemTypes.Ship,
		slotTypeIndex: 2
	},
	1971582085: { // SparrowUpper
		itemType: ShaderItemTypes.Sparrow,
		slotTypeIndex: 0
	},
	1971582084: { // SparrowEngine
		itemType: ShaderItemTypes.Sparrow,
		slotTypeIndex: 1
	},
	1971582087: { // SparrowLower
		itemType: ShaderItemTypes.Sparrow,
		slotTypeIndex: 2,
	},
	373026848: { // GhostMain
		itemType: ShaderItemTypes.Ghost,
		slotTypeIndex: 0,
	},
	373026849: { // GhostHighlights
		itemType: ShaderItemTypes.Ghost,
		slotTypeIndex: 1
	},
	373026850: { // GhostDecals
		itemType: ShaderItemTypes.Ghost,
		slotTypeIndex: 2
	},
	284967655: { // In D1 ships seem to have only one channel
		itemType: ShaderItemTypes.Ship,
		slotTypeIndex: 0
	},
	840921382: { // ship decals???
		itemType: ShaderItemTypes.Ship,
		slotTypeIndex: 3
	}
	// 2025709351 - some sparrow related channel
	// 4023194814 - some ghost shell related channel
};

// returns item type so shader application is possible
export function getInventoryItemType(DestinyInventoryItemDefinition, game)
{
	let itemType;

	if ("itemType" in DestinyInventoryItemDefinition)
	{
		if (game === "destiny2")
		{
			switch (DestinyInventoryItemDefinition.itemType)
			{
				case 2:
					itemType = ShaderItemTypes.Armor;
					break;
				case 3:
					itemType = ShaderItemTypes.Weapon;
					break;
				case 21:
					itemType = ShaderItemTypes.Ship;
					break;
				case 22:
					itemType = ShaderItemTypes.Sparrow;
					break;
				case 24:
					itemType = ShaderItemTypes.Ghost;
					break;
				case 19:
					console.log("item is mod, so it is an ornament or shader")

					if (DestinyInventoryItemDefinition.itemSubType == 20)
						itemType = ShaderItemTypes.Shader;
					else if (DestinyInventoryItemDefinition.itemCategoryHashes.includes(3124752623)) // <ItemCategory "Weapon Mods: Ornaments">
						itemType = ShaderItemTypes.Weapon;
					else if (DestinyInventoryItemDefinition.traitIds && DestinyInventoryItemDefinition.traitIds.includes("item.ornament.weapon"))
						itemType = ShaderItemTypes.Weapon;
					else if (DestinyInventoryItemDefinition.itemCategoryHashes.includes(1742617626)) // <ItemCategory "Armor Mods: Ornaments">
						itemType = ShaderItemTypes.Armor;
					else if (DestinyInventoryItemDefinition.traitIds && DestinyInventoryItemDefinition.traitIds.includes("item.ornament.armor"))
						itemType = ShaderItemTypes.Armor;
					else
					{
						console.log("Could not determine whether mod is weapon or armor, Defaulting to Weapon")
						itemType = ShaderItemTypes.Weapon;
					}
					break;
				default:
					console.log("D2, No item type!!! Defaulting to Weapon");
					itemType = ShaderItemTypes.Weapon;
					break;
			}
		}
		else
		{
			switch (DestinyInventoryItemDefinition.itemType)
			{
				case 3:
					itemType = ShaderItemTypes.Weapon;
					break;
				case 2:
					switch (DestinyInventoryItemDefinition.itemTypeName)
					{
						case "Ghost Shell":
							itemType = ShaderItemTypes.Ghost;
							break;
						case "Mask":
						case "Helmet":
						case "Gauntlets":
						case "Chest Armor":
						case "Leg Armor":
						case "Titan Mark":
						case "Hunter Cloak":
						case "Warlock Bond":
							itemType = ShaderItemTypes.Armor;
							break;
					}
					break;
				case 0:
					switch (DestinyInventoryItemDefinition.itemTypeName)
					{
						case "Vehicle":
							itemType = ShaderItemTypes.Sparrow;
							break;
						case "Ship":
							itemType = ShaderItemTypes.Ship;
							break;
						case "Weapon Ornament":
							itemType = ShaderItemTypes.Weapon;
							break;
						case "Mask":
							itemType = ShaderItemTypes.Armor;
							break;
					}
					break;
				default:
					console.log("D1, No item type!!! Defaulting to Weapon");
					itemType = ShaderItemTypes.Weapon;
					break;
			}
		}
	}
	else // fallback, just in case some data is missing for regular check
	{
		let dyeGroups = ["defaultDyes", "lockedDyes", "customDyes"];
		let channels = new Set();

		for (let dyeGroupName of dyeGroups)
		{
			const block = (game === "destiny2") ? "translationBlock" : "equippingBlock";
			const dyeGroup = DestinyInventoryItemDefinition[block][dyeGroupName];

			for (let entry of dyeGroup)
			{
				channels.add(parseInt(entry.channelHash))
			}
		}

		if (
			channels.has(662199250) && channels.has(1667433279) &&
			channels.has(3073305669) && channels.has(1971582085) && channels.has(373026848)
		)
			itemType = ShaderItemTypes.Shader;
		else if (channels.has(662199250))
			itemType = ShaderItemTypes.Armor;
		else if (channels.has(1667433279))
			itemType = ShaderItemTypes.Weapon;
		else if (channels.has(3073305669))
			itemType = ShaderItemTypes.Ship;
		else if (channels.has(1971582085))
			itemType = ShaderItemTypes.Sparrow;
		else if (channels.has(373026848))
			itemType = ShaderItemTypes.Ghost;
		else
		{
			console.log("No item type!!! Defaulting to Weapon");
			itemType = ShaderItemTypes.Weapon;
		}
	}

	return itemType
}


function normalizeTransform(transform, kind)
{
	if (transform.every(v => v === 0.0))
	{
		console.log(`${kind} is animated`);
		return [1.5, 1.5, 0.0, 0.0];
	}

	return transform;
}


// build material (primary/secondary)
export function buildDestiny2MaterialProperties(props, prefix)
{
	const color = props[`${prefix}_albedo_tint`];
	const emissive = props[`${prefix}_emissive_tint_color_and_intensity_bias`];
	const wornColor = props[`${prefix}_worn_albedo_tint`];

	let diffuseTransform = props.detail_diffuse_transform;
	let normalTransform = props.detail_normal_transform;
	diffuseTransform = normalizeTransform(diffuseTransform, "diffuse");
	normalTransform = normalizeTransform(normalTransform, "normal");

	return {
		color: new THREE.Color(...color),
		params: new Float32Array(props[`${prefix}_material_params`]),
		advancedParams: new Float32Array(props[`${prefix}_material_advanced_params`]),
		emissiveColor: new THREE.Color(...emissive),
		wearRemap: new Float32Array(props[`${prefix}_wear_remap`]),
		wornColor: new THREE.Color(...wornColor),
		wornParams: new Float32Array(props[`${prefix}_worn_material_parameters`]),
		detailDiffuseTransform: new Float32Array(diffuseTransform),
		detailNormalTransform: new Float32Array(normalTransform),
		roughnessRemap: new Float32Array(props[`${prefix}_roughness_remap`]),
		wornRoughnessRemap: new Float32Array(props[`${prefix}_worn_roughness_remap`]),
		iridescenceId: props[`${prefix}_material_advanced_params`][0],
	};
}

export function buildDestinyMaterialProperties(props, prefix)
{
	return {
		color: new Float32Array(props[`${prefix}_color`]),
		detailTransform: new Float32Array(props.detail_transform),
		detailNormalContributionStrength: new Float32Array(props.detail_normal_contribution_strength),
		decalAlphaMapTransform: new Float32Array(props.decal_alpha_map_transform),
		decalBlendOption: props.decal_blend_option,
		specularProperties: new Float32Array(props.specular_properties),
		subsurfaceScatteringStrength: new Float32Array(props.subsurface_scattering_strength),
	};
}

// shaders in assets folder do not need translation block
export function getDyeChannelHash(dye, dyeHashToChannel)
{
	// this block is for  shaders from /assets folder
	if (dye.investment_hash in ChannelHashToData)
	{
		return dye.investment_hash;
	}

	// for regular API shader dyes we need to get their channel from translation/equipment block
	return dyeHashToChannel.get(dye.investment_hash);
}
