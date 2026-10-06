const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY;
const root = __dirname;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 12000) {
        reject(new Error('Request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

async function handleAsk(request, response) {
  if (!apiKey) {
    sendJson(response, 503, { error: 'Gemini is not configured yet. Set GEMINI_API_KEY in your environment, then restart the server.' });
    return;
  }

  let data;
  try {
    data = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  const question = typeof data.question === 'string' ? data.question.trim().slice(0, 4000) : '';
  const level = typeof data.level === 'string' ? data.level : 'School';
  const mode = typeof data.mode === 'string' ? data.mode : 'Explain';
  if (!question) {
    sendJson(response, 400, { error: 'Enter a topic or question first.' });
    return;
  }

  const instructions = {
    Explain: 'Explain the topic clearly, accurately, and in an encouraging way. Start with the core idea, then build understanding with an example. Use plain text and concise paragraphs.',
    'Quiz me': 'Create a short interactive quiz of 5 questions about the topic. Ask only the first question initially, then wait for the learner to respond. Keep questions appropriate to the learner level.',
    'Study plan': 'Create a practical, achievable study plan for the topic. Break it into ordered sessions with goals, active practice, and a brief self-check.'
  };
  const instruction = instructions[mode] || instructions.Explain;
  const prompt = `You are Edu Gemini, a thoughtful learning assistant. The learner's level is ${level}. Mode: ${mode}. ${instruction}\n\nTopic or question: ${question}`;

  try {
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const result = await geminiResponse.json();
    if (!geminiResponse.ok) {
      const message = result.error?.message || 'Gemini could not complete the request.';
      sendJson(response, geminiResponse.status >= 500 ? 502 : geminiResponse.status, { error: message });
      return;
    }
    const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    if (!answer) {
      sendJson(response, 502, { error: 'Gemini returned an empty answer. Please try again.' });
      return;
    }
    sendJson(response, 200, { answer });
  } catch {
    sendJson(response, 502, { error: 'Could not reach Gemini. Check your connection and try again.' });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/api/ask' && request.method === 'POST') {
    await handleAsk(request, response);
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API route not found.' });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const requestedPath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(root, requestedPath);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html')) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
});

server.listen(port, () => {
  console.log(`Edu Gemini is running at http://localhost:${port}`);
});
