const path = require("path");
const fse = require("fs-extra");
const multiparty = require("multiparty");

// 上传文件保存的地址
const UPLOAD_DIR = path.resolve(__dirname, "..", "upload");
// 获取文件后缀名
const extractExt = (filename) =>
	filename.slice(filename.lastIndexOf(".", filename.length));

const pipeStream = (path, writeStream) =>
	new Promise((resolve) => {
		// 创建文件可读流
		const readStream = fse.createReadStream(path);
		readStream.on("end", () => {
			fse.unlinkSync(path);
			resolve();
		});
		readStream.pipe(writeStream);
	});

// 合并切片
const mergeFileChunk = async (filePath, fileHash, size) => {
	const chunkDir = path.resolve(UPLOAD_DIR, fileHash);
	const chunkPaths = await fse.readdir(chunkDir);
	// 按照前端给切片添加的后缀排序
	chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
	await Promise.all(
		chunkPaths.map((chunkPath, index) =>
			pipeStream(
				path.resolve(chunkDir, chunkPath),
				// 创建文件可写流，根据前端传入的size读取对应的位置，并发合并文件
				fse.createWriteStream(filePath, {
					start: index * size,
					end: (index + 1) * size,
				})
			)
		)
	);
	// 合并后删除临时文件目录
	fse.rmdirSync(chunkDir);
};

const resolvePost = (req) =>
	new Promise((resolve) => {
		let chunk = "";
		req.on("data", (data) => {
			chunk += data;
		});
		req.on("end", () => {
			resolve(JSON.parse(chunk));
		});
	});

const createUploadedList = async (fileHash) => {
	return fse.existsSync(path.resolve(UPLOAD_DIR, fileHash))
		? await fse.readdir(path.resolve(UPLOAD_DIR, fileHash))
		: "";
};

module.exports = class {
	async handleFormData(req, res) {
		// 使用multipart包处理前端传过来的formData
		const multipart = new multiparty.Form();

		multipart.parse(req, async (err, fields, files) => {
			if (err) {
				console.error(err);
				res.status = 500;
				res.end(
					JSON.stringify({
						code: 500,
						message: "文件上传失败",
					})
				);
				return;
			}
			// 读取文件信息
			const [chunk] = files.chunk;
			const [hash] = fields.hash;
			const [fileHash] = fields.fileHash;
			const [filename] = fields.filename;
			const filePath = path.resolve(
				UPLOAD_DIR,
				`${fileHash}${extractExt(filename)}`
			);
			const chunkDir = path.resolve(UPLOAD_DIR, fileHash);

			if (fse.existsSync(filePath)) {
				res.end(
					JSON.stringify({
						code: 500,
						message: "文件已存在",
					})
				);
				return;
			}

			// 切片储存文件夹不存在时创建文件夹
			if (!fse.existsSync(chunkDir)) {
				await fse.mkdirs(chunkDir);
			}

			// 移动切片
			await fse.move(chunk.path, path.resolve(chunkDir, hash));

			res.end(
				JSON.stringify({
					code: 200,
					message: "文件切片上传成功",
				})
			);
		});
	}

	// 合并切片
	async handleMerge(req, res) {
		const data = await resolvePost(req);
		const { fileHash, filename, size } = data;
		const ext = extractExt(filename);
		const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
		await mergeFileChunk(filePath, fileHash, size);
	}

	// 验证文件或文件的部分切片是否存在
	async handleVerifyUpload(req, res) {
		const data = await resolvePost(req);
		const { fileHash, filename } = data;
		const ext = extractExt(filename);
		const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`);
		if (fse.existsSync(filePath)) {
			res.end(
				JSON.stringify({
					shouldUpload: false,
				})
			);
		} else {
			res.end(
				JSON.stringify({
					shouldUpload: true,
					uploadedList: await createUploadedList(fileHash),
				})
			);
		}
	}
};
