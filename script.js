const $=id=>document.getElementById(id);
const pt=(n,d=0)=>n.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!=null)n.textContent=x;return n};
const NS="http://www.w3.org/2000/svg";
const sv=(t,a,title)=>{const n=document.createElementNS(NS,t);for(const k in a)n.setAttribute(k,a[k]);if(title!=null){const ti=document.createElementNS(NS,"title");ti.textContent=title;n.append(ti)}return n};
const norm=s=>String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const sum=(a,k)=>a.reduce((s,p)=>s+p[k],0);
/* R$ em Mi/Bi com a unidade separada, para os cards grandes */
function money(v){if(v>=1e9)return{n:v/1e9,u:"Bi"};if(v>=1e6)return{n:v/1e6,u:"Mi"};if(v>=1e3)return{n:v/1e3,u:"mil"};return{n:v,u:""}}
const brl=v=>{const m=money(v);return "R$ "+pt(m.n,2)+(m.u?" "+m.u:"")};
const brlFull=v=>pt(v,2);

/* ---------- Dados (gerados por etl.py a partir das planilhas) ---------- */
const D=JSON.parse($("dados").textContent);
const P=D.projetos,EQ=D.equipe;
const EQ_POR_ID={};EQ.forEach(e=>(EQ_POR_ID[e.id]=EQ_POR_ID[e.id]||[]).push(e));
const SEM="Sem financiamento";
const finDe=p=>p.fin||SEM;
const NMUN={};P.forEach(p=>{NMUN[p.mun]=(NMUN[p.mun]||0)+1});
const FIN={BRDE:"var(--s2)",Badesc:"var(--s5)","Sem financiamento":"var(--axis)"};
const ETAPAS=["Solicitação Convênio Simplificado","Análise da elegibilidade da proposta","Análise técnica do projeto – BRDE","Análise técnica do projeto – BADESC","Publicação Portaria do Convênio Simplificado","Homologação da licitação da obra","Assinatura do Convênio Simplificado","Aporte Contrapartida Município","Aporte Recursos Estaduais"];
const FONTES=[["Recursos Estaduais","var(--s1)"],["Financiamento BRDE","var(--s2)"],["Recursos Municipais","var(--s3)"],["Bens/Serviços","var(--s4)"],["Financiamento BADESC","var(--s5)"]];

/* ---------- Tema ---------- */
const root=document.documentElement,mq=matchMedia("(prefers-color-scheme: dark)");
const isDark=()=>root.dataset.theme?root.dataset.theme==="dark":mq.matches;
function themeBtn(){const d=isDark();$("theme").textContent=d?"Tema claro":"Tema escuro";$("theme").setAttribute("aria-pressed",String(d));paintLabels()}
$("theme").onclick=()=>{root.dataset.theme=isDark()?"light":"dark";themeBtn()};
mq.addEventListener&&mq.addEventListener("change",themeBtn);

/* ---------- Tooltip único (textContent: rótulos são dados) ---------- */
const tip=document.createElement("div");tip.id="tip";tip.setAttribute("role","tooltip");document.body.appendChild(tip);
function showTip(title,rows){tip.replaceChildren(el("div","t",title));
  rows.forEach(r=>{const d=el("div","r"),k=el("i");k.style.background=r.c;d.append(k,el("b","",r.v),el("span","",r.n||""));tip.append(d)})}
function placeTip(x,y){tip.style.display="block";const r=tip.getBoundingClientRect();let L=x,T=y;
  if(L+r.width>innerWidth-8)L=x-r.width-24;if(T+r.height>innerHeight-8)T=y-r.height-24;
  tip.style.left=Math.max(8,L)+"px";tip.style.top=Math.max(8,T)+"px"}
const hideTip=()=>{tip.style.display="none"};
function bindTip(n,title,rows,on){
  n.addEventListener("pointerenter",e=>{showTip(title,rows);placeTip(e.clientX+14,e.clientY+14);on&&on(1)});
  n.addEventListener("pointermove",e=>placeTip(e.clientX+14,e.clientY+14));
  n.addEventListener("pointerleave",()=>{hideTip();on&&on(0)});
  n.addEventListener("focus",()=>{showTip(title,rows);const r=n.getBoundingClientRect();placeTip(r.left+r.width/2,r.bottom+6);on&&on(1)});
  n.addEventListener("blur",()=>{hideTip();on&&on(0)});
}

/* ---------- Filtros: um estado, uma função de filtragem, tudo derivado dela ---------- */
const F={m:"",f:"",s:"",z:"",n:"",a:"",r:"",e:"",u:"",x:"",q:""};
const ROT={x:["Todos","Sim"]};
const SIMPLES=[ /* chave, id do select, rótulo do "todos", valor do projeto */
  ["m","fm","Todos",p=>p.mun],["f","ff","Todos",finDe],["s","fs","Todas",p=>p.sit],["z","fz","Todas",p=>p.sit_atual],["n","fn","Todos",p=>p.nome],
  ["a","fa","Todas",p=>p.assoc],["r","fr","Todas",p=>p.regiao]];
function equipeOk(p){
  if(!F.e&&!F.u)return true;
  return (EQ_POR_ID[p.id]||[]).some(q=>(!F.e||q.pessoa===F.e)&&(!F.u||q.funcao===F.u));
}
/* skip: ignora um filtro, para listar as opções que ainda fazem sentido naquele select */
function ok(p,skip){
  for(const [k,,,get] of SIMPLES){if(k!==skip&&F[k]&&get(p)!==F[k])return false}
  if(skip!=="e"&&skip!=="u"&&!equipeOk(p))return false;
  if(skip==="e"&&F.u&&!(EQ_POR_ID[p.id]||[]).some(q=>q.funcao===F.u))return false;
  if(skip==="u"&&F.e&&!(EQ_POR_ID[p.id]||[]).some(q=>q.pessoa===F.e))return false;
  if(skip!=="x"&&F.x==="Sim"&&NMUN[p.mun]<2)return false;
  if(skip!=="q"&&F.q&&!(p.nome+" "+p.mun+" "+p.id+" "+(p.sgpe||"")).toLowerCase().includes(F.q))return false;
  return true;
}
const ordena=a=>[...a].sort((x,y)=>x.localeCompare(y,"pt-BR"));
function setOpts(id,todos,vals,desejado){
  /* o estado F é a verdade; o select só reflete */
  const s=$(id);s.replaceChildren(new Option(todos,""));
  vals.forEach(v=>s.add(new Option(v,v)));
  s.value=vals.includes(desejado)?desejado:"";return s.value;
}
/* Recalcula as opções de cada select; se uma escolha deixou de existir, limpa e repete */
function atualizaOpcoes(){
  for(let volta=0;volta<4;volta++){
    let mudou=false;
    for(const [k,id,todos,get] of SIMPLES){
      const v=setOpts(id,todos,ordena(new Set(P.filter(p=>ok(p,k)).map(get))),F[k]);
      if(v!==F[k]){F[k]=v;mudou=true}
    }
    const base=P.filter(p=>ok(p,"e")),pessoas=new Set(),funcs=new Set();
    base.forEach(p=>(EQ_POR_ID[p.id]||[]).forEach(q=>{if(!F.u||q.funcao===F.u)pessoas.add(q.pessoa)}));
    let v=setOpts("fe","Todas",ordena(pessoas),F.e);if(v!==F.e){F.e=v;mudou=true}
    P.filter(p=>ok(p,"u")).forEach(p=>(EQ_POR_ID[p.id]||[]).forEach(q=>{if(!F.e||q.pessoa===F.e)funcs.add(q.funcao)}));
    v=setOpts("fu","Todas",ordena(funcs),F.u);if(v!==F.u){F.u=v;mudou=true}
    v=setOpts("fx","Todos",["Sim"],F.x);if(v!==F.x){F.x=v;mudou=true}
    if(!mudou)break;
  }
}
const ligaSelect=(id,k)=>{$(id).onchange=e=>{F[k]=e.target.value;render()}};
SIMPLES.forEach(([k,id])=>ligaSelect(id,k));ligaSelect("fe","e");ligaSelect("fu","u");ligaSelect("fx","x");
$("q").oninput=e=>{F.q=e.target.value.trim().toLowerCase();render()};
$("clear").onclick=()=>{Object.keys(F).forEach(k=>F[k]="");$("q").value="";render()};

/* ---------- Números do topo (animam só na primeira carga) ---------- */
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
function setNum(id,v,d){const n=$(id);n.dataset.count=v;n.dataset.dec=d||0;n.textContent=pt(v,d||0)}
function contar(){document.querySelectorAll("[data-count]").forEach(n=>{
  const to=parseFloat(n.dataset.count),d=+n.dataset.dec||0;
  if(reduce||!isFinite(to)){n.textContent=pt(to||0,d);return}
  const t0=performance.now();(function f(t){const k=Math.min(1,(t-t0)/1100),e=1-Math.pow(1-k,3);n.textContent=pt(to*e,d);if(k<1)requestAnimationFrame(f)})(t0)})}
const pct=(a,b)=>b>0?a/b*100:0;
const setW=(id,v)=>$(id).style.setProperty("--w",Math.max(0,Math.min(100,v)).toFixed(1)+"%");

function renderTopo(r){
  const plan=sum(r,"plan"),conv=sum(r,"conv"),apor=sum(r,"apor"),ab=sum(r,"apor_badesc"),ar=sum(r,"apor_brde"),ao=Math.max(0,apor-ab-ar);
  const m=money(plan);setNum("hv",m.n,2);$("hu").textContent=m.u;
  $("v1").textContent=brl(plan);
  $("v2").replaceChildren(document.createTextNode(brl(conv)),el("em","",pt(pct(conv,plan),1)+"%"));
  $("v3").replaceChildren(document.createTextNode(brl(apor)),el("em","",pt(pct(apor,plan),1)+"%"));
  setW("w2",pct(conv,plan));setW("w3",pct(apor,plan));

  const n=r.length,nb=r.filter(p=>p.fin==="BRDE").length,nd=r.filter(p=>p.fin==="Badesc").length,nn=n-nb-nd;
  setNum("kp",n);$("kpb").textContent=nb;$("kpd").textContent=nd;$("kpn").textContent=nn;
  const sp=$("kps");sp.replaceChildren();
  [[nb,"var(--s2)"],[nd,"var(--s5)"],[nn,"var(--axis)"]].forEach(([c,col])=>{if(c){const i=el("i");i.style.width=pct(c,n)+"%";i.style.background=col;sp.append(i)}});
  sp.setAttribute("aria-label",`${nb} projetos BRDE, ${nd} BADESC, ${nn} sem financiamento`);

  const mun=new Set(r.map(p=>p.mun)),cm={};r.forEach(p=>cm[p.mun]=(cm[p.mun]||0)+1);
  const m1=Object.values(cm).filter(c=>c>1).length;
  setNum("km",mun.size);$("km1").textContent=m1;$("kmp").textContent=pt(pct(m1,mun.size),0)+"%";setW("kmf",pct(m1,mun.size));

  const ma=money(apor);setNum("ka",ma.n,2);$("kau").textContent=ma.u;
  [["kab","kabv",ar],["kad","kadv",ab],["kao","kaov",ao]].forEach(([i,t,v])=>{setW(i,pct(v,apor));$(t).textContent=v?brl(v):"—"});

  const km=sum(r,"km"),kv=sum(r,"km_pav");
  setNum("kk",km);$("kke").textContent=pt(kv,2);$("kkp").textContent=pt(pct(kv,km),0)+"%";setW("kkf",pct(kv,km));
}

/* ---------- Fontes de recurso: aportado por origem (real) + planejado x pago (aguardando fonte) ---------- */
function paintLabels(){document.querySelectorAll(".sg[data-lbl]").forEach(s=>{
  const m=getComputedStyle(s).backgroundColor.match(/[\d.]+/g);if(!m)return;
  const u=m.slice(0,3).map(v=>{v=v/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
  const L=.2126*u[0]+.7152*u[1]+.0722*u[2];
  s.style.color=((L+.05)/.053>1.05/(L+.05))?"#0b0b0b":"#fff"})}
function origens(r){
  const apor=sum(r,"apor"),ab=sum(r,"apor_badesc"),ar=sum(r,"apor_brde"),ao=Math.max(0,apor-ab-ar);
  return{apor,lista:[["BRDE","var(--s2)",ar],["BADESC","var(--s5)",ab],["Sem financiamento","var(--axis)",ao]]};
}
function renderFontes(r){
  const {apor,lista}=origens(r);const sb=$("sb"),ls=$("ls");sb.replaceChildren();ls.replaceChildren();
  if(apor<=0){ls.append(el("p","nota","Nenhum aporte registrado nos projetos filtrados."));return}
  lista.forEach(([k,c,v])=>{
    if(v<=0)return;const p=pct(v,apor);
    const seg=el("div","sg");seg.tabIndex=0;seg.style.flex=p+" 1 0";seg.style.background=c;
    if(p>=15){seg.textContent=pt(p,1)+"%";seg.dataset.lbl="1"}
    const li=el("div","li");li.tabIndex=0;const sw=el("i","sw");sw.style.background=c;
    li.append(sw,el("span","nm",k),el("span","vl",brl(v)),el("span","pc",pt(p,2)+"%"));
    const rows=[{c,v:brl(v),n:"valor aportado"},{c,v:pt(p,2)+"%",n:"do total aportado"}];
    const on=f=>{seg.classList.toggle("on",!!f);li.classList.toggle("on",!!f)};
    bindTip(seg,k,rows,on);bindTip(li,k,rows,on);sb.append(seg);ls.append(li);
  });
  paintLabels();
}
function renderFontesPendentes(){
  const bl=$("bl");bl.replaceChildren();
  FONTES.forEach(([k,c])=>{
    const row=el("div","rowx pendrow"),h=el("div","bl-h"),n=el("span","bl-n"),sw=el("i","sw");sw.style.background=c;n.append(sw,document.createTextNode(k));
    h.append(n,el("span","bl-v","aguardando fonte"));
    const trk=el("div","trk"),b=el("i","skel");trk.append(b);row.append(h,trk);bl.append(row);
  });
}
function tabelaFontes(r){
  const {apor,lista}=origens(r),v=document.querySelector("#pFont .view-t");v.replaceChildren();
  const t=el("table","tv"),hr=el("tr");["Origem","Valor aportado (R$)","% do aportado"].forEach((h,i)=>hr.append(el("th",i?"n":"",h)));
  const th=el("thead");th.append(hr);t.append(th);const tb=el("tbody");
  lista.forEach(([k,,x])=>{const q=el("tr");q.append(el("td","",k),el("td","n",brlFull(x)),el("td","n",pt(pct(x,apor),2)+"%"));tb.append(q)});
  t.append(tb);v.append(t);v.append(el("p","nota","Planejado x pago por fonte de recurso: aguardando fonte."));
}
document.querySelectorAll(".tg").forEach(b=>b.addEventListener("click",()=>{
  const p=$(b.dataset.t),on=b.getAttribute("aria-pressed")==="true";hideTip();
  b.setAttribute("aria-pressed",String(!on));b.textContent=on?"Tabela":"Gráfico";
  p.querySelector(".view-c").hidden=!on;p.querySelector(".view-t").hidden=on;if(on)paintLabels()}));

/* ---------- Jornada: nove paradas, aguardando fonte ---------- */
ETAPAS.forEach((n,i)=>{
  const li=el("li","stg pendstg"),col=el("div","col");
  col.append(el("b","val","—"),el("i","bar"));
  li.append(col,el("span","dot",String(i+1)),el("span","nm",n));$("route").append(li);
});

/* ---------- Mapa: malha municipal do IBGE embutida (geodata-br, CC0), ligada pelo nome sem acento ---------- */
/*__SC__*/
const MAPN={};const CANON={};P.forEach(p=>CANON[norm(p.mun)]=p.mun);
(function(){
  const g=$("mg");
  SC.forEach(([name,d,cx,cy])=>{
    const key=norm(name),n=sv("path",{d,"fill-rule":"evenodd",class:"mun"});g.append(n);MAPN[key]={n,cx,cy,name};
    n.addEventListener("pointerenter",e=>{
      const s=POR_MUN[key];
      showTip(name,s?[{c:"var(--hit)",v:pt(s.km,2)+" km",n:"planejados ("+s.n+(s.n>1?" projetos":" projeto")+")"},{c:"var(--hit)",v:brl(s.plan),n:"planejado"},{c:"var(--hit)",v:brl(s.apor),n:"aportado"}]:[{c:"var(--axis)",v:"Sem projeto",n:"no filtro atual"}]);
      placeTip(e.clientX+14,e.clientY+14)});
    n.addEventListener("pointermove",e=>placeTip(e.clientX+14,e.clientY+14));
    n.addEventListener("pointerleave",hideTip);
    n.addEventListener("click",()=>{if(POR_MUN[key])alternaMun(key)});
  });
  $("mapnote").textContent="Malha municipal do IBGE ("+SC.length+" municípios).";
})();
let POR_MUN={};
function alternaMun(key){const nome=CANON[key];if(!nome)return;F.m=F.m===nome?"":nome;render()}
function renderMapa(r){
  POR_MUN={};
  r.forEach(p=>{const k=norm(p.mun),s=POR_MUN[k]=POR_MUN[k]||{n:0,plan:0,apor:0,km:0,nome:p.mun};s.n++;s.plan+=p.plan;s.apor+=p.apor;s.km+=p.km});
  for(const k in MAPN){MAPN[k].n.classList.toggle("hit",!!POR_MUN[k]);MAPN[k].n.classList.toggle("sel",!!F.m&&norm(F.m)===k)}
  const g=$("bg");g.replaceChildren();const semMapa=[];
  Object.keys(POR_MUN).forEach(k=>{
    const s=POR_MUN[k],m=MAPN[k];if(!m){semMapa.push(s.nome);return}
    const c=sv("circle",{class:"pt"+(F.m&&norm(F.m)===k?" sel":""),"data-m":k,cx:m.cx,cy:m.cy,r:(4+Math.sqrt(s.km)*2.2).toFixed(1)});
    c.addEventListener("click",()=>alternaMun(k));
    bindTip(c,s.nome,[{c:"var(--hit)",v:pt(s.km,2)+" km",n:"planejados ("+s.n+(s.n>1?" projetos":" projeto")+")"},{c:"var(--hit)",v:brl(s.plan),n:"planejado"},{c:"var(--hit)",v:brl(s.apor),n:"aportado"}]);g.append(c)});
  const w=$("mapwarn");w.hidden=!semMapa.length;w.textContent=semMapa.length?"Sem correspondência no mapa: "+semMapa.join(", ")+".":"";
  const ch=$("chips");ch.replaceChildren();
  const lista=Object.keys(POR_MUN).sort((a,b)=>POR_MUN[b].km-POR_MUN[a].km);
  if(!lista.length)ch.append(el("span","none","Nenhum município no filtro atual."));
  lista.slice(0,24).forEach(k=>{const s=POR_MUN[k],c=el("span","chip");c.tabIndex=0;
    c.append(el("i"),document.createTextNode(s.nome),el("b","",pt(s.km,1)+" km"));
    const on=f=>{c.classList.toggle("on",!!f);document.querySelectorAll("#bg .pt").forEach(x=>x.classList.toggle("on",!!f&&x.dataset.m===k))};
    c.addEventListener("pointerenter",()=>on(1));c.addEventListener("pointerleave",()=>on(0));c.addEventListener("focus",()=>on(1));c.addEventListener("blur",()=>on(0));
    c.addEventListener("click",()=>alternaMun(k));ch.append(c)});
  if(lista.length>24)ch.append(el("span","none","+ "+(lista.length-24)+" municípios"));
}

/* ---------- Tabela de projetos ---------- */
let SORT={k:"nome",d:1};
document.querySelectorAll("th[data-k]").forEach(th=>{th.tabIndex=0;
  const alt=()=>{const k=th.dataset.k;SORT=SORT.k===k?{k,d:-SORT.d}:{k,d:1};render()};
  th.addEventListener("click",alt);th.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();alt()}})});
const NUMS=new Set(["plan","conv","apor","km","km_pav"]);
function renderTabela(r){
  const k=SORT.k,d=SORT.d;
  const rs=[...r].sort((a,b)=>{
    if(NUMS.has(k))return (a[k]-b[k])*d;
    if(k==="id")return (+a.id-+b.id)*d;
    return String(a[k]??"").localeCompare(String(b[k]??""),"pt-BR",{numeric:true})*d});
  document.querySelectorAll("th[data-k]").forEach(th=>th.setAttribute("aria-sort",th.dataset.k===k?(d>0?"ascending":"descending"):"none"));
  const tb=$("tb");tb.replaceChildren();
  if(!rs.length){const tr=el("tr"),td=el("td","empty","Nenhum projeto encontrado. Limpe os filtros para ver todos.");td.colSpan=14;tr.append(td);tb.append(tr)}
  const icone=()=>{const s=sv("svg",{width:15,height:15,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round","aria-hidden":"true"});
    s.append(sv("path",{d:"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"}),sv("path",{d:"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"}));return s};
  rs.forEach(p=>{
    const tr=el("tr"),c0=el("td","nm",p.nome);c0.title=p.nome;
    const c3=el("td"),pill=el("span","pill"+(p.fin==="Sem financiamento"||!p.fin?" vazio":"")),sw=el("i","sw");if(p.fin&&FIN[p.fin])sw.style.background=FIN[p.fin];
    pill.append(sw,document.createTextNode(p.fin||SEM));c3.append(pill);
    const c4=el("td","sit",p.sit_atual||"–");c4.title=p.sit_atual||"";
    const cl=el("td");
    if(p.link&&/^https:\/\//.test(p.link)){const a=el("a","lnk");a.href=p.link;a.target="_blank";a.rel="noopener noreferrer";a.title="Abrir projeto no ProjetaSC";a.setAttribute("aria-label","Abrir projeto "+p.id+" no ProjetaSC");a.append(icone());cl.append(a)}else cl.textContent="–";
    tr.append(el("td","",p.id),c0,el("td","",p.mun),c3,c4,
      el("td","n",pt(p.km,2)),el("td","n",pt(p.km_pav,2)),
      el("td","n",brlFull(p.plan)),el("td","n",p.conv?brlFull(p.conv):"–"),el("td","n",p.apor?brlFull(p.apor):"–"),
      el("td","",p.sgpe||"–"),cl,el("td","",p.assoc),el("td","",p.regiao));tb.append(tr)});
  const tf=$("tf");tf.replaceChildren();
  if(rs.length){const tr=el("tr");const vz=()=>el("td");
    tr.append(el("td","","Total exibido"),vz(),vz(),vz(),vz(),el("td","n",pt(sum(rs,"km"),2)),el("td","n",pt(sum(rs,"km_pav"),2)),el("td","n",brlFull(sum(rs,"plan"))),el("td","n",brlFull(sum(rs,"conv"))),el("td","n",brlFull(sum(rs,"apor"))),vz(),vz(),vz(),vz());tf.append(tr)}
  $("cnt").textContent=rs.length+" de "+P.length+" projetos exibidos";
}

/* ---------- Situação atual: distribuição real, clicável ---------- */
function contaSit(){
  const c={};P.filter(p=>ok(p,"z")).forEach(p=>{const k=p.sit_atual||"Sem situação informada";c[k]=(c[k]||0)+1});
  return Object.entries(c).sort((a,b)=>b[1]-a[1]);
}
function renderSituacao(){
  const l=contaSit(),tot=l.reduce((s,x)=>s+x[1],0),max=l.length?l[0][1]:1,box=$("sit");box.replaceChildren();
  if(!l.length){box.append(el("p","nota","Nenhum projeto no filtro atual."))}
  l.forEach(([k,v])=>{
    const b=el("button","sitrow"+(F.z===k?" sel":""));b.type="button";b.setAttribute("aria-pressed",String(F.z===k));
    const tk=el("div","tk"),i=el("i");i.style.width=pct(v,max)+"%";tk.append(i);
    const nv=el("span","nv"),nb=el("b","",String(v));nv.append(nb,el("span","",pt(pct(v,tot),0)+"%"));
    b.append(el("span","tx",k),tk,nv);
    b.addEventListener("click",()=>{F.z=F.z===k?"":k;render()});
    bindTip(b,k,[{c:"var(--green)",v:v+(v>1?" projetos":" projeto"),n:pt(pct(v,tot),1)+"% do filtro atual"}]);
    box.append(b)});
  const t=el("table","tv"),hr=el("tr");["Situação atual","Projetos","% do total"].forEach((h,i)=>hr.append(el("th",i?"n":"",h)));
  const th=el("thead");th.append(hr);t.append(th);const tb=el("tbody");
  l.forEach(([k,v])=>{const q=el("tr");q.append(el("td","",k),el("td","n",String(v)),el("td","n",pt(pct(v,tot),1)+"%"));tb.append(q)});
  t.append(tb);document.querySelector("#pSit .view-t").replaceChildren(t);
}

/* ---------- Render único: todos os blocos saem das mesmas linhas filtradas ---------- */
let primeira=true;
function render(){
  atualizaOpcoes();
  const r=P.filter(p=>ok(p));
  renderTopo(r);renderFontes(r);tabelaFontes(r);renderMapa(r);renderSituacao();renderTabela(r);
  if(primeira){primeira=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{root.classList.add("ready");contar()}))}
  else document.querySelectorAll("[data-count]").forEach(n=>{n.textContent=pt(+n.dataset.count,+n.dataset.dec||0)});
}

/* ---------- Cabeçalho e rodapé com a origem dos dados ---------- */
(function(){
  const dt=new Date(D.meta.gerado_em);
  const txt=isNaN(dt)?D.meta.gerado_em:dt.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).replace(",","");
  $("stamp").textContent="Planilhas processadas em "+txt;
  $("fonte").textContent="Fonte: "+D.meta.arquivos.length+" planilhas exportadas ("+D.meta.arquivos.join(", ")+"). Protótipo independente, sem vínculo oficial.";
  const av=$("avisos");(D.meta.avisos.length?D.meta.avisos:["Nenhum aviso."]).forEach(a=>av.append(el("li","",a)));
})();
renderFontesPendentes();
themeBtn();render();
