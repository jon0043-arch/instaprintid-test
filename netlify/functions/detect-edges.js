exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);
    const imgBuffer = Buffer.from(imageBase64, 'base64');

    const formData = new FormData();
    formData.append('file', new Blob([imgBuffer], { type: mediaType }), 'license.jpg');

    const res = await fetch('https://begone-gateway.webeazzy.com/api/process-image', {
      method: 'POST',
      headers: { 'X-API-Key': process.env.WEBEAZZY_API_KEY },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Webeazzy failed: ' + res.status + ' ' + errText);
    }

    // Webeazzy returns raw binary PNG
    const buffer = await res.arrayBuffer();
    const cleanedBase64 = Buffer.from(buffer).toString('base64');

    // Claude validates the cleaned image
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: cleanedBase64 }
            },
            {
              type: 'text',
              text: `You are validating a driver's license photo for printing. The background has been removed.

Check for these issues:
1. Is the image too blurry to read?
2. Is any edge of the license cut off or missing?
3. Is there severe glare blocking key text areas?
4. Is the license tilted more than 10 degrees?

Reply ONLY with raw JSON, no explanation, no markdown:
{"pass": true}
OR
{"pass": false, "reason": "brief specific reason"}

Examples of reasons: "image is too blurry", "bottom edge is cut off", "severe glare on photo area", "license is too tilted"`
            }
          ]
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content?.[0]?.text || '{"pass":true}';
    let validation = { pass: true };
    try {
      validation = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    } catch(e) {}

    if (!validation.pass) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retake: true, reason: validation.reason || 'Photo quality too low' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanedImage: cleanedBase64, rotation: 0 })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
