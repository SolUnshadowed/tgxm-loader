import * as THREE from 'three';

function makeSRTMatrix(transform)
{
	const scale = transform.ts[3]; // || 1

	// [x, y, z] -> [y, z, x]
	// this rotation swap does not require switching sign of quaternion.w
	// because both bases have the same chirality
	let rotation = [transform.r[1],transform.r[2], transform.r[0], transform.r[3]]; // || [0, 0, 0, 1]

	// [x, y, z] -> [y, z, x]
	let translation = [transform.ts[1], transform.ts[2], transform.ts[0]]; // [0, 0, 0]

	const TScale = new THREE.Vector3(scale, scale, scale)
	const TRotation = new THREE.Quaternion(...rotation);
	const TTranslation = new THREE.Vector3(...translation);

	const matrix = new THREE.Matrix4();
	matrix.compose(TTranslation, TRotation, TScale);

	return matrix;
}

export function parseSeleton(skeletonJson)
{
	console.log("parseSeleton");
	const definition = skeletonJson.definition;
	const transforms = definition.default_object_space_transforms;
	const invTransforms = definition.default_inverse_object_space_transforms;
	const nodes = definition.nodes;

	const nodesLength = nodes.length;
	const bones = Array(nodesLength);
	const SRTMatrices = Array(nodesLength);
	const invSRTMatrices = Array(nodesLength);

	nodes.forEach(
		(node, nodeIndex) =>
		{
			// SRT
			const SRTMatrix = makeSRTMatrix(transforms[nodeIndex]);
			SRTMatrices[nodeIndex] = SRTMatrix;
			const invSRTMatrix = makeSRTMatrix(invTransforms[nodeIndex]);
			invSRTMatrices[nodeIndex] = invSRTMatrix;

			// skeleton bones are in world space
			const bone = new THREE.Bone();
			bone.name = node.name.string;
			bone.applyMatrix4(SRTMatrix); // set bone in place
			bones[nodeIndex] = bone;
		}
	);

	let rootBone = null;
	const boneNames = []; // bone index to bone name

	nodes.forEach(
		(node, nodeIndex) =>
		{
			const parentIndex = node.parent_node_index;
			const currentBone =  bones[nodeIndex];
			boneNames.push(currentBone.name);

			if (parentIndex > -1) // if has parent
			{
				bones[parentIndex].add(currentBone); // add child to parent

				// apply parent's inverse world matrix to compensate for SRT changes
				currentBone.applyMatrix4(invSRTMatrices[parentIndex]);
				currentBone.updateMatrixWorld(); // call update manually (does not work without it, skeleton looks broken otherwise)
			}
			else // if bone has no parent it is a root bone
			{
				rootBone = currentBone;
			}
		}
	);

	const skeleton = new THREE.Skeleton(bones, invSRTMatrices);

	return [skeleton, rootBone, boneNames];
}
