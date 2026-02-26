import * as THREE from 'three';

import { compareArtRegionPatterns } from "./compareArtRegionPatterns.js";

const allowedGames = ["destiny", "destiny2", "global"];

export class TGXModelContainer
{
	// ---------- PRIVATE FIELDS ----------

	// { data: object, texture: THREE.Texture }
	#textures = new Map();

	// { mesh: THREE.Mesh, material: THREE.Material }
	#parts = new Map();

	#disposed = false;

	#group = new THREE.Group();

	#artRegionPatterns = {};

	// ---------- PUBLIC FIELDS ----------

	// string
	#itemId;

	// string
	#game;

	constructor(itemId, game="destiny2", instance = 0)
	{
		console.log("Create TGXModelContainer for", itemId);

		if (!itemId)
			throw new Error("TGXModelContainer requires a itemId identifier");

		if (typeof itemId !== "string")
		{
			itemId = String(itemId);
		}

		this.#itemId = itemId;
		this.instance = instance;

		if (!allowedGames.includes(game))
		{
			game = "destiny2";
		}

		this.#game = game;
	}

	get itemId()
	{
		return this.#itemId;
	}

	get game()
	{
		return this.#game;
	}

	// ---------- TEXTURES ----------
	addTexture(key, data, texture)
	{
		this.#textures.set(key, { data, texture });
	}

	hasTexture(key)
	{
		return this.#textures.has(key);
	}

	getTexture(key)
	{
		const result = this.#textures.get(key);

		if (result)
			return result;
		else
			return {};
	}

	getTextureKeys()
	{
		return [...this.#textures.keys()];
	}

	removeTexture(key)
	{
		const texRecord = this.#textures.get(key);

		if (!texRecord)
			return false;

		const { texture } = texRecord;

		console.log(`[TGXModelContainer] Removing texture: ${key}`);

		texture?.dispose();

		this.#textures.delete(key);
		return true;
	}

	// ---------- PARTS ----------
	addPart(key, mesh, material)
	{
		this.#parts.set(key, { mesh, material });
		this.#group.add(mesh);
	}

	getPart(key)
	{
		return this.#parts.get(key);
	}

	hasPart(key)
	{
		return this.#parts.has(key);
	}

	removePart(key)
	{
		const part = this.#parts.get(key);

		if (!part)
			return false;

		const { mesh, material } = part;

		console.log(`[TGXModelContainer] Removing part: ${key}`);

		if (mesh)
		{
			this.#group.remove(mesh);
			mesh.geometry = null; // do not dispose geometry here as it is responsibility of the loader!
		}

		material?.dispose();

		this.#parts.delete(key);

		return true;
	}

	dispose()
	{
		if (this.#disposed)
			return;

		console.log(`[TGXModelContainer] Disposing model: ${this.#itemId}`);

		this.#textures.forEach(
			(texRecord, key) =>
			{
				this.removeTexture(key);
			}
		);

		this.#parts.forEach(
			(part, key) =>
			{
				this.removePart(key);
			}
		);

		this.#group.clear();
		this.#disposed = true;
    }

	// ---------- GROUP ----------
	get groupObject()
	{
		return this.#group;
	}

	get isDisposed()
	{
		return this.#disposed;
	}

	// ---------- ArtRegionPatterns ----------
	compareArtRegionPatterns(newArtRegionPatterns)
	{
		return compareArtRegionPatterns(this.#artRegionPatterns, newArtRegionPatterns);
	}

	updateArtRegionPatterns(newArtRegionPatterns)
	{
		this.#artRegionPatterns = newArtRegionPatterns;
	}

}
