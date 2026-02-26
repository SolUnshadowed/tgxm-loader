import BufferPack from "bufferpack";

/*
struct tgxEntry {                                   | byte range relative to entry first byte
    string[256] name;                               | [0; 256)
    // entry data offset
    // relative to the start of the TGX file
    uint offset;                                    | [256; 260)
    // always 0
    uint type;                                      | [260; 264)
    // length of entry data
    // entry data range is [offset; offset + size)
    uint size;                                      | [264; 268)
    // does not exist in reality
    // so tgx entry length was dividable by 2
    uint padding                                    | [268; 272)
}
// length 256 + 4 + 4 + 4 + 4 = 272 bytes

struct tgxFormat {
    // spells "TGXM"
    string[4] magic;                        | [0; 4) bytes
    uint version;                           | [4; 8) bytes
    // the first byte of tgxEntry[fileCount]
    uint fileHeaderOffset;                  | [8; 12) bytes
    // amount of files
    uint fileCount;                         | [12; 16) bytes
    // Always in the format XXXXXXXXXX-X
    string[256] fileIdentifier;             | [16; 272) bytes
    tgxEntry[fileCount] entries;            | [fileHeaderOffset; fileHeaderOffset + 272 * fileCount)
    byte[] data; // Raw file data           | [fileHeaderOffset + 272 * fileCount; until the end of file] or
                                            | [entries[i].offset; entries[i].offset + entries[i].size)
}
*/

export function parseTGX(tgx)
{
	const array = new Uint8Array(tgx);

    let [magic, version, fileHeaderOffset, fileCount, fileIdentifier] = BufferPack.unpack("< 4s 3I 256s", array, 0);
    fileIdentifier = fileIdentifier.replace(/\0/g, '');
    //console.log(magic, version, fileHeaderOffset, fileCount, fileIdentifier);
    let entries = [];
    let files = {};

    for (let i = 0; i < fileCount; i++)
    {
        let entry_offset = fileHeaderOffset + i * 272;

        let tgx_entry = {
            name: '',
        };

        let temp_name;

        [temp_name, tgx_entry.offset, tgx_entry.type, tgx_entry.size] = BufferPack.unpack("< 256s 3I", array, entry_offset);

        tgx_entry.name = temp_name.replace(/\0/g, '');

        files[tgx_entry.name] = BufferPack.unpack(`< ${tgx_entry.size}A`, array, tgx_entry.offset)[0];

        entries.push(tgx_entry);
    }

    return {
        "magic": magic,
        "version": version,
        "fileHeaderOffset": fileHeaderOffset,
        "fileCount": fileCount,
        "fileIdentifier": fileIdentifier,
        "entries": entries,
        "files": files
    }
}
