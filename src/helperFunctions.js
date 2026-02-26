export function isSubstrInArray(array, substr)
{
	if (Array.isArray(array))
	{
		const found = array.some(str => str.includes(substr));
		return found
	}
	else // if static_textures is undefined
		return false;
}

function detectImageMimeType(buffer)
{
	let bytes = new Uint8Array(buffer);

	// PNG signature
	if (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4E &&
		bytes[3] === 0x47
	)
	{
		return "image/png";
	}

	// JPG signature
	if (
		bytes[0] === 0xFF &&
		bytes[1] === 0xD8 &&
		bytes[2] === 0xFF
	)
	{
		return "image/jpeg";
	}

	return "application/octet-stream"; // unknown
}

function arrayBufferToBase64Url(buffer)
{
	const mimeType = detectImageMimeType(buffer);
	let binary = '';
	let bytes = new Uint8Array(buffer);

	for (let i = 0; i < bytes.length; i++)
	{
		binary += String.fromCharCode(bytes[i]);
	}

	const base64 = btoa(binary);
	return `data:${mimeType};base64,${base64}`;
}

export function consoleLogRGB(rgb, msg="")
{
	const [r, g, b, a] = rgb.map(v => Math.round(Math.min(Math.max(v, 0), 1) * 255));
	const cssColor = `rgb(${r}, ${g}, ${b}, ${a})`;

	console.log(`${msg} %c ${cssColor} `, `background: ${cssColor}; color: white; padding: 2px 8px;`);
}

export function consoleLogImage(url, width = 200, height = 200)
{
	const style = [
		'font-size: 1px;',
		`padding: ${height}px ${width}px;`,
		`background: url(${url}) no-repeat center;`,
		'background-size: contain;'
	].join(' ');

	console.log('%c ', style);
}

// one of substring is in array of strings
export function findFirstSubstrInArray(strings, substrings)
{
	if (!Array.isArray(strings) || !Array.isArray(substrings))
		return undefined;

	return strings.find(
		str => typeof str === 'string' && substrings.some(
			sub => str.includes(sub)
		)
	);
}

// small function that shows what flags are present in binary number, output is decimal
export function decompose(n)
{
	return [...n.toString(2)].reverse().map(
		(b, i) => b === '1' ? 2 ** i : null
	).filter(Boolean);
}

// compare arrays by value
export function arraysEqual(a, b)
{
	return a.length === b.length && a.every(
		(v, i) => v === b[i]
	);
}

// loads DestinyInventoryItemDefinition
export async function loadDestinyInventoryItemDefinition(url, apiKey = "")
{
	if (apiKey)
	{
		try
		{
			const response = await fetch(
				url,
				{
					method: 'GET',
					headers: {
						"X-API-KEY": apiKey
					},
				}
			);

			if (!response.ok)
			{
				throw `Http error ${response.status}`;
			}

			const responseJson = await response.json();

			const DestinyInventoryItemDefinition = responseJson.Response;

			return {
				ok: true,
				data: DestinyInventoryItemDefinition
			};
		}
		catch (error)
		{
			return {
				ok: false,
				msg: error.message
			}
		}
	}
	else
		return {
			ok: false,
			msg: "No API key!"
		};
}
