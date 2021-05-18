import React, { useEffect, useState } from "react";
import { Button, Upload, Table, Progress, Row, Col, Space } from "antd";
import { loadLimit } from "./utils";
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
  UPLOAD_DONE: 5, // 上传完毕
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

const worker = new Worker("/hash.js");

function App() {
  const [nowFile, setNowFile] = useState(null);
  const [status, setStatus] = useState(uploadState.NO_UPLOAD);
  const [fileList, setFileList] = useState([]);
  const [totalPercent, setTotalPercent] = useState(0);
  const [hashPercent, setHashPercent] = useState(0);
  const [fileHash, setFileHash] = useState("");

  const createHash = (fileChunkList) => {
    return new Promise((resolve) => {
      worker.postMessage({ fileChunkList });
      worker.onmessage = (e) => {
        const { percentage, hash } = e.data;
        setHashPercent(percentage.toFixed(2));
        if (hash) {
          resolve(hash);
          setStatus(uploadState.WAIT_UPLOAD);
        }
      };
    });
  };

  const beforeUpload = (e) => {
    setNowFile(e);
    const chunkList = createFileChunk(e).map(({ file, name }, index) => {
      return {
        chunk: file,
        size: file.size,
        percent: 0,
        name: name + " -" + (index + 1),
        index,
      };
    });
    createHash(chunkList).then((res) => {
      setStatus(uploadState.CREATE_HASH);
      chunkList.forEach((item, index) => {
        item.hash = res + "-" + index;
      });
      setFileHash(res);
      setFileList(chunkList);
    });
    return false;
  };

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
    });
  };

  const handleUpload = async (e) => {
    setStatus(uploadState.IS_UPLOADING);
    const requestList = fileList
      .map(({ chunk, hash, index }) => {
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("hash", hash);
        formData.append("filename", nowFile.name);
        formData.append("fileHash", fileHash);
        return { formData, index };
      })
      .map(async ({ formData, index }) => {
        return axios({
          url: "http://localhost:3001/",
          method: "post",
          data: formData,
          onUploadProgress: (e) => {
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
    await Promise.all(requestList);
    mergeRequest();
  };

  const props = {
    showUploadList: false,
    beforeUpload: beforeUpload,
  };

  useEffect(() => {
    if (fileList.length > 0 && status === uploadState.IS_UPLOADING) {
      const totalLoad = fileList
        .map((item) => item.size * item.percent)
        .reduce((pre, cur) => pre + cur);
      setTotalPercent((totalLoad / nowFile.size).toFixed(2));
    }
  }, [fileList]);

  return (
    <div className="app">
      <Space direction="vertical" size="middle">
        <Row justify={"space-between"} align={"middle"}>
          <Col>
            <Upload {...props}>
              <Button>选择文件</Button>
            </Upload>
          </Col>
          {nowFile && <Col span={18}>{nowFile.name}</Col>}
          <Col>
            <Button type="primary" onClick={handleUpload}>
              确认上传
            </Button>
          </Col>
        </Row>
        {nowFile && (
          <div>
            <span>计算文件hash：</span>
            <Progress percent={hashPercent} />
          </div>
        )}
        {fileList.length > 0 && (
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

const handleUpload = () => {
  const formData = new FormData();
  fileList.forEach((file) => {
    formData.append("file", file);
  });
};
