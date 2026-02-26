import * as THREE from 'three';

// animation - animation json data
// boneNames - array: [boneIndex] = boneName
export function parseAnimation(animation, boneNames)
{
	const animRate = 30;
	const animLength = animation.duration_in_frames / animRate;
	const animFrameCount = animation.frame_count;
	const animNodeCount = animation.node_count;

	const staticBoneData = animation.static_bone_data;
	const staticScaleControlMap = staticBoneData.scale_control_map;
	const staticRotationControlMap = staticBoneData.rotation_control_map;
	const staticTranslationControlMap = staticBoneData.translation_control_map;
	const staticTransforms = staticBoneData.transform_stream_header.streams.frames[0]; // using zeroth frame

	const staticScales = staticTransforms.scales;
	const staticRotations = staticTransforms.rotations;
	const staticTranslations = staticTransforms.translations;

	const animatedBoneData = animation.animated_bone_data;
	const animatedScaleControlMap = animatedBoneData.scale_control_map;
	const animatedRotationControlMap = animatedBoneData.rotation_control_map;
	const animatedTranslationControlMap = animatedBoneData.translation_control_map;
	const animatedTransformFrames = animatedBoneData.transform_stream_header.streams.frames;

	const boneData = [];

	for (let j = 0; j < animNodeCount; j++)
	{
		boneData.push(
			{
				boneName: boneNames[j],
				scales: [],
				rotations: [],
				translations: [],
			}
		);
	}

	const tracks = [];

	const staticTimeTrack = new Float32Array(1);
	staticTimeTrack[0] = 0;
	const animatedTimeTrack = new Float32Array(animFrameCount);

	for (let i = 0; i < animFrameCount; i++)
	{
		animatedTimeTrack[i] = i / animRate;
	}

	for (let mapIndex = 0; mapIndex < staticScaleControlMap.length; mapIndex++)
	{
		const boneIndex = staticScaleControlMap[mapIndex];
		const scale = staticScales[mapIndex];

		const values = new Float32Array(3);
		values[0] = scale;
		values[1] = scale;
		values[2] = scale;

		tracks.push(
			new THREE.VectorKeyframeTrack(
				`${boneNames[boneIndex]}.scale`,
				staticTimeTrack,
				values
			)
		);
	}

	for (let mapIndex = 0; mapIndex < staticRotationControlMap.length; mapIndex++)
	{
		const boneIndex = staticRotationControlMap[mapIndex];
		const rotation = staticRotations[mapIndex];

		// [x, y, z] -> [y, z, x]
		// this rotation swap does not require switching sign of quaternion.w
		// because both bases have the same chirality
		const values = new Float32Array(4);
		values[0] = rotation[1];
		values[1] = rotation[2];
		values[2] = rotation[0];
		values[3] = rotation[3];

		tracks.push(
			new THREE.QuaternionKeyframeTrack(
				`${boneNames[boneIndex]}.quaternion`,
				staticTimeTrack,
				values
			)
		);
	}

	for (let mapIndex = 0; mapIndex < staticTranslationControlMap.length; mapIndex++)
	{
		const boneIndex = staticTranslationControlMap[mapIndex];
		const translation = staticTranslations[mapIndex];

		// [x, y, z] -> [y, z, x]
		const values = new Float32Array(3);
		values[0] = translation[1];
		values[1] = translation[2];
		values[2] = translation[0];

		tracks.push(
			new THREE.VectorKeyframeTrack(
				`${boneNames[boneIndex]}.position`,
				staticTimeTrack,
				values
			)
		);
	}

	for (let mapIndex = 0; mapIndex < animatedScaleControlMap.length; mapIndex++)
	{
		const boneIndex = animatedScaleControlMap[mapIndex];
		const values = new Float32Array(3 * animFrameCount);

		for (let frame = 0; frame < animFrameCount; frame++)
		{
			const offset = frame * 3;
			const scale = animatedTransformFrames[frame].scales[mapIndex];

			values[offset]     = scale;
			values[offset + 1] = scale;
			values[offset + 2] = scale;
		}

		tracks.push(
			new THREE.VectorKeyframeTrack(
				`${boneNames[boneIndex]}.scale`,
				animatedTimeTrack,
				values
			)
		);
	}

	for (let mapIndex = 0; mapIndex < animatedRotationControlMap.length; mapIndex++)
	{
		const boneIndex = animatedRotationControlMap[mapIndex];
		const values = new Float32Array(4 * animFrameCount);

		for (let frame = 0; frame < animFrameCount; frame++)
		{
			const offset = frame * 4;
			const rotation = animatedTransformFrames[frame].rotations[mapIndex];

			values[offset]     = rotation[1];
			values[offset + 1] = rotation[2];
			values[offset + 2] = rotation[0];
			values[offset + 3] = rotation[3];
		}

		tracks.push(
			new THREE.QuaternionKeyframeTrack(
				`${boneNames[boneIndex]}.quaternion`,
				animatedTimeTrack,
				values
			)
		);
	}

	for (let mapIndex = 0; mapIndex < animatedTranslationControlMap.length; mapIndex++)
	{
		const boneIndex = animatedTranslationControlMap[mapIndex];
		const values = new Float32Array(3 * animFrameCount);

		for (let frame = 0; frame < animFrameCount; frame++)
		{
			const offset = frame * 3;
			const translation = animatedTransformFrames[frame].translations[mapIndex];

			values[offset]     = translation[1];
			values[offset + 1] = translation[2];
			values[offset + 2] = translation[0];
		}

		tracks.push(
			new THREE.VectorKeyframeTrack(
				`${boneNames[boneIndex]}.position`,
				animatedTimeTrack,
				values
			)
		);
	}

	const clip = new THREE.AnimationClip(animation.tag_name, -1, tracks);
	return clip;
}
