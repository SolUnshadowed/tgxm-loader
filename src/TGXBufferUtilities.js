import BufferPack from "bufferpack";

// string length to help get data type name
export const vertexFormats = {
	byte:   4,  ubyte:  5,
	short:  5,  ushort: 6,
	int:    3,  uint:   4,
	float:  5
};

// byte length of different data types
export const dataTypeByteSize = {
	byte:   1,  ubyte:  1,
	short:  2,  ushort: 2,
	int:    4,  uint:   4,
	float:  4
};

// alias of data types for BufferPack
export const dataTypeAlias = {
	byte:   "b",    ubyte:  "B",
	short:  "h",    ushort: "H",
	int:    "i",    uint:   "I",
	float:  "f"
};

// max values of different data types
const dataTypeMaxValues = {
	byte:   127,        ubyte:  255,
	short:  32767,      ushort: 65535,
	int:    2147483647, uint:   4294967295
};

// convertes short to float16
export function shortToHalf(short)
{
	let sign = (short >>> 15) & 0x1;
	let exponent = (short >>> 10) & 0x1F
	let mantissa = short & 0x3FF;

	if (exponent == 0)  // subnormal numbers
		exponent = -14;  // exponent for subnormal numbers is -14 as format says
	else
		exponent -= 15;  // exponent shift for normalized numbers

	return ((-1) ** sign) * (2 ** exponent) * (1 + mantissa / 1024);
}

// denormalizes array of integers
// based on: https://www.khronos.org/opengl/wiki/Normalized_Integer
export function normalize(arr, data_type)
{
	let res = [];
	if (data_type == "byte" || data_type == "short" || data_type == "int")
	{
		for (let i = 0; i < arr.length; i++)
		{
			res.push(Math.max(-1, arr[i] / dataTypeMaxValues[data_type]));
		}
	}
	else
	{
		for (let i = 0; i < arr.length; i++)
		{
			res.push(arr[i] / dataTypeMaxValues[data_type]);
		}
	}

	return res;
}

export function getDataTypeAndCount(string)
{
	for (let [vformat, vformatLen] of Object.entries(vertexFormats))
	{
		if (string.startsWith(vformat))
		{
			let number = parseInt(
				string.slice(vformatLen)
			);
			return [vformat, number]
		}
	}
}

export function parsePosition(buffers, vertexIndex, parsedFormatElement, scale, offset)
{
	const x = parsedFormatElement[0] * scale[0] + offset[0];
	const y = parsedFormatElement[1] * scale[1] + offset[1];
	const z = parsedFormatElement[2] * scale[2] + offset[2];

	// [x, y, z] -> [y, z, x]
	const vertexPostionOffset = vertexIndex * buffers.position.elementLen;
	buffers.position.data[vertexPostionOffset] = y;
	buffers.position.data[vertexPostionOffset + 1] = z;
	buffers.position.data[vertexPostionOffset + 2] = x;

	buffers.positionW.data[vertexIndex] = parsedFormatElement[3];

	// from lowlines
	// position.w layout
	// FFFF FBBB BBBB BBBB
	// B = bufferIndex/boneIndex
	// F = flags, 0x0, 0x800, 0xF000
	// 0=no buffer, treat B as boneIndex
	// 800=2 bones, grab the 0x7ff bufferIndex
	// F000=4 bones, Math.abs() value and then grab the 0x7ff bufferIndex
}

export function parseTangent(buffers, vertexIndex, parsedFormatElement, element)
{
	let tangent = parsedFormatElement;

	if (element.isNormalized)
		tangent = normalize(parsedFormatElement, element.elementTypeName);

	const vertexTangentOffset = vertexIndex * buffers.tangent.elementLen;
	buffers.tangent.data[vertexTangentOffset] = tangent[1]; // y
	buffers.tangent.data[vertexTangentOffset + 1] = tangent[2]; // z
	buffers.tangent.data[vertexTangentOffset + 2] = tangent[0]; // x
	buffers.tangent.data[vertexTangentOffset + 3] = tangent[3]; // w
}

export function parseNormal(buffers, vertexIndex, parsedFormatElement, element, uvScale)
{
	// normal
	let normal = parsedFormatElement.slice(0, 3);

	if (element.isNormalized)
		normal = normalize(parsedFormatElement, element.elementTypeName);

	const vertexNormalOffset = vertexIndex * buffers.normal.elementLen;

	// [x, y, z] -> [y, z, x]
	buffers.normal.data[vertexNormalOffset] = normal[1]; // y
	buffers.normal.data[vertexNormalOffset + 1] = normal[2]; // z
	buffers.normal.data[vertexNormalOffset + 2] = normal[0]; // x

	// dyeslot
	const slot = parsedFormatElement[3] & 0x7; // last 3 digits
	buffers.dyeslot.data[vertexIndex] = slot;

	// uv scale stride
	// short and ushort have the same 16 bits in memory.
	// In JS, they are expanded to 32 bits during bitwise operations:
	// short (-32631) -> 11111111 11111111 10000000 10001001
	// ushort (32905) -> 00000000 00000000 10000000 10001001
	// The lower 16 bits (10000000 10001001) always match.
	// Therefore, (x & 0xFFFF) removes the upper 16 bits and gives
	// the same correct value regardless of the sign.
	const normalWSHort = parsedFormatElement[3] & 0xFFFF;
	// higher we used last 3 digits for slot, so discarding them here, 4095 is to use last 12 bits, idk why not 13 because 13 + 3 = 16 would make sense
	// but maybe the last one is used for something else?
	const strideIndex = (normalWSHort >>> 3) & 4095;

	buffers.uvScaleStrideIndex.data[vertexIndex] = strideIndex

	uvScale.min = Math.min(uvScale.min, strideIndex);
	uvScale.max = Math.max(uvScale.max, strideIndex);
}

export function parseTexcoord0(buffers, vertexIndex, parsedFormatElement, element, texcoordScale, texcoordOffset)
{
	let texcoords = parsedFormatElement.slice(0, 2);

	if (element.isNormalized)
	{
		texcoords = normalize(texcoords, element.elementTypeName);
	}

	const vertexTexcoord0Offset = vertexIndex * buffers.texcoord0.elementLen;
	buffers.texcoord0.data[vertexTexcoord0Offset] = texcoords[0] * texcoordScale[0] + texcoordOffset[0];
	buffers.texcoord0.data[vertexTexcoord0Offset + 1] = texcoords[1] * texcoordScale[1] + texcoordOffset[1];
}

export function parseTexcoord2(buffers, vertexIndex, parsedFormatElement, element)
{
	let texcoords = parsedFormatElement.slice(0, 2);

	if (element.isNormalized)
	{
		texcoords = normalize(texcoords, element.elementTypeName);
	}

	const vertexTexcoord2Offset = vertexIndex * buffers.texcoord2.elementLen;
	buffers.texcoord2.data[vertexTexcoord2Offset] = texcoords[0];
	buffers.texcoord2.data[vertexTexcoord2Offset + 1] = texcoords[1];

	buffers.hasTexcoord2.data[vertexIndex] = 1;
}

export function parseBlendindices(buffers, vertexIndex, parsedFormatElement, element)
{
	const blendindices = parsedFormatElement; // it is never normalized

	const vertexBlendindicesOffset = vertexIndex * buffers.blendindices.elementLen;

	buffers.blendindices.data[vertexBlendindicesOffset] = blendindices[0];
	buffers.blendindices.data[vertexBlendindicesOffset + 1] = blendindices[1];
	buffers.blendindices.data[vertexBlendindicesOffset + 2] = blendindices[2];
	buffers.blendindices.data[vertexBlendindicesOffset + 3] = blendindices[3];

	buffers.hasBlendindices.data[vertexIndex] = 1;
}

export function parseBlendweights(buffers, vertexIndex, parsedFormatElement, element)
{
	let blendweight = parsedFormatElement.slice(0, 4);

	if (element.isNormalized)
	{
		blendweight = normalize(blendweight, element.elementTypeName); // ubyte
	}

	const vertexBlendweightOffset = vertexIndex * buffers.blendweight.elementLen;

	buffers.blendweight.data[vertexBlendweightOffset] = blendweight[0];
	buffers.blendweight.data[vertexBlendweightOffset + 1] = blendweight[1];
	buffers.blendweight.data[vertexBlendweightOffset + 2] = blendweight[2];
	buffers.blendweight.data[vertexBlendweightOffset + 3] = blendweight[3];

	buffers.hasBlendweight.data[vertexIndex] = 1;
}



/**
	vertexBuffer - Array of vertices
	meta - metadata of data driven buffer as in tgx files
	tgxStruct - parsed tgx struct
*/
export function addDataDrivenBufferData(buffers, meta={}, tgxStruct)
{
	if (!('file_name' in meta) || meta.file_name === '')
	{
		console.log("TGXMLoader // parseGeometryBuffers: No dataDrivenBufferData")
	}
	else
	{
		const length = Math.floor(meta.byte_size / meta.stride_byte_size);
		const bytes = tgxStruct.files[meta.file_name];
		console.log("Data Driven Buffer length =", length);

		for (let i = 0; i < length; i++)
		{
			const vertexColorOffset = i * buffers.color.elementLen;
			const stride = BufferPack.unpack("< 4B", bytes, i * 4);
			const color = normalize(stride, "ubyte");

			buffers.color.data[vertexColorOffset] = color[0];
			buffers.color.data[vertexColorOffset + 1] = color[1];
			buffers.color.data[vertexColorOffset + 2] = color[2];
			buffers.color.data[vertexColorOffset + 3] = color[3];
		}
	}
}


/*
from spasm_webgl_gear_shader.js

// begin skinning
if (hasBlendIndices)
{
	lines.push("ivec4 blend_indices = ivec4(a_blendindices);");
	if (hasBlendWeights)
	{
		// up to four bones
		lines.push("mat4 skinning_transform = (get_bone_transform(blend_indices[0]) * a_blendweight[0]);");
		lines.push("skinning_transform += (get_bone_transform(blend_indices[1]) * a_blendweight[1]);");
		lines.push("skinning_transform += (get_bone_transform(blend_indices[2]) * a_blendweight[2]);");
		lines.push("skinning_transform += (get_bone_transform(blend_indices[3]) * a_blendweight[3]);");
	}
	else
	{
		// up to two bones
		lines.push("vec2 blend_weight = vec2(a_blendindices.zw)/255.0;");
		lines.push("mat4 skinning_transform = get_bone_transform(blend_indices[0]) * blend_weight[0];");
		lines.push("skinning_transform += get_bone_transform(blend_indices[1]) * blend_weight[1];");
	}
}
else
{
	// one bone
	lines.push("int bone_index = int((a_position.w * 32767.0) + 0.01);");
	lines.push("mat4 skinning_transform = get_bone_transform(bone_index);");
}
*/
export function addSkinBufferData(buffers, vertexCount, meta={}, tgxStruct, uvScaleStrideIndex)
{
	if (!('file_name' in meta) || meta.file_name === '')
	{
		console.log("TGXMLoader // parseGeometryBuffers: No singlePassSkinVertexBuffer, assigning only 1 and 2 bone weights");

		for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++)
		{
			const vertexBlendOffset = vertexIndex * buffers.blendindices.elementLen;

			if (buffers.hasBlendindices.data[vertexIndex] == 0 && buffers.hasBlendweight.data[vertexIndex] == 0)
			{
				buffers.blendindices.data[vertexBlendOffset] = buffers.positionW.data[vertexIndex];
				buffers.blendweight.data[vertexBlendOffset] = 1;
			}
			else if (buffers.hasBlendindices.data[vertexIndex] == 1 && buffers.hasBlendweight.data[vertexIndex] == 0)
			{
				buffers.blendweight.data[vertexBlendOffset] = buffers.blendindices.data[vertexBlendOffset + 2] / 255; // normalize ubyte
				buffers.blendweight.data[vertexBlendOffset + 1] = buffers.blendindices.data[vertexBlendOffset + 3] / 255;
			}
		}
	}
	else
	{
		const bufferContent = tgxStruct.files[meta.file_name];

		const strideCount = Math.floor(meta.byte_size / meta.stride_byte_size);

		const {
			uvScales,
			blendIndices,
			blendWeights,
			firstBoneStride
		} = parseSkinBuffer(bufferContent, strideCount, uvScaleStrideIndex);

		assignSkinWeights(buffers, vertexCount, uvScales, blendIndices, blendWeights, firstBoneStride);
	}
}

function parseSkinBuffer(bufferContent, strideCount, uvScaleStrideIndex)
{
	const uvScales = [];
	const blendIndices = [];
	const blendWeights = [];
	let UVstrideBroken = false;
	let firstBoneStride = 0;

	// start with UV/stride block
	for (let i = uvScaleStrideIndex.min; i <= uvScaleStrideIndex.max; i++)
	{
		const stride = BufferPack.unpack("< 4B", bufferContent, i * 4);

		if ((stride[0] != stride[2]) && (stride[2] + stride[3] == 255) && (i > uvScaleStrideIndex.max))
		{
			UVstrideBroken = true;
			console.warn("parseSkinBuffer(): UV stride ended at:", i);
			firstBoneStride = i;
			break;
		}

		let [short0, short1] = BufferPack.unpack("< 2H", bufferContent, i * 4);
		uvScales.push([shortToHalf(short0), shortToHalf(short1)]);
		blendIndices.push([0, 0, 0, 0]);
		blendWeights.push([0, 0, 0, 0]);
	}

	// then skinning block
	let i = UVstrideBroken ? firstBoneStride : uvScaleStrideIndex.max + 1;

	while (i < strideCount)
	{
		let [index0, index1, weight0, weight1] = BufferPack.unpack("< 4B", bufferContent, i * 4);
		let [normalizedWeight0, normalizedWeight1] = normalize([weight0, weight1], "ubyte");

		if (index0 === 0 && index1 === 0 && weight0 === 0 && weight1 === 0)
		{
			console.log("parseSkinBuffer(): Empty stride")
			blendIndices.push([0, 0, 0, 0]);
			blendWeights.push([0, 0, 0, 0]);
		}
		else if (weight0 + weight1 < 255)
		{
			i++;
			if (i * 4 >= bufferContent.length)
				break;

			let [index2, index3, weight2, weight3] = BufferPack.unpack("< 4B", bufferContent, i * 4);
			let [normalizedWeight2, normalizedWeight3] = normalize([weight2, weight3], "ubyte");

			blendIndices.push([index0, index1, index2, index3]);
			blendWeights.push([normalizedWeight0, normalizedWeight1, normalizedWeight2, normalizedWeight3]);
			blendIndices.push([0, 0, 0, 0]); // empty stride
			blendWeights.push([0, 0, 0, 0]);

			if (weight0 + weight1 + weight2 + weight3 != 255)
			{
				console.error("parseSkinBuffer(): Error: 4 bone weights is not 255!");
			}
		}
		else
		{
			// 2 bone skinning
			blendIndices.push([index0, index1, 0, 0]);
			blendWeights.push([normalizedWeight0, normalizedWeight1, 0, 0]);

			if (weight0 + weight1 != 255)
			{
				console.error("parseSkinBuffer(): Error: 2 bone weights is not 255!");
			}
		}

		i++;
	}

	return { uvScales, blendIndices, blendWeights, firstBoneStride };
}

function assignSkinWeights(buffers, vertexCount, uvScales, blendIndices, blendWeights, firstBoneStride)
{
	let prevBlendIndex = 0;
	let offset = 0;

	for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++)
	{
		// UV scale
		const vertexUVScaleStride = buffers.uvScaleStrideIndex.data[vertexIndex];

		if (vertexUVScaleStride < firstBoneStride && buffers.hasTexcoord2.data[vertexIndex] === 0)
		{
			const vertexTexcoord2Offset = vertexIndex * buffers.texcoord2.elementLen;
			const VertexUVScales = uvScales[vertexUVScaleStride];
			buffers.texcoord2.data[vertexTexcoord2Offset] = buffers.texcoord0.data[vertexTexcoord2Offset] * VertexUVScales[0];
			buffers.texcoord2.data[vertexTexcoord2Offset + 1] = buffers.texcoord0.data[vertexTexcoord2Offset + 1] * VertexUVScales[1];
			buffers.hasTexcoord2.data[vertexIndex] = 1;
		}

		/// bone magic
		let blendIndex = 0;
		let bufferSize = 0;
		const w = buffers.positionW.data[vertexIndex];
		const vertexBlendOffset = vertexIndex * buffers.blendindices.elementLen;

		if (w >= 0 && w <= 255) // 1 bone skinning
		{
			buffers.blendindices.data[vertexBlendOffset] = w;
			buffers.blendweight.data[vertexBlendOffset] = 1;
			bufferSize = 0;
		}
		else if (w < 0)
		{
			blendIndex = Math.abs(w) - 0x800; // take absolute value to remove flag
			bufferSize = 4;
		}
		else
		{
			blendIndex = w - 0x800;  // remove the flag
			bufferSize = 2;
		}

		if (bufferSize > 0)
		{
			if (prevBlendIndex !== blendIndex)
				offset = 0;

			prevBlendIndex = blendIndex;

			// look for next non empty stride
			let count = 0;

			do
			{
				const blendData = blendIndices[blendIndex * 8 + offset]; // group index * 8 (first stride of a group) + shift in a group
				count = blendData.reduce((count, num) => count + (num > 0 ? 1 : 0), 0); // count how many indices

				if (count === 0)
				{
					console.log("assignSkinWeights(): Skipping empty stride")
					offset++;
				}
			}
			while (count === 0);


			const blendDataIndex = blendIndex * 8 + offset;

			buffers.blendindices.data[vertexBlendOffset]     = blendIndices[blendDataIndex][0];
			buffers.blendindices.data[vertexBlendOffset + 1] = blendIndices[blendDataIndex][1];
			buffers.blendindices.data[vertexBlendOffset + 2] = blendIndices[blendDataIndex][2];
			buffers.blendindices.data[vertexBlendOffset + 3] = blendIndices[blendDataIndex][3];

			buffers.blendweight.data[vertexBlendOffset] =     blendWeights[blendDataIndex][0];
			buffers.blendweight.data[vertexBlendOffset + 1] = blendWeights[blendDataIndex][1];
			buffers.blendweight.data[vertexBlendOffset + 2] = blendWeights[blendDataIndex][2];
			buffers.blendweight.data[vertexBlendOffset + 3] = blendWeights[blendDataIndex][3];

			// for 3 and 4 bone skinning buffer has empty additional stride
			// so if offsetInc == 1 we will take next block (shich is empty)
			// to skip it offsetInc = 2
			let offsetInc = (count > 2) ? 2 : 1;

			offset += offsetInc;
		}
	}
}

export function parseIndexBuffer(meta, tgxStruct)
{

	const bytes = tgxStruct.files[meta.fileName];
	///console.log("indexBuffer", bytes);
	const length = Math.floor(meta.byteSize / meta.valueByteSize);
	return BufferPack.unpack(`<${length}${dataTypeAlias.ushort}`, bytes);
}

