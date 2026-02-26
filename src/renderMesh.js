import * as THREE from 'three';

import {
    dataTypeByteSize,
    getDataTypeAndCount
} from "./TGXBufferUtilities.js"

// stageparts description
// https://github.com/cohaereo/alkahest/blob/main/crates/alkahest-data/src/tfx.rs#L10
export const renderStages = {
    0: 'GenerateGbuffer',
    1: 'Decals',
    2: 'InvestmentDecals',
    3: 'ShadowGenerate',
    4: 'LightingApply',
    5: 'LightProbeApply',
    6: 'DecalsAdditive',
    7: 'Transparents',
    8: 'Distortion',
    9: 'LightShaftOcclusion',
    10: 'SkinPrepass',
    11: 'LensFlares',
    12: 'DepthPrepass',
    13: 'WaterReflection',
    14: 'PostprocessTransparentStencil',
    15: 'Impulse',
    16: 'Reticle',
    17: 'WaterRipples',
    18: 'MaskSunLight',
    19: 'Volumetrics',
    20: 'Cubemaps',
    21: 'PostprocessScreen',
    22: 'WorldForces',
    23: 'ComputeSkinning',
};

function parseStagePart(stagePart, index, geometryHash, renderMeshIndex)
{
    const stagePartDesc = {
		id: `g${geometryHash}_m${renderMeshIndex}_p${index}`,
		"default": stagePart,
		shader: stagePart.shader,
		stagePartIndex: index,
		staticTextures: stagePart.shader?.static_textures ?? null,
		staticTextureCount: stagePart.shader?.static_textures?.length ?? 0,
		startIndex: stagePart.start_index,
		indexCount: stagePart.index_count,
		indexMin: stagePart.index_min,
		indexMax: stagePart.index_max,
		flags: stagePart.flags,
		gearDyeChangeColorIndex: stagePart.gear_dye_change_color_index,
		variantShaderIndex: stagePart.variant_shader_index,
		externalIdentifier: stagePart.external_identifier,
		primitiveType: stagePart.primitive_type,
		sides: stagePart.primitive_type == 3 ? THREE.DoubleSide : THREE.FrontSide,
		lodCategory: stagePart.lod_category,
		lodRun: stagePart.lod_run,
		// from tgxloader
		gearDyeSlot: 0,
		usePrimaryColor: true,
		useInvestmentDecal: false,
		renderStages: [],
		renderStagesIndices: [],
	};

	//console.log("side check", stagePart.primitiveType, stagePart.primitiveType == 3 ? THREE.DoubleSide : THREE.FrontSide,)

    if (stagePart.gear_dye_change_color_index > 5)
        console.warn("Found gearDyeChangeColorIndex > 5! Can be ignored.")

    switch (stagePart.gear_dye_change_color_index)
    {
        case 0:
            stagePartDesc.gearDyeSlot = 0;
            break;
        case 1:
            stagePartDesc.gearDyeSlot = 0;
            stagePartDesc.usePrimaryColor = false;
            break;
        case 2:
            stagePartDesc.gearDyeSlot = 1;
            break;
        case 3:
            stagePartDesc.gearDyeSlot = 1;
            stagePartDesc.usePrimaryColor = false;
            break;
        case 4:
            stagePartDesc.gearDyeSlot = 2;
            break;
        case 5:
            stagePartDesc.gearDyeSlot = 2;
            stagePartDesc.usePrimaryColor = false;
            break;
        case 6:
            stagePartDesc.gearDyeSlot = 3;
            stagePartDesc.useInvestmentDecal = true;
            break;
        case 7:
            stagePartDesc.gearDyeSlot = 3;
            stagePartDesc.useInvestmentDecal = true;
            stagePartDesc.usePrimaryColor = false;
            break;
        case _:
            console.log(`parseStagePart: UnknownDyeChangeColorIndex[${stagePartDesc["gearDyeChangeColorIndex"]}]`, stagePart);
    }

    return stagePartDesc;
}


export class RenderMesh
{
	constructor(renderMesh, geometryHash, renderMeshIndex)
	{
		this.renderMesh = renderMesh;
		this.boundingVolume = renderMesh.bounding_volume;
		this.positionOffset = renderMesh.position_offset;
		this.positionScale = renderMesh.position_scale;

		this.textureScale = renderMesh.texcoord0_scale_offset.slice(0, 2);
		this.textureOffset = renderMesh.texcoord0_scale_offset.slice(2);

		this.stagePartOffsets = renderMesh.stage_part_offsets;
		this.stagePartVertexStreamLayoutLookup = renderMesh.stage_part_vertex_stream_layout_lookup;
		this.stagePartVertexStreamLayoutDefintions = renderMesh.stage_part_vertex_stream_layout_definitions;

		this.stageParts = [];

		let stagePartCount = renderMesh.stage_part_list.length

		for (let stagePartIndex = 0; stagePartIndex  < stagePartCount; stagePartIndex++)
		{
			const renderMeshStagePart = renderMesh.stage_part_list[stagePartIndex];
			const stagePart = parseStagePart(renderMeshStagePart, stagePartIndex, geometryHash, renderMeshIndex);
			this.stageParts.push(stagePart);
		}

		console.log('RenderMesh // constructor: render mesh has', this.stageParts.length, "stage parts")

		// assigning render stages to be visible
		for (let [stageIndex, renderStageString] of Object.entries(renderStages))
		{
			const renderStageIndex = parseInt(stageIndex);
			const startIndex = this.stagePartOffsets[renderStageIndex];
			const stopIndex = this.stagePartOffsets[renderStageIndex + 1]; // until next, but excluding (in cycle)

			for (let i = startIndex; i < stopIndex; i++)
			{
				this.stageParts[i].renderStagesIndices.push(parseInt(renderStageIndex));
				this.stageParts[i].renderStages.push([renderStageIndex, renderStageString])
			}
		}

		this.indexBufferMetadata = {
			fileName: renderMesh.index_buffer.file_name,
			byteSize: renderMesh.index_buffer.byte_size,
			valueByteSize: renderMesh.index_buffer.value_byte_size
		};

		this.vertexBufferMetadatas = [];
		const vertexBufferCount = renderMesh.vertex_buffers.length;

		for ( let vertexBufferIndex = 0; vertexBufferIndex < vertexBufferCount; vertexBufferIndex++)
		{
			const renderMeshVertexBuffer = renderMesh.vertex_buffers[vertexBufferIndex];
			const vertexBufferMetadata = {
				fileName: renderMeshVertexBuffer.file_name,
				byteSize: renderMeshVertexBuffer.byte_size,
				strideByteSize: renderMeshVertexBuffer.stride_byte_size
			};

			this.vertexBufferMetadatas.push(vertexBufferMetadata);
		}

		// attributes

		const vertexStreamLayout = this.stagePartVertexStreamLayoutDefintions[0]

		const vertexStreamLayoutFormats = vertexStreamLayout.formats;

		const vertexBufferAttributes = [];
		const semanticIdentifiers = [];

		for ( let vertexBufferIndex = 0; vertexBufferIndex < vertexBufferCount; vertexBufferIndex++)
		{
			const attributes = [];

			const vertexStreamLayoutFormat = vertexStreamLayoutFormats[vertexBufferIndex];

			const vertexStreamLayoutElements = vertexStreamLayoutFormat.elements;
			const vertexStreamLayoutElementCount = vertexStreamLayoutElements.length;

			let elementByteOffset = 0;
			for (
				let vertexStreamLayoutElementIndex = 0;
				vertexStreamLayoutElementIndex < vertexStreamLayoutElementCount;
				vertexStreamLayoutElementIndex++
			)
			{
				const vertexStreamLayoutElement = vertexStreamLayoutElements[vertexStreamLayoutElementIndex];
				const semanticIndex = vertexStreamLayoutElement.semantic_index;
				const semanticName = vertexStreamLayoutElement.semantic;
				const elementTypeName = vertexStreamLayoutElement.type;

				const semanticNameStripped = semanticName.replace("_tfx_vb_semantic_", "");;
				const elementTypeNameStripped = elementTypeName.replace("_vertex_format_attribute_", "");

				const [foundElementValueType, foundElementValueCount] = getDataTypeAndCount(elementTypeNameStripped);
				const foundElementValueByteSize = dataTypeByteSize[foundElementValueType];
				const foundElementByteSize = foundElementValueByteSize * foundElementValueCount;
				const isNormalized = vertexStreamLayoutElement.normalized;

				/*
				I was wondering why I put this code here, so it happens to be a part of original Spasm library: spasm_render_mesh.js

				original code:
				if (semanticNameStripped.indexOf("position") >= 0
					&& foundElementValueType === "FLOAT")
				{
					// $HACK cloth position doesn't need to be scaled or offset
					this.positionScale = [1.0, 1.0, 1.0];
					this.positionOffset = [0.0, 0.0, 0.0];
				}

				I have no idea why, but it works
				Removing it breaks item scales and positions, so let it remain here
				*/

				if (semanticNameStripped.startsWith("position") && foundElementValueType == "float")
				{
					this.positionScale = [1.0, 1.0, 1.0];
					this.positionOffset = [0.0, 0.0, 0.0];
				}

				const semanticIdentifier = `${semanticNameStripped}${semanticIndex}`;

				if (semanticIdentifiers.includes(semanticIdentifier))
				{
					console.log("RenderMesh // constructor: Duplicate semantic identifier: " + semanticIdentifier);
				}

				const shaderValueType = ( foundElementValueCount == 1) ? "float" : `vec${foundElementValueCount}`;

				const attribute = {
					semantic: semanticNameStripped,
					semanticIndex: semanticIndex,
					shaderValueType: shaderValueType,
					foundElementValueCount: foundElementValueCount,
					isNormalized: isNormalized,
					byteOffset: elementByteOffset,
					elementTypeName: foundElementValueType,
					byteCount: foundElementByteSize,
					shaderValueName: `a_${semanticNameStripped}${(semanticIndex > 0) ? semanticIndex : ''}`
				};

				elementByteOffset += foundElementByteSize

				attributes.push(attribute);
			}

			vertexBufferAttributes.push(attributes);
		}

		this.attributes = vertexBufferAttributes;
	}
}
