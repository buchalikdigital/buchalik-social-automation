const GRAPH_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graphPost(pathSegment, params) {
  const url = new URL(`${GRAPH_BASE}/${pathSegment}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`Graph API error on ${pathSegment}: ${JSON.stringify(body)}`);
  }
  return body;
}

/**
 * Publishes one image to an Instagram Business/Creator account.
 * imageUrl MUST be publicly reachable — the Graph API fetches it server-side.
 */
export async function publishInstagram({ accessToken, igUserId, imageUrl, caption }) {
  const { id: creationId } = await graphPost(`${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });
  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  return published.id;
}

/** Publishes a photo post to a Facebook Page. imageUrl must be public. */
export async function publishFacebookPhoto({ accessToken, pageId, imageUrl, caption }) {
  const result = await graphPost(`${pageId}/photos`, {
    url: imageUrl,
    caption,
    access_token: accessToken,
  });
  return result.post_id || result.id;
}
