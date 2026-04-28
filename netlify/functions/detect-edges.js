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

    console.log('STATUS:', res.status);
    console.log('CONTENT-TYPE:', res.headers.get('content-type'));

    const rawText = await res.text();
    console.log('RAW RESPONSE:', rawText.substring(0, 300));

    if (!res.ok) {
      throw new Error('Webeazzy failed: ' + res.status + ' ' + rawText);
    }

    // Try to parse as JSON first
    let cleanedBase64;
    try {
      const json = JSON.parse(rawText);
      console.log('JSON KEYS:', Object.keys(json));
      cleanedBase64 = json.result_b64 || json.image || json.data || json.output;
      if (!cleanedBase64) throw new Error('No image field in JSON: ' + JSON.stringify(Object.keys(json)));
    } catch(e) {
      // Not JSON — treat as binary PNG (already read as text, re-fetch won't work)
      // Return error so we can see what happened
      console.log('JSON parse failed:', e.message);
      throw new Error('Unexpected response format');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanedImage: cleanedBase64, rotation: 0 })
    };

  } catch (err) {
    console.log('ERROR:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
