export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filename, x-userhash, x-reqtype, x-time');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawFilename = req.headers['x-filename'] || 'file.bin';
    const filename = decodeURIComponent(rawFilename);
    const userhash = req.headers['x-userhash'] || '';
    const reqtype = req.headers['x-reqtype'] || 'fileupload';
    const time = req.headers['x-time'] || '72h';
    const isLitterbox = reqtype === 'litterbox';
    const targetUrl = isLitterbox 
      ? 'https://litterbox.catbox.moe/resources/internals/api.php'
      : 'https://catbox.moe/user/api.php';

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const form = new FormData();
    form.append('reqtype', 'fileupload');
    if (isLitterbox) {
      form.append('time', time);
    }
    if (userhash && userhash.trim()) {
      form.append('userhash', userhash.trim());
    }
    const blob = new Blob([buffer]);
    form.append('fileToUpload', blob, filename);

    const catboxRes = await fetch(targetUrl, {
      method: 'POST',
      body: form,
      headers: {
        'User-Agent': 'CloudAssetDubClient/1.0',
      },
    });

    const resultText = (await catboxRes.text()).trim();
    if (catboxRes.ok && resultText.startsWith('http')) {
      return res.status(200).json({ success: true, url: resultText });
    }

    return res.status(catboxRes.status || 500).json({ success: false, error: resultText });
  } catch (err) {
    console.error('Catbox proxy error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
