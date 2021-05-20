// webworker引入脚本
self.importScripts("/node_modules/spark-md5/spark-md5.min.js");

// 生成文件 hash
self.onmessage = (e) => {
	const { fileChunkList } = e.data;
	const spark = new self.SparkMD5.ArrayBuffer();
	let percentage = 0;
	// 切片索引
	let count = 0;
	const loadNext = (index) => {
		const reader = new FileReader();
		// 读取文件切片
		reader.readAsArrayBuffer(fileChunkList[index].chunk);
		reader.onload = (e) => {
			count++;
			// 添加读取结果到spark ArrayBuffer对象
			spark.append(e.target.result);
			if (count === fileChunkList.length) {
				// 读取完毕生成hash抛出
				self.postMessage({
					percentage: 100,
					// 根据添加的所有切片读取结果，生成hash
					hash: spark.end(),
				});
				self.close();
			} else {
				percentage += 100 / fileChunkList.length;
				self.postMessage({
					percentage,
				});
				// 递归读取下一个切片
				loadNext(count);
			}
		};
	};
	loadNext(0);
};
