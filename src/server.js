import http from "http";

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot running\n");
  })
  .listen(process.env.PORT || 3000);
