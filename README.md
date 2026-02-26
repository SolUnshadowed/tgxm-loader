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

## References

This project was developed with reference to the following projects, articles,
and technical presentations:

- [destiny-tgx-loader](https://github.com/lowlines/destiny-tgx-loader) — lowlines
  - TGX/TGX asset structure and parsing
  - Gear arrangement handling
  - [Bungie's Spasm WebGL library](https://github.com/lowlines/destiny-tgx-loader/tree/master/bnet-src)

- [Porting Bungie's 3D Spasm Library to Three.js](https://lowlidev.com.au/blog/articles/porting-spasm-to-threejs/) — lowlines
  - Insights into TGX loader development and the process of porting Spasm to Three.js

- [3D Content Documentation](https://github.com/Bungie-net/api/wiki/3D-Content-Documentation) — Bungie-net
  - Render stages and LODs 

- [alkahest](https://github.com/cohaereo/alkahest) — cohaereo
  - Render stages mechanism

- [Destiny-Collada-Generator](https://github.com/TiredHobgoblin/Destiny-Collada-Generator) — TiredHobgoblin
  - Destiny 2 base shader: [base shader template](https://github.com/TiredHobgoblin/Destiny-Collada-Generator/blob/Main/Resources/template.shader)

- [Translating Art into Technology: Physically Inspired Shading in 'Destiny 2'](https://gdcvault.com/play/1025290/Translating-Art-into-Technology-Physically) — Alexis Haraux, Nate Hawbaker (GDC 2018)
  - Destiny 2 material model

- [Creating Content to Drive Destiny's Investment Game](https://advances.realtimerendering.com/destiny/siggraph2014/bungie_gear_production_siggraph_2014_web_ready.pdf) — Natalya Tatarchuk (SIGGRAPH 2014)
  - Destiny 1 material model
  - Player gear geometry parts and textures

- [Destiny: From Mythic Science Fiction to Rendering in Real-Time](https://advances.realtimerendering.com/s2013/Tatarchuk-Destiny-SIGGRAPH2013.pdf) — Natalya Tatarchuk (SIGGRAPH 2013)
  - Destiny 1 shading and lighting systems
