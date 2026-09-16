(function(){
  'use strict';
  var root=document.documentElement;
  root.setAttribute('data-erp-impar-theme','blue');
  function boot(){
    if(document.body) document.body.classList.add('erp-screen-enter');
    var selectors=['.card','.panel','.kpi','.dc','.pc','.section','.contract','.toolbar','.hero'];
    var nodes=[];
    selectors.forEach(function(selector){
      document.querySelectorAll(selector).forEach(function(node){
        if(nodes.indexOf(node)<0) nodes.push(node);
      });
    });
    nodes.slice(0,36).forEach(function(node,index){
      node.classList.add('erp-reveal');
      node.style.setProperty('--erp-delay',Math.min(index*22,280)+'ms');
    });
    document.addEventListener('click',function(event){
      var target=event.target.closest('button,.btn,.mini');
      if(!target||target.disabled) return;
      target.classList.remove('erp-pulse-complete');
      void target.offsetWidth;
      target.classList.add('erp-pulse-complete');
      setTimeout(function(){target.classList.remove('erp-pulse-complete');},520);
    },true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
