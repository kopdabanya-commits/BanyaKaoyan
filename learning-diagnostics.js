/* Shared subject-bound diagnostics. Opening/refreshing this sheet never calls a model. */
(function(root){'use strict';
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={actual_time_over_plan:'实际用时比预计长',error_rate_increase:'近期错误率有所上升',accuracy_unknown:'错误率暂时不能确定',future_load_over_budget:'未来某天安排偏满',hard_daily_limit_exceeded:'安排超过硬性时间上限',course_limit_exceeded:'课程安排超过你的上限',recorded_course_time_over_limit:'课程记录用时值得核对',daily_practice_missing:'某天还没有题感练习',unresolved_plan_backlog:'有些旧任务状态待确认',training_evidence_missing:'某类训练缺少近期记录',budget_unknown:'可用时间还没确认',profile_information_expired:'有档案信息需要更新',insufficient_recent_records:'近期记录还不够',cloud_snapshot_stale:'云端记录可能未更新',goal_time_feasibility_review:'目标与当前时间需要协调',time_samples_insufficient:'实际用时样本还少',future_plan_unavailable:'未来某天计划范围未知'};
let opened=false,epoch=0,busy=false,result=null;
function state(text){if(opened)$('diagnosis-state').textContent=text;}
function lock(value){busy=value;if(opened)for(const id of ['diagnosis-subject','diagnosis-refresh','diagnosis-mode','diagnosis-target','diagnosis-available','diagnosis-discuss'])$(id).disabled=value;}
function close(){epoch++;opened=false;result=null;$('modal').classList.add('hidden');$('modal').innerHTML='';document.body.classList.remove('modal-open');}
function issue(i){return '<article class="ai-proposal"><h3>'+esc(titles[i.issueCode]||'值得留意')+'</h3><p>'+esc(i.recommendedAction)+'</p><p class="setting-note">范围 '+esc(i.dateRange.start)+' — '+esc(i.dateRange.end)+' · 样本 '+Number(i.sampleSize)+' · '+(i.confidence==='observed'?'来自已保存数据':i.confidence==='sample_supported'?'有一定样本支持':'证据有限')+'</p><details><summary>高级：证据与来源</summary><p>'+esc(Object.entries(i.evidence).map(([k,v])=>k+'：'+(Array.isArray(v)?v.join('、'):v)).join('；'))+'</p><small>'+i.sourceRefs.map(esc).join(' · ')+'</small></details></article>';}
function render(report){
 const cards=[7,14].map(n=>'<div class="ai-proposal"><b>近 '+n+' 天任务中的记录</b><p>有记录 '+Number(report.windows[n].recordedTasks)+' 项 · 已打卡 '+Number(report.windows[n].completed)+' 项</p></div>').join('');
 const groups=Object.entries(report.windows['14'].distribution).map(([kind,v])=>'<tr><td>'+esc(kind)+'</td><td>'+Number(v.completed)+'</td><td>'+(v.actualMinutes===null?'未填写':Number(v.actualMinutes)+' 分钟')+'</td><td>'+(v.wrongCount===null?'未填写':Number(v.wrongCount))+'</td></tr>').join('');
 $('diagnosis-output').innerHTML='<p class="setting-note">按任务所属日期统计，实际完成日期未知。没打卡不等于没学习，历史基础不计入打卡。</p><div class="diagnosis-cards">'+cards+'</div><h3>先看这几件事</h3>'+report.issues.slice(0,3).map(issue).join('')+(report.issues.length>3?'<details><summary>其他提示（'+(report.issues.length-3)+'）</summary>'+report.issues.slice(3).map(issue).join('')+'</details>':'')+'<details><summary>近14天题型记录</summary><div class="diagnosis-table"><table><thead><tr><th>题型</th><th>打卡</th><th>已填用时</th><th>已填错题数</th></tr></thead><tbody>'+groups+'</tbody></table></div><p class="setting-note">只累计填写过的值，不把缺失当成0。没有总题数和充分样本不算错误率。</p></details><details><summary>未来7天负荷</summary>'+report.future7Days.map(d=>'<p>'+esc(d.date)+'：预计 '+(d.plannedMinutes===null?'未知':Number(d.plannedMinutes)+' 分钟')+(report.subject==='english'?'，另有单词 '+(d.vocabularyMinutes===null?'未知':Number(d.vocabularyMinutes)+' 分钟'):'')+'；预算 '+(d.budgetMinutes===null?'未知':Number(d.budgetMinutes)+' 分钟')+'</p>').join('')+'</details><p class="setting-note">档案版本 '+Number(report.sources.profileRevision)+' · 云端版本 '+Number(report.sources.snapshotRevision)+'。新记录或预算变化后请刷新；旧建议会失效。</p></details>';
}
async function load(){
 if(busy||!opened)return;if(navigator.onLine===false){state('现在离线，先继续记录；联网后再查看云端诊断。');return;}
 const ticket=epoch,subject=$('diagnosis-subject').value;result=null;$('diagnosis-output').innerHTML='';lock(true);state('正在核对手机和云端，不会调用模型…');
 try{
  let baseline=null;try{baseline=await root.BanyaCloudSync.prepareAssistant(subject);}catch{state('手机尚未完成同步核对，以下只分析云端现有记录。');}
  if(ticket!==epoch)return;
  const report=await root.BanyaCloudSync.assistantRequest('analysis','POST',{subject,...(baseline?{expectedRevision:baseline.revision}:{})});if(ticket!==epoch)return;
  result=report;render(report);state(baseline?'只读诊断已更新，没有调用 DeepSeek，也没有修改计划。':'仅为云端现有数据的诊断；手机未同步的新记录不在其中，先处理同步再规划。');
 }catch(error){if(ticket===epoch)state(error.message||'暂时无法读取诊断，学习记录没有改变。');}
 finally{if(ticket===epoch)lock(false);}
}
async function open(subject){
 if(!root.BanyaCloudSync?.isConnected()){root.alert('请先连接云同步，再查看私人学习诊断。');return;}
 epoch++;opened=true;busy=false;result=null;const d=new Date();d.setDate(d.getDate()+1);const target=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 $('modal').innerHTML='<div class="modal-card ai-sheet diagnosis-sheet"><div class="modal-head"><h2>学习诊断</h2><button type="button" class="close" data-diagnosis-action="close" aria-label="关闭学习诊断">×</button></div><p class="setting-note">先看看真实记录，再决定要不要调整。查看这里不会产生模型费用。</p><label class="form-line"><span>科目</span><select id="diagnosis-subject"><option value="english">英语二</option><option value="politics">政治</option></select></label><button type="button" class="cta ghost" id="diagnosis-refresh" data-diagnosis-action="refresh">刷新诊断</button><p class="setting-note" role="status" id="diagnosis-state"></p><div id="diagnosis-output"></div><details><summary>需要更具体的规划建议</summary><label class="form-line"><span>方式</span><select id="diagnosis-mode"><option value="day">每日规划</option><option value="week">每周规划</option><option value="diagnosis">阶段诊断</option></select></label><label class="form-line"><span>目标日期／周起始日</span><input type="date" id="diagnosis-target"></label><label class="form-line"><span>当天可用分钟（仅每日，可选）</span><input type="number" id="diagnosis-available" min="0" max="600" inputmode="numeric"></label><button type="button" id="diagnosis-discuss" class="cta secondary" data-diagnosis-action="discuss">进入思考助手</button><p class="setting-note">进入后仍需主动发送和授权。规划只给建议和预览；是否启用付费功能以当前 AI 设置为准。</p></details></div>';
 $('modal').classList.remove('hidden');document.body.classList.add('modal-open');$('diagnosis-subject').value=subject==='politics'?'politics':'english';$('diagnosis-target').value=target;$('diagnosis-mode').value='day';$('diagnosis-available').value='';await load();
}
document.addEventListener('click',async e=>{const button=e.target.closest('[data-diagnosis-action]');if(!button){if(opened&&e.target.id==='modal')close();return;}const action=button.dataset.diagnosisAction;if(action==='open'){await open(button.dataset.diagnosisSubject);return;}if(action==='close'){close();return;}if(busy||!opened)return;if(action==='refresh')await load();if(action==='discuss'&&result){const args=[$('diagnosis-subject').value,$('diagnosis-mode').value,$('diagnosis-target').value,$('diagnosis-available').value];close();await root.BanyaStudyAssistant.openPlanning(...args);}});
document.addEventListener('change',e=>{if(opened&&!busy&&e.target.id==='diagnosis-subject'){epoch++;void load();}});
document.addEventListener('keydown',e=>{if(opened&&e.key==='Escape')close();});
document.addEventListener('banya-modal-dismiss',()=>{if(opened)close();});
})(window);
