# 闲鱼订单金额统计（xianyu-order-stats）

![Downloads](https://img.shields.io/github/downloads/vlv777/xianyu-order-stats/total?style=flat-square)
![Release](https://img.shields.io/github/v/release/vlv777/xianyu-order-stats?style=flat-square)
![Stars](https://img.shields.io/github/stars/vlv777/xianyu-order-stats?style=flat-square)
![License](https://img.shields.io/github/license/vlv777/xianyu-order-stats?style=flat-square)

一个极小、零依赖的 Chrome 扩展：在闲鱼卖家工作台（seller.goofish.com「订单管理」页）
左下角加一个浮窗，自动翻页统计两个数字：

- **待发货**：金额合计 + 单数
- **已发货待到账**：金额合计 + 单数

打开订单页自动统计一次；随时可点「立即统计」重新拉；浮窗可拖动、可折叠。

> 配套项目：[闲鱼卖家工作台（xianyu-seller-workbench）](https://github.com/vlv777/xianyu-seller-workbench)
> ——不开页面也能看数：工作台内置的订单金额看板直接走接口取数，与本浮窗互补。

## 安装（Chrome / Edge）

**方式一：成品包（推荐，适合非开发者）**：到
[Releases](https://github.com/vlv777/xianyu-order-stats/releases/latest) 下载
`xianyu-order-stats-v1.0.0.zip`，解压后按包内「安装说明.html」操作（图文步骤，约 1 分钟）。

**方式二：本仓库源码**：

1. 下载本仓库（`git clone` 或点 Code → Download ZIP 解压）
2. 地址栏打开 `chrome://extensions` → 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」→ 选择本仓库文件夹
4. 打开闲鱼卖家工作台的「订单管理」页（刷新一次），左下角出现浮窗

## 工作原理

- 页面是 antd 表格；扩展按状态页签（待发货 `NOT_SHIP` / 已发货 `SHIPPED`）切换，
  逐页读取每笔订单「成交价」列，按订单编号去重后求和
- 纯 DOM 读取，不请求任何第三方接口，数据不出本机
- 统计完会自动切回你原来的页签；已发货口径 = 已发货但未到账（待买家确认收货）的订单

## 文件说明

```
manifest.json   Chrome MV3 清单（仅 seller.goofish.com 生效）
content.js      全部逻辑：浮窗 UI + 翻页采集 + 汇总
```

## 常见问题

- **点了没反应 / 提示「请先打开订单管理页」**：确认当前在「订单管理」的订单列表页，而不是工作台首页
- **个别单显示「金额未识别」**：该行成交价格式异常时会单独计数、不计入合计
- **统计比较慢**：订单多时需要逐页翻，属正常现象
- **数字什么时候刷新**：打开页面自动统计一次；要最新数字点「立即统计」

## 免责声明

- 本项目**仅供学习与技术研究**，与闲鱼官方无任何关系
- 请自行评估使用风险，因使用本项目产生的任何直接或间接后果由使用者自行承担

## License

[AGPL-3.0](LICENSE)
