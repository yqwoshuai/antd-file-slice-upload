import React, { useState } from "react";
import { Button, Upload } from "antd";
import axios from "axios";
import "./index.css";

// 切片大小 1M
const FILE_CHUNK_SIZE = 1 * 1024 * 1024;

// 切片文件
const createFileChunk = (file, size = FILE_CHUNK_SIZE) => {
	const fileChunkList = [];
	let cur = 0;
	while (cur < file.size) {
		fileChunkList.push({ file: file.slice(cur, cur + size), name: file.name });
		cur += size;
	}
	return fileChunkList;
};

function App() {
	const [nowFile, setNowFile] = useState(null);
	const [fileList, setFileList] = useState([]);

	const handleFileChange = (e) => {
		if (!e.fileList[0]) return;
	};

	const beforeUpload = (e) => {
		const chunkList = createFileChunk(e).map(({ file, name }, index) => {
			return {
				chunk: file,
				size: file.size,
				percent: 0,
				name: name + " -" + (index + 1),
			};
		});
		setFileList(chunkList);
	};

	const handleUpload = (e) => {
		const data = fileList.map(({ chunk }, index) => {
			const formData = new FormData();
			formData.append("chunk", chunk);
			formData.append("filename", e.file.name + " -" + (index + 1));
			return { formData, index };
		});

		const requestList = data.map(({ formData, index }) => {
			return axios({
				url: "http://localhost:3001/",
				method: "post",
				data: formData,
			});
		});

		Promise.all(requestList);
	};

	const props = {
		action: "http://localhost:3001/",
		progress: {
			strokeColor: {
				"0%": "#108ee9",
				"100%": "#87d068",
			},
			strokeWidth: 3,
			format: (percent) => `${parseFloat(percent.toFixed(2))}%`,
		},
		onChange: handleFileChange,
		customRequest: handleUpload,
		beforeUpload: beforeUpload,
		fileList,
	};

	return (
		<div className="app">
			<Upload {...props}>
				<Button>点击上传</Button>
			</Upload>
		</div>
	);
}

export default App;
