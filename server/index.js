const http = require("http");
const server = http.createServer();

server.on("request", async (req, res) => {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Headers", "*");
	if (req.method === "OPTIONS") {
		res.status = 200;
		res.end();
		return;
	}
	if (req.url === "/verify") {
		return;
	}

	if (req.url === "/merge") {
		return;
	}

	if (req.url === "/") {

		res.end();
	}
});

server.listen(3001, () => console.log("正在监听 3001 端口"));
