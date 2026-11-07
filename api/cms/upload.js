import fs from 'node:fs';
import path from 'node:path';

async function commitImageToGitHub({ owner, repo, branch = 'main', token, filename, base64Clean }) {
  const filePath = `public/textures/${filename}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  let sha = null;
  try {
    const getRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Portfolio-CMS',
      },
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }
  } catch {}

  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const putPayload = {
    message: `CMS Upload: ${filename}`,
    content: base64Clean,
    branch,
  };
  if (sha) {
    putPayload.sha = sha;
  }

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Portfolio-CMS',
    },
    body: JSON.stringify(putPayload),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub Upload error (${putRes.status}): ${errText}`);
  }

  const putJson = await putRes.json();
  return {
    success: true,
    commitSha: putJson.commit?.sha,
    downloadUrl: putJson.content?.download_url,
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { filename, base64Data, githubConfig } = body;
    if (!filename || !base64Data) {
      return res.status(400).json({ error: 'Missing filename or base64Data' });
    }

    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');

    const gh = githubConfig || {};
    const token = req.headers['x-github-token'] || gh.token || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
    const owner = req.headers['x-github-owner'] || gh.owner || process.env.GITHUB_OWNER || process.env.VITE_GITHUB_OWNER;
    const repo = req.headers['x-github-repo'] || gh.repo || process.env.GITHUB_REPO || process.env.VITE_GITHUB_REPO;
    const branch = req.headers['x-github-branch'] || gh.branch || process.env.GITHUB_BRANCH || process.env.VITE_GITHUB_BRANCH || 'main';

    let ghResult = null;
    if (token && owner && repo) {
      try {
        ghResult = await commitImageToGitHub({
          owner,
          repo,
          branch,
          token,
          filename: safeName,
          base64Clean,
        });
      } catch (err) {
        console.warn('GitHub image commit failed:', err);
      }
    }

    let localSaved = false;
    try {
      const buffer = Buffer.from(base64Clean, 'base64');
      const targetDir = path.resolve(process.cwd(), 'public/textures');
      fs.mkdirSync(targetDir, { recursive: true });
      const filePath = path.join(targetDir, safeName);
      fs.writeFileSync(filePath, buffer);
      localSaved = true;
    } catch {}

    const publicUrl = `/textures/${safeName}`;

    return res.status(200).json({
      success: true,
      url: publicUrl,
      filename: safeName,
      githubSynced: !!ghResult,
      localSaved,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
}

