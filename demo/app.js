(function(){
const h=React.createElement;
const CLARO='#DA291C';
const GF_COLORS=['#2563EB','#16A34A','#F59E0B','#7C3AED'];
const PERF_COLORS={
  'Zerado':'#111827','Crítico':'#EF4444','Baixa Performance':'#F97316',
  'Oportunidade':'#EAB308','Produtivo':'#22C55E','Alta Performance':'#15803D','Sem dado':'#94A3B8'
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
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function metricLabel(k){const m=METRICS.find(x=>x[0]===k);return m?m[1]:k}
function officialStatus(store,product){const p=store.performance[product];return p?p.status:'Sem dado'}
function visualStatus(store,product){const p=store.performance[product];if(!p)return 'Sem dado';return p.highPerformance?'Alta Performance':p.status}
function statusSymbol(st){if(st==='Alta Performance')return '★';if(st==='Produtivo')return '✓';if(st==='Oportunidade')return '•';if(st==='Baixa Performance'||st==='Crítico')return '!';if(st==='Zerado')return '0';return '?'}
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
function statsForStores(stores,product){
  let zero=0,critical=0,low=0,opportunity=0,productive=0,high=0,valid=0;
  stores.forEach(s=>{
    const p=s.performance[product];
    if(!p||p.value==null)return;
    valid++;
    if(p.value>=120)high++;
    if(p.status==='Zerado')zero++;
    else if(p.status==='Crítico')critical++;
    else if(p.status==='Baixa Performance')low++;
    else if(p.status==='Oportunidade')opportunity++;
    else if(p.status==='Produtivo')productive++;
  });
  return {zero,critical,low,below80:critical+low,opportunity,productive,high,valid,productivePct:valid?Math.round(productive/valid*1000)/10:0};
}
function groupBy(items,keyFn){const out={};items.forEach(x=>{const k=keyFn(x);(out[k]||(out[k]=[])).push(x)});return out}
function groupsForStores(stores){return [...new Set(stores.map(s=>s.group).filter(Boolean))].sort()}
function filterStoresByGroup(stores,group){return group==='Todos'?stores:stores.filter(s=>s.group===group)}
function problemRanking(stores,product,keyFn){
  const groups=groupBy(stores,keyFn);
  return Object.keys(groups).map(name=>{
    const stats=statsForStores(groups[name],product);
    return {name,stores:groups[name].length,stats,problem:stats.zero+stats.below80,productivePct:stats.productivePct};
  }).sort((a,b)=>b.problem-a.problem||b.stats.zero-a.stats.zero||b.stats.critical-a.stats.critical||b.stats.low-a.stats.low||b.stats.opportunity-a.stats.opportunity||b.stores-a.stores);
}
function pctText(v){return v==null?'sem %':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'}
function attentionBreakdownText(stats){
  const parts=[];
  if(stats.zero)parts.push(stats.zero+' '+(stats.zero===1?'zerada':'zeradas'));
  if(stats.critical)parts.push(stats.critical+' '+(stats.critical===1?'crítica':'críticas'));
  if(stats.low)parts.push(stats.low+' em Baixa Performance');
  if(stats.opportunity)parts.push(stats.opportunity+' '+(stats.opportunity===1?'oportunidade':'oportunidades'));
  if(!parts.length)return 'sem pontos de atenção';
  if(parts.length===1)return parts[0];
  return parts.slice(0,-1).join(', ')+' e '+parts[parts.length-1];
}
function diagnosisText(name,stats,product){
  const p=metricLabel(product);
  if(stats.zero>0)return name+' possui '+stats.zero+' loja(s) zerada(s) em '+p+' e '+stats.below80+' abaixo de 80%. Prioridade de investigação.';
  if(stats.below80>0)return name+' concentra '+stats.below80+' loja(s) abaixo de 80% em '+p+'. Oportunidade de atuação.';
  if(stats.opportunity>0)return name+' tem '+stats.opportunity+' loja(s) entre 80% e 99% em '+p+', próximas da meta.';
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
function PageHead({eyebrow,title,text,right}){return h('div',{className:'page-head'},h('div',null,h('span',{className:'eyebrow'},eyebrow),h('h1',null,title),h('p',null,text)),right||null)}
function ProductTabs({product,setProduct,compact}){return h('div',{className:'product-tabs '+(compact?'compact':'')},...METRICS.map(m=>h('button',{key:m[0],className:product===m[0]?'active':'',onClick:()=>setProduct(m[0])},m[1])))}
function StatCard({label,value,kind,sub}){return h('div',{className:'status-card '+kind},h('span',null,label),h('b',null,value),sub&&h('small',null,sub))}
function GfCard({data,gf,onClick,active}){
  return h('button',{className:'profile-card '+(active?'selected':''),style:{'--accent':gfColor(data,gf.name)},onClick:()=>onClick(gf)},
    h('div',{className:'profile-top'},h(Avatar,{data,person:gf,size:'lg'}),h('div',null,h('span',{className:'eyebrow'},'Gerente Filial'),h('h4',null,firstName(gf.name)))),
    h('div',{className:'profile-kpis'},...[[gf.gns,'GNs'],[gf.stores,'Lojas'],[gf.cities,'Cidades'],[gf.ddds,'DDDs']].map((x,i)=>h('div',{key:i},h('b',null,x[0]),h('span',null,x[1])))),
    h('div',{className:'profile-link'},active?'Filial selecionada':'Filtrar visão →')
  );
}
class MapBox extends React.Component{
  constructor(props){super(props);this.mapId='leaflet-'+Math.random().toString(36).slice(2);this.map=null}
  componentDidMount(){this.draw()}
  componentDidUpdate(prev){if(prev.stores!==this.props.stores||prev.product!==this.props.product||prev.route!==this.props.route)this.draw()}
  componentWillUnmount(){if(this.map)this.map.remove()}
  draw(){
    if(!window.L)return;
    const data=this.props.data,product=this.props.product||'bl',list=this.props.stores||data.stores,route=this.props.route||null;
    const valid=list.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon));
    if(this.map){this.map.remove();this.map=null}
    this.map=L.map(this.mapId,{preferCanvas:true});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(this.map);
    const bounds=[];
    valid.forEach(s=>{
      bounds.push([s.lat,s.lon]);
      const st=visualStatus(s,product),border=PERF_COLORS[st]||'#94A3B8',fill=gfColor(data,s.gf);
      const html='<div class="store-map-pin" style="background:'+fill+';border-color:'+border+'"><span>'+statusSymbol(st)+'</span></div>';
      const icon=L.divIcon({className:'store-map-pin-wrap',html,iconSize:[24,24],iconAnchor:[12,12]});
      L.marker([s.lat,s.lon],{icon}).addTo(this.map)
        .bindTooltip(esc(s.code)+' • '+esc(s.city)+' • '+esc(st),{direction:'top'})
        .bindPopup('<div class="map-popup"><b>'+esc(s.code)+'</b><span>'+esc(s.city)+' • DDD '+esc(s.ddd)+'</span><small>'+esc(firstName(s.gn))+' • '+esc(metricLabel(product))+': '+esc(st)+'</small><a href="'+googleStoreUrl(s)+'" target="_blank" rel="noopener">Abrir no Google Maps ↗</a></div>');
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
  const perf=['Zerado','Baixa Performance','Oportunidade','Produtivo','Alta Performance'];
  return h('div',{className:'dual-legend'},
    h('div',null,h('b',null,'Cor interna = Gerente Filial'),h('div',{className:'legend-line'},...data.gfs.map(g=>h('span',{key:g.name},h('i',{style:{background:gfColor(data,g.name)}}),firstName(g.name))))),
    h('div',null,h('b',null,'Borda / sinal = produtividade'),h('div',{className:'legend-line'},...perf.map(st=>h('span',{key:st},h('i',{className:'ring',style:{borderColor:PERF_COLORS[st]}},statusSymbol(st)),st))))
  );
}
function Drawer({data,gn,onClose,onRoute,product}){
  if(!gn)return null;
  const stores=data.stores.filter(s=>s.gn===gn.name),st=statsForStores(stores,product);
  return h('div',{className:'drawer-backdrop',onMouseDown:onClose},
    h('aside',{className:'drawer',onMouseDown:e=>e.stopPropagation()},
      h('button',{className:'drawer-close',onClick:onClose},'✕'),
      h('div',{className:'drawer-profile'},h(Avatar,{data,person:gn,size:'xl'}),h('div',null,h('span',{className:'eyebrow'},'Gerente de Negócios'),h('h2',null,gn.name),h('span',{className:'cargo-badge '+cargoClass(gn.cargo)},gn.cargo),h('p',null,gn.gf))),
      h('div',{className:'drawer-kpis'},...[[gn.stores,'Lojas'],[gn.cities,'Cidades'],[gn.ddds,'DDDs'],[gn.groups,'Grupos']].map((x,i)=>h('div',{key:i},h('b',null,x[0]),h('span',null,x[1])))),
      h('div',{className:'quick-diagnosis'},h('b',null,'Diagnóstico rápido • '+metricLabel(product)),h('p',null,diagnosisText(firstName(gn.name),st,product))),
      h('div',{className:'status-grid drawer-status'},h(StatCard,{label:'Zeradas',value:st.zero,kind:'zero'}),h(StatCard,{label:'Baixa / Crítico',value:st.below80,kind:'low'}),h(StatCard,{label:'Oportunidade',value:st.opportunity,kind:'opp'}),h(StatCard,{label:'Produtivas',value:st.productive,kind:'prod'})),
      h('button',{className:'google-maps-btn',onClick:()=>onRoute(gn)},'Ver circuito da carteira'),
      h('h3',{className:'section-title'},'Lojas • '+metricLabel(product)),
      h('div',{className:'store-list'},...stores.map(s=>h('div',{className:'store-row',key:s.code},h('div',null,h('b',null,s.code),h('span',null,s.city+' • '+s.group)),h('span',{className:'status-chip'},officialStatus(s,product)+' • '+pctText(s.performance[product]&&s.performance[product].value)))))
    )
  );
}
function Overview({data,product,setProduct,gf,setGf,selectGn,setPage,mapGroup,setMapGroup}){
  const scope=gf==='Todos'?data.stores:data.stores.filter(s=>s.gf===gf);
  const mapGroups=groupsForStores(scope);
  const activeMapGroup=mapGroup==='Todos'||mapGroups.includes(mapGroup)?mapGroup:'Todos';
  const mapStores=filterStoresByGroup(scope,activeMapGroup);
  const st=statsForStores(scope,product);
  const gnRank=problemRanking(scope,product,s=>s.gn).slice(0,6);
  const groupRank=problemRanking(scope,product,s=>s.group).slice(0,6);
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'PROBLEMA → RESPONSÁVEL → AÇÃO',title:'Visão Gerencial',text:'A primeira tela já mostra onde está a oportunidade. Use Produto e Filial sem navegar por várias páginas.',right:h('span',{className:'pill'},data.meta.period)}),
    h('div',{className:'kpi-grid kpi-compact'},...[['GFs',data.kpis.gfs],['GNs',data.kpis.gns],['Lojas',data.kpis.stores],['Grupos',data.kpis.groups],['Cidades',data.kpis.cities],['DDDs',data.kpis.ddds]].map(x=>h('div',{className:'kpi-card',key:x[0]},h('div',null,h('div',{className:'kpi-label'},x[0]),h('div',{className:'kpi-value'},x[1]))))),
    h(Card,{title:'Estrutura do canal',subtitle:'Selecione uma Filial e toda a leitura abaixo é filtrada automaticamente'},h('div',{className:'gf-cards'},...data.gfs.map(g=>h(GfCard,{key:g.name,data,gf:g,active:gf===g.name,onClick:x=>setGf(gf===x.name?'Todos':x.name)})))),
    h('div',{className:'focus-bar'},h('div',null,h('b',null,'Produto em análise'),h('span',null,gf==='Todos'?'Canal completo':firstName(gf))),h(ProductTabs,{product,setProduct})),
    h('div',{className:'status-grid'},h(StatCard,{label:'Zeradas',value:st.zero,kind:'zero',sub:metricLabel(product)}),h(StatCard,{label:'Baixa + Crítico',value:st.below80,kind:'low',sub:'abaixo de 80%'}),h(StatCard,{label:'Oportunidade',value:st.opportunity,kind:'opp',sub:'80% a 99%'}),h(StatCard,{label:'Produtivas',value:st.productive,kind:'prod',sub:'≥100%'}),h(StatCard,{label:'Alta performance*',value:st.high,kind:'high',sub:'≥120% • visual'})),
    h('div',{className:'diagnosis-grid-v5'},
      h(Card,{title:'GNs que requer atenção',subtitle:'Classificados do pior para o melhor pelo volume de lojas zeradas, críticas e baixa performance'},h('div',{className:'action-list attention-list'},...gnRank.map((x,i)=>h('button',{key:x.name,onClick:()=>selectGn(data.gns.find(g=>g.name===x.name))},h('span',{className:'rank'},i+1),h('div',null,h('b',null,firstName(x.name)),h('small',null,x.stores+' lojas • '+attentionBreakdownText(x.stats))))))),
      h(Card,{title:'Grupos Rede que requer atenção',subtitle:'Classificados do pior para o melhor pelo volume de lojas zeradas, críticas e baixa performance',action:h('button',{className:'outline-btn',onClick:()=>setPage('groups')},'Ver diagnóstico de rede')},h('div',{className:'action-list attention-list'},...groupRank.map((x,i)=>h('button',{key:x.name,onClick:()=>setPage('groups')},h('span',{className:'rank'},i+1),h('div',null,h('b',null,x.name),h('small',null,x.stores+' lojas • '+attentionBreakdownText(x.stats)))))))
    ),
    h('div',{className:'home-map-grid'},
      h(Card,{title:'Mapa do problema',subtitle:metricLabel(product)+' • '+(gf==='Todos'?'todas as Filiais':firstName(gf))+' • '+(activeMapGroup==='Todos'?'todos os Grupos':activeMapGroup),action:h('div',{className:'map-card-actions'},h('select',{className:'map-group-select',value:activeMapGroup,onChange:e=>setMapGroup(e.target.value)},h('option',{value:'Todos'},'Todos os Grupos'),...mapGroups.map(x=>h('option',{key:x,value:x},x))),h('button',{className:'outline-btn',onClick:()=>setPage('map')},'Abrir mapa completo'))},h(MapBox,{data,stores:mapStores,product,height:450}),h(PerfLegend,{data})),
      h(Card,{title:'Produtos: onde está a maior oportunidade?',subtitle:'Quantidade de lojas abaixo de 80% por produto'},
        h('div',{className:'product-problem-list'},...METRICS.map(m=>{const x=statsForStores(scope,m[0]);return h('button',{key:m[0],onClick:()=>{setProduct(m[0]);setPage('products')}},h('span',null,m[1]),h('div',{className:'mini-bar'},h('i',{style:{width:Math.min(100,x.below80/(x.valid||1)*100)+'%'}})),h('b',null,x.below80+' lojas'))})),
        h('div',{className:'method-note'},'* Alta Performance é apenas um sinalizador visual provisório (≥120%) e não altera os status oficiais.')
      )
    )
  );
}
function Products({data,product,setProduct,gf,setGf,selectGn}){
  const scope=gf==='Todos'?data.stores:data.stores.filter(s=>s.gf===gf),st=statsForStores(scope,product);
  const gnRank=problemRanking(scope,product,s=>s.gn),groupRank=problemRanking(scope,product,s=>s.group),cityRank=problemRanking(scope,product,s=>s.city);
  const problemStores=scope.filter(s=>['Zerado','Crítico','Baixa Performance'].includes(officialStatus(s,product))).sort((a,b)=>(a.performance[product].value||0)-(b.performance[product].value||0));
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'VISÃO POR PRODUTO',title:metricLabel(product),text:'Escolha o produto e veja imediatamente Filial, GN, Grupo Rede, cidade e lojas que explicam o resultado.',right:h('select',{className:'head-select',value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...data.gfs.map(g=>h('option',{key:g.name,value:g.name},g.name)))}),
    h(ProductTabs,{product,setProduct}),
    h('div',{className:'status-grid top-space'},h(StatCard,{label:'Zeradas',value:st.zero,kind:'zero'}),h(StatCard,{label:'Baixa + Crítico',value:st.below80,kind:'low'}),h(StatCard,{label:'Oportunidade',value:st.opportunity,kind:'opp'}),h(StatCard,{label:'Produtivas',value:st.productive,kind:'prod'}),h(StatCard,{label:'Alta performance*',value:st.high,kind:'high'})),
    h('div',{className:'three-col'},
      h(Card,{title:'GN',subtitle:'Maior concentração de problema'},h('div',{className:'compact-rank'},...gnRank.slice(0,8).map(x=>h('button',{key:x.name,onClick:()=>selectGn(data.gns.find(g=>g.name===x.name))},h('span',null,firstName(x.name)),h('b',null,x.problem),h('small',null,'abaixo 80%'))))),
      h(Card,{title:'Grupo Rede',subtitle:'Oportunidade concentrada no parceiro'},h('div',{className:'compact-rank'},...groupRank.slice(0,8).map(x=>h('div',{key:x.name},h('span',null,x.name),h('b',null,x.problem),h('small',null,'abaixo 80%'))))),
      h(Card,{title:'Cidade',subtitle:'Territórios que explicam o resultado'},h('div',{className:'compact-rank'},...cityRank.slice(0,8).map(x=>h('div',{key:x.name},h('span',null,x.name),h('b',null,x.problem),h('small',null,'abaixo 80%')))))
    ),
    h(Card,{title:'Lojas para agir',subtitle:'Zeradas, críticas ou baixa performance • '+problemStores.length+' lojas'},
      h('div',{className:'simple-table product-store-table'},
        h('div',{className:'simple-tr simple-th'},...['Loja','Cidade','GN','Grupo','Atingimento','Status'].map(x=>h('span',{key:x},x))),
        ...problemStores.slice(0,80).map(s=>h('div',{className:'simple-tr',key:s.code},h('b',null,s.code),h('span',null,s.city),h('button',{className:'table-link',onClick:()=>selectGn(data.gns.find(g=>g.name===s.gn))},firstName(s.gn)),h('span',null,s.group),h('strong',null,s.performance[product].value==null?'—':s.performance[product].value.toFixed(1)+'%'),h('span',{className:'status-text'},officialStatus(s,product))))
      ),
      h('div',{className:'method-note'},'* Alta Performance = ≥120% apenas para destaque visual do protótipo.')
    )
  );
}
function Gns({data,product,setProduct,gf,setGf,q,setQ,selectGn}){
  const list=data.gns.filter(g=>(gf==='Todos'||g.gf===gf)&&(g.name+' '+g.gf+' '+g.cargo).toLowerCase().includes(q.toLowerCase()));
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'GERENTES DE NEGÓCIOS',title:'Visão em lista',text:'Mais informação na mesma tela e menos cliques para chegar ao problema.'}),
    h('div',{className:'filter-row'},h(ProductTabs,{product,setProduct,compact:true}),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...data.gfs.map(g=>h('option',{key:g.name,value:g.name},firstName(g.name)))),h('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Buscar GN...'})),
    h('div',{className:'manager-table'},
      h('div',{className:'manager-tr manager-th'},...['GN','Cargo','Filial','Lojas','Cidades','Zeradas','Baixa/Crítico','Produtivas','Leitura'].map(x=>h('span',{key:x},x))),
      ...list.map(g=>{const stores=data.stores.filter(s=>s.gn===g.name),st=statsForStores(stores,product);return h('button',{className:'manager-tr',key:g.name,onClick:()=>selectGn(g)},h('span',{className:'manager-person'},h(Avatar,{data,person:g,size:'sm'}),h('b',null,firstName(g.name))),h('span',null,h('i',{className:'cargo-badge '+cargoClass(g.cargo)},g.cargo)),h('span',null,firstName(g.gf)),h('b',null,g.stores),h('span',null,g.cities),h('strong',{className:'txt-zero'},st.zero),h('strong',{className:'txt-low'},st.below80),h('strong',{className:'txt-prod'},st.productive),h('span',{className:'row-diagnosis'},diagnosisText(firstName(g.name),st,product)))})
    )
  );
}
function Groups({data,product,setProduct,gf,setGf,q,setQ}){
  const scope=gf==='Todos'?data.stores:data.stores.filter(s=>s.gf===gf);
  const groups=problemRanking(scope,product,s=>s.group).filter(x=>x.name.toLowerCase().includes(q.toLowerCase()));
  const cards=groups.map(x=>{
    const stores=scope.filter(s=>s.group===x.name),gns=[...new Set(stores.map(s=>s.gn))],cities=[...new Set(stores.map(s=>s.city))],st=x.stats;
    const minis=stores.slice(0,12).map(s=>h('span',{key:s.code,className:'store-mini'},h('b',null,s.code),h('i',{style:{background:PERF_COLORS[visualStatus(s,product)]}}),s.city));
    if(stores.length>12)minis.push(h('span',{key:'more',className:'store-more'},'+'+(stores.length-12)+' lojas'));
    return h('section',{className:'group-diagnostic',key:x.name},
      h('div',{className:'group-title'},h('div',null,h('span',{className:'eyebrow'},'GRUPO REDE'),h('h3',null,x.name),h('p',null,stores.length+' lojas • '+gns.length+' GNs • '+cities.length+' cidades')),h('div',{className:'group-score'},h('b',null,Math.round(st.productivePct)+'%'),h('span',null,'produtivas em '+metricLabel(product)))),
      h('div',{className:'group-inline-stats'},h('span',null,h('b',{className:'txt-zero'},st.zero),' zeradas'),h('span',null,h('b',{className:'txt-low'},st.below80),' baixa/crítico'),h('span',null,h('b',{className:'txt-prod'},st.productive),' produtivas'),h('span',null,h('b',null,st.high),' alta*')),
      h('div',{className:'group-diagnosis-text'},h('b',null,'Diagnóstico'),h('p',null,diagnosisText(x.name,st,product)),h('small',null,'Atendido por: '+gns.map(firstName).join(' • '))),
      h('div',{className:'group-store-strip'},...minis)
    );
  });
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'PARCEIRO / GRUPO REDE',title:'Diagnóstico por Grupo Rede',text:'Consolida lojas do mesmo grupo para identificar oportunidades que podem estar no parceiro, e não apenas no GN.'}),
    h('div',{className:'filter-row'},h(ProductTabs,{product,setProduct,compact:true}),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...data.gfs.map(g=>h('option',{key:g.name,value:g.name},firstName(g.name)))),h('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Buscar Grupo Rede...'})),
    h('div',{className:'group-list'},...cards)
  );
}
function Stores({data,product,setProduct,gf,setGf,group,setGroup,q,setQ,selectGn}){
  const groups=[...new Set(data.stores.map(s=>s.group))].sort();
  const list=data.stores.filter(s=>(gf==='Todos'||s.gf===gf)&&(group==='Todos'||s.group===group)&&(s.code+' '+s.city+' '+s.gn+' '+s.group).toLowerCase().includes(q.toLowerCase()));
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'LOJAS',title:'Lojas agrupáveis por Grupo Rede',text:'Filtre Grupo, Filial ou Produto e identifique o responsável sem sair da lista.'}),
    h('div',{className:'filter-row'},h(ProductTabs,{product,setProduct,compact:true}),h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...data.gfs.map(g=>h('option',{key:g.name,value:g.name},firstName(g.name)))),h('select',{value:group,onChange:e=>setGroup(e.target.value)},h('option',{value:'Todos'},'Todos os Grupos'),...groups.map(x=>h('option',{key:x,value:x},x))),h('input',{value:q,onChange:e=>setQ(e.target.value),placeholder:'Loja, cidade, GN...'})),
    h('div',{className:'simple-table'},
      h('div',{className:'simple-tr store-th'},...['Loja','Grupo Rede','Cidade','GN','Filial','Atingimento','Status'].map(x=>h('span',{key:x},x))),
      ...list.map(s=>h('div',{className:'simple-tr store-data',key:s.code},h('b',null,s.code),h('span',null,s.group),h('span',null,s.city),h('button',{className:'table-link',onClick:()=>selectGn(data.gns.find(g=>g.name===s.gn))},firstName(s.gn)),h('span',null,firstName(s.gf)),h('strong',null,s.performance[product].value==null?'—':s.performance[product].value.toFixed(1)+'%'),h('span',null,h('i',{className:'health-dot',style:{background:PERF_COLORS[visualStatus(s,product)]}}),visualStatus(s,product))))
    )
  );
}
function MapPage({data,product,setProduct,gf,setGf,mapGroup,setMapGroup}){
  const gfStores=gf==='Todos'?data.stores:data.stores.filter(s=>s.gf===gf);
  const mapGroups=groupsForStores(gfStores);
  const activeMapGroup=mapGroup==='Todos'||mapGroups.includes(mapGroup)?mapGroup:'Todos';
  const stores=filterStoresByGroup(gfStores,activeMapGroup);
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'MAPA DE LOJAS',title:'Território + produtividade na mesma leitura',text:'A cor interna identifica a Filial; a borda e o sinalizador mostram o status no produto selecionado.'}),
    h('div',{className:'filter-row map-filter'},h(ProductTabs,{product,setProduct}),h('div',{className:'map-filter-selects'},h('select',{value:gf,onChange:e=>setGf(e.target.value)},h('option',{value:'Todos'},'Todas as Filiais'),...data.gfs.map(g=>h('option',{key:g.name,value:g.name},g.name))),h('select',{value:activeMapGroup,onChange:e=>setMapGroup(e.target.value)},h('option',{value:'Todos'},'Todos os Grupos'),...mapGroups.map(x=>h('option',{key:x,value:x},x))))),
    h(Card,null,h(MapBox,{data,stores,product,height:690}),h(PerfLegend,{data}),h('div',{className:'method-note'},'Alta Performance (★) = ≥120% apenas como sinalizador visual provisório. O status oficial continua Produtivo para ≥100%.'))
  );
}
function Routes({data,routeName,setRouteName}){
  const gn=data.gns.find(g=>g.name===routeName)||data.gns[0],stores=data.stores.filter(s=>s.gn===gn.name);
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'ROTEIRIZAÇÃO',title:'Circuito entre as próprias lojas',text:'Prévia geográfica para discussão. O KM real virá do Planejamento e a rota viária poderá ser integrada posteriormente.',right:h('select',{className:'head-select',value:gn.name,onChange:e=>setRouteName(e.target.value)},...data.gns.map(g=>h('option',{key:g.name,value:g.name},g.name)))}),
    h('div',{className:'route-layout'},
      h(Card,{title:firstName(gn.name),subtitle:gn.cargo+' • '+gn.gf},h('div',{className:'route-profile'},h(Avatar,{data,person:gn,size:'lg'}),h('div',{className:'route-big-number'},h('b',null,gn.routePreviewKm.toLocaleString('pt-BR')+' km'),h('span',null,'prévia Haversine'))),h('button',{className:'google-maps-btn',onClick:()=>window.open(googleDirectionsUrl(gn.routePreview),'_blank','noopener')},'⌖ Abrir trajeto no Google Maps'),h('div',{className:'route-steps'},...gn.routePreview.map((p,i)=>h('div',{key:p.code},h('i',null,i+1),h('span',null,h('b',null,p.code),p.city))))),
      h(Card,null,h(MapBox,{data,stores,product:'bl',route:gn.routePreview,height:650}))
    )
  );
}
function Methodology({data}){
  return h('div',{className:'page'},
    h(PageHead,{eyebrow:'TRANSPARÊNCIA',title:'Critérios, fórmulas e regras',text:'Tudo o que aparece no Canal 360 precisa ser explicável e auditável.'}),
    h('div',{className:'method-grid'},
      h(Card,{title:'Status oficiais por produto',subtitle:'Regras da aba PARAMETRO'},h('div',{className:'rule-list'},...data.methodology.officialStatuses.map(x=>h('div',{key:x.name},h('i',{style:{background:PERF_COLORS[x.name]||'#94A3B8'}}),h('b',null,x.name),h('strong',null,x.rule),h('span',null,x.description))))),
      h(Card,{title:'Fórmulas usadas no protótipo'},h('div',{className:'formula-list'},h('div',null,h('b',null,'% de lojas produtivas'),h('p',null,data.methodology.productivePct)),h('div',null,h('b',null,'Índice comparativo'),h('p',null,data.methodology.comparativeIndex)),h('div',null,h('b',null,'Alta Performance'),h('p',null,data.methodology.highPerformance)))),
      h(Card,{title:'Leitura do mapa'},h('p',{className:'method-paragraph'},'A cor interna do marcador diferencia o Gerente Filial. A borda e o símbolo mudam conforme o produto selecionado. Uma mesma loja pode ser produtiva em BL e baixa performance em TV; por isso o mapa não usa um status fixo da loja.'),h(PerfLegend,{data})),
      h(Card,{title:'O que ainda não entra no diagnóstico final'},h('div',{className:'future-cards'},...data.futureIntegrations.map((x,i)=>h('div',{key:x.name},h('span',null,i+1),h('b',null,x.name),h('p',null,x.description)))))
    )
  );
}
function Sidebar({page,setPage,data}){
  return h('aside',{className:'sidebar'},
    h('div',{className:'brand'},h('div',{className:'brand-icon'},h('img',{src:'https://mondrian.claro.com.br/brands/nosvg/assinatura-claro.png',alt:'Claro'})),h('div',null,h('b',null,'CANAL 360'),h('span',null,'Agente Autorizado'))),
    h('nav',null,...NAV.map(x=>h('button',{key:x[0],className:page===x[0]?'active':'',onClick:()=>setPage(x[0])},h('span',{className:'nav-ico'},x[1]),h('span',null,x[2])))),
    h('div',{className:'sidebar-bottom'},h('b',null,'▤ Dados atuais'),h('div',null,data.meta.sourceNote))
  );
}
class App extends React.Component{
  constructor(props){super(props);this.state={page:'overview',product:'tv',gf:'Todos',mapGroup:'Todos',gnName:null,routeName:props.data.gns[0].name,gnQ:'',groupQ:'',storeQ:'',storeGroup:'Todos'}}
  setPage=page=>this.setState({page});
  selectGn=gn=>gn&&this.setState({gnName:gn.name});
  closeGn=()=>this.setState({gnName:null});
  openRoute=gn=>this.setState({gnName:null,routeName:gn.name,page:'routes'});
  render(){
    const d=this.props.data,s=this.state,selectedGn=d.gns.find(g=>g.name===s.gnName)||null;
    const common={data:d,product:s.product,setProduct:v=>this.setState({product:v}),gf:s.gf,setGf:v=>this.setState({gf:v,mapGroup:'Todos'}),mapGroup:s.mapGroup,setMapGroup:v=>this.setState({mapGroup:v}),selectGn:this.selectGn};
    let content;
    if(s.page==='overview')content=h(Overview,Object.assign({},common,{setPage:this.setPage}));
    else if(s.page==='products')content=h(Products,common);
    else if(s.page==='gns')content=h(Gns,Object.assign({},common,{q:s.gnQ,setQ:v=>this.setState({gnQ:v})}));
    else if(s.page==='groups')content=h(Groups,Object.assign({},common,{q:s.groupQ,setQ:v=>this.setState({groupQ:v})}));
    else if(s.page==='stores')content=h(Stores,Object.assign({},common,{q:s.storeQ,setQ:v=>this.setState({storeQ:v}),group:s.storeGroup,setGroup:v=>this.setState({storeGroup:v})}));
    else if(s.page==='map')content=h(MapPage,common);
    else if(s.page==='routes')content=h(Routes,{data:d,routeName:s.routeName,setRouteName:v=>this.setState({routeName:v})});
    else content=h(Methodology,{data:d});
    return h('div',{className:'app'},
      h(Sidebar,{page:s.page,setPage:this.setPage,data:d}),
      h('main',{className:'main'},h('div',{className:'topbar'},h('span',null,h('i',{className:'live-dot'}),'V5 • problema primeiro'),h('span',{className:'method-pill'},metricLabel(s.product)+' • '+(s.gf==='Todos'?'Todas as Filiais':firstName(s.gf)))),h('div',{className:'content'},content)),
      h(Drawer,{data:d,gn:selectedGn,onClose:this.closeGn,onRoute:this.openRoute,product:s.product})
    );
  }
}
fetch('data/channel-data.json')
  .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(data=>ReactDOM.render(h(App,{data}),document.getElementById('root')))
  .catch(err=>{document.getElementById('root').innerHTML='<div class="loading">Erro ao carregar os dados: '+esc(String(err))+'</div>'});
})();
