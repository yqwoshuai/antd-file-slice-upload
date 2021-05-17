import React, { useState } from "react";
import { Button, Upload, Table, Progress, Row, Col, Space } from "antd";
import { loadLimit } from "./utils";
import axios from "axios";
import "./index.css";

// 切片大小 1M
const FILE_CHUNK_SIZE = 2 * 1024 * 1024;

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
  const [nowFile, setNowFile] = useState(null);
  const [fileList, setFileList] = useState([]);

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
    setFileList(chunkList);
    return false;
  };

  const handleUpload = async (e) => {
    const requestList = fileList
      .map(({ chunk, index }) => {
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("filename", nowFile.name);
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
  };

  const props = {
    showUploadList: false,
    beforeUpload: beforeUpload,
  };

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
            <span>总进度：</span>
            <Progress percent={0} />
          </div>
        )}
        {fileList.length > 0 && (
          <Table
            rowKey={"name"}
            columns={columns}
            dataSource={fileList}
            locale={{ emptyText: "请选择文件" }}
            pagination={false}
          ></Table>
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
