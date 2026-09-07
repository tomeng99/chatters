/**
 * Media messages carry a URL as their (encrypted) content, so the URL arrives
 * from whoever sent the message rather than from the server. Rendering it
 * verbatim would let a sender point a recipient's <Image> at any host on the
 * internet, which fetches on its own with no interaction: the recipient's IP,
 * user agent and the exact moment they opened the chat all leak to a third
 * party the app never talks to otherwise.
 *
 * The server cannot police this — the content is ciphertext by the time it
 * gets there — so the client only accepts what the upload endpoint actually
 * hands out, and treats anything else as unrenderable.
 */

// Every upload the server has ever returned is `/uploads/<uuid><ext>`
// (see server/src/routes/uploads.ts). Matching a single path segment of safe
// characters accepts all of those and rejects absolute URLs, protocol-relative
// `//host/...` URLs, traversal, query strings and fragments alike.
const UPLOADS_PREFIX = '/uploads/';
const SAFE_FILE_NAME = /^[A-Za-z0-9._-]+$/;

export function isUploadPath(content: string): boolean {
  if (typeof content !== 'string' || !content.startsWith(UPLOADS_PREFIX)) return false;

  const fileName = content.slice(UPLOADS_PREFIX.length);
  if (fileName === '.' || fileName === '..') return false;

  return SAFE_FILE_NAME.test(fileName);
}

/**
 * Turn a media message's content into a URL safe to hand to <Image>, the video
 * player or Linking. Returns null when the content is not one of this server's
 * own uploads, in which case the caller should show an unavailable state
 * instead of fetching anything.
 */
export function resolveMediaUrl(content: string, apiBase: string): string | null {
  if (!isUploadPath(content)) return null;
  return `${apiBase}${content}`;
}
