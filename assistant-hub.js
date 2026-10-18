/* Shared assistant landing. Uses existing authenticated handlers only. */
(function(root){
 'use strict';
 function render(subject){
  const id=subject==='politics'?'politics':'english';
  const name=id==='politics'?'政治':'英语二';
  const links=[
   ['diagnosis','学习诊断','近 7 / 14 天记录与负荷','↗'],
   ['ai','思考与规划','讨论每日、每周学习安排','✦'],
   ['memory','学习档案与规则','查看目标、预算与长期要求','◎']
  ];
  const cards=links.map(([kind,title,detail,symbol],i)=>{
   const action=kind==='diagnosis'?'data-diagnosis-action="open" data-diagnosis-subject':kind==='ai'?'data-ai-action="open" data-ai-subject':'data-memory-action="open" data-memory-subject';
   return '<button type="button" class="assistant-hub-action '+(i===0?'is-primary':'')+'" '+action+'="'+id+'"><span class="assistant-hub-icon" aria-hidden="true">'+symbol+'</span><span class="assistant-hub-action-copy"><strong>'+title+'</strong><small>'+detail+'</small></span><span class="assistant-hub-arrow" aria-hidden="true">›</span></button>';
  }).join('');
  return '<section class="student-page assistant-hub" aria-labelledby="assistant-hub-title"><header class="assistant-hub-head"><p class="assistant-hub-kicker">'+name+' · 私人学习助手</p><h1 id="assistant-hub-title">把精力留给学习</h1><p>先看真实记录，再决定是否调整计划。打开本页不会产生 AI 费用。</p></header><div class="assistant-hub-actions">'+cards+'</div><section class="assistant-hub-status" aria-label="自动管理状态"><h2>自动调整尚未开放</h2><p>当前只能诊断和预览建议，不会自行修改云端计划。M7.3 授权与撤销仍需后端验收。</p></section><p class="assistant-hub-footnote">学习档案与真实打卡分开保存；云端诊断需要联网并连接同步。</p></section>';
 }
 root.BanyaAssistantHub=Object.freeze({render});
})(window);
