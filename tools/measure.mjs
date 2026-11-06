// HTTP transport check against this project's running loopback preview.
// Not a browser navigation, device simulation, or Web Vitals measurement.
import http from 'node:http';
import { writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const port = Number(process.env.PORT || 4333);
const paths = ['', 'style.css', 'app.js', 'assets/citrus.svg', 'assets/sun.svg'];
function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path, agent: false, headers: { 'Accept-Encoding': 'gzip' } }, res => {
      const socket = res.socket;
      let bodyBytes = 0;
      res.on('data', chunk => { bodyBytes += chunk.length; });
      res.on('end', () => resolve({ path, status: res.statusCode, encoding: res.headers['content-encoding'] || 'identity', bodyBytes, responseWireBytes: socket.bytesRead }));
    });
    req.on('error', reject);
  });
}
const requests = [];
for (const prefix of ['/', '/portfolio/d3/']) {
  for (const path of [...paths, 'assets/pear.svg', 'assets/berry.svg']) requests.push(await get(prefix + path));
}
const initial = requests.slice(0, paths.length);
const results = {
  timestamp: new Date().toISOString(), node: process.version,
  method: 'Node HTTP/1.1, new connection per resource, Accept-Encoding gzip, no client cache, loopback; responseWireBytes counts actual response headers and body, excludes request/TCP overhead. Not a browser or mobile-network measurement.',
  initialBodyBytes: initial.reduce((n,r) => n+r.bodyBytes,0),
  initialResponseWireBytes: initial.reduce((n,r) => n+r.responseWireBytes,0),
  ownJsGzipBytes: gzipSync(await readFile(new URL('../dist/app.js',import.meta.url))).length,
  requests
};
await writeFile(new URL('../docs/evidence/transport.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
if(requests.some(r=>r.status!==200))process.exitCode=1;
