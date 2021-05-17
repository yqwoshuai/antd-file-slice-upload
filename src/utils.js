export function loadLimit(loadList, limit = 3) {
  const list = loadList.slice();

  // 小于等于限制条件直接返回
  if (list.length <= limit) {
    const promiseArr = list.map((item) => load(item));
    return Promise.all(promiseArr);
  }

  // 切割请求数组准备发起请求，splice会修改原数组
  const promiseArr = list.splice(0, limit).map((item, index) => {
    return { id: index, promiser: item };
  });

  const begin = (loadListItem) => {
    console.log(promiseArr)
    // 没有需要执行的元素则结束递归
    if (!promiseArr.length) return;
    const nowArr = promiseArr.map((item) => item.promiser);
    return Promise.race(nowArr).then((res) => {
      // 找到完成加载的元素在数组中的位置，将这个元素删除
      // let finishIdPosition = promiseArr.findIndex((item) => {
      //   return res === item.id;
      // });
      // promiseArr.splice(finishIdPosition, 1);
      // // 删除一个元素后添加下一个元素进入数组
      // if (loadListItem) {
      //   promiseArr.push(loadListItem);
      // }
      // // 递归执行，如果还有没入队的元素则入队，没有了则直接执行
      // if (list.length > 0) {
      //   begin(list.shift());
      // } else {
      //   begin();
      // }
    });
  };
  begin(list.shift());
}
