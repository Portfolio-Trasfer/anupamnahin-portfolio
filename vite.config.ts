import { defineConfig, type Plugin } from 'vite';
import glsl from 'vite-plugin-glsl';
import fs from 'node:fs';
import path from 'node:path';

async function commitToGitHub({
  owner,
  repo,
  branch = 'main',
  token,
  contentString,
  message = 'CMS Update: Portfolio Settings & Projects',
}: {
  owner: string;
  repo: string;
  branch?: string;
  token: string;
  contentString: string;
  message?: string;
}) {
  const filePath = 'public/data/portfolio.json';
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  let sha: string | null = null;
  try {
    const getRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Portfolio-CMS',
      },
    });
    if (getRes.ok) {
      const getJson: any = await getRes.json();
      sha = getJson.sha;
    }
  } catch (err) {
    console.warn('Could not fetch existing file SHA from GitHub:', err);
  }

  const base64Content = Buffer.from(contentString, 'utf-8').toString('base64');
  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const putPayload: any = {
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

  const putJson: any = await putRes.json();
  return {
    success: true,
    commitSha: putJson.commit?.sha,
    commitUrl: putJson.commit?.html_url,
  };
}

function portfolioCmsPlugin(): Plugin {
  const getPortfolioData = () => {
    try {
      const filePath = path.resolve(process.cwd(), 'public/data/portfolio.json');
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {}
    return null;
  };

  const savePortfolioData = (data: any) => {
    const filePath = path.resolve(process.cwd(), 'public/data/portfolio.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  };

  return {
    name: 'portfolio-cms-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // 1. Device Lock Endpoint
        if (url === '/api/device-lock') {
          res.setHeader('Content-Type', 'application/json');

          if (req.method === 'GET') {
            const data = getPortfolioData();
            res.statusCode = 200;
            res.end(JSON.stringify({ claimedDeviceHash: data?.settings?.claimedDeviceHash || null }));
            return;
          }

          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                const data = getPortfolioData() || { settings: {}, projects: [] };

                if (parsed.action === 'reset') {
                  data.settings.claimedDeviceHash = null;
                  savePortfolioData(data);
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, message: 'Device lock reset' }));
                  return;
                }

                if (data.settings.claimedDeviceHash) {
                  res.statusCode = 403;
                  res.end(JSON.stringify({ error: 'Device already claimed' }));
                  return;
                }

                data.settings.claimedDeviceHash = parsed.claimedDeviceHash;
                savePortfolioData(data);
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, claimedDeviceHash: parsed.claimedDeviceHash }));
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
              }
            });
            return;
          }
        }

        // 2. CMS Save Endpoint
        if (req.method === 'POST' && url === '/api/cms/save') {
          try {
            let body = '';
            req.on('data', (chunk: Buffer) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const data = parsed.projects && parsed.settings ? parsed : (parsed.data || parsed);
                const ghConfig = parsed.githubConfig || {};

                // Always write locally in dev server
                savePortfolioData(data);

                // Check for GitHub credentials from request body, headers, or env
                const githubToken =
                  parsed.githubToken ||
                  (req.headers['x-github-token'] as string) ||
                  (req.headers['authorization']
                    ? (req.headers['authorization'] as string).replace(/^Bearer\s+/i, '')
                    : '') ||
                  ghConfig.token ||
                  process.env.GITHUB_TOKEN ||
                  process.env.VITE_GITHUB_TOKEN;
                const owner =
                  parsed.owner ||
                  (req.headers['x-github-owner'] as string) ||
                  ghConfig.owner ||
                  process.env.GITHUB_OWNER ||
                  process.env.VITE_GITHUB_OWNER;
                const repo =
                  parsed.repo ||
                  (req.headers['x-github-repo'] as string) ||
                  ghConfig.repo ||
                  process.env.GITHUB_REPO ||
                  process.env.VITE_GITHUB_REPO;
                const branch =
                  parsed.branch ||
                  (req.headers['x-github-branch'] as string) ||
                  ghConfig.branch ||
                  process.env.GITHUB_BRANCH ||
                  process.env.VITE_GITHUB_BRANCH ||
                  'main';

                let githubSynced = false;
                let commitUrl = '';
                let warning = '';

                if (githubToken && owner && repo) {
                  try {
                    const ghResult = await commitToGitHub({
                      owner,
                      repo,
                      branch,
                      token: githubToken,
                      contentString: JSON.stringify(
                        { settings: data.settings, projects: data.projects },
                        null,
                        2
                      ),
                      message: 'CMS Update: Portfolio Settings & Projects',
                    });
                    githubSynced = true;
                    commitUrl = ghResult.commitUrl || '';
                  } catch (ghErr) {
                    warning = `GitHub auto-commit failed: ${String(ghErr)}`;
                  }
                }

                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(
                  JSON.stringify({
                    success: true,
                    message: githubSynced
                      ? 'Saved locally & committed to GitHub!'
                      : 'Portfolio saved locally to public/data/portfolio.json',
                    githubSynced,
                    commitUrl,
                    warning: warning || undefined,
                  })
                );
              } catch (parseErr) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
              }
            });
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: String(err) }));
          }
          return;
        }

        // 3. CMS Image Upload Endpoint
        if (req.method === 'POST' && url === '/api/cms/upload') {
          try {
            let body = '';
            req.on('data', (chunk: Buffer) => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                const { filename, base64Data } = JSON.parse(body);
                if (!filename || !base64Data) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ success: false, error: 'Missing filename or base64Data' }));
                  return;
                }

                const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
                const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Clean, 'base64');

                const targetDir = path.resolve(process.cwd(), 'public/textures');
                fs.mkdirSync(targetDir, { recursive: true });
                const filePath = path.join(targetDir, safeName);
                fs.writeFileSync(filePath, buffer);

                const publicUrl = `/textures/${safeName}`;
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, url: publicUrl, filename: safeName, localSaved: true }));
              } catch (uploadErr) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Failed to process image upload' }));
              }
            });
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: String(err) }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      warnDuplicatedImports: true,
      defaultExtension: 'glsl',
      root: '/',
    }),
    portfolioCmsPlugin(),
  ],
  server: {
    port: 3000,
    open: true,
  },
});
