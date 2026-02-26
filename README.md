# tgxm-loader

Three.js loader for Bungie.net API 3D models. Inspired by 
[destiny-tgx-loader](https://github.com/lowlines/destiny-tgx-loader) made by lowlines.

Features:

- Destiny and Destiny 2 3D content support.
- Weapons, Armor, Ships, Ghost shells and Sparrows support.
- Shaders application.
- On-the-fly model reconfiguration.

Initially developed as a part of [Paracausal Forge](https://paracausalforge.com/) 3D model viewer.

## Usage

```
import { TGXMLoader } from "tgxm-loader";

try 
{
	const loader = new TGXMLoader(
		{
			Destiny2InventoryDefinition: {
				source: "syncHandler",
				// you'll need to provide your own DestinyInventoryDefinition loading logic here
				syncHandler: (hash) => yourDestinyInventoryDefinitionLoader(hash)
			},
			Destiny2GearAssetDefinition: {
				source: "syncHandler",
				// you'll need to provide your own GearAssetDefinition loading logic here
				syncHandler: (hash) => yourGearAssetDefinitionLoader(hash)
			},
			iridescenceLookupPath: "path/to/iridescencelookup/texture"
		},
	);
	
	const modelContainer = await loader.load(
		{
			itemHash: 347366834, // Ace of Spades
			game: "destiny2"
		},
		({loaded, total, text}) => console.log(`${loaded}/${total}: ${text}`)
	);

	scene.add(modelContainer.groupObject);
}
catch (err)
{
	console.log(err);
}
```

## Required textures

- `iridescenceLookupPath` (string, required) — URL to iridescence LUT for Destiny 2 materials.
- `specularTintPath` (string, required) — URL to specular tint LUT for Destiny 1 materials.
- `specularLobePath` (string, required) — URL to specular lobe LUT for Destiny 1 materials.
- `cubemapPaths` (Array<string>, required) — Array of URLs to cubemap faces, 512x512 each, in order: [+X, -X, +Y, -Y, +Z, -Z].

> ⚠ If any texture is missing or cannot be loaded, materials may display incorrectly (black or broken reflections). Users must provide all required textures for proper rendering.

## Important
This repository does not include Destiny assets. Users must provide their own LUTs and cubemap textures.
