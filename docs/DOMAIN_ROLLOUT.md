# 板牙考研：自有域名及大陆无 VPN 访问优化（2026-10-16）

## 结论和用户授权范围

用户反馈荣耀 Android16 Edge PWA 通过 `workers.dev` 不开 VPN 加载很慢，允许为正式域名支付合理费用。目标是**不换仓库、不建第二套App、不清空本机记录、不停用旧链接**，优先解决中国大陆常见网络环境下的首屏访问、启动离线缓存、后续安全云端同步。不因用户愿意付费就替其购买无法退款的服务或企业级 CDN。

当前生产 Worker 是 `english-ii-plan`，原始 URL 为 `https://english-ii-plan.kopdabanya.workers.dev`，GitHub Actions 运行 Wrangler 从 main 自动发布。华为云 ECS API 原点 `https://124.70.128.201`，应用 `cloud-sync.js` 有私有 Bearer 校验、前端 CSP 仅允许原 API，FastAPI 当前 `BANYA_ALLOWED_ORIGIN` 是**单值**，不能把新域名只挂在 Cloudflare 而忽略 API CORS。

## 为什么分阶段

- Cloudflare 官方支持将同一个 Worker 挂接自有 Custom Domain：前提是用户**已真正持有域名**且该域名在本人 Cloudflare 账号下成为 active zone。Wrangler 可以设 `routes: [{pattern:"app.example.com",custom_domain:true}]`；Cloudflare负责DNS和证书。**保留 `workers_dev:true`，不能在加 routes 时让旧 worker.dev 意外消失。**
- 换掉 `workers.dev` 主机名可能改善其域名专属的连接故障，但它仍走普通全球 Cloudflare 网络；不能承诺中国大陆节点或特定延迟。Cloudflare China Network 是 Enterprise 独立订阅，不按免费版提供。不要先买昂贵的计划。
- 若在用户实际校园网/移动数据无 VPN 测试后仍不合格，再选择中国大陆源站/CDN（先明确 ECS 所在地域及备案可行性），或其它合法的更近部署地区。中国大陆域名指向中国大陆网站服务器以及中国大陆 CDN 接入一般需先 ICP 备案。不能靠猜测公网 IP 确定地域、绕过备案或直接将未备案域名指向国内源站。

## 尚未确定、不得编造

- 自有域名尚无用户提供的已购买/受控域名；仅**建议**如 `banyakaoyan.com`（是否可注册与实际报价须由注册商页面确认）。
- 尚未完成域名购买、Cloudflare zone 验证、DNS、证书签发、Worker 自定义域名绑定或手机无 VPN 性能验收。不得写「正式域名已上线」。
- 用户完成注册、实名认证和缴费属于个人账户所有权操作，不得代为作出未经确认的交易。首次只建议买域名本身，不购买网站模板、主机、付费证书或高价加速套餐。

## 正式配置前的工程检查

1. 用户通过华为云官方注册服务（或其他可信注册商）购买本人持有、可续费的普通 .com；确认最终域名和实名认证。如注册在华为云，官方支持手动将 NS 改成 Cloudflare 分配的具体 nameserver（不能猜名字）。
2. 将域名添加至用户现有 Cloudflare 账号，在 Dashboard 中验证 active zone。此步骤依赖域名所有权；尚未购买前不得强行改 `wrangler.jsonc` 的 routes 并发布。
3. 为同一个 Worker 建立如 `app.<实际域名>` Custom Domain；使用原已有生产 Token 和 GitHub Actions 发布，不创建第二个 Worker，保留旧 Workers.dev。
4. **先处理云同步跨域：** FastAPI 配置改为精确可信的 HTTPS origin 白名单（旧 `workers.dev` 与新 app 域名），测试成功新旧站的 CORS preflight + 已授权 GET/PUT（数据测试用隔离库，不覆盖正式学习数据）。Nginx API、原IP HTTPS可先保留。前端 CSP 不扩大为任意 `https:`。
5. **谨慎迁移客户端学习记录：** `localStorage` / Service Worker / PWA 安装身份按 origin 隔离；新域名绝不自动获取旧域名英语 `yantu_english_2026_m1`、政治 `yantu_politics_2026_v1` 或云同步 token。旧站保持可访问，不进行自动跳转。先提供清晰、用户确认后执行的本机学习备份导出/导入（必要时再实现双origin严格校验来源的 `postMessage` 一键迁移）。不得把学习记录放 URL、GitHub 或日志中。
6. 域名打通后检测静态资源、manifest、SW 安装与离线、两科打卡/撤销/错题、双站私有 API 鉴权与 CORS、跨端差异。测试新域名在手机移动数据、宿舍/图书馆校园网无 VPN 与有 VPN 情况，优先评价首屏可用和首次离线成功率，而非仅用GitHub Actions美国节点验证。
7. 确实优于旧域名且本机迁移通过后，才建议让用户在新网址安装 PWA；原 PWA 保留到用户确认记录迁移完成。不要静默切换入口。

## 证据和参考

- Cloudflare Workers Custom Domains：https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Cloudflare China Network：https://developers.cloudflare.com/china-network/
- Cloudflare workers.dev：https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- 华为云域名注册：https://www.huaweicloud.com/product/domain.html
- 华为云域名修改DNS：https://support.huaweicloud.com/usermanual-domain/domain_ug_330005.html
- 华为云ICP备案限制：https://support.huaweicloud.com/icprb-icp/icp_01_0008.html

## 实际状态

2026-10-16：**仅完成方案核查及工程部署门禁记录**；无自有域名，未切换任何流量；本次不改变主站代码或任何学习记录。后续以已购域名、云服务控制台和自动化检查的真实结果逐项更新。
