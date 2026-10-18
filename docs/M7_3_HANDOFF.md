# M7.3 分阶段交接：自主规划与移动端体验

本分支基于 #56（M7.2）叠加开发。它只实现一项可独立审查的 UI 基础：底部「助手」入口、英语二/政治共用的操作首页、紧凑响应式卡片与离线缓存更新。三个入口复用已有诊断、思考和私人档案处理器；打开首页不调用模型。界面明确写明“自动调整尚未开放”，没有虚构开关、执行记录或撤销成功状态。

## 当前实现边界

- `index.html` 增加第五个导航项；`app.js` 在两科共享的路由上渲染助手首页；`assistant-hub.css` 使用已有主题变量，支持小屏、键盘聚焦、减少动态效果；`sw.js` 更换缓存版本并加入新 CSS。
- 不修改学习数据键、PWA manifest、云同步协议、已有计划、AI 权限或后台执行。
- M7.2 规划仍然只能预览；任何自动执行 UI 必须等真正的服务器授权与撤销接口通过测试后再开放。
- 本分支不宣称已经完成整体 UI 重构、真实 Android 验收、M7.3 自动执行或真实 DeepSeek 接入。

## 后续执行顺序（建议独立 PR）

### 1. 受限自动执行后端

在 #56 的 `learning_analysis.py`、`learning_policy.py`、`learning_planner.py` 和 `private_plan.py` 基础上建立后端专用执行器，不允许模型直接访问写入端点。先实现按科目独立、默认关闭、可撤销的用户授权；然后实现触发事件去重、限流、费用预留、版本快照验证、模拟提供商、事务备份、审计收据、幂等执行和冲突安全撤销。提交前重查快照、档案、模板、授权、策略及建议版本。遇到离线冲突、未知实际记录或数据不足时拒绝自动写入。用合成数据完成完整闭环。不得简单取消 M7.2 的 `previewOnly` 限制。

### 2. 完整移动端体验

统一首页/日历/统计/任务详情与学习助手的设计变量和返回逻辑；复用英语二与政治组件，保留各自记录。将自动管理权限、执行历史、差异预览、暂停和撤销接入后端真实状态，绝不展示装饰性开关。检查 360/390/412 CSS 像素、Android 返回键、滚动状态、键盘安全区域、离线及同步冲突。界面内容优先任务和有证据的诊断，减少 Banner 和冗长说明。

### 3. DeepSeek 安全接入

官方文档（核对日期：2026-10-18）：
- https://api-docs.deepseek.com/zh-cn/
- https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/
- https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/

已有 `deepseek_ai.py` 调用 `https://api.deepseek.com/chat/completions`，模型 `deepseek-flash`，思考模式 `thinking.type=enabled`，`reasoning_effort=high`。不得重建第二套 API 客户端。

当前代码读取以下服务器环境变量：
- `DEEPSEEK_API_KEY`
- `BANYA_AI_ENABLED`（只有 `1` 才启用）
- `DEEPSEEK_MONTHLY_BUDGET_USD`（默认 0）
- `DEEPSEEK_MONTHLY_CALLS`
- `DEEPSEEK_INPUT_NANO_PER_TOKEN`
- `DEEPSEEK_OUTPUT_NANO_PER_TOKEN`

密钥只能经受保护的部署渠道注入 ECS，不放入仓库、PR、浏览器、LocalStorage、对话或公开日志。接入前应审查 ECS 发布流程如何安全地保留、更新和回滚环境变量，禁止把密钥打包进静态资源。先通过模拟提供商验证费用闸门、超时与重试幂等；正式发布后，经用户另行授权，才允许一次最小真实 API 验证。应用预算是估算，不等于 DeepSeek 账户的绝对账单上限。

### 4. 私人初始档案与发布

M7.1 初始资料仍为仓库外私有草稿，尚未入库。不得从公开计划文件伪造个人打卡。完成权限/同步/备份测试后，另行通过认证的私有流程导入，经用户核对再启用自动规划。

保留 #55 的 ECS-only 发布方向；历史 Worker 仅供恢复，不恢复冗余 Cloudflare 构建。所有阶段保持独立审查，不合并、不部署生产、不运行真实付费调用，除非用户后续明确授权。

## 本 UI 分支验收

运行 `node --test scripts/assistant-hub-test.mjs`，再运行 `bash scripts/validate.sh` 和移动端浏览器测试。单元测试验证两科按钮分别带正确科目、无自动执行入口、共享路由及 Service Worker 离线资源。测试通过也不能替代 Android 真机与生产验证。
