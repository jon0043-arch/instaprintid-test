exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 }
            },
            {
              type: 'text',
              text: 'This image contains a driver\'s license or ID card photographed at an angle. Identify the 4 corners of the card itself (not the photo). Respond ONLY with raw JSON, no markdown, no backticks, in this exact format: {"topLeft":{"x":0.12,"y":0.08},"topRight":{"x":0.91,"y":0.11},"bottomRight":{"x":0.93,"y":0.88},"bottomLeft":{"x":0.10,"y":0.85}} where x and y are fractions of image width and height (0 to 1). Be precise to the card edges.'
            }
          ]
        }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Vision failed: ' + res.status + ' ' + errText);
    }

    const data = await res.json();
    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim();

    const corners = JSON.parse(text);

    // sanity check
    const pts = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    for (const p of pts) {
      if (!corners[p] || typeof corners[p].x !== 'number' || typeof corners[p].y !== 'number') {
        throw new Error('Bad corner data');
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ corners })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
