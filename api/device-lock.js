import fs from 'node:fs';
import path from 'node:path';

// In-memory cache for serverless lifecycle
let cachedDeviceHash = null;

function getPortfolioData() {
  try {
    const filePath = path.resolve(process.cwd(), 'public/data/portfolio.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading portfolio.json in serverless function:', err);
  }
  return null;
}

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const portfolio = getPortfolioData();
  const currentClaimed = cachedDeviceHash || portfolio?.settings?.claimedDeviceHash || null;

  if (req.method === 'GET') {
    return res.status(200).json({ claimedDeviceHash: currentClaimed });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    // Reset action
    if (body?.action === 'reset') {
      cachedDeviceHash = null;
      if (portfolio) {
        portfolio.settings.claimedDeviceHash = null;
        try {
          const filePath = path.resolve(process.cwd(), 'public/data/portfolio.json');
          fs.writeFileSync(filePath, JSON.stringify(portfolio, null, 2), 'utf-8');
        } catch {}
      }
      return res.status(200).json({ success: true, message: 'Device lock reset' });
    }

    // Check if already claimed
    if (currentClaimed) {
      return res.status(403).json({
        error: 'Forbidden: Admin is already claimed by the primary device',
        claimedDeviceHash: currentClaimed,
      });
    }

    const newHash = body?.claimedDeviceHash;
    if (!newHash) {
      return res.status(400).json({ error: 'Missing claimedDeviceHash' });
    }

    cachedDeviceHash = newHash;
    if (portfolio) {
      portfolio.settings.claimedDeviceHash = newHash;
      try {
        const filePath = path.resolve(process.cwd(), 'public/data/portfolio.json');
        fs.writeFileSync(filePath, JSON.stringify(portfolio, null, 2), 'utf-8');
      } catch {}
    }

    return res.status(200).json({ success: true, claimedDeviceHash: newHash });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

