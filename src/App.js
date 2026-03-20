/* eslint-disable */
import { useState, useEffect, useRef, useCallback, memo } from "react";

// ── Firebase REST helpers ──────────────────────────────────────────────────────
const FB = "https://five-cards-f8dcc-default-rtdb.firebaseio.com";
async function dbSet(key,data){const r=await fetch(`${FB}/${key}.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!r.ok)throw new Error(`Write ${r.status}`);return r.json();}
async function dbGet(key){const r=await fetch(`${FB}/${key}.json`);if(!r.ok)throw new Error(`Read ${r.status}`);return r.json();}
async function dbMerge(key,u){const r=await fetch(`${FB}/${key}.json`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(u)});if(!r.ok)throw new Error(`Merge ${r.status}`);return r.json();}
function dbListen(key,cb){let stopped=false,lastJson=null;async function poll(){if(stopped)return;try{const r=await fetch(`${FB}/${key}.json`);if(r.ok){const t=await r.text();if(t!==lastJson){lastJson=t;try{cb(JSON.parse(t));}catch(_){}}}}catch(_){}if(!stopped)setTimeout(poll,1500);}poll();return()=>{stopped=true;};}

// ── Vibration ─────────────────────────────────────────────────────────────────
function vibrate(p){if(navigator?.vibrate)navigator.vibrate(p);}

// ── Window size hook ──────────────────────────────────────────────────────────
function useWinSize(){
  const get=()=>({w:window.innerWidth,h:window.innerHeight});
  const [s,setS]=useState(get);
  useEffect(()=>{
    const fn=()=>setS(get());
    window.addEventListener('resize',fn);
    window.addEventListener('orientationchange',()=>setTimeout(fn,200));
    return()=>window.removeEventListener('resize',fn);
  },[]);
  return s;
}

// ── Landscape wrapper ─────────────────────────────────────────────────────────
// Always renders at landscape dimensions.
// On portrait phone: rotates 90° so it fills the screen in landscape.
function LandscapeWrap({children,style={}}){
  const {w,h}=useWinSize();
  const portrait=h>w;
  const LW=portrait?h:w;   // landscape width  = longer side
  const LH=portrait?w:h;   // landscape height = shorter side
  if(portrait){
    // Render at LW×LH, then rotate so it fills portrait screen
    return(
      <div style={{position:'fixed',top:0,left:0,overflow:'hidden',
        width:LW,height:LH,
        transformOrigin:'top left',
        transform:`rotate(90deg) translateY(-${LW}px)`,
        ...style}}>
        {children}
      </div>
    );
  }
  return(
    <div style={{position:'fixed',inset:0,width:LW,height:LH,overflow:'hidden',...style}}>
      {children}
    </div>
  );
}

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AV_COLS=["#7c3aed","#db2777","#ea580c","#16a34a","#0284c7","#dc2626","#0891b2","#d97706"];
function avCol(n){let h=0;for(let i=0;i<n.length;i++)h=n.charCodeAt(i)+((h<<5)-h);return AV_COLS[Math.abs(h)%AV_COLS.length];}
function avIni(n){return(n||'?').slice(0,2).toUpperCase();}


// ── Design tokens ─────────────────────────────────────────────────────────────
const T={bg:"#F4F5F7",surface:"rgba(255,255,255,0.72)",border:"rgba(255,255,255,0.9)",ink:"#111218",muted:"#6B7280",accent:"#2563EB",red:"#EF4444",green:"#10B981",gold:"#F59E0B",suit_r:"#E11D48",suit_b:"#1E3A8A",shadow:"0 8px 32px rgba(0,0,0,0.10),0 1.5px 4px rgba(0,0,0,0.06)",glow_g:"0 0 0 2.5px #10B981,0 8px 24px rgba(16,185,129,0.25)",glow_y:"0 0 0 2.5px #F59E0B,0 8px 24px rgba(245,158,11,0.25)",font:"'DM Sans',system-ui,sans-serif",mono:"'DM Mono',monospace"};

const BASE_CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#F4F5F7;font-family:'DM Sans',system-ui,sans-serif;color:#111218;overscroll-behavior:none;}
  ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
  @keyframes pop{0%{transform:scale(.85);}60%{transform:scale(1.06);}100%{transform:none;}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
  .fade-up{animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both;}
  .pop{animation:pop .3s cubic-bezier(.22,1,.36,1) both;}
`;

// ── Game constants ────────────────────────────────────────────────────────────
const SUITS=["♠","♥","♦","♣"];
const RANKS=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RANK_PTS={A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:10,Q:10,K:10};
const AI_NAMES=["Anu","Priya","Rajan","Kumar","Devi","Siva","mani","Arun","Lakshmi","Vikram","Nisha","Rahul","Sunita","Amit","Kavya","Rohit","Meera","Sanjay","Pooja","Vishal","Sneha"];

function genCode(){return Math.random().toString(36).substring(2,7).toUpperCase();}
function makeDeck(){const d=[];for(const s of SUITS)for(const r of RANKS)d.push({suit:s,rank:r,pts:RANK_PTS[r],id:`${r}-${s}`});return d;}
function shuffle(d){const a=[...d];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cardPts(c,wc){return(wc&&c.rank===wc.rank)?0:c.pts;}
function handTotal(cards,wc){return(cards||[]).reduce((s,c)=>s+cardPts(c,wc),0);}

// ── Inject global CSS once ────────────────────────────────────────────────────
function Styles(){
  useEffect(()=>{const s=document.createElement("style");s.textContent=BASE_CSS;document.head.appendChild(s);return()=>document.head.removeChild(s);},[]);
  return null;
}

// ── Shared UI components ──────────────────────────────────────────────────────
const Panel=memo(({children,style={}})=>(
  <div style={{background:T.surface,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",border:`1.5px solid ${T.border}`,borderRadius:16,boxShadow:T.shadow,...style}}>{children}</div>
));

function Btn({children,onClick,variant="primary",disabled,small,style={}}){
  const base={border:"none",borderRadius:9,cursor:disabled?"not-allowed":"pointer",fontFamily:T.font,fontWeight:700,transition:"all .15s",userSelect:"none",opacity:disabled?.45:1,...style};
  const sz=small?{fontSize:12,padding:"7px 14px"}:{fontSize:14,padding:"11px 22px"};
  const v={primary:{background:T.accent,color:"#fff",boxShadow:"0 2px 8px rgba(37,99,235,.3)"},danger:{background:T.red,color:"#fff",boxShadow:"0 2px 8px rgba(239,68,68,.3)"},ghost:{background:"rgba(0,0,0,.06)",color:T.ink,boxShadow:"none"},outline:{background:"transparent",color:T.ink,border:"1.5px solid rgba(0,0,0,.12)",boxShadow:"none"},green:{background:T.green,color:"#fff",boxShadow:"0 2px 8px rgba(16,185,129,.3)"},gold:{background:T.gold,color:"#fff",boxShadow:"0 2px 8px rgba(245,158,11,.3)"}};
  return <button onClick={disabled?undefined:onClick} style={{...base,...sz,...v[variant]}}>{children}</button>;
}

const ScoreChip=memo(({name,score,limit,isActive,isElim,isYou})=>{
  const pct=Math.min(100,(score/limit)*100);
  const barColor=pct>80?T.red:pct>55?T.gold:T.green;
  return(
    <div style={{background:isActive?"rgba(37,99,235,.08)":isElim?"rgba(0,0,0,.03)":"rgba(255,255,255,.6)",border:isActive?`1.5px solid ${T.accent}`:"1.5px solid rgba(0,0,0,.06)",borderRadius:10,padding:"6px 10px",minWidth:68,flexShrink:0,opacity:isElim?.45:1,transition:"all .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
        <span style={{fontSize:10,fontWeight:700,color:isActive?T.accent:T.ink,maxWidth:52,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{isElim?"💀 ":isActive?"▶ ":""}{isYou?"You":name}</span>
        <span style={{fontSize:10,fontFamily:T.mono,fontWeight:500,color:pct>80?T.red:T.muted,marginLeft:3}}>{score}</span>
      </div>
      <div style={{height:3,background:"rgba(0,0,0,.06)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:2,transition:"width .5s"}}/>
      </div>
      <div style={{fontSize:8,color:T.muted,marginTop:1,textAlign:"right"}}>/{limit}</div>
    </div>
  );
});

const TimerRing=memo(({timeLeft,total=30})=>{
  const r=20,circ=2*Math.PI*r,pct=Math.max(0,timeLeft/total);
  const color=timeLeft>15?T.green:timeLeft>7?T.gold:T.red;
  return(
    <svg width={48} height={48} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={24} cy={24} r={r} fill="none" stroke="rgba(0,0,0,.07)" strokeWidth={4}/>
      <circle cx={24} cy={24} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} style={{transition:"stroke-dashoffset 1s linear,stroke .5s"}}/>
      <text x={24} y={24} textAnchor="middle" dominantBaseline="central" style={{fill:color,fontSize:11,fontWeight:700,fontFamily:T.mono,transform:"rotate(90deg)",transformOrigin:"24px 24px"}}>{timeLeft}</text>
    </svg>
  );
});

const Card=memo(({card,faceDown,selected,glowGreen,small,onClick,badge})=>{
  if(!card)return null;
  const W=small?44:64,H=small?62:92;
  const isRed=card.suit==="♥"||card.suit==="♦";
  const sc=isRed?T.suit_r:T.suit_b;
  const shadow=selected?T.glow_y:glowGreen?T.glow_g:T.shadow;
  const ty=selected?-14:glowGreen?-6:0;
  const bg=faceDown?"linear-gradient(145deg,#1E3A8A 0%,#111827 100%)":"rgba(255,255,255,.82)";
  const bd=faceDown?"1.5px solid rgba(255,255,255,.12)":"1.5px solid rgba(255,255,255,.95)";
  const bf=faceDown?"none":"blur(12px)";
  return(
    <div style={{position:"relative",display:"inline-block",flexShrink:0}}>
      {badge&&<div style={{position:"absolute",top:-18,left:"50%",transform:"translateX(-50%)",background:selected?T.gold:T.green,color:"#fff",fontSize:8,fontWeight:700,borderRadius:4,padding:"2px 7px",whiteSpace:"nowrap",zIndex:5,letterSpacing:.5}}>{badge}</div>}
      <div onClick={onClick} style={{width:W,height:H,borderRadius:10,background:bg,backdropFilter:bf,WebkitBackdropFilter:bf,border:bd,boxShadow:shadow,transform:`translateY(${ty}px)`,transition:"transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s",cursor:onClick?"pointer":"default",userSelect:"none",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:small?"3px 4px":"5px 6px",overflow:"hidden",position:"relative"}}>
        {faceDown?(
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{opacity:.25,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:2}}>
              {["♠","♥","♦","♣","♣","♦","♥","♠"].map((s,i)=><div key={i} style={{fontSize:8,color:i%2?"#fff":"rgba(255,255,255,.5)",textAlign:"center"}}>{s}</div>)}
            </div>
          </div>
        ):(
          <>
            <div style={{fontSize:small?10:13,fontWeight:700,color:sc,lineHeight:1.1,fontFamily:T.mono}}>{card.rank}<br/><span style={{fontSize:small?9:10}}>{card.suit}</span></div>
            <div style={{fontSize:small?18:28,textAlign:"center",color:sc,lineHeight:1,opacity:.9}}>{card.suit}</div>
            <div style={{fontSize:small?10:13,fontWeight:700,color:sc,lineHeight:1.1,textAlign:"right",transform:"rotate(180deg)",fontFamily:T.mono}}>{card.rank}<br/><span style={{fontSize:small?9:10}}>{card.suit}</span></div>
          </>
        )}
      </div>
    </div>
  );
});

// ── Wild Card Peek — horizontal, 30% visible peeking from bottom ──────────────
// Card is 64×92px. Rotated 90deg → appears 92px wide, 64px tall.
// translateY(+45px) pushes it down so only ~30% (≈27px) is visible above the bottom edge.
const WildCardPeek=memo(({card})=>{
  if(!card)return null;
  const isRed=card.suit==="♥"||card.suit==="♦";
  const sc=isRed?T.suit_r:T.suit_b;
  return(
    <div style={{position:"absolute",bottom:0,left:"50%",width:64,height:92,
      transform:"translateX(-50%) translateY(45px) rotate(90deg)",
      transformOrigin:"center center",
      borderRadius:10,background:"rgba(255,255,255,.9)",
      backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",
      border:"1.5px solid rgba(255,255,255,.95)",
      boxShadow:`0 0 0 2.5px ${T.gold},0 8px 28px rgba(245,158,11,.35)`,
      display:"flex",flexDirection:"column",justifyContent:"space-between",
      padding:"5px 6px",overflow:"hidden",pointerEvents:"none",zIndex:4}}>
      <div style={{fontSize:13,fontWeight:700,color:sc,lineHeight:1.1,fontFamily:T.mono}}>{card.rank}<br/><span style={{fontSize:10}}>{card.suit}</span></div>
      <div style={{fontSize:28,textAlign:"center",color:sc,lineHeight:1,opacity:.9}}>{card.suit}</div>
      <div style={{fontSize:13,fontWeight:700,color:sc,lineHeight:1.1,textAlign:"right",transform:"rotate(180deg)",fontFamily:T.mono}}>{card.rank}<br/><span style={{fontSize:10}}>{card.suit}</span></div>
    </div>
  );
});

const FanCards=memo(({count=5})=>{
  const c=Math.max(1,count),W=42,H=60;
  const tw=W+(c-1)*18+20;
  const angles=Array.from({length:c},(_,i)=>c===1?0:-20+(40/(c-1))*i);
  return(
    <div style={{position:"relative",height:H+28,width:tw,margin:"0 auto"}}>
      {angles.map((angle,i)=>(
        <div key={i} style={{position:"absolute",left:i*18,bottom:0,width:W,height:H,borderRadius:7,background:"#fff",border:"1.5px solid rgba(255,255,255,.15)",boxShadow:"0 4px 12px rgba(0,0,0,.25)",transform:`rotate(${angle}deg)`,transformOrigin:"50% 100%",overflow:"hidden",zIndex:i}}>
          <div style={{position:"absolute",inset:0,background:"#fff"}}/>
          <div style={{position:"absolute",inset:2,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gridTemplateRows:"repeat(5,1fr)",gap:1,overflow:"hidden",borderRadius:5}}>
            {["♠","♥","♦","♣","♣","♦","♥","♠","♠","♥","♦","♣","♣","♦","♥","♠","♠","♥","♦","♣"].map((s,idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:s==="♥"||s==="♦"?"#E11D48":"#111827",opacity:.85}}>{s}</div>
            ))}
          </div>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,255,255,.18) 0%,transparent 60%)",borderRadius:7,pointerEvents:"none"}}/>
        </div>
      ))}
    </div>
  );
});

// ── Modals ────────────────────────────────────────────────────────────────────
function RulesModal({onClose,limit,penalty}){
  const rules=[["🎯 Goal",`Lowest hand total when SHOW is called. Reach ${limit} pts → eliminated. Last player wins.`],["🃏 Points","A=1 · 2–9=face value · 10/J/Q/K=10"],["🌟 Wild","One rank revealed each round — all those cards = 0 pts. Peeks sideways from the table bottom."],["↕ Turn","Tap Stock or Discard (green glow = source). Tap hand card (yellow glow = drop). Tap SWAP."],["♊ Multi-Drop","Drop multiple cards of the same rank in one move."],["📢 SHOW",`Correct → 0 pts for you; others score their totals. Wrong → +${penalty||50} pts penalty for you.`],["⏱ Timer","30s per turn. Extend by 10s or skip."]];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <Panel style={{maxWidth:440,width:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px 12px",borderBottom:"1px solid rgba(0,0,0,.06)"}}>
          <span style={{fontWeight:900,fontSize:17,letterSpacing:-.3}}>Rules</span>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <div style={{overflowY:"auto",padding:"14px 20px 20px"}}>
          {rules.map(([t,b])=><div key={t} style={{marginBottom:14}}><div style={{fontWeight:700,fontSize:12,marginBottom:3,color:T.accent}}>{t}</div><div style={{fontSize:13,color:T.muted,lineHeight:1.6}}>{b}</div></div>)}
        </div>
      </Panel>
    </div>
  );
}

function HistoryModal({onClose,history,allPlayers,scores,scoreLimit}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <Panel style={{maxWidth:480,width:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 12px",borderBottom:"1px solid rgba(0,0,0,.06)"}}>
          <span style={{fontWeight:900,fontSize:16,letterSpacing:-.3}}>📜 Points History</span>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <div style={{overflowY:"auto",padding:"14px 16px 18px"}}>
          {history&&history.length>0?(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:260}}>
                <thead>
                  <tr style={{borderBottom:"2px solid rgba(0,0,0,.08)"}}>
                    <th style={{textAlign:"left",padding:"6px 6px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase"}}>Rnd</th>
                    {allPlayers.map(n=><th key={n} style={{textAlign:"center",padding:"6px 6px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",whiteSpace:"nowrap"}}>{n}</th>)}
                    <th style={{textAlign:"center",padding:"6px 6px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase"}}>🏅</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,.05)",background:i%2?"rgba(0,0,0,.02)":"transparent"}}>
                      <td style={{padding:"8px 6px",fontWeight:700,fontFamily:T.mono,color:T.muted,fontSize:11}}>R{h.round}</td>
                      {allPlayers.map(name=>{const g=h.gained?.[name]??0;return<td key={name} style={{textAlign:"center",padding:"8px 6px",fontFamily:T.mono,fontSize:12,fontWeight:g>0?700:400,color:g===0?T.green:g>50?T.red:T.gold}}>{g===0?"0 ✓":`+${g}`}</td>;})}
                      <td style={{textAlign:"center",padding:"8px 6px",fontSize:11,fontWeight:700,color:T.accent,whiteSpace:"nowrap"}}>{h.winner}</td>
                    </tr>
                  ))}
                  <tr style={{borderTop:"2px solid rgba(0,0,0,.1)",background:"rgba(37,99,235,.04)"}}>
                    <td style={{padding:"8px 6px",fontWeight:900,fontSize:12,color:T.ink}}>Total</td>
                    {allPlayers.map(name=>{const sc=scores?.[name]??0,pct=Math.min(100,(sc/scoreLimit)*100);return<td key={name} style={{textAlign:"center",padding:"8px 6px",fontFamily:T.mono,fontWeight:900,fontSize:13,color:pct>80?T.red:pct>55?T.gold:T.green}}>{sc}</td>;})}
                    <td/>
                  </tr>
                </tbody>
              </table>
            </div>
          ):(
            <div style={{textAlign:"center",padding:"32px 20px"}}>
              <div style={{fontSize:32,marginBottom:8}}>📊</div>
              <div style={{color:T.muted,fontSize:13}}>No rounds played yet</div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function EliminatedBanner({name,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Panel style={{padding:"40px 36px",textAlign:"center",maxWidth:320,width:"92%"}}>
        <div style={{fontSize:56,marginBottom:12}}>💀</div>
        <div style={{fontWeight:900,fontSize:24,marginBottom:6,color:T.red}}>Eliminated</div>
        <div style={{color:T.muted,fontSize:14,marginBottom:24}}><strong style={{color:T.ink}}>{name}</strong> reached the score limit</div>
        <Btn onClick={onClose}>Continue →</Btn>
      </Panel>
    </div>
  );
}

function GameOverBanner({winner,onPlayAgain,onQuit}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Panel style={{padding:"44px 40px",textAlign:"center",maxWidth:340,width:"92%"}}>
        <div style={{fontSize:64,marginBottom:12}}>🏆</div>
        <div style={{fontWeight:900,fontSize:28,marginBottom:4,letterSpacing:-.5}}>Winner!</div>
        <div style={{fontWeight:700,fontSize:20,color:T.accent,marginBottom:28}}>{winner}</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <Btn variant="ghost" onClick={onQuit}>Quit</Btn>
          <Btn onClick={onPlayAgain}>Play Again</Btn>
        </div>
      </Panel>
    </div>
  );
}

function TurnGate({playerName,onReady}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(17,18,24,.96)",backdropFilter:"blur(12px)",zIndex:250,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
      <div style={{textAlign:"center",padding:"0 32px",animation:"fadeUp .4s both"}}>
        <div style={{fontSize:56,marginBottom:16}}>🃏</div>
        <div style={{fontWeight:900,fontSize:28,color:"#fff",marginBottom:6,letterSpacing:-.5}}>{playerName}'s Turn</div>
        <div style={{color:"rgba(255,255,255,.5)",fontSize:14,marginBottom:32}}>Hand the device to <strong style={{color:"rgba(255,255,255,.8)"}}>{playerName}</strong></div>
        <Btn onClick={onReady} style={{fontSize:15,padding:"13px 36px"}}>I'm Ready →</Btn>
      </div>
    </div>
  );
}

// ── Round Result ──────────────────────────────────────────────────────────────
function RoundResult({round,roundResult,allPlayers,scores,scoreLimit,penaltyPoints,onNext,canNext,history}){
  const [tab,setTab]=useState("result");
  const AUTO=5;
  const [cd,setCd]=useState(AUTO);
  useEffect(()=>{
    if(!canNext)return;
    const t=setInterval(()=>setCd(p=>{if(p<=1){clearInterval(t);onNext();return 0;}return p-1;}),1000);
    return()=>clearInterval(t);
  },[canNext,onNext]);
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:16}}>
      <style>{BASE_CSS}</style>
      <div style={{maxWidth:480,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:36,marginBottom:4}}>{roundResult.claimerWon?"🎉":"😬"}</div>
          <div style={{fontWeight:900,fontSize:20,marginBottom:3}}>Round {round}</div>
          <div style={{fontSize:13,color:roundResult.claimerWon?T.green:T.red,fontWeight:700}}>
            {roundResult.claimerWon?`${roundResult.claimerName} wins the round! (+0 pts) ✓`:`${roundResult.claimerName} wrong SHOW! (+${penaltyPoints} pts)`}
          </div>
        </div>
        <div style={{display:"flex",background:"rgba(0,0,0,.06)",borderRadius:10,padding:3,marginBottom:12,gap:3}}>
          {[["result","📊 This Round"],["history","📜 History"]].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:tab===t?"#fff":"transparent",color:tab===t?T.ink:T.muted,boxShadow:tab===t?T.shadow:"none",transition:"all .2s",fontFamily:T.font}}>{label}</button>
          ))}
        </div>
        {tab==="result"&&(
          <Panel style={{overflow:"hidden"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,.06)"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Hands Revealed</div>
              {roundResult.results.map(r=>(
                <div key={r.name} style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:700,minWidth:48,color:T.ink}}>{r.name}:</span>
                  {r.hand.map((c,i)=><Card key={i} card={c} small/>)}
                  <span style={{fontFamily:T.mono,fontSize:12,fontWeight:700,marginLeft:4,color:r.pts===0?T.green:r.pts<=10?T.green:T.red}}>{r.pts}pt</span>
                </div>
              ))}
            </div>
            <div style={{padding:"14px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Scores</div>
              {allPlayers.map(name=>{
                const sc=roundResult.newScores?.[name]??scores?.[name]??0;
                const gained=sc-(scores?.[name]??0);
                const isElim=(roundResult.justElim||[]).includes(name);
                const pct=Math.min(100,(sc/scoreLimit)*100);
                return(
                  <div key={name} style={{marginBottom:10,opacity:isElim?.45:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontWeight:700,fontSize:13}}>{isElim?"💀 ":""}{name}{isElim&&<span style={{marginLeft:6,fontSize:9,background:T.red,color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:700}}>OUT</span>}</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {gained>0&&<span style={{fontSize:11,color:T.red,fontWeight:700,fontFamily:T.mono}}>+{gained}</span>}
                        {gained===0&&<span style={{fontSize:11,color:T.green,fontWeight:700,fontFamily:T.mono}}>+0 ✓</span>}
                        <span style={{fontFamily:T.mono,fontSize:13,fontWeight:700,color:pct>80?T.red:T.ink}}>{sc}<span style={{fontSize:10,color:T.muted,fontWeight:400}}>/{scoreLimit}</span></span>
                      </div>
                    </div>
                    <div style={{height:5,background:"rgba(0,0,0,.06)",borderRadius:3}}><div style={{height:"100%",width:`${pct}%`,background:pct>80?T.red:pct>55?T.gold:T.green,borderRadius:3,transition:"width .6s"}}/></div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}
        {tab==="history"&&(
          <Panel style={{overflow:"hidden"}}>
            <div style={{padding:"14px 16px"}}>
              {history&&history.length>0?(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{borderBottom:"2px solid rgba(0,0,0,.08)"}}>
                        <th style={{textAlign:"left",padding:"6px 4px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase"}}>Rnd</th>
                        {allPlayers.map(n=><th key={n} style={{textAlign:"center",padding:"6px 4px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",whiteSpace:"nowrap"}}>{n}</th>)}
                        <th style={{textAlign:"center",padding:"6px 4px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase"}}>🏅</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,.05)"}}>
                          <td style={{padding:"6px 4px",fontWeight:700,fontFamily:T.mono,color:T.muted,fontSize:11}}>R{h.round}</td>
                          {allPlayers.map(name=>{const g=h.gained?.[name]??0;return<td key={name} style={{textAlign:"center",padding:"6px 4px",fontFamily:T.mono,fontSize:12,fontWeight:g>0?700:400,color:g===0?T.green:g>50?T.red:T.gold}}>{g===0?"0 ✓":`+${g}`}</td>;})}
                          <td style={{textAlign:"center",padding:"6px 4px",fontSize:11,fontWeight:700,color:T.accent,whiteSpace:"nowrap"}}>{h.winner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ):<div style={{textAlign:"center",padding:"24px 0",color:T.muted,fontSize:13}}>No history yet</div>}
            </div>
          </Panel>
        )}
        <div style={{marginTop:16,textAlign:"center"}}>
          {canNext?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div style={{position:"relative",width:72,height:72}}>
                <svg width={72} height={72} style={{transform:"rotate(-90deg)",position:"absolute",inset:0}}>
                  <circle cx={36} cy={36} r={30} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={5}/>
                  <circle cx={36} cy={36} r={30} fill="none" stroke={T.accent} strokeWidth={5} strokeDasharray={2*Math.PI*30} strokeDashoffset={2*Math.PI*30*(1-cd/AUTO)} style={{transition:"stroke-dashoffset 1s linear"}}/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:T.accent,fontFamily:T.mono}}>{cd}</div>
              </div>
              <div style={{fontSize:12,color:T.muted,fontWeight:500}}>Next round starting...</div>
            </div>
          ):<div style={{fontSize:12,color:T.muted,fontStyle:"italic",padding:"12px 0"}}>⏳ Waiting for host...</div>}
        </div>
      </div>
    </div>
  );
}

// ── Home Screen ───────────────────────────────────────────────────────────────
function HomeScreen({onPlayAI,onPlayFriends}){
  const [players,setPlayers]=useState(2);
  const [limit,setLimit]=useState(300);
  const [limInput,setLimInput]=useState("300");
  const [penalty,setPenalty]=useState(50);
  const [penInput,setPenInput]=useState("50");
  const [rules,setRules]=useState(false);

  const handleLim=e=>{const v=e.target.value.replace(/\D/g,"");setLimInput(v);const n=+v;if(n>=10&&n<=9999)setLimit(n);};
  const handlePen=e=>{const v=e.target.value.replace(/\D/g,"");setPenInput(v);const n=+v;if(n>=1&&n<=9999)setPenalty(n);};

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20,position:"relative",overflow:"hidden"}}>
      <style>{BASE_CSS}</style>
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 1px 1px,rgba(37,99,235,.07) 1px,transparent 0)",backgroundSize:"32px 32px",pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:-120,right:-80,width:320,height:320,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,.12),transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-80,left:-60,width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,.1),transparent 70%)",pointerEvents:"none"}}/>

      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:400}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28,animation:"fadeUp .5s both"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:8}}>
            <span style={{fontSize:36}}>🃏</span>
            <span style={{fontWeight:900,fontSize:40,letterSpacing:-2,color:T.ink}}>5 CARDS</span>
          </div>
          <div style={{fontSize:12,color:T.muted,letterSpacing:3,textTransform:"uppercase"}}>Swap · Claim · Survive</div>
        </div>

        {/* ── Settings ── */}
        <Panel style={{padding:"18px 20px",marginBottom:12,animation:"fadeUp .5s .05s both"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>⚙️ Game Settings</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {/* Elimination score */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>💀 Elim Score</div>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
                <input type="text" inputMode="numeric" value={limInput} onChange={handleLim} style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1.5px solid rgba(0,0,0,.1)",fontSize:18,fontWeight:700,color:T.ink,textAlign:"center",outline:"none",background:"rgba(0,0,0,.03)",fontFamily:T.mono,width:"100%"}}/>
                <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>pts</span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {[100,200,300].map(v=><button key={v} onClick={()=>{setLimit(v);setLimInput(String(v));}} style={{flex:1,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:limit===v?T.accent:"rgba(0,0,0,.06)",color:limit===v?"#fff":T.muted,transition:"all .15s"}}>{v}</button>)}
              </div>
            </div>
            {/* Penalty */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>⚠️ Wrong Show</div>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
                <input type="text" inputMode="numeric" value={penInput} onChange={handlePen} style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1.5px solid rgba(0,0,0,.1)",fontSize:18,fontWeight:700,color:T.ink,textAlign:"center",outline:"none",background:"rgba(0,0,0,.03)",fontFamily:T.mono,width:"100%"}}/>
                <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>pts</span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {[20,50,100].map(v=><button key={v} onClick={()=>{setPenalty(v);setPenInput(String(v));}} style={{flex:1,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:penalty===v?T.red:"rgba(0,0,0,.06)",color:penalty===v?"#fff":T.muted,transition:"all .15s"}}>{v}</button>)}
              </div>
            </div>
          </div>
        </Panel>

        {/* ── VS AI — 2 to 6 players ── */}
        <Panel style={{padding:"18px 20px",marginBottom:12,animation:"fadeUp .5s .1s both"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>🤖 Play vs AI</div>
          <div style={{fontSize:11,color:T.muted,marginBottom:10}}>Total players (you + AI opponents)</div>
          <div style={{display:"flex",gap:6,marginBottom:10,justifyContent:"center"}}>
            {[2,3,4,5,6].map(n=>(
              <button key={n} onClick={()=>setPlayers(n)} style={{width:44,height:44,borderRadius:10,border:"none",cursor:"pointer",fontSize:16,fontWeight:900,background:players===n?T.accent:"rgba(0,0,0,.06)",color:players===n?"#fff":T.ink,transform:players===n?"scale(1.1)":"scale(1)",transition:"all .15s"}}>{n}</button>
            ))}
          </div>
          <div style={{fontSize:11,color:T.muted,textAlign:"center",marginBottom:12}}>
            You + {players-1} AI: <span style={{fontWeight:700,color:T.ink}}>{AI_NAMES.slice(0,players-1).join(", ")}</span>
          </div>
          <Btn onClick={()=>onPlayAI(players,limit,penalty)} style={{width:"100%",justifyContent:"center"}}>▶ Play Online</Btn>
        </Panel>

        {/* ── Friends ── */}
        <Panel style={{padding:"18px 20px",marginBottom:12,animation:"fadeUp .5s .15s both"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>👫 Play with Friends</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:12}}>Real online multiplayer · any device 🌐</div>
          <Btn variant="green" onClick={()=>onPlayFriends(limit,penalty)} style={{width:"100%"}}>🌐 Create / Join Room</Btn>
        </Panel>

        <div style={{textAlign:"center",animation:"fadeUp .5s .2s both"}}>
          <button onClick={()=>setRules(true)} style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:T.font}}>📋 View Rules</button>
        </div>
      </div>
      {rules&&<RulesModal onClose={()=>setRules(false)} limit={limit} penalty={penalty}/>}
    </div>
  );
}

// ── Friends Lobby ─────────────────────────────────────────────────────────────
function FriendsLobby({scoreLimit,penalty,onStart,onBack}){
  const [myName,setMyName]=useState("");
  const [joinCode,setJoinCode]=useState("");
  const [room,setRoom]=useState(null);
  const [myCode,setMyCode]=useState("");
  const [error,setError]=useState("");
  const [maxP,setMaxP]=useState(4);
  const [loading,setLoading]=useState(false);
  const [tab,setTab]=useState("create");
  const unsubRef=useRef(null);
  // Use ref so stale closure in dbListen always reads current name
  const nameRef=useRef("");
  useEffect(()=>{nameRef.current=myName;},[myName]);

  async function createRoom(){
    const nm=nameRef.current.trim();
    if(!nm){setError("Enter your name first!");return;}
    setError("");setLoading(true);
    try{
      const c=genCode();
      await dbSet(`rooms/${c}`,{code:c,host:nm,players:[nm],maxPlayers:maxP,scoreLimit,penalty,started:false,createdAt:Date.now()});
      setMyCode(c);listenToRoom(c);
    }catch(e){setError("Failed: "+(e?.message||"unknown"));}
    setLoading(false);
  }

  async function joinRoom(){
    const nm=nameRef.current.trim();
    if(!nm){setError("Enter your name first!");return;}
    const c=joinCode.trim().toUpperCase();
    if(c.length!==5){setError("Room code must be 5 characters!");return;}
    setError("");setLoading(true);
    try{
      const r=await dbGet(`rooms/${c}`);
      if(!r){setError("Room not found!");setLoading(false);return;}
      if(r.started){setError("Game already started!");setLoading(false);return;}
      if(r.players.length>=r.maxPlayers){setError("Room is full!");setLoading(false);return;}
      if(r.players.includes(nm)){setError("Name already taken!");setLoading(false);return;}
      await dbMerge(`rooms/${c}`,{players:[...r.players,nm]});
      setMyCode(c);listenToRoom(c);
    }catch(e){setError("Failed: "+(e?.message||"unknown"));}
    setLoading(false);
  }

  function listenToRoom(c){
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=dbListen(`rooms/${c}`,data=>{
      if(!data)return;
      setRoom(data);
      if(data.started)onStart(data.players,data.scoreLimit,c,nameRef.current.trim());
    });
  }

  async function startGame(){
    if(!room||room.players.length<2){setError("Need at least 2 players!");return;}
    const ap=room.players;
    const d=shuffle(makeDeck());
    const wc=d[0],dr=d.slice(1);
    const hands={};let cur=0;
    for(const n of ap){hands[n]=dr.slice(cur,cur+5);cur+=5;}
    const gs={stock:dr.slice(cur+1),pile:[dr[cur]],wildCard:wc,hands,
      scores:Object.fromEntries(ap.map(p=>[p,0])),history:[],
      eliminated:[],activePlayers:ap,allPlayers:ap,penalty:room.penalty||50,
      turnIdx:0,round:1,roundResult:null,gameWinner:null,lastAction:Date.now()};
    await dbSet(`rooms/${room.code}/gameState`,gs);
    await dbMerge(`rooms/${room.code}`,{started:true});
  }

  useEffect(()=>()=>{if(unsubRef.current)unsubRef.current();},[]);
  const isHost=room&&room.host===nameRef.current.trim();
  const inp={width:"100%",padding:"13px 14px",borderRadius:10,border:"1.5px solid rgba(0,0,0,.12)",fontSize:15,fontWeight:500,color:T.ink,outline:"none",background:"#fff",fontFamily:T.font,boxSizing:"border-box"};

  if(room)return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20}}>
      <style>{BASE_CSS}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{fontWeight:900,fontSize:24,letterSpacing:-.5,marginBottom:20,textAlign:"center"}}>Room Lobby</div>
        <Panel style={{padding:"20px",textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Room Code</div>
          <div style={{fontSize:48,fontWeight:900,letterSpacing:12,fontFamily:T.mono,color:T.accent,marginBottom:4}}>{myCode}</div>
          <div style={{fontSize:12,color:T.muted}}>Share with friends 📲</div>
        </Panel>
        <Panel style={{padding:"18px 20px",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Players ({room.players.length}/{room.maxPlayers})</div>
          {room.players.map((p,i)=>(
            <div key={p} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:10,marginBottom:6,background:p===nameRef.current.trim()?"rgba(37,99,235,.06)":"rgba(0,0,0,.03)",border:p===nameRef.current.trim()?`1.5px solid ${T.accent}`:"1.5px solid transparent"}}>
              <span style={{fontSize:18}}>{i===0?"👑":"👤"}</span>
              <span style={{fontWeight:600,fontSize:14,flex:1}}>{p}</span>
              {p===nameRef.current.trim()&&<span style={{fontSize:10,color:T.accent,fontWeight:700,background:"rgba(37,99,235,.1)",borderRadius:4,padding:"2px 6px"}}>You</span>}
              {i===0&&p!==nameRef.current.trim()&&<span style={{fontSize:10,color:T.gold,fontWeight:700}}>Host</span>}
            </div>
          ))}
          {Array(room.maxPlayers-room.players.length).fill(0).map((_,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:10,marginBottom:6,border:"1.5px dashed rgba(0,0,0,.08)",background:"rgba(0,0,0,.02)"}}>
              <span style={{fontSize:18,opacity:.3}}>⏳</span>
              <span style={{fontSize:13,color:T.muted}}>Waiting for player...</span>
            </div>
          ))}
        </Panel>
        {isHost
          ?<Btn onClick={startGame} disabled={room.players.length<2} style={{width:"100%",fontSize:15,padding:"15px"}}>{room.players.length>=2?"🚀 Start Game!":"Need at least 2 players..."}</Btn>
          :<Panel style={{padding:"14px 20px",textAlign:"center"}}><div style={{color:T.muted,fontSize:13}}>⏳ Waiting for <strong>{room.host}</strong> to start...</div></Panel>}
        {error&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",color:T.red,fontSize:13,fontWeight:600}}>⚠️ {error}</div>}
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20}}>
      <style>{BASE_CSS}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:T.font,marginBottom:24,padding:0}}>← Back</button>
        <div style={{fontWeight:900,fontSize:26,letterSpacing:-.5,marginBottom:2}}>Play with Friends</div>
        <div style={{color:T.muted,fontSize:13,marginBottom:20}}>Real online · any device 🌐</div>
        <Panel style={{padding:"16px 18px",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Your Name</div>
          <input value={myName} onChange={e=>{setMyName(e.target.value);setError("");}} placeholder="Enter your name..." style={inp} autoFocus/>
        </Panel>
        <div style={{display:"flex",background:"rgba(0,0,0,.06)",borderRadius:12,padding:4,marginBottom:14,gap:4}}>
          {["create","join"].map(t=><button key={t} onClick={()=>{setTab(t);setError("");}} style={{flex:1,padding:"10px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:tab===t?"#fff":"transparent",color:tab===t?T.ink:T.muted,boxShadow:tab===t?T.shadow:"none",transition:"all .2s",fontFamily:T.font}}>{t==="create"?"➕ Create Room":"🔑 Join Room"}</button>)}
        </div>
        {tab==="create"&&(
          <Panel style={{padding:"18px 20px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Max Players</div>
            <div style={{display:"flex",gap:8,marginBottom:18}}>
              {[2,3,4,5,6].map(n=><button key={n} onClick={()=>setMaxP(n)} style={{flex:1,padding:"11px",borderRadius:10,border:"none",cursor:"pointer",fontSize:17,fontWeight:700,background:maxP===n?T.accent:"rgba(0,0,0,.06)",color:maxP===n?"#fff":T.ink,transition:"all .15s"}}>{n}</button>)}
            </div>
            <button onClick={createRoom} disabled={loading} style={{width:"100%",padding:"15px",borderRadius:10,border:"none",cursor:loading?"not-allowed":"pointer",background:T.accent,color:"#fff",fontSize:16,fontWeight:800,fontFamily:T.font,opacity:loading?.6:1,boxShadow:"0 4px 14px rgba(37,99,235,.4)"}}>{loading?"⏳ Creating...":"🚀 Create Room"}</button>
          </Panel>
        )}
        {tab==="join"&&(
          <Panel style={{padding:"18px 20px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Room Code</div>
            <input value={joinCode} onChange={e=>{setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));setError("");}} onKeyDown={e=>e.key==="Enter"&&joinRoom()} maxLength={5} placeholder="A1B2C" style={{...inp,fontSize:28,fontWeight:900,letterSpacing:10,textAlign:"center",fontFamily:T.mono,marginBottom:14}}/>
            <button onClick={joinRoom} disabled={loading} style={{width:"100%",padding:"15px",borderRadius:10,border:"none",cursor:loading?"not-allowed":"pointer",background:T.green,color:"#fff",fontSize:16,fontWeight:800,fontFamily:T.font,opacity:loading?.6:1,boxShadow:"0 4px 14px rgba(16,185,129,.4)"}}>{loading?"⏳ Joining...":"🔑 Join Room"}</button>
          </Panel>
        )}
        {error&&<div style={{marginTop:12,padding:"12px 14px",borderRadius:10,background:"rgba(239,68,68,.08)",border:"1.5px solid rgba(239,68,68,.25)",color:T.red,fontSize:13,fontWeight:600,textAlign:"center"}}>⚠️ {error}</div>}
      </div>
    </div>
  );
}

// ── Online Game Screen ────────────────────────────────────────────────────────
function OnlineGameScreen({roomCode,myName,onQuit}){
  const [gs,setGs]=useState(null);
  const [drawFrom,setDrawFrom]=useState(null);
  const [dropIdxs,setDropIdxs]=useState([]);
  const [msg,setMsg]=useState("Connecting...");
  const [showRules,setShowRules]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const [showGate,setShowGate]=useState(false);
  const [showContinue,setShowContinue]=useState(false);
  const [newlyElim,setNewlyElim]=useState([]);
  const [timeLeft,setTimeLeft]=useState(30);
  const unsubRef=useRef(null);
  const prevTurnRef=useRef(null);
  const timerRef=useRef(null);

  function startTimer(){clearInterval(timerRef.current);setTimeLeft(30);timerRef.current=setInterval(()=>setTimeLeft(p=>{if(p<=1){clearInterval(timerRef.current);return 0;}return p-1;}),1000);}

  useEffect(()=>{
    if(!gs||timeLeft!==0)return;
    const cp=gs.activePlayers[gs.turnIdx];
    if(cp!==myName)return;
    vibrate([300]);
    const next=(gs.turnIdx+1)%gs.activePlayers.length;
    dbMerge(`rooms/${roomCode}/gameState`,{turnIdx:next,lastAction:Date.now()});
  },[timeLeft]);// eslint-disable-line

  useEffect(()=>{
    const unsub=dbListen(`rooms/${roomCode}/gameState`,g=>{
      if(!g)return;
      setGs(g);
      const cp=g.activePlayers[g.turnIdx];
      const tk=`${g.round||1}_${g.turnIdx}`;
      if(cp===myName&&prevTurnRef.current!==tk){
        prevTurnRef.current=tk;
        setDrawFrom(null);setDropIdxs([]);setShowGate(true);
        setMsg("Pick source · select drop · SWAP");
        vibrate([100,50,100]);startTimer();
      }
      if(g.roundResult?.justElim?.length>0&&!g.roundResult.shown)setNewlyElim(g.roundResult.justElim);
    });
    unsubRef.current=unsub;
    return()=>{if(unsubRef.current)unsubRef.current();clearInterval(timerRef.current);};
  },[roomCode,myName]);// eslint-disable-line

  if(!gs)return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
      <style>{BASE_CSS}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12,animation:"pulse 1.5s infinite"}}>🃏</div>
        <div style={{fontWeight:700,color:T.muted}}>Loading game...</div>
      </div>
    </div>
  );

  const {stock,pile,hands,scores,activePlayers,turnIdx,round,roundResult,gameWinner,eliminated,scoreLimit,wildCard,penalty}=gs;
  const currentPlayer=activePlayers[turnIdx];
  const isMyTurn=currentPlayer===myName;
  const myHand=hands?.[myName]||[];
  const pileTop=pile?.[pile.length-1]||null;
  const readySwap=isMyTurn&&drawFrom!==null&&dropIdxs.length>0;
  const allPlayers=[...activePlayers,...(eliminated||[])];
  const sl=scoreLimit||300;

  async function pushGs(u){await dbMerge(`rooms/${roomCode}/gameState`,u);}
  function selStock(){if(!isMyTurn)return;setDrawFrom(p=>p==="stock"?null:"stock");}
  function selPile(){if(!isMyTurn||!pile?.length)return;setDrawFrom(p=>p==="pile"?null:"pile");}
  function toggleDrop(idx){if(!isMyTurn)return;setDropIdxs(p=>{if(p.includes(idx))return p.filter(i=>i!==idx);if(p.length>0&&myHand[p[0]].rank!==myHand[idx].rank){setMsg("Same rank only for multi-drop!");return p;}return[...p,idx];});}

  async function doSwap(){
    if(!drawFrom||!dropIdxs.length)return;
    const dropping=dropIdxs.map(i=>myHand[i]);
    let drew,ns=[...stock],np=[...pile];
    if(drawFrom==="stock"){drew=stock[0];ns=stock.slice(1);}
    else{drew=pile[pile.length-1];np=pile.slice(0,-1);}
    np=[...np,...dropping];
    clearInterval(timerRef.current);setShowContinue(false);
    const next=(turnIdx+1)%activePlayers.length;
    await pushGs({stock:ns,pile:np,hands:{...hands,[myName]:[...myHand.filter((_,i)=>!dropIdxs.includes(i)),drew]},turnIdx:next,lastAction:Date.now()});
    setDrawFrom(null);setDropIdxs([]);
  }

  async function doShow(){
    if(!isMyTurn)return;
    clearInterval(timerRef.current);setShowContinue(false);
    const wc=wildCard||null,pen=penalty||50;
    const results=activePlayers.map(n=>({name:n,hand:hands[n]||[],pts:handTotal(hands[n]||[],wc)}));
    const clPts=handTotal(myHand,wc),lowPts=Math.min(...results.map(r=>r.pts));
    const clWon=clPts===lowPts;
    const ns={...scores};
    if(clWon)results.forEach(r=>{if(r.name!==myName)ns[r.name]=(ns[r.name]||0)+r.pts;});
    else ns[myName]=(ns[myName]||0)+pen;
    const justElim=activePlayers.filter(n=>ns[n]>=sl&&!(eliminated||[]).includes(n));
    const newElim=[...(eliminated||[]),...justElim];
    const newActive=activePlayers.filter(n=>!newElim.includes(n));
    const winner=newActive.length<=1?newActive[0]||activePlayers[0]:null;
    const gained={};activePlayers.forEach(n=>{gained[n]=(ns[n]||0)-(scores[n]||0);});
    const hist=[...(gs.history||[]),{round:round||1,winner:clWon?myName:"❌",gained}];
    await pushGs({scores:ns,eliminated:newElim,activePlayers:newActive,roundResult:{results,claimerName:myName,claimerWon:clWon,claimerPts:clPts,lowestPts:lowPts,justElim,newScores:ns,shown:false},history:hist,gameWinner:winner,lastAction:Date.now()});
  }

  async function nextRound(){
    const ap=gs.activePlayers,nr=(round||1)+1,allP=gs.allPlayers||ap;
    const d=shuffle(makeDeck()),wc=d[0],dr=d.slice(1);
    const h={};let cur=0;for(const n of ap){h[n]=dr.slice(cur,cur+5);cur+=5;}
    await pushGs({stock:dr.slice(cur+1),pile:[dr[cur]],wildCard:wc,hands:h,turnIdx:nr%ap.length,round:nr,roundResult:null,lastAction:Date.now(),allPlayers:allP});
  }

  if(gameWinner)return<GameOverBanner winner={gameWinner} onPlayAgain={onQuit} onQuit={onQuit}/>;
  if(roundResult)return<RoundResult round={round} roundResult={roundResult} allPlayers={allPlayers} scores={scores} scoreLimit={sl} penaltyPoints={penalty||50} onNext={nextRound} canNext={isMyTurn||roundResult.claimerName===myName} history={gs.history||[]}/>;
  if(newlyElim.length>0)return<EliminatedBanner name={newlyElim[0]} onClose={()=>setNewlyElim([])}/>;
  if(showGate&&isMyTurn)return<TurnGate playerName={myName} onReady={()=>{vibrate([100,50,100]);setShowGate(false);startTimer();}}/>;
  const opponents=activePlayers.filter(n=>n!==myName);
  const {w:sw,h:sh}=useWinSize();
  const LW=sh>sw?sh:sw, LH=sh>sw?sw:sh;
  // Scale everything to fit in landscape dimensions (base: 667w x 375h)
  const sc=Math.min(LW/667,LH/375);
  const S=v=>Math.round(v*sc);

  return(
    <LandscapeWrap>
      <div style={{width:'100%',height:'100%',
        background:'#E8B800',
        backgroundImage:'radial-gradient(circle,rgba(0,0,0,.09) 1px,transparent 1px),radial-gradient(circle,rgba(0,0,0,.04) 1px,transparent 1px)',
        backgroundSize:S(28)+'px '+S(28)+'px,'+S(14)+'px '+S(14)+'px',
        backgroundPosition:'0 0,'+S(7)+'px '+S(7)+'px',
        fontFamily:T.font,display:'flex',flexDirection:'row',overflow:'hidden',position:'relative',
      }}>
      <style>{BASE_CSS}</style>
      {/* ── LEFT PANEL: My hand (vertical) + controls ── */}
      <div style={{width:S(155),flexShrink:0,background:'#111',display:'flex',flexDirection:'column',alignItems:'center',padding:S(8)+' '+S(6)+'px',gap:S(4),overflowY:'hidden'}}>
        {/* My avatar + name + pts */}
        <div style={{display:'flex',alignItems:'center',gap:S(5),alignSelf:'stretch',marginBottom:S(2)}}>
          <div style={{width:S(28),height:S(28),borderRadius:'50%',background:avCol(myName),display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(10),fontWeight:900,color:'#fff',flexShrink:0}}>{avIni(myName)}</div>
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:S(10),lineHeight:1}}>You</div>
            <div style={{color:'#86efac',fontFamily:T.mono,fontSize:S(9),fontWeight:700}}>{handTotal(myHand,wildCard)}pt</div>
          </div>
          {isMyTurn&&<div style={{marginLeft:'auto'}}><TimerRing timeLeft={timeLeft}/></div>}
        </div>
        {/* My 5 cards stacked vertically */}
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:S(3),justifyContent:'center',overflowY:'hidden',width:'100%',alignItems:'center'}}>
          {myHand.map((card,idx)=>(
            <div key={card.id} style={{transform:dropIdxs.includes(idx)?'translateX('+S(8)+'px)':'translateX(0)',transition:'transform .15s',flexShrink:0}}>
              <Card card={card} selected={dropIdxs.includes(idx)} onClick={isMyTurn?()=>toggleDrop(idx):undefined} badge={dropIdxs.includes(idx)?'Drop':null} small/>
            </div>
          ))}
        </div>
        {/* Action buttons */}
        <div style={{display:'flex',flexDirection:'column',gap:S(4),width:'100%'}}>
          {isMyTurn&&(
            <>
              <button onClick={doSwap} disabled={!readySwap} style={{width:'100%',padding:S(7)+'px 0',borderRadius:S(18),border:'none',cursor:readySwap?'pointer':'not-allowed',background:readySwap?'#16a34a':'rgba(255,255,255,.1)',color:readySwap?'#fff':'#555',fontSize:S(10),fontWeight:900,fontFamily:T.font,opacity:readySwap?1:.55,boxShadow:readySwap?'0 0 10px rgba(22,163,74,.5)':'none'}}>⇄ SWAP</button>
              <button onClick={doShow} style={{width:'100%',padding:S(7)+'px 0',borderRadius:S(18),border:'none',cursor:'pointer',background:'#dc2626',color:'#fff',fontSize:S(10),fontWeight:900,fontFamily:T.font,boxShadow:'0 0 10px rgba(220,38,38,.4)'}}>📢 SHOW</button>
            </>
          )}
          <div style={{display:'flex',gap:S(4),justifyContent:'center'}}>
            <button onClick={()=>setShowRules(true)} style={{flex:1,padding:S(6)+'px 0',borderRadius:S(10),border:'none',cursor:'pointer',background:'#7c3aed',color:'#fff',fontSize:S(9),fontWeight:900,fontFamily:T.font}}>RULES</button>
            <button onClick={()=>setShowHistory(true)} style={{flex:1,padding:S(6)+'px 0',borderRadius:S(10),border:'none',cursor:'pointer',background:'#0284c7',color:'#fff',fontSize:S(11)}}>📜</button>
            <button onClick={onQuit} style={{flex:1,padding:S(6)+'px 0',borderRadius:S(10),border:'none',cursor:'pointer',background:'rgba(220,38,38,.7)',color:'#fff',fontSize:S(9),fontWeight:900,fontFamily:T.font}}>Exit</button>
          </div>
        </div>
      </div>

      {/* ── CENTER: Table ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:S(8),padding:S(8)+'px',position:'relative'}}>
        {/* Score chips top */}
        <div style={{position:'absolute',top:S(6),left:'50%',transform:'translateX(-50%)',display:'flex',gap:S(5),zIndex:5}}>
          {activePlayers.map(n=>{
            const sc=scores?.[n]||0,pct=Math.min(100,(sc/sl)*100),isCur=currentPlayer===n,isMe=n===myName,isElim=(eliminated||[]).includes(n);
            return(
              <div key={n} style={{background:isCur?'rgba(0,0,0,.85)':'rgba(0,0,0,.6)',borderRadius:S(20),padding:S(3)+'px '+S(9)+'px '+S(3)+'px '+S(5)+'px',display:'flex',alignItems:'center',gap:S(4),border:isCur?S(1.5)+'px solid #facc15':'none',opacity:isElim?.4:1}}>
                <div style={{width:S(16),height:S(16),borderRadius:'50%',background:avCol(n),display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(7),color:'#fff',fontWeight:900}}>{avIni(n)}</div>
                <span style={{fontSize:S(9),color:'#fff',fontWeight:700}}>{isElim?'💀':''}{isMe?'You':n}</span>
                <span style={{fontSize:S(9),color:pct>70?'#f87171':'#86efac',fontFamily:T.mono,fontWeight:700}}>{sc}</span>
              </div>
            );
          })}
        </div>

        {/* Wild label */}
        {wildCard&&(
          <div style={{display:'inline-flex',alignItems:'center',gap:S(5),background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.3)',borderRadius:S(20),padding:S(3)+'px '+S(10)+'px'}}>
            <span style={{fontSize:S(11)}}>🌟</span>
            <span style={{fontSize:S(10),fontWeight:700,color:'#92400e'}}>Wild · {wildCard.rank}s = 0 pts</span>
          </div>
        )}

        {/* Stock + Discard */}
        <div style={{display:'flex',gap:S(20),alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:S(8),fontWeight:600,color:'rgba(0,0,0,.5)',marginBottom:S(4),textTransform:'uppercase',letterSpacing:.5}}>Stock ({stock?.length||0})</div>
            {stock?.length>0?<Card card={stock[0]} faceDown glowGreen={isMyTurn&&drawFrom==='stock'} onClick={isMyTurn?selStock:undefined} badge={drawFrom==='stock'?'✓ Draw':null}/>:<div style={{width:64,height:92,borderRadius:10,border:'2px dashed rgba(0,0,0,.12)'}}/>}
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:S(8),fontWeight:600,color:'rgba(0,0,0,.5)',marginBottom:S(4),textTransform:'uppercase',letterSpacing:.5}}>Discard</div>
            {pileTop?<Card card={pileTop} glowGreen={isMyTurn&&drawFrom==='pile'} onClick={isMyTurn?selPile:undefined} badge={drawFrom==='pile'?'✓ Draw':null}/>:<div style={{width:64,height:92,borderRadius:10,border:'2px dashed rgba(0,0,0,.12)'}}/>}
          </div>
        </div>

        {/* Steps */}
        {isMyTurn&&(
          <div style={{display:'flex',gap:S(5),alignItems:'center',background:'rgba(0,0,0,.1)',borderRadius:S(20),padding:S(4)+'px '+S(12)+'px'}}>
            {[['Pick',drawFrom!=null],['Drop',dropIdxs.length>0],['SWAP',readySwap]].map(([lbl,done],i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:S(3)}}>
                <div style={{width:S(15),height:S(15),borderRadius:'50%',background:done?'#16a34a':'rgba(0,0,0,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(7),color:done?'#fff':'rgba(0,0,0,.4)',fontWeight:700}}>{done?'✓':i+1}</div>
                <span style={{fontSize:S(9),color:done?'#15803d':'rgba(0,0,0,.45)',fontWeight:done?700:500}}>{lbl}</span>
                {i<2&&<span style={{color:'rgba(0,0,0,.2)',fontSize:S(9)}}>›</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{fontSize:S(10),color:isMyTurn?'#92400e':'rgba(0,0,0,.5)',fontWeight:isMyTurn?700:400,textAlign:'center'}}>
          {isMyTurn?msg:('⏳ '+currentPlayer+'\'s turn...')}
        </div>
      </div>

      {/* ── RIGHT: Opponents ── */}
      <div style={{width:S(150),flexShrink:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:S(10),padding:S(8)+'px',overflowY:'hidden'}}>
        {opponents.map(name=>{
          const h=hands?.[name]||[],isCur=currentPlayer===name;
          return(
            <div key={name} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:S(4)}}>
              <FanCards count={Math.max(1,h.length||5)}/>
              <div style={{background:'#111',borderRadius:S(30),padding:S(5)+'px '+S(12)+'px '+S(5)+'px '+S(7)+'px',display:'inline-flex',alignItems:'center',gap:S(6),border:isCur?S(2)+'px solid #facc15':'none',position:'relative'}}>
                <div style={{width:S(26),height:S(26),borderRadius:'50%',background:avCol(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(10),fontWeight:900,color:'#fff'}}>{avIni(name)}</div>
                <span style={{fontWeight:700,fontSize:S(11),color:'#fff'}}>{name}</span>
                {isCur&&<span style={{position:'absolute',top:S(-7),right:S(-4),background:'linear-gradient(135deg,#c026d3,#7c3aed)',color:'#fff',fontSize:S(7),fontWeight:900,borderRadius:S(7),padding:S(2)+'px '+S(5)+'px'}}>PLAY</span>}
              </div>
              <div style={{display:'flex',gap:S(3)}}>{h.map((_,i)=><div key={i} style={{width:S(6),height:S(6),borderRadius:'50%',background:'rgba(0,0,0,.2)'}}/>)}</div>
            </div>
          );
        })}
      </div>

      {showRules&&<RulesModal onClose={()=>setShowRules(false)} limit={sl} penalty={penalty||50}/>}
      {showHistory&&<HistoryModal onClose={()=>setShowHistory(false)} history={gs.history||[]} allPlayers={allPlayers} scores={scores} scoreLimit={sl}/>}
      </div>
    </LandscapeWrap>
  );
}

// ── AI Game Screen ────────────────────────────────────────────────────────────
function AIGameScreen({players,scoreLimit,penaltyPoints,onQuit}){
  const allPlayers=players,YOU=players[0];
  const isAI=useCallback(n=>n!==YOU,[YOU]);

  const [stock,setStock]=useState([]);
  const [pile,setPile]=useState([]);
  const [hands,setHands]=useState({});
  const [scores,setScores]=useState(()=>Object.fromEntries(allPlayers.map(p=>[p,0])));
  const [eliminated,setEliminated]=useState([]);
  const [active,setActive]=useState(allPlayers);
  const [round,setRound]=useState(1);
  const [turnIdx,setTurnIdx]=useState(0);
  const [drawFrom,setDrawFrom]=useState(null);
  const [dropIdxs,setDropIdxs]=useState([]);
  const [msg,setMsg]=useState("");
  const [showRules,setShowRules]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const [roundResult,setRoundResult]=useState(null);
  const [newlyElim,setNewlyElim]=useState([]);
  const [gameWinner,setGameWinner]=useState(null);
  const [wildCard,setWildCard]=useState(null);
  const [history,setHistory]=useState([]);
  const [timeLeft,setTimeLeft]=useState(30);
  const [showContinueAI,setShowContinueAI]=useState(false); // BUG FIX: was missing useState

  const aiTimerRef=useRef(null);
  const turnTimerRef=useRef(null);
  // Refs mirror state to avoid stale closures in setTimeout/AI logic
  const stockRef=useRef([]),pileRef=useRef([]),handsRef=useRef({});
  const wildRef=useRef(null),activeRef=useRef(allPlayers),turnIdxRef=useRef(0);
  const rrRef=useRef(null),gwRef=useRef(null);

  useEffect(()=>{stockRef.current=stock;},[stock]);
  useEffect(()=>{pileRef.current=pile;},[pile]);
  useEffect(()=>{handsRef.current=hands;},[hands]);
  useEffect(()=>{wildRef.current=wildCard;},[wildCard]);
  useEffect(()=>{activeRef.current=active;},[active]);
  useEffect(()=>{turnIdxRef.current=turnIdx;},[turnIdx]);
  useEffect(()=>{rrRef.current=roundResult;},[roundResult]);
  useEffect(()=>{gwRef.current=gameWinner;},[gameWinner]);

  function startTurnTimer(){clearInterval(turnTimerRef.current);setTimeLeft(30);vibrate([100,50,100]);turnTimerRef.current=setInterval(()=>setTimeLeft(p=>{if(p<=1){clearInterval(turnTimerRef.current);return 0;}return p-1;}),1000);}
  useEffect(()=>()=>{clearInterval(turnTimerRef.current);clearTimeout(aiTimerRef.current);},[]);

  function deal(ap,roundNum){
    const a=ap||activeRef.current;
    if(!a||!a.length)return;
    const d=shuffle(makeDeck()),wc=d[0],dr=d.slice(1);
    const h={};let cur=0;for(const n of a){h[n]=dr.slice(cur,cur+5);cur+=5;}
    const si=(roundNum||1)%a.length;
    setWildCard(wc);setStock(dr.slice(cur+1));setPile([dr[cur]]);setHands(h);
    setTurnIdx(si);setDrawFrom(null);setDropIdxs([]);setRoundResult(null);setShowContinueAI(false);
    setMsg(a[si]===YOU?"Pick source · select drop · SWAP":`${a[si]}'s turn...`);
    if(a[si]===YOU)startTurnTimer();
  }
  useEffect(()=>{deal();},[]);// eslint-disable-line

  // BUG FIX: timer expiry now checks refs not stale state
  useEffect(()=>{
    if(timeLeft!==0||rrRef.current||gwRef.current)return;
    const cur=activeRef.current[turnIdxRef.current];
    if(cur!==YOU)return;
    clearInterval(turnTimerRef.current);
    setShowContinueAI(true);
  },[timeLeft]);// eslint-disable-line

  function onContinueAI(){setShowContinueAI(false);setTimeLeft(10);turnTimerRef.current=setInterval(()=>setTimeLeft(p=>{if(p<=1){clearInterval(turnTimerRef.current);return 0;}return p-1;}),1000);}
  function onSkipAI(){
    setShowContinueAI(false);clearInterval(turnTimerRef.current);
    const a=activeRef.current,idx=turnIdxRef.current;
    const next=(idx+1)%a.length;
    setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
    setMsg(a[next]===YOU?"Your turn":`${a[next]}'s turn`);
    if(a[next]===YOU)startTurnTimer();
  }

  const currentPlayer=active[turnIdx];
  const isMyTurn=currentPlayer===YOU;

  // AI turn — reads from refs to avoid stale closures
  useEffect(()=>{
    if(rrRef.current||gwRef.current)return;
    if(!isAI(currentPlayer))return;
    const hand=handsRef.current[currentPlayer];
    if(!hand||!hand.length)return;
    aiTimerRef.current=setTimeout(()=>{
      if(rrRef.current||gwRef.current)return;
      const wc=wildRef.current,p=pileRef.current,s=stockRef.current,a=activeRef.current,tidx=turnIdxRef.current;
      // Decide: SHOW if hand is very low
      if(handTotal(hand,wc)<=10){handleClaim(currentPlayer,hand,wc);return;}
      // Pick draw source
      const topCard=p[p.length-1];
      const useTop=topCard&&cardPts(topCard,wc)<Math.max(...hand.map(c=>cardPts(c,wc)));
      // Find worst group to drop
      const groups={};hand.forEach(c=>{(groups[c.rank]=groups[c.rank]||[]).push(c);});
      let bg=null,bp=-1;
      for(const g of Object.values(groups)){const gp=g.reduce((sum,c)=>sum+cardPts(c,wc),0);if(gp>bp){bp=gp;bg=g;}}
      if(!bg)return;
      let drew,ns=[...s],np=[...p];
      if(useTop&&topCard){drew=topCard;np=p.slice(0,-1);}
      else{
        if(!s.length){
          // Reshuffle discard into stock when empty
          if(p.length>1){const sh=shuffle(p.slice(0,-1));ns=sh.slice(1);np=[p[p.length-1]];drew=sh[0];}
          else return;
        }else{drew=s[0];ns=s.slice(1);}
      }
      const di=new Set(bg.map(c=>c.id));
      const nh=[...hand.filter(c=>!di.has(c.id)),drew];
      np=[...np,...bg];
      setStock(ns);setPile(np);setHands(prev=>({...prev,[currentPlayer]:nh}));
      const next=(tidx+1)%a.length;
      setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
      setMsg(a[next]===YOU?"Pick source · select drop · SWAP":`${a[next]}'s turn...`);
      if(a[next]===YOU)startTurnTimer();
    },1200);
    return()=>clearTimeout(aiTimerRef.current);
  },[turnIdx,roundResult]);// eslint-disable-line

  function handleClaim(claimerName,claimerHand,wc){
    const wcard=wc!==undefined?wc:wildRef.current;
    const a=activeRef.current,h=handsRef.current;
    const results=a.map(n=>({name:n,hand:n===claimerName?claimerHand:(h[n]||[]),pts:n===claimerName?handTotal(claimerHand,wcard):handTotal(h[n]||[],wcard)}));
    const lowPts=Math.min(...results.map(r=>r.pts));
    const clPts=results.find(r=>r.name===claimerName)?.pts??Infinity;
    const clWon=clPts===lowPts;
    // Use functional update to avoid reading stale scores
    setScores(prev=>{
      const ns={...prev};
      if(clWon)results.forEach(r=>{if(r.name!==claimerName)ns[r.name]=(ns[r.name]||0)+r.pts;});
      else ns[claimerName]=(ns[claimerName]||0)+penaltyPoints;
      const gained={};allPlayers.forEach(n=>{gained[n]=(ns[n]||0)-(prev[n]||0);});
      setHistory(hist=>[...hist,{round,winner:clWon?claimerName:"❌",gained}]);
      const justElim=a.filter(n=>ns[n]>=scoreLimit&&!eliminated.includes(n));
      const newElim=[...eliminated,...justElim];
      const newActive=a.filter(n=>!newElim.includes(n));
      if(justElim.length>0){setEliminated(newElim);setActive(newActive);}
      if(newActive.length<=1)setGameWinner(newActive[0]||a[0]);
      setRoundResult({results,claimerName,claimerWon:clWon,claimerPts:clPts,lowestPts:lowPts,newScores:ns,justElim});
      return ns;
    });
    clearInterval(turnTimerRef.current);
  }

  function nextRound(){
    if(roundResult?.justElim?.length>0){setNewlyElim(roundResult.justElim);setRoundResult(null);}
    else{const nr=round+1;setRoundResult(null);setRound(nr);deal(null,nr);}
  }

  const selStock=useCallback(()=>{if(!isMyTurn)return;setDrawFrom(p=>p==="stock"?null:"stock");},[isMyTurn]);
  const selPile=useCallback(()=>{if(!isMyTurn||!pileRef.current.length)return;setDrawFrom(p=>p==="pile"?null:"pile");},[isMyTurn]);

  function toggleDrop(idx){
    if(!isMyTurn)return;
    const hand=handsRef.current[YOU];
    setDropIdxs(p=>{
      if(p.includes(idx))return p.filter(i=>i!==idx);
      if(p.length>0&&hand[p[0]]?.rank!==hand[idx]?.rank){setMsg("Same rank only for multi-drop!");return p;}
      return[...p,idx];
    });
  }

  function doSwap(){
    if(!drawFrom||!dropIdxs.length)return;
    const hand=handsRef.current[YOU];if(!hand)return;
    const s=stockRef.current,p=pileRef.current;
    const dropping=dropIdxs.map(i=>hand[i]);
    let drew,ns=[...s],np=[...p];
    if(drawFrom==="stock"){
      if(!s.length){if(p.length>1){const sh=shuffle(p.slice(0,-1));ns=sh.slice(1);np=[p[p.length-1]];drew=sh[0];}else return;}
      else{drew=s[0];ns=s.slice(1);}
    }else{
      if(!p.length)return;drew=p[p.length-1];np=p.slice(0,-1);
    }
    np=[...np,...dropping];
    const kept=hand.filter((_,i)=>!dropIdxs.includes(i));
    setStock(ns);setPile(np);setHands(prev=>({...prev,[YOU]:[...kept,drew]}));
    clearInterval(turnTimerRef.current);setShowContinueAI(false);
    const a=activeRef.current,tidx=turnIdxRef.current;
    const next=(tidx+1)%a.length;
    setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
    setMsg(a[next]===YOU?"Pick source · select drop · SWAP":`${a[next]}'s turn...`);
    if(a[next]===YOU)startTurnTimer();
  }

  function doShow(){if(!isMyTurn)return;clearInterval(turnTimerRef.current);setShowContinueAI(false);handleClaim(YOU,handsRef.current[YOU],wildRef.current);}

  const myHand=hands[YOU]||[];
  const pileTop=pile[pile.length-1]||null;
  const readySwap=isMyTurn&&drawFrom!==null&&dropIdxs.length>0;

  if(gameWinner)return<GameOverBanner winner={gameWinner} onPlayAgain={()=>{setGameWinner(null);onQuit();}} onQuit={onQuit}/>;
  if(roundResult)return<RoundResult round={round} roundResult={roundResult} allPlayers={allPlayers} scores={scores} scoreLimit={scoreLimit} penaltyPoints={penaltyPoints} onNext={nextRound} canNext={true} history={history}/>;
  if(newlyElim.length>0)return<EliminatedBanner name={newlyElim[0]} onClose={()=>{const nr=round+1;setNewlyElim([]);setRound(nr);deal(active.filter(n=>!eliminated.includes(n)),nr);}}/>;

  const {w:sw,h:sh}=useWinSize();
  const LW=sh>sw?sh:sw, LH=sh>sw?sw:sh;
  const sc=Math.min(LW/667,LH/375);
  const S=v=>Math.round(v*sc);
  const opponents=active.filter(n=>n!==YOU);

  return(
    <LandscapeWrap>
      <div style={{width:'100%',height:'100%',
        background:'#E8B800',
        backgroundImage:'radial-gradient(circle,rgba(0,0,0,.09) 1px,transparent 1px),radial-gradient(circle,rgba(0,0,0,.04) 1px,transparent 1px)',
        backgroundSize:S(28)+'px '+S(28)+'px,'+S(14)+'px '+S(14)+'px',
        backgroundPosition:'0 0,'+S(7)+'px '+S(7)+'px',
        fontFamily:T.font,display:'flex',flexDirection:'row',overflow:'hidden',position:'relative',
      }}>
      <style>{BASE_CSS}</style>

      {/* ── LEFT: My hand + controls ── */}
      <div style={{width:S(155),flexShrink:0,background:'#111',display:'flex',flexDirection:'column',alignItems:'center',padding:S(8)+'px '+S(6)+'px',gap:S(4)}}>
        <div style={{display:'flex',alignItems:'center',gap:S(5),alignSelf:'stretch',marginBottom:S(2)}}>
          <div style={{width:S(28),height:S(28),borderRadius:'50%',background:avCol(YOU),display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(10),fontWeight:900,color:'#fff',flexShrink:0}}>{avIni(YOU)}</div>
          <div>
            <div style={{color:'#fff',fontWeight:700,fontSize:S(10),lineHeight:1}}>You</div>
            <div style={{color:'#86efac',fontFamily:T.mono,fontSize:S(9),fontWeight:700}}>{handTotal(myHand,wildCard)}pt</div>
          </div>
          {isMyTurn&&<div style={{marginLeft:'auto'}}><TimerRing timeLeft={timeLeft}/></div>}
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:S(3),justifyContent:'center',overflowY:'hidden',width:'100%',alignItems:'center'}}>
          {myHand.map((card,idx)=>(
            <div key={card.id} style={{transform:dropIdxs.includes(idx)?'translateX('+S(8)+'px)':'translateX(0)',transition:'transform .15s',flexShrink:0}}>
              <Card card={card} selected={dropIdxs.includes(idx)} onClick={isMyTurn?()=>toggleDrop(idx):undefined} badge={dropIdxs.includes(idx)?'Drop':null} small/>
            </div>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:S(4),width:'100%'}}>
          {isMyTurn&&(
            <>
              <button onClick={doSwap} disabled={!readySwap} style={{width:'100%',padding:S(7)+'px 0',borderRadius:S(18),border:'none',cursor:readySwap?'pointer':'not-allowed',background:readySwap?'#16a34a':'rgba(255,255,255,.1)',color:readySwap?'#fff':'#555',fontSize:S(10),fontWeight:900,fontFamily:T.font,opacity:readySwap?1:.55,boxShadow:readySwap?'0 0 10px rgba(22,163,74,.5)':'none'}}>⇄ SWAP</button>
              <button onClick={doShow} style={{width:'100%',padding:S(7)+'px 0',borderRadius:S(18),border:'none',cursor:'pointer',background:'#dc2626',color:'#fff',fontSize:S(10),fontWeight:900,fontFamily:T.font,boxShadow:'0 0 10px rgba(220,38,38,.4)'}}>📢 SHOW</button>
            </>
          )}
          <div style={{display:'flex',gap:S(4),justifyContent:'center'}}>
            <button onClick={()=>setShowRules(true)} style={{flex:1,padding:S(6)+'px 0',borderRadius:S(10),border:'none',cursor:'pointer',background:'#7c3aed',color:'#fff',fontSize:S(9),fontWeight:900,fontFamily:T.font}}>RULES</button>
            <button onClick={()=>setShowHistory(true)} style={{flex:1,padding:S(6)+'px 0',borderRadius:S(10),border:'none',cursor:'pointer',background:'#0284c7',color:'#fff',fontSize:S(11)}}>📜</button>
            <button onClick={onQuit} style={{flex:1,padding:S(6)+'px 0',borderRadius:S(10),border:'none',cursor:'pointer',background:'rgba(220,38,38,.7)',color:'#fff',fontSize:S(9),fontWeight:900,fontFamily:T.font}}>Exit</button>
          </div>
        </div>
      </div>

      {/* ── CENTER ── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:S(8),padding:S(8)+'px',position:'relative'}}>
        <div style={{position:'absolute',top:S(6),left:'50%',transform:'translateX(-50%)',display:'flex',gap:S(5),zIndex:5}}>
          {allPlayers.map(n=>{
            const sc2=scores[n]||0,pct=Math.min(100,(sc2/scoreLimit)*100),isCur=active[turnIdx]===n,isElim=eliminated.includes(n);
            return(
              <div key={n} style={{background:isCur?'rgba(0,0,0,.85)':'rgba(0,0,0,.6)',borderRadius:S(20),padding:S(3)+'px '+S(9)+'px '+S(3)+'px '+S(5)+'px',display:'flex',alignItems:'center',gap:S(4),border:isCur?S(1.5)+'px solid #facc15':'none',opacity:isElim?.4:1}}>
                <div style={{width:S(16),height:S(16),borderRadius:'50%',background:avCol(n),display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(7),color:'#fff',fontWeight:900}}>{avIni(n)}</div>
                <span style={{fontSize:S(9),color:'#fff',fontWeight:700}}>{isElim?'💀':''}{n===YOU?'You':n}</span>
                <span style={{fontSize:S(9),color:pct>70?'#f87171':'#86efac',fontFamily:T.mono,fontWeight:700}}>{sc2}</span>
              </div>
            );
          })}
        </div>
        {wildCard&&(
          <div style={{display:'inline-flex',alignItems:'center',gap:S(5),background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.3)',borderRadius:S(20),padding:S(3)+'px '+S(10)+'px'}}>
            <span style={{fontSize:S(11)}}>🌟</span>
            <span style={{fontSize:S(10),fontWeight:700,color:'#92400e'}}>Wild · {wildCard.rank}s = 0 pts</span>
          </div>
        )}
        <div style={{display:'flex',gap:S(20),alignItems:'flex-end',justifyContent:'center'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:S(8),fontWeight:600,color:'rgba(0,0,0,.5)',marginBottom:S(4),textTransform:'uppercase',letterSpacing:.5}}>Stock ({stock.length})</div>
            {stock.length>0?<Card card={stock[0]} faceDown glowGreen={isMyTurn&&drawFrom==='stock'} onClick={isMyTurn?selStock:undefined} badge={drawFrom==='stock'?'✓':null}/>:<div style={{width:64,height:92,borderRadius:10,border:'2px dashed rgba(0,0,0,.12)'}}/>}
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:S(8),fontWeight:600,color:'rgba(0,0,0,.5)',marginBottom:S(4),textTransform:'uppercase',letterSpacing:.5}}>Discard</div>
            {pileTop?<Card card={pileTop} glowGreen={isMyTurn&&drawFrom==='pile'} onClick={isMyTurn?selPile:undefined} badge={drawFrom==='pile'?'✓':null}/>:<div style={{width:64,height:92,borderRadius:10,border:'2px dashed rgba(0,0,0,.12)'}}/>}
          </div>
        </div>
        {isMyTurn&&(
          <div style={{display:'flex',gap:S(5),alignItems:'center',background:'rgba(0,0,0,.1)',borderRadius:S(20),padding:S(4)+'px '+S(12)+'px'}}>
            {[['Pick',drawFrom!=null],['Drop',dropIdxs.length>0],['SWAP',readySwap]].map(([lbl,done],i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:S(3)}}>
                <div style={{width:S(15),height:S(15),borderRadius:'50%',background:done?'#16a34a':'rgba(0,0,0,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(7),color:done?'#fff':'rgba(0,0,0,.4)',fontWeight:700}}>{done?'✓':i+1}</div>
                <span style={{fontSize:S(9),color:done?'#15803d':'rgba(0,0,0,.45)',fontWeight:done?700:500}}>{lbl}</span>
                {i<2&&<span style={{color:'rgba(0,0,0,.2)',fontSize:S(9)}}>›</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{fontSize:S(10),color:isMyTurn?'#92400e':'rgba(0,0,0,.5)',fontWeight:isMyTurn?700:400,textAlign:'center'}}>{msg}</div>
      </div>

      {/* ── RIGHT: Opponents ── */}
      <div style={{width:S(150),flexShrink:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',gap:S(10),padding:S(8)+'px',overflowY:'hidden'}}>
        {opponents.map(name=>{
          const h=hands[name]||[],isCur=currentPlayer===name;
          return(
            <div key={name} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:S(4)}}>
              <FanCards count={Math.max(1,h.length||5)}/>
              <div style={{background:'#111',borderRadius:S(30),padding:S(5)+'px '+S(12)+'px '+S(5)+'px '+S(7)+'px',display:'inline-flex',alignItems:'center',gap:S(6),border:isCur?S(2)+'px solid #facc15':'none',position:'relative'}}>
                <div style={{width:S(26),height:S(26),borderRadius:'50%',background:avCol(name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:S(10),fontWeight:900,color:'#fff'}}>{avIni(name)}</div>
                <span style={{fontWeight:700,fontSize:S(11),color:'#fff'}}>{name}</span>
                {isCur&&<span style={{position:'absolute',top:S(-7),right:S(-4),background:'linear-gradient(135deg,#c026d3,#7c3aed)',color:'#fff',fontSize:S(7),fontWeight:900,borderRadius:S(7),padding:S(2)+'px '+S(5)+'px'}}>PLAY</span>}
              </div>
              <div style={{display:'flex',gap:S(3)}}>{h.map((_,i)=><div key={i} style={{width:S(6),height:S(6),borderRadius:'50%',background:'rgba(0,0,0,.2)'}}/>)}</div>
            </div>
          );
        })}
      </div>

      {showContinueAI&&(
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(6px)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Panel style={{padding:'28px 24px',textAlign:'center',maxWidth:260,width:'90%'}}>
            <div style={{fontSize:36,marginBottom:10}}>⏱</div>
            <div style={{fontWeight:900,fontSize:17,marginBottom:6}}>Time's Up!</div>
            <div style={{color:T.muted,fontSize:12,marginBottom:16}}>Your 30s are over.</div>
            <div style={{display:'flex',gap:8,justifyContent:'center'}}>
              <Btn variant="ghost" onClick={onSkipAI}>Skip</Btn>
              <Btn variant="gold" onClick={onContinueAI}>+10s</Btn>
            </div>
          </Panel>
        </div>
      )}
      {showRules&&<RulesModal onClose={()=>setShowRules(false)} limit={scoreLimit} penalty={penaltyPoints}/>}
      {showHistory&&<HistoryModal onClose={()=>setShowHistory(false)} history={history} allPlayers={allPlayers} scores={scores} scoreLimit={scoreLimit}/>}
      </div>
    </LandscapeWrap>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("home");
  const [config,setConfig]=useState({players:["You","Muthu"],limit:300,penalty:50,roomCode:null,myName:null});
  return(
    <>
      <Styles/>
      {screen==="home"&&(
        <HomeScreen
          onPlayAI={(n,l,p)=>{
            setConfig({players:["You",...AI_NAMES.slice(0,n-1)],limit:l,penalty:p||50,roomCode:null,myName:null});
            setScreen("ai");
          }}
          onPlayFriends={(l,p)=>{setConfig(prev=>({...prev,limit:l,penalty:p||50}));setScreen("lobby");}}
        />
      )}
      {screen==="lobby"&&(
        <FriendsLobby scoreLimit={config.limit} penalty={config.penalty||50}
          onStart={(players,limit,roomCode,myName)=>{setConfig(p=>({...p,players,limit,roomCode,myName}));setScreen("online");}}
          onBack={()=>setScreen("home")}/>
      )}
      {screen==="online"&&<OnlineGameScreen roomCode={config.roomCode} myName={config.myName} onQuit={()=>setScreen("home")}/>}
      {screen==="ai"&&<AIGameScreen players={config.players} scoreLimit={config.limit} penaltyPoints={config.penalty||50} onQuit={()=>setScreen("home")}/>}
    </>
  );
}