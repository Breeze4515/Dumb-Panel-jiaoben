# 魔方签到（青龙/呆呆面板自动签到脚本）

自动签到脚本，运行于 [青龙/呆呆面板](https://mf.yinxiaoxing.dpdns.org/?invite=9c427a68)。

- **目标站点**：`https://mf.yinxiaoxing.dpdns.org/?invite=9c427a68`（滑块验证码求解网关平台）
- **脚本文件**：`魔方签到.js`
- **运行环境**：青龙/呆呆面板 Node（需 Node ≥ 18，自带 `fetch`）

---

## 一、脚本功能

1. 通过环境变量 `MF_COOKIE` 登录 Cookie 完成鉴权。
2. 调用 `GET /api/me` 读取账户信息。
3. 执行每日签到 `POST /api/my/checkin`，领取余额奖励。
4. 签到完成后通过青龙 `notify.sendNotify()` 推送通知，内容包括：

   - 用户
   - 账户余额
   - 累计求解次数
   - 累计消费
   - 本次签到获取的余额

5. 已签到 / 重复签到按正常结果处理，不作为失败。

---

## 二、抓包分析结论

| 接口 | 方法 | 用途 |
|---|---|---|
| `/api/me` | GET | 用户信息：`balance`(余额)、`total_calls`(累计求解次数)、`total_cost`(累计消费)、`username` |
| `/api/my/checkin` | GET | 今日签到状态（`today_count`、`total_days` 等） |
| `/api/my/checkin` | POST | 执行签到，请求体 `{"egress_ip":"<出口IP>"}` |

**鉴权方式**：所有接口响应头都带有 `vary: Cookie`，登录态完全依赖请求头 `Cookie`，因此脚本将环境变量 `MF_COOKIE` 原样作为请求头发送。

**`/api/me` 返回示例**

```json
{
  "data": {
    "balance": 0.89,
    "price_per_call": 0.06,
    "token_count": 1,
    "total_calls": 4,
    "total_cost": 0.24,
    "username": "xxxxx"
  },
  "success": true
}
```

**签到 POST 返回示例**

```json
{
  "message": "签到成功，奖励 0.01 元已到账",
  "quota": 100,
  "reward": 0.01,
  "success": true,
  "today_count": 16,
  "total_days": 4
}
```

---

## 三、青龙/呆呆面板部署步骤

### 1. 放置脚本

将 `魔方签到.js` 上传到青龙容器的脚本目录（通常为 `/ql/scripts`），或通过青龙 Web 控制台「脚本管理」直接新建同名文件并粘贴内容。

### 2. 配置环境变量

进入 **青龙/呆呆面板 → 环境变量 → 新建变量**，按如下配置：

| 变量名 | 必填 | 说明 |
|---|---|---|
| `MF_COOKIE` | ✅ 必填 | 站点登录后的完整 Cookie 字符串 |
| `MF_EGRESS_IP` | 可选 | 固定出口 IP；不填则脚本自动获取本机出口 IP |
| `MF_IPIFY_API` | 可选 | 出口 IP 回显服务地址，默认 `https://api.ipify.org` |

### 3. 获取 `MF_COOKIE`

1. 用浏览器登录 `https://mf.yinxiaoxing.dpdns.org/`
2. 按 `F12` 打开开发者工具 → 切到 **Network（网络）** 面板
3. 刷新页面，点击任意一个 `/api/...` 请求
4. 在请求 **Headers → Request Headers** 中找到 `Cookie:` 一行，复制整段值
5. 粘贴到青龙环境变量 `MF_COOKIE` 中

> 注意：Cookie 可能有过期时间，失效后脚本会提示「查询用户信息失败」，重新按上述步骤更新即可。

### 4. 新建定时任务

进入 **青龙/呆呆面板 → 定时任务 → 新建任务**：

- **名称**：魔方每日签到
- **命令**：`task 魔方签到.js`
- **定时规则**：建议 `01 8 * * *`（每天 08:01 自动执行）

也可根据需要自行调整 cron（例如每天 9 点：`0 9 * * *`）。

### 5. 配置通知

在青龙/呆呆面板「系统设置 / 推送设置」中配置推送渠道（Server酱、企业微信、Telegram、钉钉等）后，脚本的 `notify.sendNotify()` 会自动复用青龙配置，无需改动脚本。

---

## 四、脚本参数说明

脚本内顶部为配置区，可按需修改：

| 常量 | 默认值 | 说明 |
|---|---|---|
| `BASE` | `https://mf.yinxiaoxing.dpdns.org` | 站点根地址 |
| `USER_AGENT` | Chrome/156 Android 移动端 UA | 请求头 User-Agent |
| `IPIFY_API` | `https://api.ipify.org` | 出口 IP 回显服务（也可用环境变量 `MF_IPIFY_API` 覆盖） |

---

## 五、运行输出示例

正常签到：

```
[2026/11/5 8:10:01] 用户: xxxxx  余额: 0.00  累计求解: 0 次  累计消费: 0.00 元
[2026/11/5 8:10:02] ✅ 签到成功，奖励 0.01 元已到账（奖励 0.01 元）
```

当日已签到：

```
[2026/11/5 8:10:01] 用户: xxxxx  余额: 0.00  累计求解: 0 次  累计消费: 0.00 元
[2026/11/5 8:10:02] ℹ️ 今日已签到，无需重复操作
```

未配置 Cookie：

```
[2026/11/5 8:10:01] 未配置 MF_COOKIE 环境变量，请先在青龙/呆呆面板-环境变量中添加登录 Cookie。
```

---

## 六、常见问题（FAQ）

**Q1：运行提示「未配置 MF_COOKIE 环境变量」**
检查青龙环境变量中是否已创建 `MF_COOKIE`，并确认变量值非空（脚本开头的 `COOKIE` 读取的是 `process.env.MF_COOKIE`）。

**Q2：运行提示「查询用户信息失败 / 可能 Cookie 失效」**
说明 `MF_COOKIE` 已过期或无效，请按「三、3」重新抓取最新 Cookie 后更新环境变量。

**Q3：签到 POST 返回「签到失败」**
可能是出口 IP 获取失败或服务端风控。可查看日志确认 `egress_ip` 取值；如本机 IP 可通过 `MF_EGRESS_IP` 配置固定的出口 IP，或调整 `MF_IPIFY_API` 使用其他可用的 IP 回显服务。

**Q4：本地（非青龙）如何调试？**
在本地执行需满足 Node ≥ 18，且未安装 `sendNotify` 时脚本会自动降级为控制台打印通知（不会报错）。示例：

```bash
MF_COOKIE="<你的Cookie>" node 魔方签到.js
```

---

## 七、免责声明

本脚本仅用于个人账号的自动化签到，请遵守目标平台的服务条款及当地法律法规。频繁、异常的操作可能触发平台风控，账号被封禁的风险由使用者自行承担。
