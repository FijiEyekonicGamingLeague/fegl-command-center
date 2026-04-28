const NAV = [
  ['home', 'Home'], ['season', 'Season'], ['fixtures', 'Fixtures'], ['standings', 'Standings'],
  ['players', 'Players'], ['results', 'Results'], ['submit', 'Submit'], ['rules', 'Rules'],
  ['archive', 'Archive'], ['backend', 'Backend'], ['admin', 'Admin']
];

const SOCIAL_LINKS = {
  youtube: '#youtube-link-here',
  facebook: '#facebook-link-here',
  discord: '#discord-invite-here',
  instagram: '#instagram-link-here',
  tiktok: '#tiktok-link-here'
};

const DB_TABLES = [
  ['seasons', 'Season theme, number, status, dates, archive state.'],
  ['season_rulesets', 'Club caps, ELO settings, playoff multipliers, halftime rules.'],
  ['players', 'Permanent FEGL IDs, PSN/EA ID, social handles, active status.'],
  ['player_seasons', 'Season-specific HR, reliability, card, registration status.'],
  ['fixtures', 'Matchday, stage, deadline, player A/B, allowed star caps.'],
  ['result_submissions', 'Raw player results waiting for admin review.'],
  ['approved_results', 'Official source for standings, ELO, cards, archive.'],
  ['rating_events', 'Full Hidden Rating audit log for every player movement.'],
  ['match_player_stats', 'One row per player per match for HT/FT analytics.'],
  ['card_snapshots', 'Weekly/live card outputs and identity tags.'],
  ['disputes', 'Club, score, disconnect, no-response and conduct reviews.'],
  ['admin_audit_log', 'Every approval, correction, export, freeze and ruling.'],
  ['social_links', 'YouTube, Facebook, Discord, Instagram, TikTok links.']
];

const ENGINE_FLOW = [
  'Player submits result', 'Result enters pending queue', 'Admin checks proof + club legality',
  'Admin approves official result', 'Standings recalculate', 'ELO event is written',
  'Halftime analytics update', 'Cards refresh', 'Backup export becomes available'
];

const seed = {
  players: [
    { id:'TEST-0001', name:'AlphaFlame', hr:1600.00, role:'Strong favourite', card:{ovr:72,pac:68,sho:72,pas:70,dri:69,def:66,phy:70,tier:'Silver'}, tags:['Favourite','Crown Pressure'] },
    { id:'TEST-0002', name:'BetaStorm', hr:1540.00, role:'Contender', card:{ovr:70,pac:67,sho:70,pas:69,dri:68,def:65,phy:69,tier:'Silver'}, tags:['Contender'] },
    { id:'TEST-0003', name:'CoralGhost', hr:1500.00, role:'Balanced player', card:{ovr:68,pac:66,sho:67,pas:68,dri:68,def:64,phy:67,tier:'Bronze'}, tags:['Balanced'] },
    { id:'TEST-0004', name:'DaloWarrior', hr:1460.00, role:'Underdog', card:{ovr:66,pac:65,sho:66,pas:64,dri:66,def:62,phy:68,tier:'Bronze'}, tags:['Underdog'] }
  ],
  fixtures: [
    { id:'FX-001', md:'MD1', a:'AlphaFlame', b:'DaloWarrior', deadline:'Sun 10 PM', status:'scheduled', story:'Favourite forced down by club cap. Underdog keeps 5-star freedom.' },
    { id:'FX-002', md:'MD1', a:'BetaStorm', b:'CoralGhost', deadline:'Sun 10 PM', status:'scheduled', story:'Close-rating test match. Both players have full club freedom.' }
  ],
  submissions: [
    { id:'SUB-001', fixtureId:'FX-001', aHT:1,bHT:2,aFT:4,bFT:3,aClub:'Real Sociedad',bClub:'PSG',aStars:4,bStars:5,type:'played',proof:'mock-proof-link-1',status:'pending',dispute:false },
    { id:'SUB-002', fixtureId:'FX-002', aHT:2,bHT:2,aFT:5,bFT:5,aClub:'Bayern Munich',bClub:'Manchester City',aStars:5,bStars:5,type:'draw',proof:'mock-proof-link-2',status:'pending',dispute:false },
    { id:'SUB-003', fixtureId:'FX-001', aHT:0,bHT:0,aFT:6,bFT:2,aClub:'Real Madrid',bClub:'PSG',aStars:5,bStars:5,type:'played',proof:'mock-proof-illegal',status:'under_review',dispute:true, note:'Illegal club test: AlphaFlame cap should be 4★.' }
  ],
  approved: [],
  ratingEvents: [],
  stats: []
};

let state = JSON.parse(JSON.stringify(seed));
let currentView = 'home';

function byName(name){ return state.players.find(p => p.name === name); }
function fixtureById(id){ return state.fixtures.find(f => f.id === id); }
function submissionById(id){ return state.submissions.find(s => s.id === id); }
function expectedScore(r, opp){ return 1/(1+Math.pow(10,(opp-r)/400)); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function kValue(count, gap){ if(count < 5) return 32; if(gap <= 74) return 24; if(gap <= 149) return 20; if(gap <= 249) return 16; return 12; }
function goalModifier(gd, gap){ let m = gd <= 1 ? 1 : gd <= 3 ? 1.10 : gd <= 5 ? 1.20 : 1.25; if(gap >= 200) return 1; if(gap >= 100) return 1 + ((m-1)/2); return m; }
function starCapForGap(gap){ if(gap <= 49) return 5; if(gap <= 99) return 4.5; if(gap <= 149) return 4; if(gap <= 199) return 3.5; return 3; }
function getCaps(f){ const a = byName(f.a), b = byName(f.b); const gap = Math.abs(a.hr-b.hr); const cap = starCapForGap(gap); return { aCap: a.hr >= b.hr ? cap : 5, bCap: b.hr >= a.hr ? cap : 5, gap }; }
function officialCount(name){ return state.approved.filter(r => r.a === name || r.b === name).length; }
function leaguePoints(gf,ga,type){ if(type === 'double_forfeit' || type === 'void') return 0; if(gf>ga) return 3; if(gf===ga) return 1; return 0; }
function resultCode(gf,ga,type){ if(type === 'double_forfeit' || type === 'void') return 'VOID'; if(gf>ga) return 'W'; if(gf===ga) return 'D'; return 'L'; }
function round2(n){ return Math.round(n*100)/100; }
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function approveSubmission(subId){
  const sub = submissionById(subId);
  if(!sub || sub.status !== 'pending') return toast('This submission is not pending.');
  const f = fixtureById(sub.fixtureId);
  const caps = getCaps(f);
  const aLegal = sub.aStars <= caps.aCap;
  const bLegal = sub.bStars <= caps.bCap;
  if(sub.dispute || !aLegal || !bLegal){
    sub.status = 'under_review'; f.status = 'under_review';
    render();
    return toast('Sent to review: dispute or illegal club detected.');
  }
  const a = byName(f.a), b = byName(f.b);
  const aPre = a.hr, bPre = b.hr;
  const gap = Math.abs(aPre-bPre);
  const gd = Math.abs(sub.aFT-sub.bFT);
  let aDelta=0,bDelta=0,aExp=null,bExp=null,aActual=null,bActual=null,kA=null,kB=null,mod=1;
  if(sub.type === 'forfeit'){
    aDelta = sub.aFT > sub.bFT ? 6 : -6; bDelta = -aDelta;
  } else if(sub.type !== 'double_forfeit' && sub.type !== 'void'){
    aExp = expectedScore(aPre,bPre); bExp = expectedScore(bPre,aPre);
    aActual = sub.aFT > sub.bFT ? 1 : sub.aFT === sub.bFT ? .5 : 0;
    bActual = 1-aActual;
    kA = kValue(officialCount(a.name), gap); kB = kValue(officialCount(b.name), gap);
    mod = goalModifier(gd, gap);
    aDelta = round2(kA*(aActual-aExp)*mod);
    bDelta = round2(kB*(bActual-bExp)*mod);
  }
  a.hr = round2(a.hr + aDelta); b.hr = round2(b.hr + bDelta);
  const approved = { id:'APP-'+String(state.approved.length+1).padStart(3,'0'), fixtureId:f.id, subId:sub.id, md:f.md, a:f.a,b:f.b,...sub,aPre,bPre,aPost:a.hr,bPost:b.hr,aDelta,bDelta,approvedAt:new Date().toISOString() };
  state.approved.push(approved);
  state.ratingEvents.push({player:f.a, opponent:f.b, pre:aPre, delta:aDelta, post:a.hr, expected:aExp, modifier:mod, match:approved.id});
  state.ratingEvents.push({player:f.b, opponent:f.a, pre:bPre, delta:bDelta, post:b.hr, expected:bExp, modifier:mod, match:approved.id});
  createStats(approved);
  sub.status='approved'; f.status = sub.type === 'forfeit' ? 'forfeit' : 'official';
  updateCards();
  render();
  toast(`Approved: ${f.a} ${sub.aFT}-${sub.bFT} ${f.b}. Standings, ELO and cards moved.`);
}

function createStats(r){
  const htValid = Number.isFinite(r.aHT) && Number.isFinite(r.bHT) && (r.type === 'played' || r.type === 'draw');
  const a2For = htValid ? r.aFT-r.aHT : null, a2Ag = htValid ? r.bFT-r.bHT : null;
  const b2For = htValid ? r.bFT-r.bHT : null, b2Ag = htValid ? r.aFT-r.aHT : null;
  const row = (player,opp,gf,ga,htf,hta,sf,sa) => ({
    player,opp,gf,ga,htf,hta,sf,sa,fixtureId:r.fixtureId,resultId:r.id,
    points:leaguePoints(gf,ga,r.type), code:resultCode(gf,ga,r.type),
    played:r.type === 'played' || r.type === 'draw', htValid,
    ledHT:htValid ? htf>hta : false, trailedHT:htValid ? htf<hta : false,
    secondHalfControl:htValid ? sf>=sa : false,
    comeback:htValid ? htf<hta && gf>=ga : false,
    collapse:htValid ? htf>hta && gf<=ga : false,
    leadProtected:htValid ? htf>hta && gf>ga : false,
    bigAttack:gf>=5, burst:htValid ? htf>=3 || sf>=3 : false,
    bigWin:gf>ga && (gf-ga)>=4, lowConcession:ga<=2,
    closeSurvival:Math.abs(gf-ga)===1 && gf>=ga
  });
  state.stats.push(row(r.a,r.b,r.aFT,r.bFT,r.aHT,r.bHT,a2For,a2Ag));
  state.stats.push(row(r.b,r.a,r.bFT,r.aFT,r.bHT,r.aHT,b2For,b2Ag));
}

function getStandings(){
  const rows = state.players.map(p => ({player:p.name,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0,rel:100,hr:p.hr}));
  state.stats.forEach(s=>{
    const r = rows.find(x=>x.player===s.player); if(!r || !s.played) return;
    r.p++; r.gf += s.gf; r.ga += s.ga; r.pts += s.points; if(s.code==='W') r.w++; else if(s.code==='D') r.d++; else if(s.code==='L') r.l++;
  });
  rows.forEach(r=>r.gd=r.gf-r.ga);
  return rows.sort((a,b)=> b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || a.ga-b.ga || a.player.localeCompare(b.player)).map((r,i)=>({...r,pos:i+1}));
}
function rate(n,d){ return d ? n/d : 0; }
function updateCards(){
  state.players.forEach(p=>{
    const stats = state.stats.filter(s=>s.player===p.name && s.played);
    const n = stats.length;
    if(!n) return;
    const ht = stats.filter(s=>s.htValid);
    const htCov = ht.length/n;
    const goals = stats.reduce((a,s)=>a+s.gf,0), against = stats.reduce((a,s)=>a+s.ga,0);
    const gpg = goals/n, gag = against/n;
    const winRate = rate(stats.filter(s=>s.code==='W').length,n);
    const bigAttack = rate(stats.filter(s=>s.bigAttack).length,n);
    const burst = rate(stats.filter(s=>s.burst).length,n);
    const bigWin = rate(stats.filter(s=>s.bigWin).length,n);
    const lowCon = rate(stats.filter(s=>s.lowConcession).length,n);
    const fastStart = rate(ht.filter(s=>s.ledHT).length,ht.length);
    const leads = ht.filter(s=>s.ledHT), trails = ht.filter(s=>s.trailedHT);
    const leadProtect = rate(leads.filter(s=>s.leadProtected).length,leads.length);
    const collapse = rate(leads.filter(s=>s.collapse).length,leads.length);
    const comeback = rate(trails.filter(s=>s.comeback).length,trails.length);
    const secondControl = rate(ht.filter(s=>s.secondHalfControl).length,ht.length);
    const conf = n<=2?6:n<=4?4:n<=7?2:0;
    const htCap = htCov < .7 ? 1 : 99;
    const fastBonus = Math.min(htCap,clamp((fastStart-.35)*4,0,2));
    let control = clamp((fastStart*1)+(leadProtect*1.5)+(secondControl*1)-(collapse*2.5)-1,-2,4); if(control>0) control=Math.min(control,htCap);
    let gm = clamp(((leadProtect-collapse)*2)+((secondControl-.5)*1.5),-2,2); if(gm>0) gm=Math.min(gm,htCap);
    let res = clamp((comeback*2)+((secondControl-.5)*1.5)+((leadProtect-.6)*1),-1,3); if(res>0) res=Math.min(res,htCap);
    const hrStrength = clamp(60+((p.hr-1400)/10),60,90);
    const pac = Math.round(clamp(58+(Math.min(bigAttack,.6)*10)+(bigWin*4)+(Math.min(burst,.5)*8)+fastBonus-conf,40,90));
    const sho = Math.round(clamp(57+(Math.min(gpg,6)*2.5)+(winRate*8)+(Math.min(bigWin,.5)*4)-conf,40,90));
    const pas = Math.round(clamp(56+((stats.reduce((a,s)=>a+s.points,0)/n)*3)+(secondControl*4)+(lowCon*4)+control-conf,40,90));
    const dri = Math.round(clamp(58+(comeback*6)+(Math.min(burst,.5)*5)+(Math.min(gpg,6)*.8)-conf,40,90));
    const def = Math.round(clamp(80-(gag*2.8)+(lowCon*4)+gm-conf,40,90));
    const phy = Math.round(clamp(56+(100/10)+(rate(stats.filter(s=>s.closeSurvival).length,stats.filter(s=>Math.abs(s.gf-s.ga)===1).length)*4)+res-conf,40,90));
    let ovr = Math.round(.35*hrStrength+.15*sho+.15*def+.12*pas+.10*dri+.07*pac+.06*phy);
    if(n<=4) ovr = Math.min(ovr,72);
    const tier = ovr>=80?'Gold':ovr>=70?'Silver':'Bronze';
    const tags = [];
    if(fastStart>=.6) tags.push('Fast Starter'); if(comeback>=.5) tags.push('Comeback Threat'); if(leadProtect>=.7) tags.push('Lead Protector'); if(secondControl>=.65) tags.push('Second-Half Controller'); if(gpg>=5) tags.push('High Threat'); if(gag<=3) tags.push('Defensive Survivor'); if(tags.length===0) tags.push(...p.tags.slice(0,2));
    p.card = {ovr,pac,sho,pas,dri,def,phy,tier,htCov:Math.round(htCov*100)};
    p.tags = [...new Set(tags)];
  });
}

function resetTest(){ state = JSON.parse(JSON.stringify(seed)); render(); toast('Mock data reset.'); }
function toast(msg){ const old=document.querySelector('.toast'); if(old) old.remove(); const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),4200); }
function setView(v){ currentView=v; render(); }

function renderNav(){
  const make = () => NAV.map(([key,label])=>`<button class="navbtn ${currentView===key?'active':''}" data-view="${key}">${label}</button>`).join('');
  document.getElementById('desktopNav').innerHTML = make();
  document.getElementById('mobileNav').innerHTML = make();
  document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>setView(btn.dataset.view));
}
function sectionTitle(icon,eyebrow,title,subtitle=''){
  return `<div class="title-row"><div class="iconbox">${icon}</div><div><p class="eyebrow">${eyebrow}</p><h2 class="section-title">${title}</h2>${subtitle?`<p class="subtitle">${subtitle}</p>`:''}</div></div>`;
}
function stat(label,value,note){ return `<div class="stat"><span>${label}</span><strong>${value}</strong>${note?`<small>${note}</small>`:''}</div>`; }

function viewHome(){ return `
<section class="hero section"><div class="hero-grid"><div>
  <div class="logo-card"><img src="assets/fegl-logo.jpg" alt="FEGL logo"></div>
  <div class="pill">🔥 Season 2 System-Test Season</div>
  <h1>FEGL <span class="gradient">REIGNITE</span></h1>
  <p class="lead">New Fire. Same Crown.</p>
  <p class="copy">The digital home for Fiji Eyekonic Gaming League: fixtures, live standings after admin approval, player registry, result submission, ELO movement, card identity, and season archives — built for Season 2, ready for Season 100.</p>
  <div class="actions"><button class="primary" data-view="fixtures">View Fixtures</button><button class="secondary" data-view="submit">Submit Result</button><button class="ghost" data-view="standings">Live Table</button></div>
</div><div class="panel">
  <div class="between"><div><p class="eyebrow">Crown Status</p><h2 class="section-title">Season 2 starts at zero</h2></div><span style="font-size:52px">👑</span></div>
  <div class="grid grid2" style="margin-top:18px">${stat('Official Table','Admin Approved','No fake live scores.')}${stat('Club Picks','Free Until Kickoff','Drama stays alive.')}</div>
  <div class="note" style="margin-top:16px"><b>Command Center Rule:</b> Players create the fire. Admin approves the record. The leaderboard moves only when the result becomes official.</div>
</div></div></section>
<section class="section grid grid4">${stat('Season','REIGNITE','System-test season.')}${stat('Leaderboard','Live after approval','Official only.')}${stat('Club System','Freedom + cap','No pre-lock.')}${stat('Cards','HT analytics','Identity layer.')}</section>
${viewSeason()}${viewFixtures()}`; }

function viewSeason(){ return `<section class="section">${sectionTitle('👑','Season Hub','IGNITE to REIGNITE','Season 1 lit the fire. Season 2 tests the platform and protects the future.')}
<div class="grid grid2"><div class="panel orange"><div class="logo-card"><img src="assets/fegl-logo.jpg" alt="FEGL logo"></div><p class="eyebrow">Current Season</p><h2 class="section-title" style="font-size:56px">REIGNITE</h2><p class="lead">New Fire. Same Crown.</p><p class="copy">Season 2 is where FEGL becomes more than a tournament. It tests official FEGL IDs, flexible club selection, halftime analytics, admin-approved live standings, rating continuity, card evolution, and proper league records.</p><div class="actions"><button class="primary" data-view="fixtures">Open Fixtures</button><button class="secondary" data-view="submit">Submit Result</button></div></div>
<div class="grid"><div class="panel"><h3>Season 2 Test Targets</h3><p class="muted">Live leaderboard after approval, auto ELO, card engine, halftime identity tags, club-star cap display, disputes, exports, and archive-safe data.</p></div><div class="panel"><h3>Club Freedom Stays</h3><p class="muted">The site shows allowed star caps. Players still pick clubs on the spot before kickoff, so the drama and surprise stay alive.</p></div><div class="panel"><h3>Built for Season 100</h3><p class="muted">Every season, player, fixture, result, rating event, card snapshot, dispute, and archive should survive long-term.</p></div></div></div></section>`; }

function viewFixtures(){ return `<section class="section">${sectionTitle('📅','Match Rooms','Fixtures with Club-Star Caps','No club lock. The site shows each player’s allowed cap, but the actual club choice stays free until kickoff.')}
<div class="grid grid2">${state.fixtures.map(f=>{ const caps=getCaps(f); const stat=f.status==='official'?'green':f.status==='under_review'?'red':f.status==='forfeit'?'yellow':'green'; return `<article class="fixture"><div class="fixture-head"><div><span class="tag orange">${f.md}</span> <span class="tag ${stat}">${f.status.replace('_',' ')}</span></div><span class="tag">Gap ${Math.round(caps.gap)}</span></div><div class="matchup"><div class="player-side"><b>${f.a}</b><span>Allowed: up to ${caps.aCap}★</span></div><div class="vs">VS</div><div class="player-side right"><b>${f.b}</b><span>Allowed: up to ${caps.bCap}★</span></div></div><div class="note"><b>Club choice:</b> free until kickoff. Submit clubs used, star ratings, HT, FT and proof after the match.</div><div class="between" style="margin-top:14px"><small class="muted">Deadline: <b>${f.deadline}</b></small><small class="muted">${f.story}</small></div></article>`; }).join('')}</div></section>`; }

function viewStandings(){ const rows=getStandings(); return `<section class="section">${sectionTitle('📊','Official Ladder','Live Standings After Approval','Player submissions go pending first. Only admin-approved results move the official table, ELO, cards, and profiles.')}
<div class="table-wrap"><table><thead><tr>${['Pos','Player','P','W','D','L','GF','GA','GD','Pts','HR','Rel'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r.pos}</strong></td><td><strong>${r.player}</strong></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd>0?'+':''}${r.gd}</td><td><strong>${r.pts}</strong></td><td>${r.hr.toFixed(2)}</td><td><span class="tag green">${r.rel}%</span></td></tr>`).join('')}</tbody></table></div><p class="muted" style="margin-top:12px">Tie-break: points, goal difference, goals scored, head-to-head, goals against, admin decision.</p></section>`; }

function viewPlayers(){ return `<section class="section">${sectionTitle('👥','Registry','Players and FEGL IDs','Season 2 introduces the registry era. IDs survive PSN changes, seasons, awards, cards and ELO history.')}
<div class="cards">${state.players.map(p=>`<article class="player-card"><div class="head"><div><p class="eyebrow">${p.id}</p><h3>${p.name}</h3><p class="muted">${p.role}</p></div><span class="tag ${p.card.tier==='Silver'?'yellow':'orange'}">${p.card.ovr} ${p.card.tier}</span></div><div class="mini-grid"><div class="mini"><span>Hidden Rating</span><b>${p.hr.toFixed(2)}</b></div><div class="mini"><span>Card</span><b>${p.card.ovr} OVR</b></div></div><div class="mini-grid"><div class="mini"><span>PAC SHO PAS</span><b>${p.card.pac} ${p.card.sho} ${p.card.pas}</b></div><div class="mini"><span>DRI DEF PHY</span><b>${p.card.dri} ${p.card.def} ${p.card.phy}</b></div></div><div class="chips">${p.tags.map(t=>`<span class="chip">${t}</span>`).join('')}</div></article>`).join('')}</div></section>`; }

function viewResults(){ return `<section class="section">${sectionTitle('🏆','Official Feed','Results and Match Stories','Approved results become league history: HT, FT, clubs used, ELO movement and storyline tags.')}
<div class="grid grid2">${state.approved.length ? state.approved.map(r=>`<article class="result-card"><div class="between"><span class="tag green">Official</span><span class="eyebrow">${r.md}</span></div><div class="score-line"><span><strong>${r.a}</strong></span><b>${r.aFT}-${r.bFT}</b><span class="right"><strong>${r.b}</strong></span></div><div class="grid grid2"><div class="mini"><span>HT</span><b>${r.aHT}-${r.bHT}</b></div><div class="mini"><span>Clubs</span><b>${r.aClub} ${r.aStars}★ vs ${r.bClub} ${r.bStars}★</b></div></div><p class="muted" style="margin-top:12px">${storyForResult(r)}</p></article>`).join('') : `<div class="panel"><h3>No official results yet</h3><p class="muted">Approve a pending result from Admin to see the official feed move.</p></div>`}</div></section>`; }
function storyForResult(r){ if(r.aHT<r.bHT && r.aFT>r.bFT) return `${r.a} survives the upset scare and flips the match after halftime.`; if(r.aFT===r.bFT) return `${r.a} and ${r.b} split the points after a tense draw.`; return `${r.aFT>r.bFT?r.a:r.b} takes the official result and moves the table.`; }

function viewSubmit(){ return `<section class="section">${sectionTitle('⬆️','Player Action','Submit Result','This mock form shows the future mobile-first result flow. Submissions stay pending until admin approval.')}
<div class="panel"><div class="form-grid">${['Fixture ID / Matchday','Submitter Name','Player 1 Club Used','Player 1 Club Star Rating','Player 2 Club Used','Player 2 Club Star Rating','Halftime Score','Full-Time Score','Proof Link','Any Dispute?'].map(x=>`<div class="field"><label>${x}</label><input placeholder="${x.includes('Score')?'Example: 2-1':'Placeholder input'}"></div>`).join('')}</div><div class="note" style="margin-top:16px"><b>Important:</b> halftime helps cards and scouting. Full-time decides the official result. Club stars are checked after submission.</div><button class="primary" style="margin-top:16px;width:100%" onclick="toast('Prototype form only. In the real site this creates a pending submission.')">Submit Pending Result</button></div></section>`; }

function viewRules(){ const rules=['Club teams only. No international teams.','Club choice is free until kickoff, but must stay within the allowed star cap.','Submit halftime score, full-time score, clubs used, club stars and proof.','Full-time decides standings and ELO. Halftime helps cards, scouting and player identity.','Submitted results are pending until admin approval.','Forfeits count for standings; forfeits do not count as gameplay sample matches.','Respect opponents, admins and the league. Fake results and abuse are reviewable offenses.']; return `<section class="section">${sectionTitle('⚖️','Player Rules','Simple Rules, Strong System','Public rules stay readable. Formula depth stays behind the scenes.')}
<div class="grid">${rules.map((r,i)=>`<div class="panel"><p><b>${String(i+1).padStart(2,'0')}.</b> ${r}</p></div>`).join('')}</div></section>`; }

function viewArchive(){ const seasons=[['Season 1','IGNITE','The Fire Was Lit','Archived','hy-brid_theory','Deathbringer1606','The origin season. FEGL proved the league could run, created the first champion and gave Season 2 its foundation.'],['Season 2','REIGNITE','New Fire. Same Crown.','Active Build','To be decided','To be decided','The system-test season. New ELO continuity, FEGL IDs, halftime analytics, club-star balancing and Command Center test.']]; return `<section class="section">${sectionTitle('🔥','Hall of Flame','Season Archive','Each season gets its own permanent record, story, champion, awards and downloadable season book later.')}
<div class="grid grid2">${seasons.map((s,i)=>`<article class="archive-card"><div class="bar ${i?'gold':''}"></div><div class="body"><div class="between"><div><p class="eyebrow">${s[0]}</p><h2 class="section-title">${s[1]}</h2><p class="lead">${s[2]}</p></div><span class="tag orange">${s[3]}</span></div><p class="muted">${s[6]}</p><div class="grid grid2"><div class="mini"><span>Champion</span><b>${s[4]}</b></div><div class="mini"><span>Runner-up</span><b>${s[5]}</b></div></div><div class="chips"><span class="chip">Final Table</span><span class="chip">Awards</span><span class="chip">Cards</span><span class="chip">ELO Path</span></div></div></article>`).join('')}</div></section>`; }

function viewBackend(){ return `<section class="section">${sectionTitle('🗄️','Platform Core','Backend-Ready Database Schema','Long-term structure behind the website. It keeps Season 2 simple while preparing for future formats, paid seasons, archives and divisions.')}
<div class="grid grid2"><div class="panel"><div class="grid grid2">${DB_TABLES.map(([name,p])=>`<div class="backend-table"><code>${name}</code><p>${p}</p></div>`).join('')}</div></div><div class="grid"><div class="panel orange"><h3>Approval Engine Flow</h3><div class="engine-list">${ENGINE_FLOW.map((s,i)=>`<div class="engine-step"><span>${i+1}</span><b>${s}</b></div>`).join('')}</div></div><div class="panel"><h3>Free-Tier Protection</h3><p class="muted">Store match data in the database. Keep heavy videos/proof outside early. Export CSV backups every matchday. No player login until needed.</p></div><div class="panel"><h3>Different Formats Later</h3><p class="muted">Round robin, groups, knockouts, Swiss, divisions and cups can all be supported because fixtures belong to season, stage and ruleset.</p></div></div></div></section>`; }

function viewAdmin(){ return `<section class="section">${sectionTitle('🔐','Private Control','Admin Command Panel','Owner-only engine. The public sees clean updates; admin controls what becomes official.')}
<div class="grid grid2"><div class="panel"><div class="between"><h3>Pending / Review Queue</h3><button class="secondary small" onclick="resetTest()">Reset Mock</button></div><div class="grid" style="margin-top:14px">${state.submissions.map(s=>{ const f=fixtureById(s.fixtureId); const caps=getCaps(f); const aLegal=s.aStars<=caps.aCap,bLegal=s.bStars<=caps.bCap; return `<div class="admin-item"><div><span class="tag ${s.status==='pending'?'yellow':s.status==='approved'?'green':'red'}">${s.status.replace('_',' ')}</span><p><b>${f.a} ${s.aFT}-${s.bFT} ${f.b}</b> · HT ${s.aHT}-${s.bHT}</p><p class="muted">${s.aClub} ${s.aStars}★ vs ${s.bClub} ${s.bStars}★ · ${aLegal&&bLegal?'Club caps legal':'Club cap issue'}</p>${s.note?`<p class="danger">${s.note}</p>`:''}</div><div>${s.status==='pending'?`<button class="primary small" onclick="approveSubmission('${s.id}')">Approve</button>`:''}</div></div>`}).join('')}</div></div>
<div class="panel"><h3>ELO Event Log</h3>${state.ratingEvents.length?state.ratingEvents.map(e=>`<div class="engine-step"><span>${e.delta>0?'+':'−'}</span><b>${e.player}: ${e.pre.toFixed(2)} → ${e.post.toFixed(2)} (${e.delta>0?'+':''}${e.delta.toFixed(2)})</b></div>`).join(''):`<p class="muted">No ELO movement yet. Approve a result to create audit rows.</p>`}<div class="note" style="margin-top:16px"><b>Admin Freeze Button:</b> If a dispute or formula issue happens, show “Standings under admin review” until corrected.</div></div></div></section>`; }

function render(){ renderNav(); const views={home:viewHome,season:viewSeason,fixtures:viewFixtures,standings:viewStandings,players:viewPlayers,results:viewResults,submit:viewSubmit,rules:viewRules,archive:viewArchive,backend:viewBackend,admin:viewAdmin}; document.getElementById('app').innerHTML = (views[currentView]||viewHome)(); document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>setView(btn.dataset.view)); }
render();
