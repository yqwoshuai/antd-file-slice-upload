const http = require("http");
const Controller = require("./controller");

const server = http.createServer();
const controller = new Controller();

server.on("request", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.writeHead(200, { "Content-Type": "application/json;charset=utf-8" });
  if (req.method === "OPTIONS") {
    res.status = 200;
    res.end();
    return;
  }
  if (req.url === "/verify") {
    return;
  }

  if (req.url === "/merge") {
    await controller.handleMerge(req, res);
    res.end(
      JSON.stringify({
        code: 200,
        message: "上传成功",
      })
    );
    return;
  }

  if (req.url === "/") {
    await controller.handleFormData(req, res);
  }
});

server.listen(3001, () => console.log("正在监听 3001 端口"));
