import { PNG } from 'pngjs/browser.js';
import jpeg from 'jpeg-js';
import UPNG from "upng-js";

/*
	main purpose of this mini-library is to provide a tool for blitting images
	because standard browser canvas corrupt RGB pixel data
	during ctx.drawImage() method if Alpha-channel == 0

	to combat this annoying bug this was made
*/

// Function 1: Creating empty image and returning raw pixels
// full black and transparent
export function createEmptyImage(width, height)
{
	return {
		width,
		height,
		data: new Uint8Array(width * height * 4)
	};
}

// Function 2: Transformation of raw pixels to Base64 string
// used it mostly to output images to console
export function rawPixelsToBase64(pixels, width, height)
{
	const png = new PNG({ width, height });
	png.data = pixels;  // RGBA pixel data array
	const buffer = PNG.sync.write(png);
	const base64Data = buffer.toString('base64');

	return `data:image/png;base64,${base64Data}`;
}

// Function 3: Convertion from Uint8Array representation of Image file (not pixels) to PNG (respecting image format)
export function imageBytesToPNG(imageBytes)
{
	// If image is PNG
	if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50 && imageBytes[2] === 0x4e && imageBytes[3] === 0x47)
	{
		const UPNGResult = UPNG.decode(imageBytes);
		const width = UPNGResult.width;
		const height = UPNGResult.height;
		let data = UPNGResult.data;

		if (UPNGResult.data.length / height / width < 4)
		{
			const frames = UPNG.toRGBA8(UPNGResult);
			console.log("imageBytesToPNG(): png with less than 4 components, expanding!", UPNGResult.data.length / height / width);
			data = new Uint8Array(frames[0]);
		}

		return {
			width: width,
			height: height,
			data: data
		}
	}
	// If image is jpeg
	else if (imageBytes[0] === 0xFF && imageBytes[1] === 0xD8)
	{
		// useTArray is set because imageBytes is Uint8Array
		const decodedImage = jpeg.decode(imageBytes, {useTArray: true});

		return {
			height: decodedImage.height,
			width: decodedImage.width,
			data: decodedImage.data
		};
	}
	else
	{
		throw new Error('Unsupported image format');
    }
}

// Function 4: Inserting one image to another
export function insertImage(receiverPng, inputPng, xOffset, yOffset)
{	// multiplicating x coord by 4, because sizes and offsets are in pixels
	// but data is pixel components (RGBA) [r0, g0, b0, a0, r1, g1, b1, a1, ...]
	const inputData = inputPng.data;
	const inputWidth = inputPng.width * 4;
	const inputHeight = inputPng.height;

	const receiverData = receiverPng.data;
	const receiverWidth = receiverPng.width * 4;
	const receiverHeight = receiverPng.height;
	xOffset *= 4;

	for (let i = 0; i < inputHeight; i++)
	{
		const inputStart = i * inputWidth;
		const receiverStart = (yOffset + i) * receiverWidth + xOffset;

		receiverData.set(inputData.subarray(inputStart, inputStart + inputWidth), receiverStart);
	}
}
