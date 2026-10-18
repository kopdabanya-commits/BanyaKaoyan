# M7.3：DeepSeek 安全接入准备

本阶段仅开发和模拟验证。没有配置真实密钥、启动发布或调用付费 API。

## 官方接口契约

2026-10-18 只读取官方公开文档核对：

- https://api-docs.deepseek.com/quick_start/pricing
- https://api-docs.deepseek.com/guides/thinking_mode

现有传输固定 `https://api.deepseek.com/chat/completions`，`model=deepseek-flash`，`thinking.type=enabled`，`reasoning_effort=high`。不接受模型自定义 URL，不跟随重定向。正式启用前仍需核验当时模型与价格；本次没有用实际接口响应验证账号兼容性。本次公开价格表的 Flash 峰值 cache-miss 输入为 $0.30/百万 token、输出为 $1.20/百万 token，与现有保守预留参数一致；不依赖低谷或缓存折扣。8192 输出 token 和有界上下文限制继续保留，不自动扩容或重试收费请求。

## 三层开关

1. 服务器环境：`BANYA_AI_ENABLED`、`BANYA_AUTO_ENABLED`、密钥、总费用和调用次数。默认关闭／零费用。
2. 所有者 `POST /v1/ai/activation`：受既有认证、CAS 版本和明确确认保护。`GET /v1/ai/status` 显示配置、费用和批准状态，永不返回密钥。
3. 自动管理仍需总开关及科目范围授权，不能因普通聊天启用而自行管理计划。

环境加载的配置始终要求 App 批准；显式注入的合成测试配置可以省略该步骤。`ai_activation` 是独立控制表，不改学习快照。配置写入生成新的配置版本，旧批准与新配置不匹配，必须再次批准。调用开始及提交结果前均核验批准，调用期间暂停会安全丢弃建议并保留保守费用预留。

后台循环仅在服务器自动功能开关开启时运行；尚未批准时只做就绪检查，不调用模型。开启 App、切页、统计、打卡、刷新和同步不直接调用付费 API。满足预先明确授权的自动管理条件时，未来才可进入收费链路。

## 密钥安装与回退

`configure_ai.py` 只从 stdin 接收有界密钥，不从命令行读取，不打印内容，不执行输入。拒绝空白、换行及 Shell 字符；保留数据库、原同步认证和其他环境配置，原子写入 root:root 0600 的 `/etc/banya-sync.env`。`configure-ai.sh` 先保存 root 私有配置副本，重启失败恢复环境；不替换数据库。只验证本地健康与未授权 401，不做任何模型请求。

GitHub 工作流 `Reviewed DeepSeek configuration (no model call)` 仅 main 手动启动，使用 pinned known_hosts、既有 SSH Secret、独立 `banya-ai-production` Environment。参数只允许操作和数值限制，密钥只来自 Secret，通过 SSH 标准输入传送，不写公开参数、日志或仓库。不得从 PR 运行它，也不要将新增环境名称误认为已配置审批保护。

## 未来真实启用步骤（必须另获发布与费用授权）

1. 审阅并按依赖顺序合并这些 PR；经授权用现有 ECS 流程部署匹配的 PWA 和后端，先验证备份、HTTPS、版本和未授权拒绝。当前尚未执行。
2. 手机浏览器进入仓库 Settings → Environments → New environment，名称 `banya-ai-production`；配置审批人（平台可用时），在 Environment secrets 添加 `DEEPSEEK_API_KEY`。只在 DeepSeek 官方开放平台创建密钥，不发聊天。既有 SSH Secret 继续复用。
3. Actions → `Reviewed DeepSeek configuration (no model call)` → Run workflow → main，先选择 `install-disabled`，保留 0/0。密钥已安装仍不能调用。
4. 核验保护后，再经授权选择 `prepare-enabled`，建议起始月预算 `2` 美元、`40` 次。该工作流仍不请求模型，App 批准保持失效状态。
5. App → 助手 → AI 启用与费用，核对限制并显式启用。此按钮本身不收费。随后由用户主动发送一个最小咨询，验证账号响应、用量、失败状态和手机体验。
6. 真实咨询与手机同步验收完成后，才另行开启 AI 自动管理并授权科目与范围；不自动导入旧档案。

回退：先在 App 暂停 AI 及自动管理；必要时用 `install-disabled` 恢复服务器关闭/零费用配置。密钥泄露时在官方平台撤销，再更新受保护 Secret，不更换同步认证或数据库。不能清零已预留费用来绕过限额。

## 费用与数据

沿用全局 `ai_requests` 保守费用预留、请求幂等、超时不自动重试；自动管理另有科目费用/次数/冷却。收据只保存有界模型请求 ID 和整数 token 用量，不保存内部思考过程。实际账单及同账号其他应用用量仍以官方平台为准，应用上限不能约束账号外的调用。

M7.3 自动执行接口、来源/模板/档案版本、事务备份、审计和撤销可直接供后续生产验收复用；无需新增数据系统或开放代码/SSH 工具。
