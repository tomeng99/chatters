/**
 * Magic-byte detection for the file types the upload route accepts.
 *
 * The MIME type on a multipart part is chosen by the client, so it is a claim
 * rather than evidence. These helpers look at the bytes instead. Detection is
 * deliberately limited to the types the upload route allows: anything that is
 * not recognised returns null so the caller can reject it, rather than being
 * guessed at.
 *
 * This identifies containers, not contents: a file can be a structurally valid
 * MP4 and still carry arbitrary trailing data. What it does guarantee is that
 * the extension (and therefore the Content-Type the static handler serves the
 * file back with) matches the container the bytes actually describe.
 */

// ISO base media file format brands, as found in the `ftyp` box. Covers the
// HEIC/HEIF stills produced by iOS and the MP4/QuickTime video containers.
const ISO_BMFF_BRANDS: Record<string, string> = {
  heic: 'image/heic',
  heix: 'image/heic',
  hevc: 'image/heic',
  hevx: 'image/heic',
  heim: 'image/heic',
  heis: 'image/heic',
  hevm: 'image/heic',
  hevs: 'image/heic',
  mif1: 'image/heif',
  msf1: 'image/heif',
  'qt  ': 'video/quicktime',
  isom: 'video/mp4',
  iso2: 'video/mp4',
  iso4: 'video/mp4',
  iso5: 'video/mp4',
  iso6: 'video/mp4',
  mp41: 'video/mp4',
  mp42: 'video/mp4',
  mmp4: 'video/mp4',
  avc1: 'video/mp4',
  dash: 'video/mp4',
  'M4V ': 'video/mp4',
};

// A PDF is allowed to carry leading junk before the header; the spec puts the
// marker within the first kilobyte.
const PDF_HEADER_SEARCH_LIMIT = 1024;

// Real ftyp boxes are a few dozen bytes. Cap the brand scan so a file that
// declares an absurd box size cannot make us walk the whole upload.
const ISO_BMFF_SCAN_LIMIT = 256;

// MPEG transport streams have no header, only a 0x47 sync byte every 188 bytes.
const TS_PACKET_SIZE = 188;
const TS_SYNC_BYTE = 0x47;

function startsWith(buffer: Buffer, offset: number, bytes: number[]): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => buffer[offset + i] === byte);
}

function hasAscii(buffer: Buffer, offset: number, text: string): boolean {
  if (buffer.length < offset + text.length) return false;
  return buffer.toString('latin1', offset, offset + text.length) === text;
}

function detectIsoBmff(buffer: Buffer): string | null {
  if (!hasAscii(buffer, 4, 'ftyp')) return null;

  // The ftyp box holds a major brand at offset 8, a minor version at 12, then a
  // list of compatible brands. Any recognised brand identifies the container.
  const boxSize = buffer.readUInt32BE(0);
  const end = Math.min(boxSize > 8 ? boxSize : ISO_BMFF_SCAN_LIMIT, ISO_BMFF_SCAN_LIMIT, buffer.length);

  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (offset === 12) continue; // minor version, not a brand
    const brand = ISO_BMFF_BRANDS[buffer.toString('latin1', offset, offset + 4)];
    if (brand) return brand;
  }

  return null;
}

function isMpegTransportStream(buffer: Buffer): boolean {
  if (buffer.length < TS_PACKET_SIZE * 2 + 1) return false;
  return (
    buffer[0] === TS_SYNC_BYTE &&
    buffer[TS_PACKET_SIZE] === TS_SYNC_BYTE &&
    buffer[TS_PACKET_SIZE * 2] === TS_SYNC_BYTE
  );
}

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_HEADER_SEARCH_LIMIT).includes('%PDF-', 0, 'latin1');
}

/**
 * Returns the MIME type the bytes actually describe, or null when they do not
 * match any type the upload route supports.
 */
export function detectMimeType(buffer: Buffer): string | null {
  if (startsWith(buffer, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (hasAscii(buffer, 0, 'GIF87a') || hasAscii(buffer, 0, 'GIF89a')) return 'image/gif';
  if (hasAscii(buffer, 0, 'RIFF') && hasAscii(buffer, 8, 'WEBP')) return 'image/webp';

  const isoBmff = detectIsoBmff(buffer);
  if (isoBmff) return isoBmff;

  // EBML header: Matroska and WebM share it, and the route treats both as WebM.
  if (startsWith(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';

  // MPEG program stream (0xBA) and elementary video stream (0xB3).
  if (startsWith(buffer, 0, [0x00, 0x00, 0x01, 0xba])) return 'video/mpeg';
  if (startsWith(buffer, 0, [0x00, 0x00, 0x01, 0xb3])) return 'video/mpeg';
  if (isMpegTransportStream(buffer)) return 'video/mpeg';

  if (isPdf(buffer)) return 'application/pdf';

  return null;
}
