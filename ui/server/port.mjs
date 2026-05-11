import { createServer } from "node:net";

export function findFreePort(start = 4242, end = 4299) {
  return new Promise((resolve, reject) => {
    function attempt(port) {
      if (port > end) return reject(new Error(`No free port in ${start}-${end}`));
      const srv = createServer();
      srv.once("error", () => attempt(port + 1));
      srv.once("listening", () => srv.close(() => resolve(port)));
      srv.listen(port);
    }
    attempt(start);
  });
}
