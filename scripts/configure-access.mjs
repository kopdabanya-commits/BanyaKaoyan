/** Manual-only Cloudflare provisioning. Tokens remain in Actions env, never in output. */
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export const HOST='english-ii-plan.kopdabanya.workers.dev';
export const APP_NAME='研途英语二 · private';
const WORKER='english-ii-plan';
export function exactPolicy(p,email){return p?.decision==='allow'&&p.include?.length===1&&Object.keys(p.include[0]).length===1&&p.include[0].email?.email?.toLowerCase()===email&&!(p.exclude?.length)&&!(p.require?.length);}
export function loginRedirect(r,authDomain){try{const u=new URL(r.headers.get('location'));return [302,303,307,308].includes(r.status)&&u.protocol==='https:'&&u.hostname===authDomain&&/^\/cdn-cgi\/access\/login(?:\/|$)/.test(u.pathname);}catch{return false;}}
export async function configure({accountId,email,api,probe,persist,summary=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(!/^[a-f0-9]{32}$/.test(accountId)||!/^\S+@\S+\.\S+$/.test(email))throw Error('账户ID或邮箱格式不正确');email=email.toLowerCase();
 const base=`/accounts/${accountId}`,sub=`${base}/workers/scripts/${WORKER}/subdomain`;
 let touched=false;
 try{
  // No public transition happens until exact hostname/email protection is read back.
  const route=await api('GET',sub);
  if(route.enabled||route.previews_enabled){await api('POST',sub,{enabled:false,previews_enabled:false});touched=true;}
  let org;try{org=await api('GET',`${base}/access/organizations`);}catch{throw Error('无法读取Zero Trust组织。请在手机完成免费方案开通，或检查令牌组织权限；本流程不会开通付费服务。');}
  if(!org?.auth_domain?.endsWith('.cloudflareaccess.com'))throw Error('Zero Trust尚未就绪，请先在手机完成开通');
  let providers=await api('GET',`${base}/access/identity_providers`);
  if(!Array.isArray(providers))throw Error('身份提供商响应异常');
  let otp=providers.find(p=>p.type==='onetimepin');
  if(!otp)otp=await api('POST',`${base}/access/identity_providers`,{name:'One-time PIN login',type:'onetimepin',config:{}});
  if(!otp?.id)throw Error('邮箱验证码登录配置未成功');
  const apps=await api('LIST',`${base}/access/apps`);
  const matches=apps.filter(a=>a.domain===HOST);
  if(matches.length>1)throw Error('发现重复Access应用，已停止，请检查现有配置');
  let app=matches[0];
  if(app&&app.name!==APP_NAME)throw Error('域名已有其他Access应用，保留原配置并停止');
  if(!app){app=await api('POST',`${base}/access/apps`,{type:'self_hosted',name:APP_NAME,domain:HOST,session_duration:'168h',allowed_idps:[otp.id],auto_redirect_to_identity:false,app_launcher_visible:false,policies:[{name:'Only owner email',decision:'allow',include:[{email:{email}}]}]});}
  if(!app?.id)throw Error('Access应用未创建成功');
  app=await api('GET',`${base}/access/apps/${app.id}`);
  if(app.domain!==HOST||app.type!=='self_hosted'||app.allowed_idps?.length!==1||app.allowed_idps[0]!==otp.id||app.destinations?.length)throw Error('Access应用范围或身份提供商校验失败');
  const policies=await api('LIST',`${base}/access/apps/${app.id}/policies`);
  if(policies.length!==1||!exactPolicy(policies[0],email))throw Error('Access白名单并非仅指定邮箱，已停止');
  // Preview URLs stay disabled. Network probes carry no API or Access credentials.
  touched=true;await api('POST',sub,{enabled:true,previews_enabled:false});
  let protectedOK=false;
  for(let i=0;i<5;i++){
   const checks=await Promise.all(['/', '/app.js', '/plan.json','/manifest.webmanifest'].map(path=>probe(`https://${HOST}${path}`)));
   if(checks.every(r=>loginRedirect(r,org.auth_domain))){protectedOK=true;break;}
   if(i<4)await sleep(1000);
  }
  if(!protectedOK)throw Error('未验证到四个入口均跳转至本组织Access，已回关域名');
  const finalRoute=await api('GET',sub);
  if(!finalRoute.enabled||finalRoute.previews_enabled)throw Error('域名或预览状态不符合要求');
  // Persist the verified routing flag so later Cloudflare builds do not disable it.
  await persist({host:HOST,application_id:app.id,protection:'owner-email',preview_urls:false,verified_at:new Date().toISOString()});
  await summary('Access邮箱白名单已配置；生产入口均要求身份验证；预览关闭。仍需本人完成邮箱验证码登录及Android验收。');
  return {host:HOST,protected:true,preview:false};
 }catch(err){
  if(touched){try{await api('POST',sub,{enabled:false,previews_enabled:false});}catch{throw Error('配置未完成且自动关闭域名失败，请立刻在手机检查Worker域名开关。');}}
  throw err;
 }
}
export function cfClient(token,fetcher=fetch){
 return async function api(method,path,body){
  if(method==='LIST'){const result=[];for(let page=1;page<=20;page++){const data=await request('GET',`${path}?page=${page}&per_page=100`);if(!Array.isArray(data.result))throw Error('列表响应异常');result.push(...data.result);if(page>=(data.result_info?.total_pages||1))return result;}throw Error('列表分页超出限制');}
  async function request(verb,url){
   const response=await fetcher('https://api.cloudflare.com/client/v4'+url,{method:verb,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});
   let data;try{data=await response.json();}catch{throw Error(`Cloudflare响应异常 HTTP ${response.status}`);}
   if(!response.ok||!data.success)throw Error(`Cloudflare ${verb} 请求失败 HTTP ${response.status}，请检查令牌权限与账户`);
   return data;
  }
  return (await request(method,path)).result;
 };
}
async function persistGitHub(marker){
 const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
 if(repo!=='kopdabanya-commits/English-II-Plan'||!token)throw Error('GitHub写入授权缺失或仓库不匹配');
 async function gh(method,path,body){const r=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`GitHub配置持久化失败 HTTP ${r.status}`);return r.json();}
 const ref=await gh('GET','/git/ref/heads/main');
 const head=await gh('GET',`/git/commits/${ref.object.sha}`);
 const file=await gh('GET','/contents/wrangler.jsonc?ref='+ref.object.sha);
 const config=JSON.parse(Buffer.from(file.content,'base64').toString());
 if(config.name!==WORKER||config.assets?.directory!=='.')throw Error('现有Worker配置已变化，拒绝覆盖');
 config.workers_dev=true;config.preview_urls=false;
 const tree=await gh('POST','/git/trees',{base_tree:head.tree.sha,tree:[{path:'wrangler.jsonc',mode:'100644',type:'blob',content:JSON.stringify(config,null,2)+'\n'},{path:'.cloudflare/access-state.json',mode:'100644',type:'blob',content:JSON.stringify(marker,null,2)+'\n'}]});
 const commit=await gh('POST','/git/commits',{message:'chore: persist verified Access-protected workers.dev route',tree:tree.sha,parents:[ref.object.sha]});
 await gh('PATCH','/git/refs/heads/main',{sha:commit.sha,force:false});
 console.log('已提交验证后的域名配置：'+commit.sha);
}
async function main(){
 const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('请先保存名为CLOUDFLARE_API_TOKEN的仓库Secret，再重新运行');
 if(process.env.GITHUB_REF!=='refs/heads/main')throw Error('仅允许在main手动运行');
 await configure({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,email:process.env.ACCESS_EMAIL||'',api:cfClient(token),probe:url=>fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)}),persist:persistGitHub,summary:async text=>{console.log(text);if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`## 配置结果\n\n${text}\n\nhttps://${HOST}\n`);}});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(err=>{console.error(err.message);process.exitCode=1;});
