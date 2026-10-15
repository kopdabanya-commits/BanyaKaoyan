> ⚠️ **归档资料：不执行！** 2026-10-15 用户已决定使用无需绑卡的免费公开workers.dev，明确不使用Cloudflare Access付费/要求付款信息的开通流程。以下为此前探索的技术试验，并非当前部署指南。旧GitHub Actions `configure-access.yml` 已停用；除非用户未来另行明确授权和讨论新的免费访问控制方案，禁止要求用户创建Token、进入Zero Trust或执行此流程。当前操作看 [OPERATIONS.md](OPERATIONS.md) 和 [DECISIONS.md](DECISIONS.md)。

# 手机一次授权，GitHub执行配置

使用者在Cloudflare手机控制台创建一天有效的Custom API Token，账户范围仅当前账户，权限仅：Workers Scripts Edit、Access: Apps and Policies Edit、Access: Organizations, Identity Providers, and Groups Edit。部分界面显示Write，含义对应写入。不要使用Global API Key，不要放进聊天、源码或普通变量。

到GitHub仓库 Settings → Secrets and variables → Actions → New repository secret，Name为 `CLOUDFLARE_API_TOKEN`，Secret为刚生成的令牌。

到Actions → Configure private Cloudflare access → Run workflow，选择main，填写当前Cloudflare账户邮箱（App唯一允许的邮箱），运行。

此workflow只有workflow_dispatch手动入口，push或PR不会调用令牌。凭证只在配置步骤通过环境变量传递，只向Cloudflare API发送。GitHub自动提供的短期token只向GitHub API发送，用于保存验证成功后的域名配置。不会将Cloudflare令牌放入提交、日志、前端或artifact，不会打印API原始响应。

流程：读取并关闭现有生产/预览入口（若开启）→ 检查已存在的Zero Trust组织 → 复用或添加邮箱OTP登录 → 创建指定域名的单邮箱Access应用 → 回读应用与全部策略，拒绝其他允许条件或bypass → 启用生产、关闭预览 → 无凭证探测首页/JS/plan/manifest，均须跳转到本组织Access → 提交workers_dev=true及无令牌验证标记（.cloudflare/access-state.json，禁止静态发布）。后续原Cloudflare GitHub自动部署继续工作。

遇到未知现有应用/不匹配策略，不擅自覆盖。任何开启后的校验失败尝试回关生产与预览；不会删除Access或放宽策略。若关闭接口也失败，日志要求立即在手机检查。创建操作不盲目重试，重跑时按确切域名复用，避免重复应用。

Zero Trust未开通、需要接受条款或付款：流程停止，由本人在手机选择免费方案并完成必要确认；脚本没有组织创建、订阅或付款接口。完成后重跑。

当前只测试了API模拟逻辑，尚未使用真实令牌运行，不能视为已配置Access或已交付生产。未登录探测通过也不能证明指定邮箱登录成功或其他邮箱实际拒绝，仍需本人OTP登录及Android验收。预览URL保持关闭，不创建访问绕过令牌。

成功后可撤销临时令牌并删除该GitHub Secret，Access规则不依赖令牌持续存在。Secret不会自动撤销，撤销应由本人完成。原Workflow GitHub token提交不会触发GitHub Actions的新工作流；Cloudflare外部GitHub部署检查另行确认。
