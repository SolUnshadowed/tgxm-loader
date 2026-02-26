import * as THREE from 'three';

export function parseTCHCHeader(buffer)
{
	const dv = new DataView(buffer);
	let offset = 0;

	const magic = String.fromCharCode(
		dv.getUint8(offset++),
		dv.getUint8(offset++),
		dv.getUint8(offset++),
		dv.getUint8(offset++)
	);

	if (magic !== 'TCHC')
		return {};

	const version = dv.getUint32(offset, true);
	offset += 4;

	const regionCount = dv.getUint32(offset, true);
	offset += 4;

	const containerNameBytes = new Uint8Array(buffer, offset, 64);
	const containerName = new TextDecoder().decode(containerNameBytes).replace(/\0.*$/, '');
	offset += 64;

	const regions = {};

	for (let i = 0; i < regionCount; i++)
	{
		const nameBytes = new Uint8Array(buffer, offset, 64);
		const regionName = new TextDecoder().decode(nameBytes).replace(/\0.*$/, '');
		offset += 64;

		const vertex_offset = dv.getUint32(offset, true);
		offset += 4;

		const vertex_size   = dv.getUint32(offset, true);
		offset += 4;

		const index_offset  = dv.getUint32(offset, true);
		offset += 4;

		const index_size    = dv.getUint32(offset, true);
		offset += 4;

		const vertex_count  = dv.getUint32(offset, true);
		offset += 4;

		const index_count   = dv.getUint32(offset, true);
		offset += 4;

		regions[regionName] = {
			name: regionName,
			vertex_offset,
			vertex_size,
			index_offset,
			index_size,
			vertex_count,
			index_count
		};
	}

	return {
		version,
		containerName,
		regions,
		buffer
	};
}

export function buildGeometryFromTCHC(buffer, region)
{
	const vertexCount = region.vertex_count;
	const indexCount  = region.index_count;

	const positionArray   = new Float32Array(vertexCount * 3);
	const normalArray     = new Float32Array(vertexCount * 3);
	const uvArray         = new Float32Array(vertexCount * 2);
	const uv2Array        = new Float32Array(vertexCount * 2);
	const skinIndexArray  = new Uint8Array(vertexCount * 4);
	const skinWeightArray = new Float32Array(vertexCount * 4);

	const vertexStride = 52;
	// px, py, pz, nx, ny, nz, u, v | float32
	// + bi 0-3                     | uint8
	// + bw 0-3                     | float32
	const vertexBuffer = new DataView(buffer, region.vertex_offset, region.vertex_size);

	for (let i = 0; i < vertexCount; i++)
	{
		const base = i * vertexStride;

		// NOTE: this is different from transformations used for api models!!
		// [x, y, z] -> [y, z, x];
		const x = vertexBuffer.getFloat32(base + 0, true);
		const y = vertexBuffer.getFloat32(base + 4, true);
		const z = vertexBuffer.getFloat32(base + 8, true);
		positionArray[i * 3]     = x;
		positionArray[i * 3 + 1] = z;
		positionArray[i * 3 + 2] = -y;

		// [x, y, z] -> [y, z, x];
		const nx = vertexBuffer.getFloat32(base + 12, true);
		const ny = vertexBuffer.getFloat32(base + 16, true);
		const nz = vertexBuffer.getFloat32(base + 20, true);
		normalArray[i * 3]     = nx;
		normalArray[i * 3 + 1] = nz;
		normalArray[i * 3 + 2] = -ny;

		// blender stores textures flipped
		const u = vertexBuffer.getFloat32(base + 24, true);
		const v = vertexBuffer.getFloat32(base + 28, true);
		uvArray[i * 2]      = u;
		uvArray[i * 2 + 1]  = 1 - v;
		uv2Array[i * 2]     = u;
		uv2Array[i * 2 + 1] = 1 - v;

		skinIndexArray[i * 4]     = vertexBuffer.getUint8(base + 32);
		skinIndexArray[i * 4 + 1] = vertexBuffer.getUint8(base + 33);
		skinIndexArray[i * 4 + 2] = vertexBuffer.getUint8(base + 34);
		skinIndexArray[i * 4 + 3] = vertexBuffer.getUint8(base + 35);

		skinWeightArray[i * 4]     = vertexBuffer.getFloat32(base + 36, true);
		skinWeightArray[i * 4 + 1] = vertexBuffer.getFloat32(base + 40, true);
		skinWeightArray[i * 4 + 2] = vertexBuffer.getFloat32(base + 44, true);
		skinWeightArray[i * 4 + 3] = vertexBuffer.getFloat32(base + 48, true);
	}

	const geometry = new THREE.BufferGeometry();
	geometry.name = region.name;

	geometry.setAttribute('position',   new THREE.BufferAttribute(positionArray, 3, false));
	geometry.setAttribute('normal',     new THREE.BufferAttribute(normalArray, 3, false));
	geometry.setAttribute('uv',         new THREE.BufferAttribute(uvArray, 2, false));
	geometry.setAttribute('uv2',        new THREE.BufferAttribute(uv2Array, 2, false));
	geometry.setAttribute('skinIndex',  new THREE.BufferAttribute(skinIndexArray, 4, false));
	geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeightArray, 4, false));

	// index buffer
	const indexArray = new Uint32Array(buffer, region.index_offset, region.index_count);
	geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

    return geometry;
}


