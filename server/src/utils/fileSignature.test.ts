import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMimeType } from './fileSignature';

// The upload route stores a file under an extension derived from whatever this
// module returns, and the static handler then serves it back with the matching
// Content-Type. So detection is the thing standing between "the client said
// this is a PNG" and "the server agrees to serve these bytes as a PNG", and a
// silent regression here re-opens the hole that content sniffing was added to
// close. These tests pin both halves of the contract: the types that must be
// recognised, and the content that must not be.

// Every MIME type the upload route accepts. Kept as a literal rather than
// imported from routes/uploads.ts, which cannot be loaded without multer,
// sharp and a JWT secret. If the route's allowlist changes, this changes too.
const UPLOAD_ROUTE_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/mpeg',
  'application/pdf',
];

// Real encoder output rather than a hand-written idea of each format: these are
// complete 1x1 images produced by the server's own sharp, the same library the
// upload route runs images through. Regenerate with:
//   sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 1, g: 2, b: 3 } } })
//     .jpeg({ quality: 20 }).toBuffer()   // and .png({compressionLevel:9}) / .webp() / .gif() / .tiff() / .avif()
const SHARP_JPEG =
  '/9j/2wBDACgcHiMeGSgjISMtKygwPGRBPDc3PHtYXUlkkYCZlo+AjIqgtObDoKrarYqMyP/L2u71////m8H////6/+b9//j/2wBDASstLTw1PHZBQXb4pYyl+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj4+Pj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AIwAP//Z';
const SHARP_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVR42mNgZGIGAAAOAAfpkjfUAAAAAElFTkSuQmCC';
const SHARP_WEBP = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v0gUAA=';
const SHARP_GIF = 'R0lGODlhAQABAIAAAExpcQECAyH5BAUAAAAALAAAAAABAAEAAAICTAEAOw==';
// TIFF and AVIF are formats sharp will happily produce but the route does not
// list, so a client can reach the sniffer with them.
const SHARP_TIFF =
  'SUkqAH4AAAD/2P/AABEIAAEAAQMBIgACEQEDEQH/xABLAAEBAAAAAAAAAAAAAAAAAAAACBABAAAAAAAAAAAAAAAAAAAAAAEBAAAAAAAAAAAAAAAAAAAAAREBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AlcAh/9kAEQAAAQMAAQAAAAEAAAABAQMAAQAAAAEAAAACAQMAAwAAAGABAAADAQMAAQAAAAcAAAAGAQMAAQAAAAYAAAARAQQAAQAAAAgAAAASAQMAAQAAAAEAAAAVAQMAAQAAAAMAAAAWAQMAAQAAAAABAAAXAQQAAQAAAHUAAAAaAQUAAQAAAFABAAAbAQUAAQAAAFgBAAAcAQMAAQAAAAEAAAAoAQMAAQAAAAIAAABTAQMAAwAAAGYBAABbAQcAjgAAAJwBAAAUAgUABgAAAGwBAAAAAAAAMzPLAAAACAAzM8sAAAAIAAgACAAIAAEAAQABAAAAAAABAAAA/wAAAAEAAACAAAAAAQAAAP8AAAABAAAAgAAAAAEAAAD/AAAAAQAAAP/Y/9sAQwAGBgYGBwYHCAgHCgsKCwoPDgwMDg8WEBEQERAWIhUZFRUZFSIeJB4cHiQeNiomJio2PjQyND5MRERMX1pffHyn/9sAQwEGBgYGBwYHCAgHCgsKCwoPDgwMDg8WEBEQERAWIhUZFRUZFSIeJB4cHiQeNiomJio2PjQyND5MRERMX1pffHyn/9k=';
const SHARP_AVIF =
  'AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAD6AAEAAAAAAAAAFwAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGF2MDEAAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAfbWRhdBIACgc4AAYQENBpMgoYAAAAQAX172TY';

function file(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Build the header of an ISO base media file: a 4-byte box size, the literal
 * "ftyp", a 4-byte major brand, a 4-byte minor version, then the compatible
 * brands. That prefix is all detection looks at, and it is how a real MP4, MOV
 * or HEIC file starts. `boxSize` overrides the size field for the cases that
 * probe how far the brand scan is willing to walk.
 */
function isoBmff(majorBrand: string, compatibleBrands: string[] = [], boxSize?: number): Buffer {
  const body = Buffer.concat([
    Buffer.from('ftyp', 'latin1'),
    Buffer.from(majorBrand, 'latin1'),
    Buffer.from([0x00, 0x00, 0x02, 0x00]), // minor version
    ...compatibleBrands.map((brand) => Buffer.from(brand, 'latin1')),
  ]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(boxSize ?? body.length + 4, 0);
  return Buffer.concat([size, body]);
}

// ---------------------------------------------------------------------------
// The types the route accepts
// ---------------------------------------------------------------------------

test('recognises a JPEG produced by the encoder the upload route uses', () => {
  assert.equal(detectMimeType(file(SHARP_JPEG)), 'image/jpeg');
});

test('recognises a PNG produced by the encoder the upload route uses', () => {
  assert.equal(detectMimeType(file(SHARP_PNG)), 'image/png');
});

test('recognises a WebP produced by the encoder the upload route uses', () => {
  assert.equal(detectMimeType(file(SHARP_WEBP)), 'image/webp');
});

test('recognises a GIF produced by the encoder the upload route uses', () => {
  assert.equal(detectMimeType(file(SHARP_GIF)), 'image/gif');
});

// GIF87a is the older header; both are still valid GIFs.
test('recognises both GIF header versions', () => {
  assert.equal(detectMimeType(Buffer.from('GIF87a\x00\x00', 'latin1')), 'image/gif');
  assert.equal(detectMimeType(Buffer.from('GIF89a\x00\x00', 'latin1')), 'image/gif');
});

test('recognises an MP4 by its major brand', () => {
  assert.equal(detectMimeType(isoBmff('isom', ['iso2', 'avc1', 'mp41'])), 'video/mp4');
});

// Real files from phones and editors carry brands the major field does not
// always cover, so a recognised brand anywhere in the list has to count.
test('recognises an MP4 by a compatible brand when the major brand is unknown', () => {
  assert.equal(detectMimeType(isoBmff('zzzz', ['yyyy', 'mp42'])), 'video/mp4');
});

test('recognises a QuickTime movie', () => {
  assert.equal(detectMimeType(isoBmff('qt  ')), 'video/quicktime');
});

test('recognises an iOS HEIC still', () => {
  assert.equal(detectMimeType(isoBmff('heic', ['mif1', 'heic'])), 'image/heic');
});

test('recognises a bare HEIF still', () => {
  assert.equal(detectMimeType(isoBmff('mif1', ['heim'])), 'image/heif');
});

test('recognises a WebM file by its EBML header', () => {
  assert.equal(detectMimeType(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00])), 'video/webm');
});

test('recognises MPEG program and elementary streams', () => {
  assert.equal(detectMimeType(Buffer.from([0x00, 0x00, 0x01, 0xba, 0x44, 0x00])), 'video/mpeg');
  assert.equal(detectMimeType(Buffer.from([0x00, 0x00, 0x01, 0xb3, 0x16, 0x01])), 'video/mpeg');
});

// A transport stream has no header at all, only a 0x47 sync byte at the start
// of every 188-byte packet.
test('recognises an MPEG transport stream by its packet sync bytes', () => {
  const ts = Buffer.alloc(188 * 2 + 1, 0x00);
  ts[0] = 0x47;
  ts[188] = 0x47;
  ts[376] = 0x47;
  assert.equal(detectMimeType(ts), 'video/mpeg');
});

test('does not mistake a stream shorter than three packets for a transport stream', () => {
  const tooShort = Buffer.alloc(188 * 2, 0x00);
  tooShort[0] = 0x47;
  tooShort[188] = 0x47;
  assert.equal(detectMimeType(tooShort), null);
});

test('recognises a PDF', () => {
  assert.equal(detectMimeType(Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')), 'application/pdf');
});

// The PDF spec allows junk ahead of the header, as long as it appears within
// the first kilobyte.
test('recognises a PDF whose header is preceded by junk', () => {
  const padded = Buffer.concat([Buffer.alloc(900, 0x41), Buffer.from('%PDF-1.4')]);
  assert.equal(detectMimeType(padded), 'application/pdf');
});

test('does not search past the first kilobyte for a PDF header', () => {
  const tooDeep = Buffer.concat([Buffer.alloc(2000, 0x41), Buffer.from('%PDF-1.4')]);
  assert.equal(detectMimeType(tooDeep), null);
});

// ---------------------------------------------------------------------------
// The content the route must refuse
// ---------------------------------------------------------------------------

test('rejects an empty upload', () => {
  assert.equal(detectMimeType(Buffer.alloc(0)), null);
});

test('rejects a buffer too short to carry any signature', () => {
  assert.equal(detectMimeType(Buffer.from([0xff])), null);
  assert.equal(detectMimeType(Buffer.from([0xff, 0xd8])), null); // JPEG SOI, one byte shy
  assert.equal(detectMimeType(Buffer.from('\x00\x00\x00\x18ftyp', 'latin1')), null);
});

test('rejects HTML', () => {
  assert.equal(detectMimeType(Buffer.from('<html><script>alert(1)</script></html>')), null);
});

// SVG is an image format, but one that carries script. It is not on the route's
// allowlist and must not sneak past as one.
test('rejects SVG', () => {
  assert.equal(
    detectMimeType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')),
    null
  );
});

test('rejects a ZIP container', () => {
  assert.equal(detectMimeType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])), null);
});

test('rejects an executable', () => {
  assert.equal(detectMimeType(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00])), null);
  assert.equal(detectMimeType(Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1')), null);
});

test('rejects plain text', () => {
  assert.equal(detectMimeType(Buffer.from('just some notes, nothing binary here')), null);
});

// RIFF is a container family; only the WebP flavour is allowed.
test('rejects a RIFF file that is not WebP', () => {
  const wav = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WAVEfmt '),
  ]);
  assert.equal(detectMimeType(wav), null);
});

test('rejects a TIFF, which sharp can produce but the route does not accept', () => {
  assert.equal(detectMimeType(file(SHARP_TIFF)), null);
});

test('rejects an ISO container whose brands are all unrecognised', () => {
  assert.equal(detectMimeType(isoBmff('3gp4', ['3gp4', '3gp6'])), null); // 3GP video
  assert.equal(detectMimeType(isoBmff('zzzz', ['yyyy'])), null);
});

// The brand scan stops at 256 bytes so a file declaring an absurd box size
// cannot make the sniffer walk the whole upload looking for something to like.
test('stops scanning brands after the first 256 bytes', () => {
  const hidden = Buffer.concat([
    isoBmff('zzzz', new Array(80).fill('xxxx'), 0xffffffff),
    Buffer.from('isom'),
  ]);
  assert.equal(detectMimeType(hidden), null);
});

// ---------------------------------------------------------------------------
// Behaviour that is deliberately loose, pinned so a change to it is deliberate
// ---------------------------------------------------------------------------

// AVIF shares the HEIF brand set, so it is identified as image/heif. The route
// then hands it to sharp, which transcodes it to JPEG like any other HEIF, and
// the stored extension is .jpg either way. Harmless, but worth knowing: a
// client that declares image/heif and sends AVIF bytes is accepted.
test('treats AVIF as HEIF, because it carries the same brands', () => {
  assert.equal(detectMimeType(file(SHARP_AVIF)), 'image/heif');
});

// "%PDF-" anywhere in the first kilobyte is enough, so a file that merely
// contains the marker is called a PDF. It is then stored as .pdf and served as
// application/pdf under X-Content-Type-Options: nosniff, so the browser will
// not reinterpret it as markup — a misfiling inside the allowlist, not a way
// out of it.
test('treats any file containing "%PDF-" early on as a PDF', () => {
  assert.equal(detectMimeType(Buffer.from('<html>%PDF-1.4</html>')), 'application/pdf');
});

// Likewise, a transport stream is only three bytes of evidence spread 188 bytes
// apart, so content that happens to hold 0x47 at those offsets — a run of
// ASCII "G", for instance — passes as video/mpeg.
test('treats a run of 0x47 bytes as a transport stream', () => {
  assert.equal(detectMimeType(Buffer.alloc(400, 0x47)), 'video/mpeg');
});

// A QuickTime file is not required to open with an ftyp box; older ones start
// straight in on moov/wide/mdat. Those are not recognised and are refused.
test('does not recognise a QuickTime file that opens without an ftyp box', () => {
  const legacyMov = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x08]),
    Buffer.from('wide'),
    Buffer.from([0x00, 0x00, 0x10, 0x00]),
    Buffer.from('mdat'),
  ]);
  assert.equal(detectMimeType(legacyMov), null);
});

// ---------------------------------------------------------------------------
// Contract held across arbitrary input
// ---------------------------------------------------------------------------

/** xorshift32, so a failure reproduces exactly rather than once in a while. */
function makeRandomBytes(seed: number): (length: number) => Buffer {
  let state = seed;
  return (length: number) => {
    const buffer = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      buffer[i] = state & 0xff;
    }
    return buffer;
  };
}

// The route calls this on whatever bytes arrive, inside a try that would turn a
// throw into a 500. Reading a length-prefixed box header off a short buffer is
// exactly the kind of thing that throws, so check it does not.
test('never throws, whatever the bytes are', () => {
  const randomBytes = makeRandomBytes(0x5eed1234);

  for (let length = 0; length <= 400; length++) {
    for (const fill of [0x00, 0xff, 0x47, 0x66]) {
      assert.doesNotThrow(() => detectMimeType(Buffer.alloc(length, fill)));
    }
  }

  for (let i = 0; i < 5000; i++) {
    const buffer = randomBytes(i % 600);
    assert.doesNotThrow(() => detectMimeType(buffer));
  }
});

// Anything this returns becomes a stored extension and a served Content-Type.
// A type the route does not allow would be rejected outright, so returning one
// is dead weight at best; returning one the extension map has no entry for
// would store the file as .bin.
test('only ever returns a type the upload route allows', () => {
  const randomBytes = makeRandomBytes(0x0badc0de);
  const seen = new Set<string>();

  const inputs: Buffer[] = [
    file(SHARP_JPEG),
    file(SHARP_PNG),
    file(SHARP_WEBP),
    file(SHARP_GIF),
    file(SHARP_TIFF),
    file(SHARP_AVIF),
    isoBmff('isom', ['mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'iso4', 'iso5', 'iso6', 'mmp4']),
    isoBmff('heix', ['hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'msf1']),
    isoBmff('qt  '),
    Buffer.from('%PDF-1.4'),
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    Buffer.alloc(400, 0x47),
  ];
  for (let i = 0; i < 5000; i++) inputs.push(randomBytes(i % 600));

  for (const input of inputs) {
    const detected = detectMimeType(input);
    if (detected !== null) seen.add(detected);
  }

  for (const type of seen) {
    assert.ok(
      UPLOAD_ROUTE_ALLOWLIST.includes(type),
      `detectMimeType returned ${type}, which routes/uploads.ts does not accept`
    );
  }
});
