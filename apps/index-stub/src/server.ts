import { createServer } from 'node:http';

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Mock index server' }));
});

server.listen(PORT, () => {
  console.log(`Index stub running on http://localhost:${PORT}`);
});
