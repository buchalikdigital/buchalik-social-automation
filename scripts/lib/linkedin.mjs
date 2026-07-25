import { readFile } from 'node:fs/promises';

const API_BASE = 'https://api.linkedin.com/v2';

async function linkedinFetch(pathSegment, { accessToken, method = 'GET', body, extraHeaders = {} }) {
  const res = await fetch(`${API_BASE}/${pathSegment}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn API error on ${pathSegment}: ${res.status} ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

async function registerImageUpload({ accessToken, personUrn }) {
  const result = await linkedinFetch('assets?action=registerUpload', {
    accessToken,
    method: 'POST',
    body: {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [
          { relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' },
        ],
      },
    },
  });
  const uploadUrl =
    result.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  return { uploadUrl, asset: result.value.asset };
}

async function uploadImageBinary({ accessToken, uploadUrl, imagePath }) {
  const bytes = await readFile(imagePath);
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`LinkedIn image upload failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Publishes an image post to a personal LinkedIn profile.
 * Requires the "Share on LinkedIn" (w_member_social) product on the app —
 * confirm this is granted before relying on it, see README.
 */
export async function publishLinkedInPost({ accessToken, personUrn, imagePath, caption }) {
  const { uploadUrl, asset } = await registerImageUpload({ accessToken, personUrn });
  await uploadImageBinary({ accessToken, uploadUrl, imagePath });

  const post = await linkedinFetch('ugcPosts', {
    accessToken,
    method: 'POST',
    body: {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: caption },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', media: asset }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
  });
  return post?.id ?? asset;
}
