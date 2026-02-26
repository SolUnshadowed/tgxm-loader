import * as THREE from 'three';

export const ghostEyeBackgroundSignature = [
	[
	-0.8511602071889985,
	-0.19759210678554898,
	-0.07215971730722245
	],
	[
	-0.8511602071889985,
	0.19759210678554898,
	-0.07215971730722245
	],
	[
	-0.7993614750347122,
	-0.5807481333530613,
	-0.15383512453422646
	],
	[
	-0.7993614750347122,
	0.5807481333530613,
	-0.15383512453422646
	],
	[
	-0.5741238786592469,
	0,
	0.08061765347849394
	],
	[
	-0.5556935707065855,
	-0.40372034717560784,
	0.0323108364186613
	],
	[
	-0.5556935707065855,
	0.40372034717560784,
	0.0323108364186613
	],
	[
	-0.4509319687343152,
	-0.7483668071523913,
	-0.07215971730722245
	],
	[
	-0.4509319687343152,
	0.7483668071523913,
	-0.07215971730722245
	],
	[
	-0.2847683425404473,
	-0.20690426762370037,
	0.14783978513916718
	],
	[
	-0.2847683425404473,
	0.20690426762370037,
	0.14783978513916718
	],
	[
	-0.17738763828179036,
	-0.546021613085946,
	0.08061765347849394
	],
	[
	-0.17738763828179036,
	0.546021613085946,
	0.08061765347849394
	],
	[
	-0.0750510211437987,
	-0.8704916692582194,
	-0.07215971730722245
	],
	[
	-0.0750510211437987,
	0.8704916692582194,
	-0.07215971730722245
	],
	[
	0.00002816106002243659,
	0,
	0.18693142056174478
	],
	[
	0.10876687193862682,
	-0.33475225796770774,
	0.14783978513916718
	],
	[
	0.10876687193862682,
	0.33475225796770774,
	0.14783978513916718
	],
	[
	0.21226751609661845,
	-0.6532083036209615,
	0.0323108364186613
	],
	[
	0.21226751609661845,
	0.6532083036209615,
	0.0323108364186613
	],
	[
	0.3052919516507654,
	-0.9397508067125061,
	-0.15383512453422646
	],
	[
	0.3052919516507654,
	0.9397508067125061,
	-0.15383512453422646
	],
	[
	0.35194970738149434,
	0,
	0.14783978513916718
	],
	[
	0.4644714710464819,
	-0.33746831179406633,
	0.08061765347849394
	],
	[
	0.4644714710464819,
	0.33746831179406633,
	0.08061765347849394
	],
	[
	0.5724342164760633,
	-0.6600953758963677,
	-0.07215971730722245
	],
	[
	0.5724342164760633,
	0.6600953758963677,
	-0.07215971730722245
	],
	[
	0.6867990275328716,
	0,
	0.0323108364186613
	],
	[
	0.8047528435287276,
	-0.3403783793440664,
	-0.07215971730722245
	],
	[
	0.8047528435287276,
	0.3403783793440664,
	-0.07215971730722245
	],
	[
	0.9880856884715873,
	0,
	-0.15383512453422646
	]
	];

export function countVertices(geometry)
{
	if (!geometry.index)
		return geometry.attributes.position.count;

	const indices = geometry.index.array;
	const vertexSet = new Set(indices);
	return vertexSet.size;
}

// creating signature of a model
export function createSignatureFromIndices(geometry, sortTolerance=0.001)
{
	const posAttr = geometry.attributes.position;
	const indexAttr = geometry.index;

	if (!posAttr || !indexAttr)
		return null;

	const indices = indexAttr.array;
	const vertexSet = new Set(indices); // unique indices

	// 1. find center by using unique indices only
	const center = new THREE.Vector3();
	for (const i of vertexSet)
	{
		center.x += posAttr.getX(i);
		center.y += posAttr.getY(i);
		center.z += posAttr.getZ(i);
	}
	center.divideScalar(vertexSet.size);

	// 2. calc coord relative to the center
	const points = [];
	let maxLen = 0;
	for (const i of vertexSet)
	{
		const x = posAttr.getX(i) - center.x;
		const y = posAttr.getY(i) - center.y;
		const z = posAttr.getZ(i) - center.z;
		const len = Math.sqrt(x*x + y*y + z*z);

		if (len > maxLen)
			maxLen = len;

		points.push([x, y, z]);
	}

	// 3. normalize scale
	for (const p of points)
	{
		p[0] /= maxLen;
		p[1] /= maxLen;
		p[2] /= maxLen;
	}

	// 4. sort not depending on idices order
	points.sort(
		(a, b) =>
		{
			if (Math.abs(a[0] - b[0]) > sortTolerance)
				return a[0] - b[0];

			if (Math.abs(a[1] - b[1]) > sortTolerance)
				return a[1] - b[1];

			return a[2] - b[2];
		}
	);

	return points;
}

// check signature
export function checkSignatureFromIndices(geometry, signature, tolerance = 0.01, sortTolerance = 0.001)
{
	const posAttr = geometry.attributes.position;
	const indexAttr = geometry.index;
	if (!posAttr || !indexAttr)
		return false;

	const indices = indexAttr.array;
	const vertexSet = new Set(indices);
	if (vertexSet.size !== signature.length)
		return false;

	// find center
	const center = new THREE.Vector3();

	for (const i of vertexSet)
	{
		center.x += posAttr.getX(i);
		center.y += posAttr.getY(i);
		center.z += posAttr.getZ(i);
	}
	center.divideScalar(vertexSet.size);

	// calc coord relative to the center
	const points = [];
	let maxLen = 0;
	for (const i of vertexSet)
	{
		const x = posAttr.getX(i) - center.x;
		const y = posAttr.getY(i) - center.y;
		const z = posAttr.getZ(i) - center.z;
		const len = Math.sqrt(x*x + y*y + z*z);

		if (len > maxLen)
			maxLen = len;

		points.push([x, y, z]);
	}

	for (const p of points)
	{
		p[0] /= maxLen;
		p[1] /= maxLen;
		p[2] /= maxLen;
	}

	// sort
	points.sort(
		(a, b) =>
		{
			if (Math.abs(a[0] - b[0]) > sortTolerance)
				return a[0] - b[0];

			if (Math.abs(a[1] - b[1]) > sortTolerance)
				return a[1] - b[1];

			return a[2] - b[2];
		}
	);

	let pointsMatch = 0;

	// compare with reference signature
	// if x, y, z of a point is in tolerable range from signature point
	// count this point in
	for (let i = 0; i < points.length; i++)
	{
		let componentsMatched = 0
		for (let j = 0; j < 3; j++)
		{
			if (Math.abs(points[i][j] - signature[i][j]) <= tolerance)
			{
				componentsMatched++;
			}
		}

		if (componentsMatched === 3)
			pointsMatch++;
	}

	//console.log("pointsMatch", pointsMatch);

	// if more than half of points match - ok (31 in total)
	if (pointsMatch > 15)
		return true;
	else
		return false;
}
