(function(){
const h=React.createElement;
const CLARO='#DA291C';
const GF_COLORS=['#2563EB','#16A34A','#F59E0B','#7C3AED'];
const EXCEPTION_NAO_CABO='Exceção Não Cabo';
const PERF_COLORS={
  'Zerado':'#111827','Crítico':'#EF4444','Baixa Performance':'#F97316',
  'Oportunidade':'#EAB308','Produtivo':'#22C55E','Sem dado':'#94A3B8',
  [EXCEPTION_NAO_CABO]:'#64748B'
};
const METRICS=[['bl','Banda Larga'],['tv','TV'],['pos','Pós Total'],['conta','Conta'],['controle','Controle']];
const NAV=[
  ['overview','⌂','Visão Gerencial'],['products','◫','Produtos'],['gns','●','Gerentes de Negócios'],
  ['groups','▦','Grupo Rede'],['stores','▣','Lojas'],['map','⌖','Mapa de Lojas'],
  ['routes','↝','Roteirização'],['methodology','ⓘ','Critérios e Indicadores']
];
function firstName(n){if(String(n).startsWith('VAGO'))return n;return String(n).split(/\s+/).slice(0,2).join(' ')}
function initials(n){const b=String(n||'').trim().split(/\s+/);return b.length>1?(b[0][0]+b[b.length-1][0]).toUpperCase():String(n||'?').slice(0,2).toUpperCase()}
function cargoClass(c){return c==='Cargo III'?'cargo-iii':c==='Cargo II'?'cargo-ii':c==='Cargo I'?'cargo-i':'cargo-vago'}
function gfColor(data,n){const i=data.gfs.findIndex(x=>x.name===n);return GF_COLORS[Math.max(0,i)%GF_COLORS.length]}
function matchesGt(item,gt){return gt==='Todos'||item.gt===gt||(item.gtNames&&item.gtNames.includes(gt))}
function gfsForGt(data,gt){return data.gfs.filter(g=>matchesGt(g,gt))}
function scopeStores(data,gt,gf){return data.stores.filter(s=>matchesGt(s,gt)&&(gf==='Todos'||s.gf===gf))}
function scopeName(gt,gf){if(gt==='Todos'&&gf==='Todos')return 'Todos os Territoriais';if(gf!=='Todos')return firstName(gf);return 'GT '+firstName(gt)}
function uniqueCount(items,key){return new Set(items.map(x=>x[key]).filter(Boolean)).size}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function metricLabel(k){const m=METRICS.find(x=>x[0]===k);return m?m[1]:k}
function officialStatus(store,product){const p=store.performance[product];return p?p.status:'Sem dado'}
function statusDisplay(store,product){const p=store.performance[product]||{};if(!p.status)return 'Sem dado';if(p.status===EXCEPTION_NAO_CABO)return EXCEPTION_NAO_CABO;if(p.exceptionLabel)return p.status+' • '+p.exceptionLabel;return p.status}
function isProductivityEligible(store,product){const p=store.performance[product];return !p||p.productiveEligible!==false}
function visualStatus(store,product){const p=store.performance[product];if(!p)return 'Sem dado';if(p.status===EXCEPTION_NAO_CABO)return EXCEPTION_NAO_CABO;return p.status}
function statusSymbol(st){if(st===EXCEPTION_NAO_CABO)return 'NC';if(st==='Produtivo')return '✓';if(st==='Oportunidade')return '•';if(st==='Baixa Performance'||st==='Crítico')return '!';if(st==='Zerado')return '0';return '?'}
function googleStoreUrl(s){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.lat+','+s.lon)}
function googleDirectionsUrl(route){
  const pts=(route||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).slice(0,11);
  if(!pts.length)return 'https://www.google.com/maps';
  if(pts.length===1)return googleStoreUrl(pts[0]);
  const origin=pts[0].lat+','+pts[0].lon,dest=pts[pts.length-1].lat+','+pts[pts.length-1].lon;
  const way=pts.slice(1,-1).map(p=>p.lat+','+p.lon).join('|');
  let u='https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(origin)+'&destination='+encodeURIComponent(dest)+'&travelmode=driving';
  if(way)u+='&waypoints='+encodeURIComponent(way);
  return u;
}
function haversineKm(a,b){
  const r=6371.0088,lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180,dlat=(b.lat-a.lat)*Math.PI/180,dlon=(b.lon-a.lon)*Math.PI/180;
  const x=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(x)));
}
function routeDistanceKm(route){
  let total=0;
  for(let i=1;i<(route||[]).length;i++)total+=haversineKm(route[i-1],route[i]);
  return Math.round(total*10)/10;
}
function routePriorityScore(store,product){
  if(!product)return Math.max(...METRICS.map(([key])=>routePriorityScore(store,key)));
  const p=store.performance[product],v=p&&p.value,st=p&&p.status;
  if(p&&p.productiveEligible===false)return 0;
  if(st==='Zerado')return 500;
  if(st==='Crítico')return 400-(v||0);
  if(st==='Baixa Performance')return 300-(v||0);
  if(st==='Oportunidade')return 200-(v||0);
  if(st==='Produtivo')return 100-(v||0)/10;
  return 0;
}
function prioritySortedStores(stores,product){
  return stores.slice().sort((a,b)=>routePriorityScore(b,product)-routePriorityScore(a,product)||String(a.city).localeCompare(String(b.city))||String(a.code).localeCompare(String(b.code)));
}
function buildVisitRoute(stores,product){
  const points=prioritySortedStores(stores.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)),product);
  if(points.length<3)return points;
  const route=[points.shift()];
  while(points.length){
    const current=route[route.length-1];
    const idx=points.reduce((best,_,i)=>haversineKm(current,points[i])<haversineKm(current,points[best])?i:best,0);
    route.push(points.splice(idx,1)[0]);
  }
  return route;
}
function routeStoreWorstMetric(store){
  return METRICS.map(([key,label])=>({key,label,p:store.performance[key],score:routePriorityScore(store,key)}))
    .filter(x=>x.p&&x.p.value!=null)
    .sort((a,b)=>b.score-a.score)[0]||null;
}
function routeStoreStatus(store){
  const worst=routeStoreWorstMetric(store);
  return worst?worst.p.status:'Sem dado';
}
function routeStoreStatusText(store){
  const worst=routeStoreWorstMetric(store);
  return worst?statusDisplay(store,worst.key)+' • '+worst.label+' '+pctText(worst.p.value):'Sem dado';
}
function routeStatsForStores(stores){
  let zero=0,critical=0,low=0,opportunity=0,productive=0,exception=0,valid=0;
  stores.forEach(s=>{
    const worst=routeStoreWorstMetric(s),st=worst?worst.p.status:'Sem dado';
    if(st==='Sem dado')return;
    if(worst&&worst.p.exceptionLabel)exception++;
    if(st===EXCEPTION_NAO_CABO)return;
    valid++;
    if(st==='Zerado')zero++;
    else if(st==='Crítico')critical++;
    else if(st==='Baixa Performance')low++;
    else if(st==='Oportunidade')opportunity++;
    else if(st==='Produtivo')productive++;
  });
  return {zero,critical,low,below80:critical+low,opportunity,productive,exception,valid,productivePct:valid?Math.round(productive/valid*1000)/10:0};
}
function routeStatusSummary(stores,product){
  const st=product?statsForStores(stores,product):routeStatsForStores(stores);
  return attentionBreakdownText(st)+' • '+st.productive+' produtivas';
}
function statusClassName(status){
  if(status===EXCEPTION_NAO_CABO)return 'exception';
  if(status==='Zerado')return 'zero';
  if(status==='Crítico')return 'critical';
  if(status==='Baixa Performance')return 'low';
  if(status==='Oportunidade')return 'opp';
  if(status==='Produtivo')return 'prod';
  return 'nodata';
}
function productCell(store,key){
  const p=store.performance[key]||{},value=p.value==null?'sem %':pctText(p.value),st=p.status||'Sem dado';
  return `<td class="${statusClassName(st)}"><b>${esc(fmtNumber(p.realized))} vol</b><span>${esc(value)} • ${esc(statusDisplay(store,key))}</span></td>`;
}
function exportRoutePdf(route,context){
  const title='Roteiro de visitas';
  const rows=route.map((s,i)=>`<tr><td>${i+1}</td><td><b>${esc(s.code)}</b><br><span>${esc(s.name)}</span></td><td>${esc(s.city)}<br><span>${esc(s.group)}</span></td><td>${esc(firstName(s.gn))}<br><span>${esc(firstName(s.gf))}</span></td>${METRICS.map(([key])=>productCell(s,key)).join('')}</tr>`).join('');
  const win=window.open('','_blank');
  if(!win)return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Segoe UI,Arial,sans-serif;margin:18px;color:#252525}h1{margin:0 0 8px;font-size:22px}.export-info{margin:0 0 12px;color:#555;font-size:11px;line-height:1.45}.export-info b{color:#252525}table{width:100%;border-collapse:collapse;margin-top:10px}th{background:#252525;color:#fff;text-align:left;font-size:9px;padding:6px}td{border-bottom:1px solid #e5e5e5;font-size:9px;padding:6px;vertical-align:top}td span{color:#666;font-size:8px}td b{font-size:10px}.zero{background:#f3f4f6}.critical{background:#fee2e2}.low{background:#ffedd5}.opp{background:#fef9c3}.prod{background:#dcfce7}.exception{background:#e2e8f0}.nodata{background:#f8fafc}@media print{body{margin:12px}tr{page-break-inside:avoid}}</style></head><body><h1>${title}</h1><p class="export-info"><b>Data de exportação:</b> ${new Date().toLocaleDateString('pt-BR')}<br><b>Filtros selecionados:</b> ${esc(context)}</p><table><thead><tr><th>#</th><th>Loja</th><th>Cidade / Grupo</th><th>GN / GF</th>${METRICS.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=function(){setTimeout(function(){window.print()},250)}</script></body></html>`);
  win.document.close();
}
function statsForStores(stores,product){
  return statsFromEntries(stores.map(s=>s.performance[product]));
}
function groupBy(items,keyFn){const out={};items.forEach(x=>{const k=keyFn(x);(out[k]||(out[k]=[])).push(x)});return out}
function groupsForStores(stores){return [...new Set(stores.map(s=>s.group).filter(Boolean))].sort()}
function filterStoresByGroup(stores,group){return group==='Todos'?stores:stores.filter(s=>s.group===group)}
function fmtNumber(v){return v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:0})}
function statsFromEntries(entries){
  let zero=0,critical=0,low=0,opportunity=0,productive=0,exception=0,valid=0,realized=0,target=0;
  entries.forEach(p=>{
    if(!p||p.realized==null&&p.value==null)return;
    if(p.realized!=null)realized+=Number(p.realized)||0;
    if(p.exceptionLabel)exception++;
    if(p.productiveEligible===false||p.status===EXCEPTION_NAO_CABO)return;
    if(p.value==null)return;
    valid++;
    if(p.target!=null)target+=Number(p.target)||0;
    if(p.status==='Zerado')zero++;
    else if(p.status==='Crítico')critical++;
    else if(p.status==='Baixa Performance')low++;
    else if(p.status==='Oportunidade')opportunity++;
    else if(p.status==='Produtivo')productive++;
  });
  return {zero,critical,low,below80:critical+low,opportunity,productive,exception,valid,realized,target,attainmentPct:target?Math.round(realized/target*1000)/10:null,productivePct:valid?Math.round(productive/valid*1000)/10:0};
}
function problemRanking(stores,product,keyFn){
  const groups=groupBy(stores,keyFn);
  return Object.keys(groups).map(name=>{
    const stats=statsForStores(groups[name],product);
    return {name,stores:groups[name].length,stats,problem:stats.zero+stats.below80,productivePct:stats.productivePct};
  }).sort((a,b)=>b.stats.zero-a.stats.zero||b.problem-a.problem||b.stats.critical-a.stats.critical||b.stats.low-a.stats.low||b.stats.opportunity-a.stats.opportunity||b.stores-a.stores);
}
function productProblemCount(stores,product){
  const s=statsForStores(stores,product);
  return {count:s.zero+s.below80,stats:s};
}
function farolClass(stats){
  if(stats.zero>0)return 'red';
  if(stats.below80>0)return 'orange';
  if(stats.opportunity>0)return 'yellow';
  if(stats.exception>0)return 'gray';
  return 'green';
}
function farolLabel(stats){
  if(stats.zero>0)return 'Zerado';
  if(stats.below80>0)return 'Abaixo de 80%';
  if(stats.opportunity>0)return 'Oportunidade';
  if(stats.exception>0)return 'Exceção';
  return 'Produtivo';
}
function childSummary(stores,level){
  const gfs=uniqueCount(stores,'gf'),gns=uniqueCount(stores,'gn'),groups=uniqueCount(stores,'group');
  if(level==='Territorial')return gfs+' filiais • '+gns+' GNs • '+groups+' grupos';
  if(level==='Filial')return gns+' GNs • '+groups+' grupos';
  if(level==='GN')return groups+' grupos';
  return gns+' GNs • '+gfs+' filiais';
}
function farolStructureCards(row){
  const cards=[['Lojas',row.stores,'main']];
  if(row.level==='Territorial')cards.push(['Filiais',row.gfs,'owner'],['GNs',row.gns,'owner']);
  else if(row.level==='Filial')cards.push(['GNs',row.gns,'owner']);
  else if(row.level==='Grupo Rede')cards.push(['GNs',row.gns,'owner'],['Filiais',row.gfs,'owner']);
  cards.push(['Cidades',row.cities,''],['DDDs',row.dddList,'ddd']);
  if(row.level!=='Grupo Rede')cards.push(['Grupos',row.groups,'']);
  return cards;
}
function farolStatusCards(stats){
  return [
    ['Zeradas',stats.zero,'danger'],
    ['Críticas',stats.critical,'critical'],
    ['Baixa',stats.low,'low'],
    ['Oportun.',stats.opportunity,'opp'],
    ['Produtivas',stats.productive,'prod'],
    ['Exceções',stats.exception||0,'exception']
  ];
}
function compactDddList(stores){
  const ddds=[...new Set(stores.map(s=>s.ddd).filter(v=>v!==null&&v!==undefined&&v!==''))]
    .sort((a,b)=>Number(a)-Number(b)||String(a).localeCompare(String(b)));
  return ddds.length?ddds.join(', '):'—';
}
function farolMetricLabel(key,label){
  return key==='bl'?'BL':label;
}
function farolRowsFor(stores,level,keyFn,product,onClick){
  const groups=groupBy(stores,keyFn);
  return Object.keys(groups).map(name=>{
    const rows=groups[name],stats=statsForStores(rows,product);
    const radar=METRICS.map(([key,label])=>({key,label:farolMetricLabel(key,label),...productProblemCount(rows,key)}));
    return {level,name,storeList:rows,stores:rows.length,cities:uniqueCount(rows,'city'),ddds:uniqueCount(rows,'ddd'),dddList:compactDddList(rows),groups:uniqueCount(rows,'group'),gfs:uniqueCount(rows,'gf'),gns:uniqueCount(rows,'gn'),stats,radar,onClick};
  }).sort((a,b)=>b.stats.zero-a.stats.zero||(b.stats.zero+b.stats.below80)-(a.stats.zero+a.stats.below80)||b.stats.opportunity-a.stats.opportunity||b.stores-a.stores||a.name.localeCompare(b.name));
}
function pctText(v){return v==null?'sem %':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'}
function attentionBreakdownText(stats){
  const parts=[];
  if(stats.zero)parts.push(stats.zero+' '+(stats.zero===1?'zerada':'zeradas'));
  if(stats.critical)parts.push(stats.critical+' '+(stats.critical===1?'crítica':'críticas'));
  if(stats.low)parts.push(stats.low+' em Baixa Performance');
  if(stats.opportunity)parts.push(stats.opportunity+' '+(stats.opportunity===1?'oportunidade':'oportunidades'));
  if(stats.exception)parts.push(stats.exception+' '+(stats.exception===1?'exceção Não Cabo':'exceções Não Cabo'));
  if(!parts.length)return 'sem pontos de atenção';
  if(parts.length===1)return parts[0];
  return parts.slice(0,-1).join(', ')+' e '+parts[parts.length-1];
}
function diagnosisText(name,stats,product){
  const p=metricLabel(product);
  if(stats.zero>0)return name+' possui '+stats.zero+' loja(s) zerada(s) em '+p+' e '+stats.below80+' abaixo de 80%. Prioridade de investigação.';
  if(stats.below80>0)return name+' concentra '+stats.below80+' loja(s) abaixo de 80% em '+p+'. Oportunidade de atuação.';
  if(stats.opportunity>0)return name+' tem '+stats.opportunity+' loja(s) entre 80% e 99% em '+p+', próximas da meta.';
  if(stats.exception>0)return name+' possui '+stats.exception+' loja(s) Não Cabo em exceção para '+p+'. Não tratar como problema operacional de BL.';
  return name+' apresenta boa concentração de lojas produtivas em '+p+'.';
}
class Avatar extends React.Component{
  constructor(props){super(props);this.state={failed:false}}
  componentDidUpdate(prev){
    const a=prev.person&&prev.person.photoFile,b=this.props.person&&this.props.person.photoFile;
    if(a!==b&&this.state.failed)this.setState({failed:false});
  }
  render(){
    const {data,person,size='md'}=this.props,src=person&&person.photoFile;
    return h('div',{className:'avatar '+size+(src&&!this.state.failed?' has-photo':''),style:{'--avatar':gfColor(data,(person&&person.gf)||(person&&person.name))}},
      src&&!this.state.failed?h('img',{src:src,alt:'Foto de '+person.name,onError:()=>this.setState({failed:true})}):null,
      (!src||this.state.failed)?h('span',{className:'avatar-initials'},person.initials||initials(person.name)):null
    );
  }
}
function Card({title,subtitle,children,action,className}){
  return h('section',{className:'card '+(className||'')},
    (title||action)?h('div',{className:'card-head'},h('div',null,title&&h('h3',null,title),subtitle&&h('p',null,subtitle)),action||null):null,
    children
  );
}
function PageHead({eyebrow,title,text,right}){return h('div',{className:'page-head'},h('div',null,eyebrow&&h('span',{className:'eyebrow'},eyebrow),h('h1',null,title),text&&h('p',null,text)),right||null)}
function ProductTabs({product,setProduct,compact}){return h('div',{className:'product-tabs '+(compact?'compact':'')},...METRICS.map(m=>h('button',{key:m[0],className:product===m[0]?'active':'',onClick:()=>setProduct(m[0])},m[1])))}
function StatCard({label,value,kind,sub}){return h('div',{className:'status-card '+kind},h('span',null,label),h('b',null,value),sub&&h('small',null,sub))}
function FarolTable({data,stores,product,setGt,setGf,selectGn,selectNode,setMapGroup}){
  const sections=[
    {title:'Territorial',rows:farolRowsFor(stores,'Territorial',s=>s.gt,product),click:r=>selectNode('gt',r.name)},
    {title:'Filial',rows:farolRowsFor(stores,'Filial',s=>s.gf,product),click:r=>selectNode('gf',r.name)},
    {title:'GN',rows:farolRowsFor(stores,'GN',s=>s.gn,product),click:r=>selectGn(data.gns.find(g=>g.name===r.name))},
    {title:'Grupo Rede',rows:farolRowsFor(stores,'Grupo Rede',s=>s.group,product),click:r=>setMapGroup(r.name)}
  ];
  const renderRow=(row,onClick)=>h('button',{className:'farol-tr farol-row',key:row.level+row.name,onClick:()=>onClick(row)},
    h('span',{className:'farol-name'},h('i',{className:'farol-light '+farolClass(row.stats)}),h('b',null,row.name)),
    h('span',{className:'farol-structure'},
      ...farolStructureCards(row).map(x=>h('i',{key:x[0],className:'farol-card-chip '+x[2]},h('small',null,x[0]),h('b',null,x[1])))
    ),
    h('span',{className:'farol-current'},
      ...farolStatusCards(row.stats).map(x=>h('i',{key:x[0],className:'farol-card-chip '+x[2]},h('small',null,x[0]),h('b',null,x[1])))
    ),
    h('span',{className:'farol-radar'},...row.radar.map(x=>h('i',{key:x.key,className:x.key===product?'active':''},h('small',null,x.label),h('b',null,x.count))))
  );
  return h('div',{className:'farol-table'},
    h('div',{className:'farol-tr farol-th'},h('span',null,'Farol'),h('span',null,'Resumo do canal'),h('span',null,metricLabel(product)),h('span',null,'Produtos abaixo de 80%')),
    ...sections.flatMap(section=>[
      h('div',{className:'farol-section',key:'sec'+section.title},section.title),
      ...section.rows.map(row=>renderRow(row,section.click))
    ])
  );
}
function GfCard({data,gf,onClick,active}){
  return h('button',{className:'profile-card '+(active?'selected':''),style:{'--accent':gfColor(data,gf.name)},onClick:()=>onClick(gf)},
    h('div',{className:'profile-top'},h(Avatar,{data,person:gf,size:'lg'}),h('div',null,h('span',{className:'eyebrow'},'Gerente Filial'),h('h4',null,firstName(gf.name)))),
    h('div',{className:'profile-kpis'},...[[gf.gns,'GNs'],[gf.stores,'Lojas'],[gf.cities,'Cidades'],[gf.ddds,'DDDs']].map((x,i)=>h('div',{key:i},h('b',null,x[0]),h('span',null,x[1])))),
    h('div',{className:'profile-link'},active?'Filial selecionada':'Filtrar visão →')
  );
}
function GtCard({gt,onClick,active}){
  return h('button',{className:'profile-card gt-card '+(active?'selected':''),style:{'--accent':'#252525'},onClick:()=>onClick(gt)},
    h('div',{className:'profile-top'},h('div',{className:'avatar lg',style:{'--avatar':'#252525'}},h('span',{className:'avatar-initials'},gt.initials||initials(gt.name))),h('div',null,h('span',{className:'eyebrow'},'Gerente Territorial'),h('h4',null,firstName(gt.name)))),
    h('div',{className:'profile-kpis'},...[[gt.gfs,'GFs'],[gt.gns,'GNs'],[gt.stores,'Lojas'],[gt.cities,'Cidades']].map((x,i)=>h('div',{key:i},h('b',null,x[0]),h('span',null,x[1])))),
    h('div',{className:'profile-link'},active?'Territorial selecionado':'Filtrar território →')
  );
}
class MapBox extends React.Component{
  constructor(props){super(props);this.mapId='leaflet-'+Math.random().toString(36).slice(2);this.map=null}
  componentDidMount(){this.draw()}
  componentDidUpdate(prev){if(prev.stores!==this.props.stores||prev.product!==this.props.product||prev.route!==this.props.route||prev.statusMode!==this.props.statusMode)this.draw()}
  componentWillUnmount(){if(this.map)this.map.remove()}
  draw(){
    if(!window.L)return;
    const data=this.props.data,product=this.props.product||'bl',list=this.props.stores||data.stores,route=this.props.route||null,statusMode=this.props.statusMode||'product';
    const valid=list.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon));
    if(this.map){this.map.remove();this.map=null}
    this.map=L.map(this.mapId,{preferCanvas:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(this.map);
    const bounds=[];
    valid.forEach(s=>{
      bounds.push([s.lat,s.lon]);
      const st=statusMode==='route'?routeStoreStatus(s):visualStatus(s,product),border=PERF_COLORS[st]||'#94A3B8',fill=gfColor(data,s.gf),display=statusMode==='route'?routeStoreStatusText(s):statusDisplay(s,product);
      const statusLabel=statusMode==='route'?'Pior status':metricLabel(product);
      const html='<div class="store-map-pin" style="background:'+fill+';border-color:'+border+'"><span>'+statusSymbol(st)+'</span></div>';
      const icon=L.divIcon({className:'store-map-pin-wrap',html,iconSize:[24,24],iconAnchor:[12,12]});
      L.marker([s.lat,s.lon],{icon}).addTo(this.map)
        .bindTooltip(esc(s.code)+' • '+esc(s.city)+' • '+esc(display),{direction:'top'})
        .bindPopup('<div class="map-popup"><b>'+esc(s.code)+'</b><span>'+esc(s.city)+' • DDD '+esc(s.ddd)+'</span><small>'+esc(firstName(s.gn))+' • '+esc(statusLabel)+': '+esc(display)+'</small><a href="'+googleStoreUrl(s)+'" target="_blank" rel="noopener">Abrir no Google Maps ↗</a></div>');
    });
    if(route&&route.length){
      const seq=route.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
      if(seq.length>1)L.polyline(seq.map(p=>[p.lat,p.lon]),{color:CLARO,weight:4,opacity:.85,dashArray:'10 7'}).addTo(this.map);
    }
    if(bounds.length>1)this.map.fitBounds(bounds,{padding:[24,24],maxZoom:11});
    else if(bounds.length===1)this.map.setView(bounds[0],12);
    else this.map.setView([-22.3,-48.5],6);
    setTimeout(()=>this.map&&this.map.invalidateSize(),80);
  }
  render(){return h('div',{className:'mapbox leaflet-shell',style:{height:this.props.height||390}},h('div',{id:this.mapId,className:'leaflet-host'}))}
}
function PerfLegend({data}){
  const perf=['Zerado','Crítico','Baixa Performance','Oportunidade','Produtivo',EXCEPTION_NAO_CABO];
  return h('div',{className:'dual-legend'},
    h('div',null,h('b',null,'Cor interna = Gerente Filial'),h('div',{className:'legend-line'},...data.gfs.map(g=>h('span',{key:g.name},h('i',{style:{background:gfColor(data,g.name)}}),firstName(g.name))))),
    h('div',null,h('b',null,'Borda / sinal = produtividade'),h('div',{className:'legend-line'},...perf.map(st=>h('span',{key:st},h('i',{className:'ring',style:{borderColor:PERF_COLORS[st]}},statusSymbol(st)),st))))
  );
}
function hierarchyStores(data,node){
  if(!node)return [];
  if(node.level==='gt')return data.stores.filter(s=>s.gt===node.name);
  if(node.level==='gf')return data.stores.filter(s=>s.gf===node.name);
  if(node.level==='gn')return data.stores.filter(s=>s.gn===node.name);
  return [];
}
function hierarchyPerson(data,node){
  if(!node)return null;
  if(node.level==='gt')return data.gts.find(x=>x.name===node.name)||{name:node.name,initials:initials(node.name)};
  if(node.level==='gf')return data.gfs.find(x=>x.name===node.name)||{name:node.name,initials:initials(node.name)};
  if(node.level==='gn')return data.gns.find(x=>x.name===node.name)||{name:node.name,initials:initials(node.name)};
  return null;
}
function hierarchyLabel(level){
  if(level==='gt')return 'Gerente Territorial';
  if(level==='gf')return 'Gerente Filial';
  return 'Gerente de Negócios';
}
function hierarchyKpis(stores,level){
  const base=[[stores.length,'Lojas'],[uniqueCount(stores,'city'),'Cidades'],[uniqueCount(stores,'ddd'),'DDDs'],[uniqueCount(stores,'group'),'Grupos']];
  if(level==='gt')return [[uniqueCount(stores,'gf'),'Filiais'],[uniqueCount(stores,'gn'),'GNs'],...base];
  if(level==='gf')return [[uniqueCount(stores,'gn'),'GNs'],...base];
  return base;
}
function productSignals(stores){
  return METRICS.map(([key,label])=>({key,label,stats:statsForStores(stores,key)}))
    .sort((a,b)=>b.stats.zero-a.stats.zero||(b.stats.zero+b.stats.below80)-(a.stats.zero+a.stats.below80)||a.label.localeCompare(b.label));
}
function Drawer({data,node,onClose,onRoute,onFilter,onSelectNode,product}){
  if(!node)return null;
  const stores=hierarchyStores(data,node),person=hierarchyPerson(data,node),st=statsForStores(stores,product),isGt=node.level==='gt',isGf=node.level==='gf',isGn=node.level==='gn';
  const productRows=productSignals(stores),problemStores=prioritySortedStores(stores,product).slice(0,isGn?999:8);
  const gfRank=isGt?problemRanking(stores,product,s=>s.gf).slice(0,5):[];
  const gnRank=!isGn?problemRanking(stores,product,s=>s.gn).slice(0,isGt?6:8):[];
  const groupRank=problemRanking(stores,product,s=>s.group).slice(0,isGt?5:4);
  const cityRank=isGt?problemRanking(stores,product,s=>s.city).slice(0,5):[];
  const subtitle=isGn?(person.gt+' → '+person.gf):(isGf?(person.gtNames?person.gtNames.join(' • '):person.gt):uniqueCount(stores,'gf')+' filiais • '+uniqueCount(stores,'gn')+' GNs');
  const rankRow=(x,label,click)=>h('button',{className:'drawer-rank-row',key:label+x.name,onClick:click},h('span',null,x.name),h('b',null,x.problem),h('small',null,attentionBreakdownText(x.stats)));
  const productRow=x=>h('div',{className:'drawer-product-row '+(x.key===product?'active':''),key:x.key},
    h('b',null,x.label),
    h('span',{className:'txt-zero'},x.stats.zero+' zeradas'),
    h('span',{className:'txt-low'},x.stats.below80+' baixa/critico'),
    h('span',null,x.stats.opportunity+' oportunidade'),
    h('strong',null,x.stats.productive+' produtivas'),
    h('small',null,(x.stats.exception||0)+' excecoes')
  );
  return h('div',{className:'drawer-backdrop',onMouseDown:onClose},
    h('aside',{className:['drawer',isGt?'drawer-wide':'',isGf?'drawer-mid':''].filter(Boolean).join(' '),onMouseDown:e=>e.stopPropagation()},
      h('button',{className:'drawer-close',onClick:onClose},'✕'),
      h('div',{className:'drawer-profile'},
        h(Avatar,{data,person:person,size:'xl'}),
        h('div',null,
          h('span',{className:'eyebrow'},hierarchyLabel(node.level)),
          h('h2',null,person.name),
          isGn?h('span',{className:'cargo-badge '+cargoClass(person.cargo)},person.cargo):null,
          h('p',null,subtitle)
        )
      ),
      h('div',{className:'drawer-kpis hierarchy-kpis'},...hierarchyKpis(stores,node.level).map((x,i)=>h('div',{key:i},h('b',null,x[0]),h('span',null,x[1])))),
      h('div',{className:'quick-diagnosis'},h('b',null,'Leitura rápida • '+metricLabel(product)),h('p',null,diagnosisText(firstName(person.name),st,product))),
      h('div',{className:'status-grid drawer-status'},h(StatCard,{label:'Zeradas',value:st.zero,kind:'zero'}),h(StatCard,{label:'Baixa / Crítico',value:st.below80,kind:'low'}),h(StatCard,{label:'Oportunidade',value:st.opportunity,kind:'opp'}),h(StatCard,{label:'Produtivas',value:st.productive,kind:'prod'}),h(StatCard,{label:'Exceções Não Cabo',value:st.exception||0,kind:'exception'})),
      isGn?h('button',{className:'google-maps-btn',onClick:()=>onRoute(person)},'Ver circuito da carteira'):h('div',{className:'drawer-action-row'},h('button',{className:'google-maps-btn',onClick:()=>onFilter(node)},'Aplicar este recorte no painel')),
      h('h3',{className:'section-title'},'Produtos no recorte'),
      h('div',{className:'drawer-product-grid'},...productRows.map(productRow)),
      !isGn?h('div',{className:'drawer-section-grid'},
        isGt?h('section',{className:'drawer-rank'},h('h3',null,'Filiais que requerem atenção'),...gfRank.map(x=>rankRow(x,'gf',()=>onSelectNode('gf',x.name)))):null,
        h('section',{className:'drawer-rank'},h('h3',null,'GNs que requerem atenção'),...gnRank.map(x=>rankRow(x,'gn',()=>onSelectNode('gn',x.name)))),
        h('section',{className:'drawer-rank'},h('h3',null,'Grupos Rede'),...groupRank.map(x=>rankRow(x,'group',null))),
        isGt?h('section',{className:'drawer-rank'},h('h3',null,'Cidades com atenção'),...cityRank.map(x=>rankRow(x,'city',null))):null
      ):null,
      h('h3',{className:'section-title'},(isGn?'Lojas • ':'Principais lojas para agir • ')+metricLabel(product)),
      h('div',{className:'store-list hierarchy-store-list'},...problemStores.map(s=>h('div',{className:'store-row',key:s.code},h('div',null,h('b',null,s.code),h('span',null,s.city+' • '+s.group+(isGn?'':' • '+firstName(s.gn)))),h('span',{className:'status-chip'},fmtNumber(s.performance[product]&&s.performance[product].realized)+' vol • '+pctText(s.performance[product]&&s.performance[product].value)+' • '+statusDisplay(s,product)))))
    )
  );
}
function Overview({data,product,setProduct,gt,setGt,gf,setGf,selectGn,selectNode,setPage,mapGroup,setMapGroup}){
  const availableGfs=gfsForGt(data,gt);
  const scope=scopeStores(data,gt,gf);
  const mapGroups=groupsForStores(scope);
  const activeMapGroup=mapGroup==='Todos'||mapGroups.includes(mapGroup)?mapGroup:'Todos';
  const mapStores=filterStoresByGroup(scope,activeMapGroup);
  const viewScope=mapStores;
  const st=statsForStores(viewScope,product);
  const channelKpis=[
    ['Lojas',viewScope.length],['Cidades',uniqueCount(viewScope,'city')],['DDDs',uniqueCount(viewScope,'ddd')],['Grupos Rede',uniqueCount(viewScope,'group')],
    ['Territoriais',uniqueCount(viewScope,'gt')],['Filiais',uniqueCount(viewScope,'gf')],['GNs',uniqueCount(viewScope,'gn')]
  ];
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'',title:'Visão Gerencial',text:'',right:h('span',{className:'pill'},data.meta.period)}),
    h('div',{className:'manager-control-strip'},
      h('label',null,h('span',null,'Territorial'),h('select',{value:gt,onChange:e=>{setGt(e.target.value);setGf('Todos')}},h('option',{value:'Todos'},'Todos os Territoriais'),...data.gts.map(t=>h('option',{key:t.name,value:t.name},t.name)))),
      h('label',null,h('span',null,'Filial'),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...availableGfs.map(g=>h('option',{key:g.name,value:g.name},g.name)))),
      h('label',null,h('span',null,'Grupo Rede'),h('select',{value:activeMapGroup,onChange:e=>setMapGroup(e.target.value)},h('option',{value:'Todos'},'Todos os Grupos'),...mapGroups.map(x=>h('option',{key:x,value:x},x)))),
      h('div',{className:'manager-product-filter'},h('span',null,'Produto'),h(ProductTabs,{product,setProduct,compact:true})),
      h('button',{className:'outline-btn clear-filter-btn',onClick:()=>{setGt('Todos');setGf('Todos');setMapGroup('Todos')}},'Limpar')
    ),
    h('section',{className:'manager-hero'},
      h('div',{className:'manager-channel-card'},
        h('div',{className:'manager-channel-head'},
          h('div',null,h('span',{className:'eyebrow'},'Resumo do canal')),
          h('button',{className:'outline-btn',onClick:()=>setPage('stores')},'Ver base de lojas')
        ),
        h('div',{className:'manager-channel-kpis'},...channelKpis.map(x=>h('div',{key:x[0]},h('b',null,x[1]),h('span',null,x[0])))),
        h('div',{className:'manager-channel-health'},
          h('div',null,h('span',null,'Produto selecionado'),h('b',null,metricLabel(product)),h('small',null,attentionBreakdownText(st)))
        )
      )
    ),
    h('div',{className:'manager-status-strip'},h(StatCard,{label:'Zeradas',value:st.zero,kind:'zero',sub:metricLabel(product)}),h(StatCard,{label:'Baixa + Crítico',value:st.below80,kind:'low',sub:'abaixo de 80%'}),h(StatCard,{label:'Oportunidade',value:st.opportunity,kind:'opp',sub:'80% a 99%'}),h(StatCard,{label:'Produtivas',value:st.productive,kind:'prod',sub:'≥100%'}),h(StatCard,{label:'Exceções Não Cabo',value:st.exception||0,kind:'exception',sub:'fora da régua BL'})),
    h(Card,{title:'Farol gerencial',subtitle:'Territorial, Filial, GN e Grupo Rede com estrutura comercial e produtos abaixo de 80%',className:'farol-card'},h(FarolTable,{data,stores:viewScope,product,setGt,setGf,selectGn,selectNode,setMapGroup})),
    h('div',{className:'home-map-grid'},
      h(Card,{title:'Mapa do Canal',subtitle:metricLabel(product)+' • '+scopeName(gt,gf)+' • '+(activeMapGroup==='Todos'?'todos os Grupos':activeMapGroup),action:h('div',{className:'map-card-actions'},h('select',{className:'map-group-select',value:activeMapGroup,onChange:e=>setMapGroup(e.target.value)},h('option',{value:'Todos'},'Todos os Grupos'),...mapGroups.map(x=>h('option',{key:x,value:x},x))),h('button',{className:'outline-btn',onClick:()=>setPage('map')},'Abrir mapa completo'))},h(MapBox,{data,stores:mapStores,product,height:620}),h(PerfLegend,{data}))
    )
  );
}
function Products({data,product,setProduct,gt,setGt,gf,setGf,selectGn}){
  const availableGfs=gfsForGt(data,gt),scope=scopeStores(data,gt,gf),st=statsForStores(scope,product);
  const gnRank=problemRanking(scope,product,s=>s.gn),groupRank=problemRanking(scope,product,s=>s.group),cityRank=problemRanking(scope,product,s=>s.city);
  const problemStores=scope.filter(s=>['Zerado','Crítico','Baixa Performance'].includes(officialStatus(s,product))).sort((a,b)=>(a.performance[product].value||0)-(b.performance[product].value||0));
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'VISÃO POR PRODUTO',title:metricLabel(product),text:'Escolha o produto e veja imediatamente Territorial, Filial, GN, Grupo Rede, cidade e lojas que explicam o resultado.',right:h('div',{className:'head-actions'},h('select',{className:'head-select',value:gt,onChange:e=>setGt(e.target.value)},h('option',{value:'Todos'},'Todos os Territoriais'),...data.gts.map(t=>h('option',{key:t.name,value:t.name},t.name))),h('select',{className:'head-select',value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...availableGfs.map(g=>h('option',{key:g.name,value:g.name},g.name))))}),
    h(ProductTabs,{product,setProduct}),
    h('div',{className:'status-grid top-space'},h(StatCard,{label:'Realizado',value:fmtNumber(st.realized),kind:'volume'}),h(StatCard,{label:'Atingimento',value:pctText(st.attainmentPct),kind:'prod'}),h(StatCard,{label:'Zeradas',value:st.zero,kind:'zero'}),h(StatCard,{label:'Baixa + Crítico',value:st.below80,kind:'low'}),h(StatCard,{label:'Oportunidade',value:st.opportunity,kind:'opp'}),h(StatCard,{label:'Produtivas',value:st.productive,kind:'prod'}),h(StatCard,{label:'Exceções Não Cabo',value:st.exception||0,kind:'exception'})),
    h('div',{className:'three-col'},
      h(Card,{title:'GN',subtitle:'Maior concentração de problema'},h('div',{className:'compact-rank'},...gnRank.slice(0,8).map(x=>h('button',{key:x.name,onClick:()=>selectGn(data.gns.find(g=>g.name===x.name))},h('span',null,firstName(x.name)),h('b',null,x.problem),h('small',null,'abaixo 80%'))))),
      h(Card,{title:'Grupo Rede',subtitle:'Oportunidade concentrada no parceiro'},h('div',{className:'compact-rank'},...groupRank.slice(0,8).map(x=>h('div',{key:x.name},h('span',null,x.name),h('b',null,x.problem),h('small',null,'abaixo 80%'))))),
      h(Card,{title:'Cidade',subtitle:'Territórios que explicam o resultado'},h('div',{className:'compact-rank'},...cityRank.slice(0,8).map(x=>h('div',{key:x.name},h('span',null,x.name),h('b',null,x.problem),h('small',null,'abaixo 80%')))))
    ),
    h(Card,{title:'Lojas para agir',subtitle:'Zeradas, críticas ou baixa performance • '+problemStores.length+' lojas'},
      h('div',{className:'simple-table product-store-table'},
        h('div',{className:'simple-tr simple-th'},...['Loja','Cidade','GN','Grupo','Realizado','Atingimento','Status'].map(x=>h('span',{key:x},x))),
        ...problemStores.slice(0,80).map(s=>h('div',{className:'simple-tr',key:s.code},h('b',null,s.code),h('span',null,s.city),h('button',{className:'table-link',onClick:()=>selectGn(data.gns.find(g=>g.name===s.gn))},firstName(s.gn)),h('span',null,s.group),h('strong',null,fmtNumber(s.performance[product].realized)),h('strong',null,s.performance[product].value==null?'—':s.performance[product].value.toFixed(1)+'%'),h('span',{className:'status-text'},statusDisplay(s,product))))
      ),
      h('div',{className:'method-note'},'Status exibidos conforme régua oficial da aba PARAMETRO.')
    )
  );
}
function Gns({data,product,setProduct,gt,setGt,gf,setGf,q,setQ,selectGn}){
  const availableGfs=gfsForGt(data,gt);
  const list=data.gns.filter(g=>matchesGt(g,gt)&&(gf==='Todos'||g.gf===gf)&&(g.name+' '+g.gf+' '+g.gt+' '+g.cargo).toLowerCase().includes(q.toLowerCase()));
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'GERENTES DE NEGÓCIOS',title:'Visão em lista',text:'Mais informação na mesma tela e menos cliques para chegar ao problema.'}),
    h('div',{className:'filter-row'},h(ProductTabs,{product,setProduct,compact:true}),h('select',{value:gt,onChange:e=>setGt(e.target.value)},h('option',{value:'Todos'},'Todos os Territoriais'),...data.gts.map(t=>h('option',{key:t.name,value:t.name},firstName(t.name)))),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...availableGfs.map(g=>h('option',{key:g.name,value:g.name},firstName(g.name)))),h('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Buscar GN...'})),
    h('div',{className:'manager-table'},
      h('div',{className:'manager-tr manager-th'},...['GN','Cargo','Territorial','Filial','Lojas','Cidades','Zeradas','Baixa/Crítico','Produtivas','Leitura'].map(x=>h('span',{key:x},x))),
      ...list.map(g=>{const stores=data.stores.filter(s=>s.gn===g.name),st=statsForStores(stores,product);return h('button',{className:'manager-tr',key:g.name,onClick:()=>selectGn(g)},h('span',{className:'manager-person'},h(Avatar,{data,person:g,size:'sm'}),h('b',null,firstName(g.name))),h('span',null,h('i',{className:'cargo-badge '+cargoClass(g.cargo)},g.cargo)),h('span',null,firstName(g.gt)),h('span',null,firstName(g.gf)),h('b',null,g.stores),h('span',null,g.cities),h('strong',{className:'txt-zero'},st.zero),h('strong',{className:'txt-low'},st.below80),h('strong',{className:'txt-prod'},st.productive),h('span',{className:'row-diagnosis'},diagnosisText(firstName(g.name),st,product)))})
    )
  );
}
function Groups({data,product,setProduct,gt,setGt,gf,setGf,q,setQ}){
  const availableGfs=gfsForGt(data,gt);
  const scope=scopeStores(data,gt,gf);
  const groups=problemRanking(scope,product,s=>s.group).filter(x=>x.name.toLowerCase().includes(q.toLowerCase()));
  const cards=groups.map(x=>{
    const stores=scope.filter(s=>s.group===x.name),gns=[...new Set(stores.map(s=>s.gn))],cities=[...new Set(stores.map(s=>s.city))],st=x.stats;
    const minis=stores.slice(0,12).map(s=>h('span',{key:s.code,className:'store-mini'},h('b',null,s.code),h('i',{style:{background:PERF_COLORS[visualStatus(s,product)]}}),s.city));
    if(stores.length>12)minis.push(h('span',{key:'more',className:'store-more'},'+'+(stores.length-12)+' lojas'));
    return h('section',{className:'group-diagnostic',key:x.name},
      h('div',{className:'group-title'},h('div',null,h('span',{className:'eyebrow'},'GRUPO REDE'),h('h3',null,x.name),h('p',null,stores.length+' lojas • '+gns.length+' GNs • '+cities.length+' cidades')),h('div',{className:'group-score'},h('b',null,Math.round(st.productivePct)+'%'),h('span',null,'produtivas em '+metricLabel(product)))),
      h('div',{className:'group-inline-stats'},h('span',null,h('b',null,fmtNumber(st.realized)),' realizado'),h('span',null,h('b',null,pctText(st.attainmentPct)),' atingimento'),h('span',null,h('b',{className:'txt-zero'},st.zero),' zeradas'),h('span',null,h('b',{className:'txt-low'},st.below80),' baixa/crítico'),h('span',null,h('b',{className:'txt-prod'},st.productive),' produtivas'),h('span',null,h('b',null,st.exception||0),' exceções')),
      h('div',{className:'group-diagnosis-text'},h('b',null,'Diagnóstico'),h('p',null,diagnosisText(x.name,st,product)),h('small',null,'Atendido por: '+gns.map(firstName).join(' • '))),
      h('div',{className:'group-store-strip'},...minis)
    );
  });
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'PARCEIRO / GRUPO REDE',title:'Diagnóstico por Grupo Rede',text:'Consolida lojas do mesmo grupo para identificar oportunidades que podem estar no parceiro, e não apenas no GN.'}),
    h('div',{className:'filter-row'},h(ProductTabs,{product,setProduct,compact:true}),h('select',{value:gt,onChange:e=>setGt(e.target.value)},h('option',{value:'Todos'},'Todos os Territoriais'),...data.gts.map(t=>h('option',{key:t.name,value:t.name},firstName(t.name)))),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...availableGfs.map(g=>h('option',{key:g.name,value:g.name},firstName(g.name)))),h('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Buscar Grupo Rede...'})),
    h('div',{className:'group-list'},...cards)
  );
}
function Stores({data,product,setProduct,gt,setGt,gf,setGf,group,setGroup,q,setQ,selectGn}){
  const availableGfs=gfsForGt(data,gt);
  const base=scopeStores(data,gt,gf);
  const groups=groupsForStores(base);
  const list=base.filter(s=>(group==='Todos'||s.group===group)&&(s.code+' '+s.city+' '+s.gn+' '+s.gf+' '+s.gt+' '+s.group).toLowerCase().includes(q.toLowerCase()));
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'LOJAS',title:'Lojas agrupáveis por Grupo Rede',text:'Filtre Grupo, Filial ou Produto e identifique o responsável sem sair da lista.'}),
    h('div',{className:'filter-row'},h(ProductTabs,{product,setProduct,compact:true}),h('select',{value:gt,onChange:e=>setGt(e.target.value)},h('option',{value:'Todos'},'Todos os Territoriais'),...data.gts.map(t=>h('option',{key:t.name,value:t.name},firstName(t.name)))),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...availableGfs.map(g=>h('option',{key:g.name,value:g.name},firstName(g.name)))),h('select',{value:group,onChange:e=>setGroup(e.target.value)},h('option',{value:'Todos'},'Todos os Grupos'),...groups.map(x=>h('option',{key:x,value:x},x))),h('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Loja, cidade, GN...'})),
    h('div',{className:'simple-table'},
      h('div',{className:'simple-tr store-th'},...['Loja','Grupo Rede','Cidade','GN','Filial','Realizado','Atingimento','Status'].map(x=>h('span',{key:x},x))),
      ...list.map(s=>h('div',{className:'simple-tr store-data',key:s.code},h('b',null,s.code),h('span',null,s.group),h('span',null,s.city),h('button',{className:'table-link',onClick:()=>selectGn(data.gns.find(g=>g.name===s.gn))},firstName(s.gn)),h('span',null,firstName(s.gf)),h('strong',null,fmtNumber(s.performance[product].realized)),h('strong',null,s.performance[product].value==null?'—':s.performance[product].value.toFixed(1)+'%'),h('span',null,h('i',{className:'health-dot',style:{background:PERF_COLORS[visualStatus(s,product)]}}),statusDisplay(s,product))))
    )
  );
}
function MapPage({data,product,setProduct,gt,setGt,gf,setGf,mapGroup,setMapGroup}){
  const availableGfs=gfsForGt(data,gt);
  const gfStores=scopeStores(data,gt,gf);
  const mapGroups=groupsForStores(gfStores);
  const activeMapGroup=mapGroup==='Todos'||mapGroups.includes(mapGroup)?mapGroup:'Todos';
  const stores=filterStoresByGroup(gfStores,activeMapGroup);
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'MAPA DE LOJAS',title:'Território + produtividade na mesma leitura',text:'A cor interna identifica a Filial; a borda e o sinalizador mostram o status no produto selecionado.'}),
    h('div',{className:'filter-row map-filter'},h(ProductTabs,{product,setProduct}),h('div',{className:'map-filter-selects'},h('select',{value:gt,onChange:e=>setGt(e.target.value)},h('option',{value:'Todos'},'Todos os Territoriais'),...data.gts.map(t=>h('option',{key:t.name,value:t.name},t.name))),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...availableGfs.map(g=>h('option',{key:g.name,value:g.name},g.name))),h('select',{value:activeMapGroup,onChange:e=>setMapGroup(e.target.value)},h('option',{value:'Todos'},'Todos os Grupos'),...mapGroups.map(x=>h('option',{key:x,value:x},x))))),
    h(Card,null,h(MapBox,{data,stores,product,height:690}),h(PerfLegend,{data}),h('div',{className:'method-note'},'Status exibidos conforme régua oficial da aba PARAMETRO. Exceção Não Cabo identifica BL fora da régua de problema.'))
  );
}
class Routes extends React.Component{
  constructor(props){super(props);this.state={group:'Todos',routeGn:props.routeName||'Todos',q:'',selectedCodes:[]}}
  componentDidUpdate(prev){
    if(prev.routeName!==this.props.routeName&&this.props.routeName){
      const codes=this.props.data.stores.filter(s=>s.gn===this.props.routeName).map(s=>s.code);
      this.setState({routeGn:this.props.routeName,selectedCodes:codes});
    }
  }
  setSelectedCodes=codes=>this.setState({selectedCodes:[...new Set(codes)]});
  toggleStore=code=>this.setState(s=>({selectedCodes:s.selectedCodes.includes(code)?s.selectedCodes.filter(x=>x!==code):s.selectedCodes.concat(code)}));
  render(){
    const {data,gt,setGt,gf,setGf}=this.props,s=this.state;
    const availableGfs=gfsForGt(data,gt),base=scopeStores(data,gt,gf),groups=groupsForStores(base);
    const activeGroup=s.group==='Todos'||groups.includes(s.group)?s.group:'Todos';
    const groupStores=filterStoresByGroup(base,activeGroup);
    const gnNames=[...new Set(groupStores.map(x=>x.gn).filter(Boolean))].sort();
    const activeGn=s.routeGn==='Todos'||gnNames.includes(s.routeGn)?s.routeGn:'Todos';
    const q=s.q.toLowerCase();
    const candidates=prioritySortedStores(groupStores.filter(x=>(activeGn==='Todos'||x.gn===activeGn)&&(x.code+' '+x.name+' '+x.city+' '+x.group+' '+x.gn).toLowerCase().includes(q)));
    const selectedStores=prioritySortedStores(data.stores.filter(x=>s.selectedCodes.includes(x.code)&&groupStores.some(y=>y.code===x.code)&&(activeGn==='Todos'||x.gn===activeGn)));
    const route=buildVisitRoute(selectedStores),mapsRoute=route.slice(0,11),routeKm=routeDistanceKm(route);
    const selectedStats=routeStatsForStores(selectedStores);
    const badCandidates=candidates.filter(x=>['Zerado','Crítico','Baixa Performance'].includes(routeStoreStatus(x)));
    const mapStores=selectedStores.length?selectedStores:candidates.slice(0,60);
    const candidateRows=candidates.map(store=>h('button',{className:'route-store-row '+(s.selectedCodes.includes(store.code)?'selected':''),key:store.code,onClick:()=>this.toggleStore(store.code)},
      h('span',null,h('input',{type:'checkbox',checked:s.selectedCodes.includes(store.code),readOnly:true})),
      h('span',null,h('b',null,store.code),h('small',null,store.name+' • '+store.group)),
      h('span',null,store.city),
      h('span',null,firstName(store.gn)),
      h('strong',null,routeStoreStatusText(store))
    ));
    const routeSteps=route.map((p,i)=>h('div',{key:p.code},h('i',null,i+1),h('span',null,h('b',null,p.code+' • '+p.city),routeStoreStatusText(p))));
    return h('div',{className:'page route-planner-page'},
      h(PageHead,{eyebrow:'ROTEIRIZAÇÃO',title:'Roteiro de visitas',text:'Monte uma lista de lojas por Territorial, Filial, GN e Grupo Rede. O painel prioriza os piores status e organiza a sequência por proximidade.'}),
      h(Card,{title:'Filtros do roteiro',subtitle:'Escolha a carteira de visita e selecione as lojas que entram na rota'},
        h('div',{className:'route-filter-grid'},
          h('label',null,h('span',null,'Gerente Territorial'),h('select',{value:gt,onChange:e=>{setGt(e.target.value);this.setState({group:'Todos',routeGn:'Todos',selectedCodes:[]})}},h('option',{value:'Todos'},'Todos os Territoriais'),...data.gts.map(t=>h('option',{key:t.name,value:t.name},t.name)))),
          h('label',null,h('span',null,'Gerente Filial'),h('select',{value:gf,onChange:e=>{setGf(e.target.value);this.setState({group:'Todos',routeGn:'Todos',selectedCodes:[]})}},h('option',{value:'Todos'},'Todas as Filiais'),...availableGfs.map(g=>h('option',{key:g.name,value:g.name},g.name)))),
          h('label',null,h('span',null,'Grupo Rede'),h('select',{value:activeGroup,onChange:e=>this.setState({group:e.target.value,routeGn:'Todos',selectedCodes:[]})},h('option',{value:'Todos'},'Todos os Grupos'),...groups.map(x=>h('option',{key:x,value:x},x)))),
          h('label',null,h('span',null,'GN'),h('select',{value:activeGn,onChange:e=>this.setState({routeGn:e.target.value,selectedCodes:[]})},h('option',{value:'Todos'},'Todos os GNs'),...gnNames.map(x=>h('option',{key:x,value:x},x)))),
          h('label',null,h('span',null,'Buscar loja'),h('input',{value:s.q,onChange:e=>this.setState({q:e.target.value}),placeholder:'Código, cidade, grupo...'}))
        )
      ),
      h('div',{className:'route-command-grid'},
        h(Card,{title:'Carteira filtrada',subtitle:candidates.length+' lojas disponíveis • '+badCandidates.length+' em zerada/crítica/baixa'},
          h('div',{className:'route-actions'},h('button',{className:'outline-btn',onClick:()=>this.setSelectedCodes(badCandidates.slice(0,20).map(x=>x.code))},'Selecionar críticas/baixas'),h('button',{className:'outline-btn',onClick:()=>this.setSelectedCodes(candidates.slice(0,20).map(x=>x.code))},'Selecionar top 20'),h('button',{className:'outline-btn',onClick:()=>this.setSelectedCodes(candidates.map(x=>x.code))},'Selecionar todas'),h('button',{className:'outline-btn',onClick:()=>this.setSelectedCodes([])},'Limpar')),
          h('div',{className:'route-store-table'},
            h('div',{className:'route-store-row route-store-head'},h('span',null,''),h('span',null,'Loja'),h('span',null,'Cidade'),h('span',null,'GN'),h('span',null,'Status')),
            ...candidateRows
          )
        ),
        h('div',{className:'route-side'},
          h(Card,{title:'Roteiro montado',subtitle:selectedStores.length?routeStatusSummary(selectedStores):'Selecione lojas para montar a rota'},
            h('div',{className:'route-summary-grid'},h(StatCard,{label:'Selecionadas',value:selectedStores.length,kind:'zero'}),h(StatCard,{label:'Baixa + Crítico',value:selectedStats.below80,kind:'low'}),h(StatCard,{label:'Oportunidade',value:selectedStats.opportunity,kind:'opp'}),h(StatCard,{label:'Exceções Não Cabo',value:selectedStats.exception||0,kind:'exception'}),h(StatCard,{label:'Prévia KM',value:routeKm,kind:'prod'})),
            h('button',{className:'google-maps-btn',disabled:!mapsRoute.length,onClick:()=>mapsRoute.length&&window.open(googleDirectionsUrl(mapsRoute),'_blank','noopener')},'Abrir roteiro no Google Maps'),
            selectedStores.length>11?h('div',{className:'route-limit-note'},'Google Maps abre os 11 primeiros pontos. O PDF mantém todas as lojas selecionadas.'):null,
            h('button',{className:'outline-btn export-route-btn',disabled:!route.length,onClick:()=>route.length&&exportRoutePdf(route,'Territorial/Filial: '+scopeName(gt,gf)+' • Grupo Rede: '+(activeGroup==='Todos'?'todos os Grupos':activeGroup)+' • GN: '+(activeGn==='Todos'?'todos os GNs':activeGn))},'Exportar PDF'),
            h('div',{className:'route-steps'},...routeSteps)
          ),
          h(Card,{title:'Mapa da visita',subtitle:selectedStores.length?'Sequência otimizada por proximidade':'Prévia das lojas filtradas'},h(MapBox,{data,stores:mapStores,route,height:430,statusMode:'route'}))
        )
      )
    );
  }
}
function Methodology({data}){
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'TRANSPARÊNCIA',title:'Critérios, fórmulas e regras',text:'Tudo o que aparece no painel precisa ser explicável e auditável.'}),
    h('div',{className:'method-grid'},
      h(Card,{title:'Status oficiais por produto',subtitle:'Regras da aba PARAMETRO'},h('div',{className:'rule-list'},...data.methodology.officialStatuses.map(x=>h('div',{key:x.name},h('i',{style:{background:PERF_COLORS[x.name]||'#94A3B8'}}),h('b',null,x.name),h('strong',null,x.rule),h('span',null,x.description))))),
      h(Card,{title:'Fórmulas usadas no protótipo'},h('div',{className:'formula-list'},h('div',null,h('b',null,'% de lojas produtivas'),h('p',null,data.methodology.productivePct)),h('div',null,h('b',null,'Índice comparativo'),h('p',null,data.methodology.comparativeIndex)),h('div',null,h('b',null,'Exceção Não Cabo'),h('p',null,data.methodology.nonCaboRule||'BL em loja Não Cabo zerada é tratada como exceção.')))),
      h(Card,{title:'Leitura do mapa'},h('p',{className:'method-paragraph'},'A cor interna do marcador diferencia o Gerente Filial. A borda e o símbolo mudam conforme o produto selecionado. Uma mesma loja pode ser produtiva em BL e baixa performance em TV; por isso o mapa não usa um status fixo da loja.'),h(PerfLegend,{data})),
      h(Card,{title:'O que ainda não entra no diagnóstico final'},h('div',{className:'future-cards'},...data.futureIntegrations.map((x,i)=>h('div',{key:x.name},h('span',null,i+1),h('b',null,x.name),h('p',null,x.description)))))
    )
  );
}
function Sidebar({page,setPage,data,open,onClose}){
  return h('aside',{className:'sidebar '+(open?'mobile-open':'')},
    h('div',{className:'brand'},h('div',{className:'brand-icon'},h('img',{src:'https://mondrian.claro.com.br/brands/nosvg/assinatura-claro.png',alt:'Claro'})),h('div',null,h('span',null,'Agente Autorizado'))),
    h('button',{className:'mobile-menu-close',onClick:onClose},'Fechar'),
    h('nav',null,...NAV.map(x=>h('button',{key:x[0],className:page===x[0]?'active':'',onClick:()=>setPage(x[0])},h('span',{className:'nav-ico'},x[1]),h('span',null,x[2]))))
  );
}
class App extends React.Component{
  constructor(props){super(props);this.state={page:'overview',product:'tv',gt:'Todos',gf:'Todos',mapGroup:'Todos',detailNode:null,routeName:props.data.gns[0].name,gnQ:'',groupQ:'',storeQ:'',storeGroup:'Todos',mobileMenuOpen:false}}
  setPage=page=>this.setState({page,mobileMenuOpen:false});
  selectNode=(level,name)=>name&&this.setState({detailNode:{level,name}});
  selectGn=gn=>gn&&this.selectNode('gn',gn.name);
  closeDetail=()=>this.setState({detailNode:null});
  applyNodeFilter=node=>{
    if(!node)return;
    if(node.level==='gt')this.setState({gt:node.name,gf:'Todos',mapGroup:'Todos',storeGroup:'Todos',detailNode:null});
    else if(node.level==='gf')this.setState({gt:'Todos',gf:node.name,mapGroup:'Todos',storeGroup:'Todos',detailNode:null});
  };
  openRoute=gn=>this.setState({detailNode:null,routeName:gn.name,page:'routes'});
  render(){
    const d=this.props.data,s=this.state;
    const common={data:d,product:s.product,setProduct:v=>this.setState({product:v}),gt:s.gt,setGt:v=>this.setState({gt:v,gf:'Todos',mapGroup:'Todos',storeGroup:'Todos'}),gf:s.gf,setGf:v=>this.setState({gf:v,mapGroup:'Todos',storeGroup:'Todos'}),mapGroup:s.mapGroup,setMapGroup:v=>this.setState({mapGroup:v}),selectGn:this.selectGn,selectNode:this.selectNode};
    let content;
    if(s.page==='overview')content=h(Overview,Object.assign({},common,{setPage:this.setPage}));
    else if(s.page==='products')content=h(Products,common);
    else if(s.page==='gns')content=h(Gns,Object.assign({},common,{q:s.gnQ,setQ:v=>this.setState({gnQ:v})}));
    else if(s.page==='groups')content=h(Groups,Object.assign({},common,{q:s.groupQ,setQ:v=>this.setState({groupQ:v})}));
    else if(s.page==='stores')content=h(Stores,Object.assign({},common,{q:s.storeQ,setQ:v=>this.setState({storeQ:v}),group:s.storeGroup,setGroup:v=>this.setState({storeGroup:v})}));
    else if(s.page==='map')content=h(MapPage,common);
    else if(s.page==='routes')content=h(Routes,Object.assign({},common,{routeName:s.routeName}));
    else content=h(Methodology,{data:d});
    return h('div',{className:'app'},
      h(Sidebar,{page:s.page,setPage:this.setPage,data:d,open:s.mobileMenuOpen,onClose:()=>this.setState({mobileMenuOpen:false})}),
      s.mobileMenuOpen?h('button',{className:'mobile-sidebar-backdrop',onClick:()=>this.setState({mobileMenuOpen:false}),tabIndex:-1},''):null,
      h('main',{className:'main'},h('div',{className:'topbar'},h('button',{className:'mobile-menu-button',onClick:()=>this.setState({mobileMenuOpen:true})},'Menu'),h('span',{className:'method-pill'},metricLabel(s.product)+' • '+scopeName(s.gt,s.gf))),h('div',{className:'content'},content)),
      h(Drawer,{data:d,node:s.detailNode,onClose:this.closeDetail,onRoute:this.openRoute,onFilter:this.applyNodeFilter,onSelectNode:this.selectNode,product:s.product})
    );
  }
}
fetch('data/channel-data.json')
  .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(data=>ReactDOM.render(h(App,{data}),document.getElementById('root')))
  .catch(err=>{document.getElementById('root').innerHTML='<div class="loading">Erro ao carregar os dados: '+esc(String(err))+'</div>'});
})();
