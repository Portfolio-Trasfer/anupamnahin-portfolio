import fs from 'node:fs';
import path from 'node:path';

async function commitToGitHub({
  owner,
  repo,
  branch = 'main',
  token,
  contentString,
  message = 'CMS Update: Portfolio Settings & Projects',
}) {
  const filePath = 'public/data/portfolio.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  let sha = null;
  try {
    const getRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Portfolio-CMS',
      },
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }
  } catch (err) {
    console.warn('Could not fetch existing file SHA from GitHub:', err);
  }

  const base64Content = Buffer.from(contentString, 'utf-8').toString('base64');
  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const putPayload = {
    message,
    content: base64Content,
    branch,
  };
  if (sha) {
    putPayload.sha = sha;
  }

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Portfolio-CMS',
    },
    body: JSON.stringify(putPayload),
  });

  if (!putRes.ok) {
    const errText = await putRes.text();
    throw new Error(`GitHub API error (${putRes.status}): ${errText}`);
  }

  const putJson = await putRes.json();
  return {
    success: true,
    commitSha: putJson.commit?.sha,
    commitUrl: putJson.commit?.html_url,
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

    const portfolioData = body.projects && body.settings ? body : (body.data || body);
    const ghConfig = body.githubConfig || {};

    const githubToken =
      body.githubToken ||
      req.headers['x-github-token'] ||
      (req.headers['authorization'] ? req.headers['authorization'].replace(/^Bearer\s+/i, '') : '') ||
      ghConfig.token ||
      process.env.GITHUB_TOKEN ||
      process.env.VITE_GITHUB_TOKEN;
    const owner =
      body.owner ||
      req.headers['x-github-owner'] ||
      ghConfig.owner ||
      process.env.GITHUB_OWNER ||
      process.env.VITE_GITHUB_OWNER;
    const repo =
      body.repo ||
      req.headers['x-github-repo'] ||
      ghConfig.repo ||
      process.env.GITHUB_REPO ||
      process.env.VITE_GITHUB_REPO;
    const branch =
      body.branch ||
      req.headers['x-github-branch'] ||
      ghConfig.branch ||
      process.env.GITHUB_BRANCH ||
      process.env.VITE_GITHUB_BRANCH ||
      'main';

    const cleanData = {
      settings: portfolioData.settings,
      projects: portfolioData.projects,
    };
    const contentString = JSON.stringify(cleanData, null, 2);

    let githubResult = null;
    let githubError = null;
    if (githubToken && owner && repo) {
      try {
        githubResult = await commitToGitHub({
          owner,
          repo,
          branch,
          token: githubToken,
          contentString,
          message: 'CMS Update: Portfolio Settings & Projects',
        });
      } catch (ghErr) {
        githubError = String(ghErr);
        console.error('GitHub auto-commit error:', ghErr);
      }
    }

    let localWritten = false;
    try {
      const filePath = path.resolve(process.cwd(), 'public/data/portfolio.json');
      fs.writeFileSync(filePath, contentString, 'utf-8');
      localWritten = true;
    } catch {
      // Ephemeral or read-only on Vercel
    }

    if (githubResult) {
      return res.status(200).json({
        success: true,
        message: 'Committed to GitHub successfully! Redeployment triggered.',
        githubSynced: true,
        commitUrl: githubResult.commitUrl,
        commitSha: githubResult.commitSha,
        localWritten,
      });
    }

    if (localWritten) {
      return res.status(200).json({
        success: true,
        message: 'Saved locally to public/data/portfolio.json',
        githubSynced: false,
        warning: githubError ? `GitHub commit failed: ${githubError}` : undefined,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Saved to browser cache. Configure GitHub credentials in Admin Panel to commit globally.',
      githubSynced: false,
      warning: githubError ? `GitHub commit failed: ${githubError}` : 'No GitHub token configured for remote sync.',
    });
  } catch (err) {
    console.error('Save error:', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
}
