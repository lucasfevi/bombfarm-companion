/**
 * A local stand-in for the Premium API that says only one thing: whether the Premium tab is
 * visible (it is, unless a spec asks for the bar without it).
 * Pointed at through `BFC_PREMIUM_API_ORIGIN`, it puts the real tab in the top bar for a spec that
 * measures the bar as the widest build ships it. Every other route answers 503, so a sign-in
 * started against it ends as unreachable and nothing here holds state.
 */
import http from 'node:http';

export async function startPremiumVisibleStub({ visible = true } = {}) {
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/v1/premium/visibility') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ visible }));
      return;
    }
    response.writeHead(503);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
