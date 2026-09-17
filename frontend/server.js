const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const distDir = path.join(__dirname, "dist");
const port = process.env.PORT || 4173;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(distDir, urlPath);

    // Prevent path traversal outside dist/
    if (!filePath.startsWith(distDir)) {
      filePath = distDir;
    }

    fs.stat(filePath, (err, stat) => {
      // SPA fallback: unknown routes and directories resolve to index.html
      if (err || stat.isDirectory()) {
        filePath = path.join(distDir, "index.html");
      }

      fs.readFile(filePath, (readErr, data) => {
        if (readErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, {
          "Content-Type": mimeTypes[ext] || "application/octet-stream",
        });
        res.end(data);
      });
    });
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Serving ${distDir} on port ${port}`);
  });
