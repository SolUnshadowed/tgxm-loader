// let oldVal = {
// 	"-1": {
// 		regionIndex: -1,
// 		selectedPattern: {
// 		index: -1,
// 		hash: 3329190510,
// 		geometryHashes: ['775494375-0'],
// 		},
// 	},
// 	"old": {
// 		regionIndex: "old",
// 		selectedPattern: {
// 		index: -1,
// 		hash: 33235432450,
// 		geometryHashes: ['3456345665-0'],
// 		},
// 	},
// };

// let newVal = {
// 	"-1": {
// 		regionIndex: -1,
// 		selectedPattern: {
// 			index: -1,
// 			hash: 179678141,
// 			geometryHashes: ['1633155336-0'],
// 		},
// 	},
// 	"new":  {
// 		regionIndex: "new",
// 		selectedPattern: {
// 			index: -1,
// 			hash: 77465364432450,
// 			geometryHashes: ['5683456745-0'],
// 		},
// 	},
// };

//console.log(compareArtRegionPatterns(oldVal, newVal))

function compareKeys(obj1, obj2)
{
	const common = [];
	const onlyInFirst = [];
	const onlyInSecond = [];

	for (let key of Object.keys(obj1))
	{
		if (Object.hasOwn(obj2, key))
			common.push(key)
		else
			onlyInFirst.push(key)
	}

	for (let key of Object.keys(obj2))
	{
		if (!Object.hasOwn(obj1, key))
			onlyInSecond.push(key)
	}

	return { common, onlyInFirst, onlyInSecond };
}

export function compareArtRegionPatterns(oldVal, newVal)
{
	let {
		common: commonIndices,
		onlyInFirst: indicesToRemove,
		onlyInSecond: indicesToAdd
	} = compareKeys(oldVal, newVal);

	const res = {};

	for (const regionIndex of indicesToRemove)
	{
		const oldPattern = oldVal[regionIndex].selectedPattern;

		if (!(regionIndex in res))
		{
			res[regionIndex] = {
				add: [],
				remove: [],
				stay: []
			};
		}

		res[regionIndex].remove.push(...oldPattern.geometryHashes);
	}

	for (const regionIndex of commonIndices)
	{
		const oldPattern = oldVal[regionIndex].selectedPattern;
		const newPattern = newVal[regionIndex].selectedPattern;

		if (!(regionIndex in res))
		{
			res[regionIndex] = {
				add: [],
				remove: [],
				stay: []
			};
		}

		if (oldPattern.hash !== newPattern.hash)
		{
			res[regionIndex].remove.push(...oldPattern.geometryHashes);
			res[regionIndex].add.push(...newPattern.geometryHashes)
		}
		else
		{
			res[regionIndex].stay.push(...oldPattern.geometryHashes)
		}
	}

	for (const regionIndex of indicesToAdd)
	{
		const newPattern = newVal[regionIndex].selectedPattern;

		if (!(regionIndex in res))
		{
			res[regionIndex] = {
				add: [],
				remove: [],
				stay: []
			};
		}

		res[regionIndex].add.push(...newPattern.geometryHashes)
	}

	return res;
}


