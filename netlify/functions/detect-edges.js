exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { imageBase64, mediaType } = JSON.parse(event.body);
    const imgBuffer = Buffer.from(imageBase64, 'base64');

    const formData = new FormData();
    formData.append('image_file', new Blob([imgBuffer], { type: mediaType }), 'license.jpg');
    formData.append('size', 'auto');
    formData.append('format', 'png');

    const res = await fetch('https://begone-gateway.webeazzy.com/api/process-image', {
      method: 'POST',
      headers: { 'X-API-Key': process.env.WEBEAZZY_API_KEY },
      body: formData
    });

    console.log('Webeazzy status:', res.status);
    console.log('Webeazzy content-type:', res.headers.get('content-type'));

    if (!res.ok) {
      const errText = await res.text();
      console.log('Webeazzy error body:', errText);
      throw new Error('Webeazzy failed: ' + res.status + ' ' + errText);
    }

    const contentType = res.headers.get('content-type') || '';
    let cleanedBase64;

    if (contentType.includes('application/json')) {
      const json = await res.json();
      console.log('Webeazzy JSON:', JSON.stringify(json));
      if (json.result_b64) {
        cleanedBase64 = json.result_b64;
      } else if (json.result_url) {
        const imgRes = await fetch(json.result_url);
        const imgBuf = await imgRes.arrayBuffer();
        cleanedBase64 = Buffer.from(imgBuf).toString('base64');
      } else {
        throw new Error('Webeazzy JSON missing image: ' + JSON.stringify(json));
      }
    } else {
      const buffer = await res.arrayBuffer();
      cleanedBase64 = Buffer.from(buffer).toString('base64');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cleanedImage: cleanedBase64, rotation: 0 })
    };
  } catch (err) {
    console.log('Error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
