const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../app/src/main/assets");
http
  .createServer((req, res) => {
    let file;
    try {
      file = path.resolve(
        root,
        "." +
          decodeURIComponent(
            req.url.split("?")[0] === "/"
              ? "/index.html"
              : req.url.split("?")[0],
          ),
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const type =
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      }[path.extname(file)] || "application/octet-stream";
    fs.readFile(file, (err, data) => {
      if (err) res.writeHead(404).end();
      else {
        res.setHeader("Content-Type", type);
        res.end(data);
      }
    });
  })
  .listen(8766, "127.0.0.1");
