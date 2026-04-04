export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: body,
    });

    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(response.status).send(text);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
