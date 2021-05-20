import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Upload,
  Table,
  Progress,
  Row,
  Col,
  Space,
  message,
} from "antd";
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

// 上传状态
const uploadState = {
  NO_UPLOAD: 1, // 未上传
  CREATE_HASH: 2, // 正在计算hash
  WAIT_UPLOAD: 3, // hash计算完毕等待上传
  IS_UPLOADING: 4, // 正在上传
  UPLOAD_PAUSE: 5, // 暂停上传
  UPLOAD_DONE: 6, // 上传完毕
};

const columns = [
  {
    title: "切片名称",
    dataIndex: "name",
  },
  {
    title: "切片大小",
    dataIndex: "size",
    width: 150,
  },
  {
    title: "加载进度",
    dataIndex: "percent",
    width: 550,
    render: (row) => {
      return <Progress percent={row} />;
    },
  },
];

function App() {
  // 当前正在上传的文件
  const [nowFile, setNowFile] = useState(null);
  // 文件传输状态
  const [status, setStatus] = useState(uploadState.NO_UPLOAD);
  // 切片列表
  const [fileList, setFileList] = useState([]);
  // 文件传输总进度
  const [totalPercent, setTotalPercent] = useState(0);
  // 文件hash计算进度
  const [hashPercent, setHashPercent] = useState(0);
  // 文件hash
  const [fileHash, setFileHash] = useState("");
  // 是否展示切片列表
  const [showChunkList, setShowChunkList] = useState(false);
  // 使用webworker计算文件hash
  const worker = useRef(null);
  // 切片请求列表的取消模块
  const requestCancelList = useRef([]);

  // 清空上传组件
  const clearFile = () => {
    worker.current?.terminate();
    worker.current = null;
    setNowFile(null);
    setFileList([]);
    setTotalPercent(0);
    setHashPercent(0);
    setShowChunkList(false);
    setFileHash("");
    // 取消正在进行的请求
    if (status === uploadState.IS_UPLOADING) {
      requestCancelList.current.forEach((item) => item.cancel());
    }
    requestCancelList.current = [];
    setStatus(uploadState.NO_UPLOAD);
  };

  // 计算文件hash
  const createHash = (fileChunkList) => {
    return new Promise((resolve) => {
      // 开启webworker计算hash
      worker.current = new Worker("/hash.js");
      // 传入切片列表进行计算
      worker.current.postMessage({ fileChunkList });
      // 计算完毕传出文件hash
      worker.current.onmessage = (e) => {
        const { percentage, hash } = e.data;
        setHashPercent(percentage.toFixed(2));
        if (hash) {
          resolve(hash);
        }
      };
    });
  };

  // 传文件前处理文件
  // antd的Upload组件的beforeUpload返回false时会停止上传，之后自定义上传逻辑
  const beforeUpload = (e) => {
    setStatus(uploadState.CREATE_HASH);
    // beforeUpload入参为选择的文件
    setNowFile(e);
    // 创建文件切片信息
    const chunkList = createFileChunk(e).map(({ file, name }, index) => {
      return {
        chunk: file,
        size: file.size,
        percent: 0,
        name: name + " -" + (index + 1),
        index,
      };
    });
    // 创建切片列表hash
    createHash(chunkList).then((res) => {
      chunkList.forEach((item, index) => {
        // 给切片列表的hash标明顺序
        item.hash = res + "-" + index;
      });
      setFileHash(res);
      setFileList(chunkList);
      setStatus(uploadState.WAIT_UPLOAD);
    });
    return false;
  };

  // 验证当前文件是否已经上传过或者部分上传过
  const verifyUpload = async (filename, fileHash) => {
    const { data } = await axios({
      url: "http://localhost:3001/verify",
      method: "post",
      headers: {
        "content-type": "application/json",
      },
      data: JSON.stringify({
        fileHash: fileHash,
        filename: filename,
      }),
    });
    return data;
  };

  // 通知后端合并文件切片
  const mergeRequest = async () => {
    await axios({
      url: "http://localhost:3001/merge",
      method: "post",
      headers: {
        "content-type": "application/json",
      },
      data: JSON.stringify({
        size: FILE_CHUNK_SIZE,
        fileHash: fileHash,
        filename: nowFile.name,
      }),
    }).then((res) => {
      setStatus(uploadState.UPLOAD_DONE);
      message.success("上传成功");
    });
  };

  // 暂停上传
  const handlePause = () => {
    setStatus(uploadState.UPLOAD_PAUSE);
    // 取消当前正在进行的请求
    requestCancelList.current.forEach((item) => item.cancel());
    requestCancelList.current = [];
  };

  // 验证文件后创建请求
  const handleUpload = async () => {
    const { shouldUpload, uploadedList } = await verifyUpload(
      nowFile.name,
      fileHash
    );
    uploadBegin(shouldUpload, uploadedList);
  };

  // 创建请求
  const uploadBegin = async (shouldUpload, uploadedList) => {
    if (!shouldUpload) {
      message.error("文件已上传，请勿重复上传");
      clearFile();
      return;
    }
    setStatus(uploadState.IS_UPLOADING);
    setShowChunkList(true);
    requestCancelList.current = [];
    // 已经上传完成的切片进度为100%
    setFileList((preList) =>
      preList.map((item) => {
        item.percent = uploadedList.includes(item.hash) ? 100 : 0;
        return item;
      })
    );
    // 过滤已经完成的请求
    const nowRequestList = fileList
      .filter(({ hash }) => !uploadedList.includes(hash))
      .map(({ chunk, hash, index }) => {
        // 创建FormData传文件信息
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("hash", hash);
        formData.append("filename", nowFile.name);
        formData.append("fileHash", fileHash);
        return { formData, index };
      })
      .map(async ({ formData, index }) => {
        // axios取消请求模块需要用到axios.CancelToken
        const CancelToken = axios.CancelToken;
        const source = CancelToken.source();
        requestCancelList.current.push(source);
        return axios({
          url: "http://localhost:3001/",
          method: "post",
          data: formData,
          cancelToken: source.token,
          onUploadProgress: (e) => {
            // 更新切片的请求进度
            const newList = fileList.map((item) => {
              if (item.index === index) {
                item.percent = ((e.loaded / e.total) * 100).toFixed(2);
              }
              return item;
            });
            setFileList(newList);
          },
        });
      });
    // 发起请求
    await Promise.all(nowRequestList);
    // 通知后端合并文件
    mergeRequest();
  };

  // 切片列表内容变化时更新上传总进度
  useEffect(() => {
    if (fileList.length > 0 && status === uploadState.IS_UPLOADING) {
      const totalLoad = fileList
        .map((item) => item.size * item.percent)
        .reduce((pre, cur) => pre + cur);
      const curPercent = (totalLoad / nowFile.size).toFixed(2);
      // 暂停请求再次发起时，有些切片已经上传一部分，需要重新上传，会导致总进度条后退
      // 取两者的最小值不让总进度条倒退
      setTotalPercent((pre) =>
        Number(curPercent) > Number(pre) ? curPercent : pre
      );
    }
  }, [fileList]);

  
  const props = {
    // 隐藏默认的文件列表
    showUploadList: false,
    beforeUpload: beforeUpload,
  };

  return (
    <div className="app">
      <Space direction="vertical" size="middle">
        <Row justify={"space-between"} align={"middle"}>
          <Col>
            <Upload {...props}>
              <Button disabled={status !== uploadState.NO_UPLOAD}>
                选择文件
              </Button>
            </Upload>
          </Col>
          {nowFile && <Col span={9}>{nowFile.name}</Col>}
          <Col>
            <Space>
              <Button
                disabled={status !== uploadState.WAIT_UPLOAD}
                type="primary"
                onClick={handleUpload}
              >
                确认上传
              </Button>
              <Button
                disabled={status !== uploadState.IS_UPLOADING}
                onClick={handlePause}
              >
                暂停上传
              </Button>
              <Button
                disabled={status !== uploadState.UPLOAD_PAUSE}
                onClick={handleUpload}
              >
                恢复上传
              </Button>
              <Button
                disabled={status === uploadState.NO_UPLOAD}
                onClick={clearFile}
              >
                清空上传
              </Button>
            </Space>
          </Col>
        </Row>
        {nowFile && (
          <div>
            <span>计算文件hash：</span>
            <Progress percent={hashPercent} />
          </div>
        )}
        {fileList.length > 0 && showChunkList && (
          <>
            <div>
              <span>总进度：</span>
              <Progress percent={totalPercent} />
            </div>
            <Table
              rowKey={"name"}
              columns={columns}
              dataSource={fileList}
              locale={{ emptyText: "请选择文件" }}
              pagination={false}
            ></Table>
          </>
        )}
      </Space>
    </div>
  );
}

export default App;