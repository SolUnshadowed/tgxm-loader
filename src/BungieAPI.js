export const BungieAPI = {
	async fetchFile(url)
	{
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(`Error loading ${url}: ${response.status}`);
		return response;
	},

	async fetchGeometry(cdn, fileName)
	{
		const url = `https://www.bungie.net${cdn.Geometry}/${fileName}`;
		const response = await this.fetchFile(url);
		return response.arrayBuffer();
	},

	async fetchTexture(cdn, fileName)
	{
		const url = `https://www.bungie.net${cdn.Texture}/${fileName}`;
		const response = await this.fetchFile(url);
		return response.arrayBuffer();
	},

	async fetchGearJson(cdn, fileName)
	{
		const url = `https://www.bungie.net${cdn.Gear}/${fileName}`;
		const response = await this.fetchFile(url);
		return response.json();
	},

	async fetchAnimation(cdn, fileName)
	{
		const url = `https://www.bungie.net${cdn.Animation}/${fileName}`;
		const response = await this.fetchFile(url);
		return response.json();
	}
};

