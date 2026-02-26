/*
each stage part has

"lod_category": {
	"value": <value>,
	"name": "<category>"
},

as stated in https://github.com/Bungie-net/api/wiki/3D-Content-Documentation#level-of-detail-lod-categories

Level of detail starts at the highest level (0), and gradually decreases to the lowest level (3).
For the highest quality renders, you probably only want parts with LOD 0 (0, 01, 012, and 0123).
For example, a stage part with lod_category_012 would be rendered for LODs 0, 1, and 2.

value | category
0. lod_category_0,
1. lod_category_01,
2. lod_category_012,
3. lod_category_0123,
4. lod_category_1,
5. lod_category_12,
6. lod_category_123,
7. lod_category_2,
8. lod_category_23,
9. lod_category_3,
10. lod_category_unused
11. lod_category_count

0 - Main Geometry
1 - Grip / Stock
2 - Stickers
3 - Internal / Hidden Geometry?
4 - LOD 1: Low poly geometries
7 - LOD 2: Low poly geometries
8 - HUD / Low poly geometries
9 - LOD 3: Low poly geometries

so for LOD 0 values are [0, 1, 2, 3], categories [lod_category_0, lod_category_01, lod_category_0123]
for LOD 1 values are [1, 2, 3, 4, 5, 6], categories [lod_category_01, lod_category_0123, lod_category_1, lod_category_12, lod_category_123]
and etc.
*/

const LODToValues = {
	0: [0, 1, 2, 3],
	1: [1, 2, 3, 4, 5, 6],
	2: [2, 3, 5, 6, 7, 8],
	3: [3, 6, 8, 9]
};

function LODFilter(stagePart, LOD = 0)
{
	const lodValues = LODToValues[LOD];

	if (lodValues.includes(stagePart.lodCategory.value))
		return true;

	return false;
}

export function filterDestiny2StagePartsToRender(mesh, LOD = 0, allowedRenderStageIndexes)
{
	const renderableParts = [];
	const parts = mesh.stageParts;
	const partCount = parts.length;

	for (let p = 0; p < partCount; p++)
	{
		const part = parts[p];

		if (!LODFilter(part, LOD))
		{
			continue;
		}

		if (!part.flags)
		{
			console.log(`TGXMLoader // parseGeometryBuffers: Part [index = ${p}] has no flags, skipping`)
			continue;
		}

		if (part.renderStagesIndices.some(el => allowedRenderStageIndexes.includes(el)))
		{
			renderableParts.push(part);
			console.log(`TGXMLoader // parseGeometryBuffers: Part [index = ${p}] will be used`)
		}
		else
		{
			console.log(`TGXMLoader // parseGeometryBuffers: Part [index = ${p}] do not include allowed render stage indexes, skipping`);
		}
	}

	return renderableParts;
}


// TODO: figure out logic
export function filterDestinyStagePartsToRender(mesh, LOD = 0, allowedRenderStageIndexes)
{
	const renderableParts = [];
	const parts = mesh.stageParts;
	const partCount = parts.length;

	for (let p = 0; p < partCount; p++)
	{
		const part = parts[p];

		if (!LODFilter(part))
		{
			continue;
		}

		// if (!part.flags) // nex step would be check only if transparent
		// {
		// 	console.log(`TGXMLoader // parseGeometryBuffers: Part [index = ${p}] has no flags, skipping`)
		// 	continue;
		// }

		if (part.renderStagesIndices.some(el => allowedRenderStageIndexes.includes(el)))
		{
			renderableParts.push(part);
			console.log(`TGXMLoader // parseGeometryBuffers: Part [index = ${p}] will be used`)
		}
		else
		{
			console.log(`TGXMLoader // parseGeometryBuffers: Part [index = ${p}] do not include allowed render stage indexes, skipping`);
		}
	}

	return renderableParts;
}


