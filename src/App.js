/* eslint-disable */
import { useState, useEffect, useRef } from "react";

// ── Firebase REST API (rules now set to public) ────────────────────────────────
const FB = "https://five-cards-f8dcc-default-rtdb.firebaseio.com";

async function dbSet(key, data){
  const res = await fetch(`${FB}/${key}.json`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
  if(!res.ok) throw new Error(`Write failed: ${res.status}`);
  return res.json();
}
async function dbGet(key){
  const res = await fetch(`${FB}/${key}.json`);
  if(!res.ok) throw new Error(`Read failed: ${res.status}`);
  const d = await res.json();
  return d;
}
async function dbMerge(key, updates){
  const res = await fetch(`${FB}/${key}.json`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(updates)});
  if(!res.ok) throw new Error(`Merge failed: ${res.status}`);
  return res.json();
}
function dbListen(key, callback){
  let stopped=false, lastJson=null;
  async function poll(){
    if(stopped)return;
    try{
      const res=await fetch(`${FB}/${key}.json`);
      if(res.ok){const t=await res.text();if(t!==lastJson){lastJson=t;try{callback(JSON.parse(t));}catch(_){}}}
    }catch(_){}
    if(!stopped)setTimeout(poll,1500);
  }
  poll();
  return ()=>{stopped=true;};
}


// ── Vibration helper ──────────────────────────────────────────────────────────
function vibrate(pattern){
  if(navigator?.vibrate) navigator.vibrate(pattern);
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:      "#F4F5F7",
  surface: "rgba(255,255,255,0.72)",
  border:  "rgba(255,255,255,0.9)",
  ink:     "#111218",
  muted:   "#6B7280",
  accent:  "#2563EB",
  red:     "#EF4444",
  green:   "#10B981",
  gold:    "#F59E0B",
  suit_r:  "#E11D48",
  suit_b:  "#1E3A8A",
  shadow:  "0 8px 32px rgba(0,0,0,0.10), 0 1.5px 4px rgba(0,0,0,0.06)",
  glow_g:  "0 0 0 2.5px #10B981, 0 8px 24px rgba(16,185,129,0.25)",
  glow_y:  "0 0 0 2.5px #F59E0B, 0 8px 24px rgba(245,158,11,0.25)",
  font:    "'DM Sans', system-ui, sans-serif",
  mono:    "'DM Mono', monospace",
};

const GS = {
  base: `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,900;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:${T.bg};font-family:${T.font};color:${T.ink};overscroll-behavior:none;}
    ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#ddd;border-radius:2px;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
    @keyframes pop{0%{transform:scale(0.85);}60%{transform:scale(1.06);}100%{transform:scale(1);}}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}
    @keyframes timerShrink{from{width:100%;}to{width:0%;}}
    .fade-up{animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both;}
    .pop{animation:pop .3s cubic-bezier(.22,1,.36,1) both;}
  `
};

// ── Game logic ─────────────────────────────────────────────────────────────────
const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RANK_PTS = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:10,Q:10,K:10};
const AI_NAMES = ["Muthu","Priya","Rajan"];
function genCode(){ return Math.random().toString(36).substring(2,7).toUpperCase(); }
function makeDeck(){
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r,pts:RANK_PTS[r],id:`${r}-${s}`});
  return d;
}
function shuffleDeck(d){const a=[...d];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cardPts(card,wc){if(wc&&card.rank===wc.rank)return 0;return card.pts;}
function handTotal(cards,wc){return cards.reduce((s,c)=>s+cardPts(c,wc),0);}

// ── Global styles injector ─────────────────────────────────────────────────────
function Styles(){
  useEffect(()=>{
    const s=document.createElement("style");
    s.textContent=GS.base;
    document.head.appendChild(s);
    return()=>document.head.removeChild(s);
  },[]);
  return null;
}

// ── Glass card ─────────────────────────────────────────────────────────────────
function Card({card,faceDown,selected,glowGreen,small,onClick,badge}){
  if(!card)return null;
  const W=small?44:64, H=small?62:92;
  const isRed=card.suit==="♥"||card.suit==="♦";
  const suitColor=isRed?T.suit_r:T.suit_b;
  const boxShadow=selected?T.glow_y:glowGreen?T.glow_g:T.shadow;
  const translateY=selected?-14:glowGreen?-6:0;
  const bg=faceDown
    ?"linear-gradient(145deg,#1E3A8A 0%,#111827 100%)"
    :"rgba(255,255,255,0.82)";
  const backdropFilter=faceDown?"none":"blur(12px)";
  const border=faceDown?"1.5px solid rgba(255,255,255,0.12)":"1.5px solid rgba(255,255,255,0.95)";
  return(
    <div style={{position:"relative",display:"inline-block",flexShrink:0}}>
      {badge&&(
        <div style={{position:"absolute",top:-18,left:"50%",transform:"translateX(-50%)",
          background:selected?T.gold:T.green,color:"#fff",fontSize:8,fontWeight:700,
          borderRadius:4,padding:"2px 7px",whiteSpace:"nowrap",zIndex:5,letterSpacing:.5}}>
          {badge}
        </div>
      )}
      <div onClick={onClick} style={{
        width:W,height:H,borderRadius:10,
        background:bg,backdropFilter,WebkitBackdropFilter:backdropFilter,
        border,boxShadow,
        transform:`translateY(${translateY}px)`,
        transition:"transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s",
        cursor:onClick?"pointer":"default",userSelect:"none",
        display:"flex",flexDirection:"column",justifyContent:"space-between",
        padding:small?"3px 4px":"5px 6px",overflow:"hidden",position:"relative",
      }}>
        {faceDown?(
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{opacity:.25,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:2}}>
              {["♠","♥","♦","♣","♣","♦","♥","♠"].map((s,i)=>(
                <div key={i} style={{fontSize:8,color:i%2?"#fff":"rgba(255,255,255,.5)",textAlign:"center"}}>{s}</div>
              ))}
            </div>
          </div>
        ):(
          <>
            <div style={{fontSize:small?10:13,fontWeight:700,color:suitColor,lineHeight:1.1,fontFamily:T.mono}}>
              {card.rank}<br/><span style={{fontSize:small?9:10}}>{card.suit}</span>
            </div>
            <div style={{fontSize:small?18:28,textAlign:"center",color:suitColor,lineHeight:1,opacity:.9}}>{card.suit}</div>
            <div style={{fontSize:small?10:13,fontWeight:700,color:suitColor,lineHeight:1.1,textAlign:"right",transform:"rotate(180deg)",fontFamily:T.mono}}>
              {card.rank}<br/><span style={{fontSize:small?9:10}}>{card.suit}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Fanned face-down cards (opponent view) ────────────────────────────────────
function FanCards({count=5}){
  const W=42, H=60;
  const totalWidth = W + (count-1)*18 + 20;
  // angles spread from -20 to +20 degrees
  const angles = Array.from({length:count},(_,i)=> count===1 ? 0 : -20 + (40/(count-1))*i);
  return(
    <div style={{position:"relative",height:H+28,width:totalWidth,margin:"0 auto"}}>
      {angles.map((angle,i)=>(
        <div key={i} style={{
          position:"absolute",
          left: i*18,
          bottom:0,
          width:W, height:H,
          borderRadius:7,
          background:"#fff",
          border:"1.5px solid rgba(255,255,255,0.15)",
          boxShadow:"0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)",
          transform:`rotate(${angle}deg)`,
          transformOrigin:"50% 100%",
          overflow:"hidden",
          zIndex:i,
        }}>
          {/* White background */}
          <div style={{position:"absolute",inset:0,background:"#fff"}}/>
          {/* Red/black suit pattern grid */}
          <div style={{
            position:"absolute",inset:2,
            display:"grid",
            gridTemplateColumns:"repeat(4,1fr)",
            gridTemplateRows:"repeat(5,1fr)",
            gap:1,overflow:"hidden",borderRadius:5,
          }}>
            {["♠","♥","♦","♣","♣","♦","♥","♠","♠","♥","♦","♣","♣","♦","♥","♠","♠","♥","♦","♣"].map((s,idx)=>(
              <div key={idx} style={{
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,
                color:s==="♥"||s==="♦"?"#E11D48":"#111827",
                opacity:0.85,
              }}>{s}</div>
            ))}
          </div>
          {/* Subtle shine overlay */}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 60%)",borderRadius:7,pointerEvents:"none"}}/>
        </div>
      ))}
    </div>
  );
}

// ── Continue Popup (shown when timer hits 0) ──────────────────────────────────
function ContinuePopup({onContinue, onSkip}){
  const [sec,setSec]=useState(8);
  useEffect(()=>{
    const t=setInterval(()=>{
      setSec(p=>{
        if(p<=1){clearInterval(t);onSkip();return 0;}
        return p-1;
      });
    },1000);
    return()=>clearInterval(t);
  },[]);// eslint-disable-line
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",backdropFilter:"blur(6px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,padding:"32px 28px",textAlign:"center",maxWidth:300,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:44,marginBottom:10}}>⏱</div>
        <div style={{fontWeight:900,fontSize:20,marginBottom:6,color:T.red}}>Time's Up!</div>
        <div style={{fontSize:13,color:T.muted,marginBottom:24}}>Need more time? Auto-skip in <strong style={{color:T.ink}}>{sec}s</strong></div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onSkip} style={{flex:1,padding:"12px",borderRadius:10,border:"none",cursor:"pointer",background:"rgba(0,0,0,.07)",color:T.ink,fontSize:14,fontWeight:700,fontFamily:T.font}}>
            Skip Turn
          </button>
          <button onClick={onContinue} style={{flex:1,padding:"12px",borderRadius:10,border:"none",cursor:"pointer",background:T.green,color:"#fff",fontSize:14,fontWeight:700,fontFamily:T.font,boxShadow:"0 4px 12px rgba(16,185,129,.4)"}}>
            +10s ▶
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Timer ring ─────────────────────────────────────────────────────────────────
function TimerRing({timeLeft,total=30}){
  const r=20, circ=2*Math.PI*r;
  const pct=timeLeft/total;
  const color=timeLeft>15?T.green:timeLeft>7?T.gold:T.red;
  return(
    <svg width={52} height={52} style={{transform:"rotate(-90deg)"}}>
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={4}/>
      <circle cx={26} cy={26} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
        style={{transition:"stroke-dashoffset 1s linear, stroke .5s"}}/>
      <text x={26} y={26} textAnchor="middle" dominantBaseline="central"
        style={{fill:color,fontSize:11,fontWeight:700,fontFamily:T.mono,transform:"rotate(90deg)",transformOrigin:"26px 26px"}}>
        {timeLeft}
      </text>
    </svg>
  );
}

// ── Pill button ────────────────────────────────────────────────────────────────
function Btn({children,onClick,variant="primary",disabled,small,style={}}){
  const base={border:"none",borderRadius:9,cursor:disabled?"not-allowed":"pointer",
    fontFamily:T.font,fontWeight:700,transition:"all .15s",userSelect:"none",
    opacity:disabled?.45:1,...style};
  const sz=small?{fontSize:12,padding:"7px 14px"}:{fontSize:14,padding:"11px 22px"};
  const vars={
    primary:{background:T.accent,color:"#fff",boxShadow:"0 2px 8px rgba(37,99,235,.3)"},
    danger: {background:T.red,  color:"#fff",boxShadow:"0 2px 8px rgba(239,68,68,.3)"},
    ghost:  {background:"rgba(0,0,0,.06)",color:T.ink,boxShadow:"none"},
    outline:{background:"transparent",color:T.ink,border:`1.5px solid rgba(0,0,0,.12)`,boxShadow:"none"},
    green:  {background:T.green,color:"#fff",boxShadow:"0 2px 8px rgba(16,185,129,.3)"},
    gold:   {background:T.gold, color:"#fff",boxShadow:"0 2px 8px rgba(245,158,11,.3)"},
  };
  return(
    <button onClick={disabled?undefined:onClick} style={{...base,...sz,...vars[variant]}}>{children}</button>
  );
}

// ── Glass panel ────────────────────────────────────────────────────────────────
function Panel({children,style={}}){
  return(
    <div style={{background:T.surface,backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",
      border:`1.5px solid ${T.border}`,borderRadius:16,boxShadow:T.shadow,...style}}>
      {children}
    </div>
  );
}

// ── Score chip ─────────────────────────────────────────────────────────────────
function ScoreChip({name,score,limit,isActive,isElim,isYou}){
  const pct=Math.min(100,(score/limit)*100);
  const barColor=pct>80?T.red:pct>55?T.gold:T.green;
  return(
    <div style={{
      background:isActive?"rgba(37,99,235,0.08)":isElim?"rgba(0,0,0,.03)":"rgba(255,255,255,.6)",
      border:isActive?`1.5px solid ${T.accent}`:`1.5px solid rgba(0,0,0,.06)`,
      borderRadius:10,padding:"8px 12px",minWidth:80,opacity:isElim?.45:1,
      transition:"all .3s",
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <span style={{fontSize:11,fontWeight:700,color:isActive?T.accent:T.ink,maxWidth:64,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {isElim?"💀 ":isActive?"▶ ":""}{isYou?"You":name}
        </span>
        <span style={{fontSize:11,fontFamily:T.mono,fontWeight:500,color:pct>80?T.red:T.muted}}>{score}</span>
      </div>
      <div style={{height:3,background:"rgba(0,0,0,.06)",borderRadius:2,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:2,transition:"width .5s"}}/>
      </div>
      <div style={{fontSize:9,color:T.muted,marginTop:2,textAlign:"right"}}>/{limit}</div>
    </div>
  );
}

// ── Rules modal ────────────────────────────────────────────────────────────────
function RulesModal({onClose,limit,penalty}){
  const rules=[
    ["🎯 Goal",`Lowest total when SHOW is called. Reach ${limit} pts = eliminated. Last player wins.`],
    ["🃏 Card Points","A=1 · 2–9=face value · 10/J/Q/K=10"],
    ["🌟 Wild Card","One card revealed at round start. ALL cards of that rank = 0 pts this round."],
    ["↕ Your Turn","Tap Stock or top Discard (glows green = draw source). Tap hand card (glows yellow = drop). Tap SWAP."],
    ["♊ Multi-Drop","Drop multiple cards of the same rank together."],
    ["📢 SHOW",`Correct SHOW → 0 pts for you, others add their hand total. Wrong SHOW → +${penalty||50} pts penalty only for you.`],
    ["⏱ Timer","30 seconds per turn. Auto-skip if time runs out."],
  ];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <Panel style={{maxWidth:440,width:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 20px 12px",borderBottom:"1px solid rgba(0,0,0,.06)"}}>
          <span style={{fontWeight:900,fontSize:17,letterSpacing:-.3}}>Rules</span>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <div style={{overflowY:"auto",padding:"14px 20px 20px"}}>
          {rules.map(([t,b])=>(
            <div key={t} style={{marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:3,color:T.accent}}>{t}</div>
              <div style={{fontSize:13,color:T.muted,lineHeight:1.6}}>{b}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── Eliminated banner ──────────────────────────────────────────────────────────
function EliminatedBanner({name,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Panel style={{padding:"40px 36px",textAlign:"center",maxWidth:320,width:"92%"}} className="pop">
        <div style={{fontSize:56,marginBottom:12}}>💀</div>
        <div style={{fontWeight:900,fontSize:24,marginBottom:6,color:T.red}}>Eliminated</div>
        <div style={{color:T.muted,fontSize:14,marginBottom:24}}><strong style={{color:T.ink}}>{name}</strong> reached the score limit</div>
        <Btn onClick={onClose}>Continue →</Btn>
      </Panel>
    </div>
  );
}

// ── Game Over banner ───────────────────────────────────────────────────────────
function GameOverBanner({winner,onPlayAgain,onQuit}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",backdropFilter:"blur(8px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <Panel style={{padding:"44px 40px",textAlign:"center",maxWidth:340,width:"92%"}}>
        <div style={{fontSize:64,marginBottom:12}}>🏆</div>
        <div style={{fontWeight:900,fontSize:28,marginBottom:4,letterSpacing:-.5}}>Winner</div>
        <div style={{fontWeight:700,fontSize:20,color:T.accent,marginBottom:28}}>{winner}</div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <Btn variant="ghost" onClick={onQuit}>Quit</Btn>
          <Btn onClick={onPlayAgain}>Play Again</Btn>
        </div>
      </Panel>
    </div>
  );
}

// ── Pass-and-play gate ─────────────────────────────────────────────────────────
function TurnGate({playerName,onReady}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(17,18,24,0.96)",backdropFilter:"blur(12px)",zIndex:250,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
      <div style={{textAlign:"center",padding:"0 32px",animation:"fadeUp .4s both"}}>
        <div style={{fontSize:56,marginBottom:16}}>🃏</div>
        <div style={{fontWeight:900,fontSize:28,color:"#fff",marginBottom:6,letterSpacing:-.5}}>{playerName}'s Turn</div>
        <div style={{color:"rgba(255,255,255,.5)",fontSize:14,marginBottom:32}}>Hand the device to <strong style={{color:"rgba(255,255,255,.8)"}}>{playerName}</strong></div>
        <Btn onClick={onReady} style={{fontSize:15,padding:"13px 36px"}}>I'm Ready →</Btn>
      </div>
    </div>
  );
}

// ── Home Screen ────────────────────────────────────────────────────────────────
function HomeScreen({onPlayAI,onPlayFriends}){
  const [players,setPlayers]=useState(2);
  const [limit,setLimit]=useState(300);
  const [customInput,setCustomInput]=useState("300");
  const [penalty,setPenalty]=useState(50);
  const [penaltyInput,setPenaltyInput]=useState("50");
  const [rules,setRules]=useState(false);

  function handleLimitChange(e){const v=e.target.value.replace(/[^0-9]/g,"");setCustomInput(v);const n=parseInt(v,10);if(n>=10&&n<=9999)setLimit(n);}
  function handlePenaltyChange(e){const v=e.target.value.replace(/[^0-9]/g,"");setPenaltyInput(v);const n=parseInt(v,10);if(n>=1&&n<=9999)setPenalty(n);}

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20,position:"relative",overflow:"hidden"}}>
      <style>{GS.base}</style>
      {/* Background grid decoration */}
      <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 1px 1px, rgba(37,99,235,.07) 1px, transparent 0)",backgroundSize:"32px 32px",pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:-120,right:-80,width:320,height:320,borderRadius:"50%",background:"radial-gradient(circle,rgba(37,99,235,.12),transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:-80,left:-60,width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,.1),transparent 70%)",pointerEvents:"none"}}/>

      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:400}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32,animation:"fadeUp .5s both"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:8}}>
            <span style={{fontSize:36}}>🃏</span>
            <span style={{fontWeight:900,fontSize:40,letterSpacing:-2,color:T.ink}}>5 CARDS</span>
          </div>
          <div style={{fontSize:12,color:T.muted,letterSpacing:3,textTransform:"uppercase"}}>Swap · Claim · Survive</div>
        </div>

        {/* Settings */}
        <Panel style={{padding:"20px",marginBottom:12,animation:"fadeUp .5s .05s both"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {/* Elimination score */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>💀 Elim Score</div>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
                <input type="text" inputMode="numeric" value={customInput} onChange={handleLimitChange}
                  style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1.5px solid rgba(0,0,0,.1)`,fontSize:18,fontWeight:700,color:T.ink,textAlign:"center",outline:"none",background:"rgba(0,0,0,.03)",fontFamily:T.mono,width:"100%"}}/>
                <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>pts</span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {[100,200,300].map(v=>(
                  <button key={v} onClick={()=>{setLimit(v);setCustomInput(String(v));}}
                    style={{flex:1,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                      background:limit===v?T.accent:"rgba(0,0,0,.06)",color:limit===v?"#fff":T.muted,transition:"all .15s"}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {/* Wrong show penalty */}
            <div>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>⚠️ Penalty</div>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
                <input type="text" inputMode="numeric" value={penaltyInput} onChange={handlePenaltyChange}
                  style={{flex:1,padding:"8px 10px",borderRadius:8,border:`1.5px solid rgba(0,0,0,.1)`,fontSize:18,fontWeight:700,color:T.ink,textAlign:"center",outline:"none",background:"rgba(0,0,0,.03)",fontFamily:T.mono,width:"100%"}}/>
                <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>pts</span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {[20,50,100].map(v=>(
                  <button key={v} onClick={()=>{setPenalty(v);setPenaltyInput(String(v));}}
                    style={{flex:1,padding:"5px 0",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                      background:penalty===v?T.red:"rgba(0,0,0,.06)",color:penalty===v?"#fff":T.muted,transition:"all .15s"}}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* VS AI */}
        <Panel style={{padding:"18px 20px",marginBottom:12,animation:"fadeUp .5s .1s both"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>🤖 Play vs AI</div>
          <div style={{display:"flex",gap:8,marginBottom:14,justifyContent:"center"}}>
            {[2,3,4].map(n=>(
              <button key={n} onClick={()=>setPlayers(n)}
                style={{width:46,height:46,borderRadius:10,border:"none",cursor:"pointer",fontSize:18,fontWeight:900,
                  background:players===n?T.accent:"rgba(0,0,0,.06)",color:players===n?"#fff":T.ink,
                  transform:players===n?"scale(1.08)":"scale(1)",transition:"all .15s"}}>
                {n}
              </button>
            ))}
          </div>
          <Btn onClick={()=>onPlayAI(players,limit,penalty)} style={{width:"100%",justifyContent:"center"}}>▶ Start vs AI</Btn>
        </Panel>

        {/* Friends */}
        <Panel style={{padding:"18px 20px",marginBottom:12,animation:"fadeUp .5s .15s both"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>👫 Play with Friends</div>
          <div style={{fontSize:12,color:T.muted,marginBottom:12}}>Real online multiplayer · play from any device</div>
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

// ── Friends Lobby ──────────────────────────────────────────────────────────────
function FriendsLobby({scoreLimit,penalty,onStart,onBack}){
  const [myName,setMyName]=useState("");
  const [joinCode,setJoinCode]=useState("");
  const [room,setRoom]=useState(null);
  const [myCode,setMyCode]=useState("");
  const [error,setError]=useState("");
  const [maxP,setMaxP]=useState(4);
  const [loading,setLoading]=useState(false);
  const [tab,setTab]=useState("create"); // "create" | "join"
  const unsubRef=useRef(null);

  async function createRoom(){
    if(!myName.trim()){setError("Enter your name first!");return;}
    setError("");setLoading(true);
    try{
      const c=genCode();
      const roomData={code:c,host:myName.trim(),players:[myName.trim()],maxPlayers:maxP,scoreLimit,penalty,started:false,createdAt:Date.now()};
      await dbSet(`rooms/${c}`,roomData);
      setMyCode(c);
      listenToRoom(c);
    }catch(e){
      setError("Failed: "+(e?.message||"unknown error"));
    }
    setLoading(false);
  }

  async function joinRoom(){
    if(!myName.trim()){setError("Enter your name first!");return;}
    if(joinCode.trim().length!==5){setError("Room code must be 5 characters!");return;}
    const c=joinCode.trim().toUpperCase();
    setError("");setLoading(true);
    try{
      const r=await dbGet(`rooms/${c}`);
      if(!r){setError("Room not found! Check the code.");setLoading(false);return;}
      if(r.started){setError("Game already started!");setLoading(false);return;}
      if(r.players.length>=r.maxPlayers){setError("Room is full!");setLoading(false);return;}
      if(r.players.includes(myName.trim())){setError("Name already taken!");setLoading(false);return;}
      await dbMerge(`rooms/${c}`,{players:[...r.players,myName.trim()]});
      setMyCode(c);
      listenToRoom(c);
    }catch(e){
      setError("Failed: "+(e?.message||"unknown error"));
    }
    setLoading(false);
  }

  function listenToRoom(c){
    if(unsubRef.current)unsubRef.current();
    unsubRef.current=dbListen(`rooms/${c}`,(data)=>{
      if(!data)return;
      setRoom(data);
      if(data.started)onStart(data.players,data.scoreLimit,c,myName.trim());
    });
  }

  async function startGame(){
    if(!room||room.players.length<2){setError("Need at least 2 players!");return;}
    const ap=room.players;
    const d=shuffleDeck(makeDeck());
    const wc=d[0],dr=d.slice(1);
    const hands={};let cur=0;
    for(const name of ap){hands[name]=dr.slice(cur,cur+5);cur+=5;}
    const gs={stock:dr.slice(cur+1),pile:[dr[cur]],wildCard:wc,hands,
      scores:Object.fromEntries(ap.map(p=>[p,0])),
      eliminated:[],activePlayers:ap,allPlayers:ap,penalty:room.penalty||50,
      turnIdx:0,round:1,roundResult:null,gameWinner:null,lastAction:Date.now()};
    await dbSet(`rooms/${room.code}/gameState`,gs);
    await dbMerge(`rooms/${room.code}`,{started:true});
  }

  useEffect(()=>()=>{if(unsubRef.current)unsubRef.current();},[]);
  const isHost=room&&room.host===myName.trim();

  const inp={width:"100%",padding:"13px 14px",borderRadius:10,border:`1.5px solid rgba(0,0,0,.12)`,
    fontSize:15,fontWeight:500,color:T.ink,outline:"none",background:"#fff",
    fontFamily:T.font,boxSizing:"border-box"};

  // ── In Room lobby ──
  if(room) return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20}}>
      <style>{GS.base}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{fontWeight:900,fontSize:24,letterSpacing:-.5,marginBottom:20,textAlign:"center"}}>Room Lobby</div>

        <Panel style={{padding:"20px",textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Room Code</div>
          <div style={{fontSize:48,fontWeight:900,letterSpacing:12,fontFamily:T.mono,color:T.accent,marginBottom:4}}>{myCode}</div>
          <div style={{fontSize:12,color:T.muted}}>Share with friends 📲</div>
        </Panel>

        <Panel style={{padding:"18px 20px",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>
            Players ({room.players.length}/{room.maxPlayers})
          </div>
          {room.players.map((p,i)=>(
            <div key={p} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:10,marginBottom:6,
              background:p===myName.trim()?"rgba(37,99,235,.06)":"rgba(0,0,0,.03)",
              border:p===myName.trim()?`1.5px solid ${T.accent}`:"1.5px solid transparent"}}>
              <span style={{fontSize:18}}>{i===0?"👑":"👤"}</span>
              <span style={{fontWeight:600,fontSize:14,flex:1}}>{p}</span>
              {p===myName.trim()&&<span style={{fontSize:10,color:T.accent,fontWeight:700,background:"rgba(37,99,235,.1)",borderRadius:4,padding:"2px 6px"}}>You</span>}
              {i===0&&p!==myName.trim()&&<span style={{fontSize:10,color:T.gold,fontWeight:700}}>Host</span>}
            </div>
          ))}
          {Array(room.maxPlayers-room.players.length).fill(0).map((_,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:10,marginBottom:6,
              border:"1.5px dashed rgba(0,0,0,.08)",background:"rgba(0,0,0,.02)"}}>
              <span style={{fontSize:18,opacity:.3}}>⏳</span>
              <span style={{fontSize:13,color:T.muted}}>Waiting for player...</span>
            </div>
          ))}
        </Panel>

        {isHost?(
          <Btn onClick={startGame} disabled={room.players.length<2}
            style={{width:"100%",fontSize:15,padding:"15px",opacity:room.players.length<2?.5:1}}>
            {room.players.length>=2?"🚀 Start Game!":"Need at least 2 players..."}
          </Btn>
        ):(
          <Panel style={{padding:"14px 20px",textAlign:"center"}}>
            <div style={{color:T.muted,fontSize:13}}>⏳ Waiting for <strong>{room.host}</strong> to start...</div>
          </Panel>
        )}
        {error&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:"rgba(239,68,68,.08)",border:`1px solid rgba(239,68,68,.2)`,color:T.red,fontSize:13,fontWeight:600}}>⚠️ {error}</div>}
      </div>
    </div>
  );

  // ── Pre-room screen ──
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20}}>
      <style>{GS.base}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:T.font,marginBottom:24,padding:0}}>← Back</button>
        <div style={{fontWeight:900,fontSize:26,letterSpacing:-.5,marginBottom:2}}>Play with Friends</div>
        <div style={{color:T.muted,fontSize:13,marginBottom:20}}>Real online · any device 🌐</div>

        {/* Name input */}
        <Panel style={{padding:"16px 18px",marginBottom:14}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Your Name</div>
          <input value={myName} onChange={e=>{setMyName(e.target.value);setError("");}}
            placeholder="Enter your name..." style={inp} autoFocus/>
        </Panel>

        {/* Tab switcher */}
        <div style={{display:"flex",background:"rgba(0,0,0,.06)",borderRadius:12,padding:4,marginBottom:14,gap:4}}>
          {["create","join"].map(t=>(
            <button key={t} onClick={()=>{setTab(t);setError("");}}
              style={{flex:1,padding:"10px",borderRadius:9,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,
                background:tab===t?"#fff":  "transparent",
                color:tab===t?T.ink:T.muted,
                boxShadow:tab===t?T.shadow:"none",
                transition:"all .2s",fontFamily:T.font}}>
              {t==="create"?"➕ Create Room":"🔑 Join Room"}
            </button>
          ))}
        </div>

        {/* Create panel */}
        {tab==="create"&&(
          <Panel style={{padding:"18px 20px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Max Players</div>
            <div style={{display:"flex",gap:8,marginBottom:18}}>
              {[2,3,4].map(n=>(
                <button key={n} onClick={()=>setMaxP(n)}
                  style={{flex:1,padding:"12px",borderRadius:10,border:"none",cursor:"pointer",fontSize:18,fontWeight:700,
                    background:maxP===n?T.accent:"rgba(0,0,0,.06)",color:maxP===n?"#fff":T.ink,transition:"all .15s"}}>
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={createRoom}
              disabled={loading}
              style={{width:"100%",padding:"15px",borderRadius:10,border:"none",cursor:loading?"not-allowed":"pointer",
                background:T.accent,color:"#fff",fontSize:16,fontWeight:800,fontFamily:T.font,
                opacity:loading?.6:1,boxShadow:"0 4px 14px rgba(37,99,235,.4)"}}>
              {loading?"⏳ Creating...":"🚀 Create Room"}
            </button>
          </Panel>
        )}

        {/* Join panel */}
        {tab==="join"&&(
          <Panel style={{padding:"18px 20px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Room Code</div>
            <input value={joinCode}
              onChange={e=>{setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,""));setError("");}}
              onKeyDown={e=>{if(e.key==="Enter")joinRoom();}}
              maxLength={5} placeholder="A1B2C"
              style={{...inp,fontSize:28,fontWeight:900,letterSpacing:10,textAlign:"center",fontFamily:T.mono,marginBottom:14}}/>
            <button
              onClick={joinRoom}
              disabled={loading}
              style={{width:"100%",padding:"15px",borderRadius:10,border:"none",cursor:loading?"not-allowed":"pointer",
                background:T.green,color:"#fff",fontSize:16,fontWeight:800,fontFamily:T.font,
                opacity:loading?.6:1,boxShadow:"0 4px 14px rgba(16,185,129,.4)"}}>
              {loading?"⏳ Joining...":"🔑 Join Room"}
            </button>
          </Panel>
        )}

        {error&&(
          <div style={{marginTop:12,padding:"12px 14px",borderRadius:10,
            background:"rgba(239,68,68,.08)",border:`1.5px solid rgba(239,68,68,.25)`,
            color:T.red,fontSize:13,fontWeight:600,textAlign:"center"}}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </div>
  );
}


// ── Points History Modal ──────────────────────────────────────────────────────
function HistoryModal({onClose,history,allPlayers,scores,scoreLimit}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <Panel style={{maxWidth:460,width:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 18px 12px",borderBottom:"1px solid rgba(0,0,0,.06)"}}>
          <span style={{fontWeight:900,fontSize:16,letterSpacing:-.3}}>📜 Points History</span>
          <Btn variant="ghost" small onClick={onClose}>✕</Btn>
        </div>
        <div style={{overflowY:"auto",padding:"14px 16px 18px"}}>
          {history&&history.length>0?(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:280}}>
                <thead>
                  <tr style={{borderBottom:"2px solid rgba(0,0,0,.08)"}}>
                    <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>Rnd</th>
                    {allPlayers.map(name=>(
                      <th key={name} style={{textAlign:"center",padding:"6px 8px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{name}</th>
                    ))}
                    <th style={{textAlign:"center",padding:"6px 8px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>🏅</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h,i)=>(
                    <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,.05)",background:i%2===0?"transparent":"rgba(0,0,0,.02)"}}>
                      <td style={{padding:"8px",fontWeight:700,fontFamily:T.mono,color:T.muted,fontSize:11}}>R{h.round}</td>
                      {allPlayers.map(name=>{
                        const gained=h.gained?.[name]??0;
                        return(
                          <td key={name} style={{textAlign:"center",padding:"8px",fontFamily:T.mono,fontSize:12,
                            fontWeight:gained>0?700:400,
                            color:gained===0?T.green:gained>50?T.red:T.gold}}>
                            {gained===0?"0 ✓":`+${gained}`}
                          </td>
                        );
                      })}
                      <td style={{textAlign:"center",padding:"8px",fontSize:11,fontWeight:700,color:T.accent,whiteSpace:"nowrap"}}>{h.winner}</td>
                    </tr>
                  ))}
                  <tr style={{borderTop:"2px solid rgba(0,0,0,.1)",background:"rgba(37,99,235,.04)"}}>
                    <td style={{padding:"8px",fontWeight:900,fontSize:12,color:T.ink}}>Total</td>
                    {allPlayers.map(name=>{
                      const sc=scores?.[name]??0;
                      const pct=Math.min(100,(sc/scoreLimit)*100);
                      return(
                        <td key={name} style={{textAlign:"center",padding:"8px",fontFamily:T.mono,fontWeight:900,fontSize:13,
                          color:pct>80?T.red:pct>55?T.gold:T.green}}>
                          {sc}
                        </td>
                      );
                    })}
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

// ── Round Result Screen ────────────────────────────────────────────────────────
function RoundResult({round,roundResult,allPlayers,scores,scoreLimit,penaltyPoints,onNext,canNext,history}){
  const [tab,setTab]=useState("result"); // "result" | "history"
  const AUTO_NEXT=10; // auto-advance after 10 seconds
  const [countdown,setCountdown]=useState(AUTO_NEXT);
  useEffect(()=>{
    const t=setInterval(()=>{
      setCountdown(p=>{
        if(p<=1){clearInterval(t);onNext();return 0;}
        return p-1;
      });
    },1000);
    return()=>clearInterval(t);
  },[]);// eslint-disable-line

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:16}}>
      <style>{GS.base}</style>
      <div style={{maxWidth:480,width:"100%"}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:36,marginBottom:4}}>{roundResult.claimerWon?"🎉":"😬"}</div>
          <div style={{fontWeight:900,fontSize:20,marginBottom:3}}>Round {round}</div>
          <div style={{fontSize:13,color:roundResult.claimerWon?T.green:T.red,fontWeight:700}}>
            {roundResult.claimerWon
              ?`${roundResult.claimerName} wins the round! (+0 pts) ✓`
              :`${roundResult.claimerName} wrong SHOW! (+${penaltyPoints} pts)`
            }
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{display:"flex",background:"rgba(0,0,0,.06)",borderRadius:10,padding:3,marginBottom:12,gap:3}}>
          {[["result","📊 This Round"],["history","📜 Points History"]].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
                background:tab===t?"#fff":"transparent",color:tab===t?T.ink:T.muted,
                boxShadow:tab===t?T.shadow:"none",transition:"all .2s",fontFamily:T.font}}>
              {label}
            </button>
          ))}
        </div>

        {tab==="result"&&(
          <Panel style={{overflow:"hidden"}}>
            {/* Hands revealed */}
            <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(0,0,0,.06)"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Hands</div>
              {roundResult.results.map(r=>(
                <div key={r.name} style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4,marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:700,minWidth:48,color:T.ink}}>{r.name}:</span>
                  {r.hand.map((c,i)=><Card key={i} card={c} small/>)}
                  <span style={{fontFamily:T.mono,fontSize:12,fontWeight:700,marginLeft:4,
                    color:r.pts===0?T.green:r.pts<=10?T.green:T.red}}>{r.pts}pt</span>
                </div>
              ))}
            </div>

            {/* Score bars */}
            <div style={{padding:"14px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Total Scores</div>
              {allPlayers.map(name=>{
                const sc=roundResult.newScores?.[name]??scores?.[name]??0;
                const prev=(scores?.[name]??0);
                const gained=sc-prev;
                const isElim=(roundResult.justElim||[]).includes(name);
                const pct=Math.min(100,(sc/scoreLimit)*100);
                return(
                  <div key={name} style={{marginBottom:10,opacity:isElim?.45:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontWeight:700,fontSize:13}}>
                        {isElim?"💀 ":""}{name}
                        {isElim&&<span style={{marginLeft:6,fontSize:9,background:T.red,color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:700}}>OUT</span>}
                      </span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {gained>0&&<span style={{fontSize:11,color:T.red,fontWeight:700,fontFamily:T.mono}}>+{gained}</span>}
                        {gained===0&&<span style={{fontSize:11,color:T.green,fontWeight:700,fontFamily:T.mono}}>+0 ✓</span>}
                        <span style={{fontFamily:T.mono,fontSize:13,fontWeight:700,color:pct>80?T.red:T.ink}}>{sc}<span style={{fontSize:10,color:T.muted,fontWeight:400}}>/{scoreLimit}</span></span>
                      </div>
                    </div>
                    <div style={{height:5,background:"rgba(0,0,0,.06)",borderRadius:3}}>
                      <div style={{height:"100%",width:`${pct}%`,background:pct>80?T.red:pct>55?T.gold:T.green,borderRadius:3,transition:"width .6s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {tab==="history"&&(
          <Panel style={{overflow:"hidden"}}>
            <div style={{padding:"14px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Points Per Round</div>
              {history&&history.length>0?(
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead>
                      <tr style={{borderBottom:"2px solid rgba(0,0,0,.08)"}}>
                        <th style={{textAlign:"left",padding:"6px 8px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>Round</th>
                        {allPlayers.map(name=>(
                          <th key={name} style={{textAlign:"center",padding:"6px 8px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>{name}</th>
                        ))}
                        <th style={{textAlign:"center",padding:"6px 8px",fontWeight:700,color:T.muted,fontSize:10,textTransform:"uppercase",letterSpacing:.5}}>Winner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h,i)=>(
                        <tr key={i} style={{borderBottom:"1px solid rgba(0,0,0,.05)",background:i%2===0?"transparent":"rgba(0,0,0,.02)"}}>
                          <td style={{padding:"8px",fontWeight:700,fontFamily:T.mono,color:T.muted,fontSize:11}}>R{h.round}</td>
                          {allPlayers.map(name=>{
                            const gained=h.gained?.[name]??0;
                            return(
                              <td key={name} style={{textAlign:"center",padding:"8px",fontFamily:T.mono,fontSize:12,
                                fontWeight:gained>0?700:400,
                                color:gained===0?T.green:gained>50?T.red:T.gold}}>
                                {gained===0?"+0 ✓":`+${gained}`}
                              </td>
                            );
                          })}
                          <td style={{textAlign:"center",padding:"8px",fontSize:11,fontWeight:700,color:T.accent}}>{h.winner}</td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr style={{borderTop:"2px solid rgba(0,0,0,.1)",background:"rgba(37,99,235,.04)"}}>
                        <td style={{padding:"8px",fontWeight:900,fontSize:12,color:T.ink}}>Total</td>
                        {allPlayers.map(name=>{
                          const sc=roundResult.newScores?.[name]??scores?.[name]??0;
                          const pct=Math.min(100,(sc/scoreLimit)*100);
                          return(
                            <td key={name} style={{textAlign:"center",padding:"8px",fontFamily:T.mono,fontWeight:900,fontSize:13,
                              color:pct>80?T.red:pct>55?T.gold:T.green}}>
                              {sc}
                            </td>
                          );
                        })}
                        <td/>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ):(
                <div style={{textAlign:"center",padding:"20px",color:T.muted,fontSize:13}}>No history yet</div>
              )}
            </div>
          </Panel>
        )}

        {/* Auto-advance countdown — always shown, no button */}
        <div style={{marginTop:16,textAlign:"center"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <div style={{position:"relative",width:72,height:72}}>
              <svg width={72} height={72} style={{transform:"rotate(-90deg)",position:"absolute",top:0,left:0}}>
                <circle cx={36} cy={36} r={30} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={5}/>
                <circle cx={36} cy={36} r={30} fill="none" stroke={T.accent} strokeWidth={5}
                  strokeDasharray={2*Math.PI*30}
                  strokeDashoffset={2*Math.PI*30*(1-countdown/AUTO_NEXT)}
                  style={{transition:"stroke-dashoffset 1s linear"}}/>
              </svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:22,fontWeight:900,color:T.accent,fontFamily:T.mono}}>
                {countdown}
              </div>
            </div>
            <div style={{fontSize:13,color:T.muted,fontWeight:600}}>Next round in {countdown}s...</div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Online Game Screen ─────────────────────────────────────────────────────────
function OnlineGameScreen({roomCode,myName,onQuit}){
  const [gs,setGs]=useState(null);
  const [drawFrom,setDrawFrom]=useState(null);
  const [dropIdxs,setDropIdxs]=useState([]);
  const [msg,setMsg]=useState("");
  const [showRules,setShowRules]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const [showGate,setShowGate]=useState(false);
  const [newlyElim,setNewlyElim]=useState([]);
  const [timeLeft,setTimeLeft]=useState(30);
  const [showContinue,setShowContinue]=useState(false);
  const unsubRef=useRef(null);
  const prevTurnRef=useRef(null);
  const timerRef=useRef(null);

  function startTimer(){clearInterval(timerRef.current);setShowContinue(false);setTimeLeft(30);timerRef.current=setInterval(()=>{setTimeLeft(p=>{if(p<=1){clearInterval(timerRef.current);return 0;}return p-1;});},1000);}
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  useEffect(()=>{
    if(!gs||!gs.activePlayers||timeLeft!==0)return;
    const cp=gs.activePlayers[gs.turnIdx];
    if(cp!==myName)return;
    vibrate([300]);
    setShowContinue(true); // show popup instead of auto-skip
  },[timeLeft]);// eslint-disable-line

  function onContinueOnline(){
    clearInterval(timerRef.current);setShowContinue(false);
    setTimeLeft(10);
    timerRef.current=setInterval(()=>{setTimeLeft(p=>{if(p<=1){clearInterval(timerRef.current);return 0;}return p-1;});},1000);
  }
  function onSkipOnline(){
    clearInterval(timerRef.current);setShowContinue(false);
    if(!gs||!gs.activePlayers)return;
    const next=(gs.turnIdx+1)%gs.activePlayers.length;
    dbMerge(`rooms/${roomCode}/gameState`,{turnIdx:next,lastAction:Date.now()});
  }

  useEffect(()=>{
    const unsub=dbListen(`rooms/${roomCode}/gameState`,(g)=>{
      if(!g)return;
      setGs(g);
      const cp=g.activePlayers[g.turnIdx];
      const turnKey=`${g.round||1}_${g.turnIdx}`;
      if(prevTurnRef.current!==turnKey){
        prevTurnRef.current=turnKey;
        if(cp===myName){
          setDrawFrom(null);setDropIdxs([]);setShowGate(true);
          setMsg("Pick source · select drop · SWAP");
          vibrate([100,50,100]); // strong buzz = YOUR turn
          startTimer();
        } else {
          vibrate([40]); // short buzz = someone else's turn
        }
      }
      if(g.roundResult?.justElim?.length>0&&!g.roundResult.shown)setNewlyElim(g.roundResult.justElim);
    });
    unsubRef.current=unsub;
    return()=>{if(unsubRef.current)unsubRef.current();};
  },[roomCode,myName]);// eslint-disable-line

  if(!gs)return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
      <style>{GS.base}</style>
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

  async function pushGs(u){await dbMerge(`rooms/${roomCode}/gameState`,u);}
  function selStock(){if(!isMyTurn)return;setDrawFrom(p=>p==="stock"?null:"stock");}
  function selPile(){if(!isMyTurn||!pile?.length)return;setDrawFrom(p=>p==="pile"?null:"pile");}
  function toggleDrop(idx){
    if(!isMyTurn)return;
    setDropIdxs(p=>{
      if(p.includes(idx))return p.filter(i=>i!==idx);
      if(p.length>0&&myHand[p[0]].rank!==myHand[idx].rank){setMsg("Same rank only for multi-drop!");return p;}
      return[...p,idx];
    });
  }
  async function doSwap(){
    if(!drawFrom||!dropIdxs.length)return;
    const dropping=dropIdxs.map(i=>myHand[i]);
    let drew,ns=[...stock],np=[...pile];
    if(drawFrom==="stock"){drew=stock[0];ns=stock.slice(1);}
    else{drew=pile[pile.length-1];np=pile.slice(0,-1);}
    const kept=myHand.filter((_,i)=>!dropIdxs.includes(i));
    np=[...np,...dropping];
    clearInterval(timerRef.current);setShowContinue(false);
    const next=(turnIdx+1)%activePlayers.length;
    await pushGs({stock:ns,pile:np,hands:{...hands,[myName]:[...kept,drew]},turnIdx:next,lastAction:Date.now()});
    setDrawFrom(null);setDropIdxs([]);
  }
  async function doShow(){
    if(!isMyTurn)return;
    clearInterval(timerRef.current);setShowContinue(false);
    const wc=wildCard||null;
    const penaltyPts=penalty||50;
    const results=activePlayers.map(name=>({name,hand:hands[name]||[],pts:handTotal(hands[name]||[],wc)}));
    const claimerPts=handTotal(myHand,wc);
    const lowestPts=Math.min(...results.map(r=>r.pts));
    const claimerWon=claimerPts===lowestPts;
    const newScores={...scores};
    if(claimerWon){results.forEach(r=>{if(r.name!==myName)newScores[r.name]=(newScores[r.name]||0)+r.pts;});}
    else{newScores[myName]=(newScores[myName]||0)+penaltyPts;}
    const sl=scoreLimit||300;
    const justElim=activePlayers.filter(n=>newScores[n]>=sl&&!(eliminated||[]).includes(n));
    const newElim=[...(eliminated||[]),...justElim];
    const newActive=activePlayers.filter(n=>!newElim.includes(n));
    const winner=newActive.length<=1?newActive[0]||activePlayers[0]:null;
    const gained={};
    activePlayers.forEach(n=>{gained[n]=(newScores[n]||0)-(scores[n]||0);});
    const histEntry={round:round||1,winner:claimerWon?myName:"❌",gained};
    const newHistory=[...(gs.history||[]),histEntry];
    await pushGs({scores:newScores,eliminated:newElim,activePlayers:newActive,
      roundResult:{results,claimerName:myName,claimerWon,claimerPts,lowestPts,justElim,newScores,shown:false},
      history:newHistory,gameWinner:winner,lastAction:Date.now()});
  }
  async function nextRound(){
    const ap=gs.activePlayers;
    const newRound=(round||1)+1;
    // Rotate starting player: each round starts with next player
    const allP=gs.allPlayers||ap;
    const startIdx=newRound % ap.length;
    const d=shuffleDeck(makeDeck());
    const wc=d[0],dr=d.slice(1);
    const h={};let cur=0;
    for(const name of ap){h[name]=dr.slice(cur,cur+5);cur+=5;}
    await pushGs({stock:dr.slice(cur+1),pile:[dr[cur]],wildCard:wc,hands:h,
      turnIdx:startIdx>=0?startIdx:0,round:newRound,
      roundResult:null,lastAction:Date.now(),allPlayers:allP});
  }

  if(gameWinner)return <GameOverBanner winner={gameWinner} onPlayAgain={onQuit} onQuit={onQuit}/>;
  if(roundResult)return <RoundResult round={round} roundResult={roundResult} allPlayers={allPlayers} scores={scores} scoreLimit={scoreLimit||300} penaltyPoints={penalty||50} onNext={nextRound} canNext={isMyTurn||roundResult.claimerName===myName} history={gs.history||[]}/>;
  if(newlyElim.length>0)return <EliminatedBanner name={newlyElim[0]} onClose={()=>setNewlyElim([])}/>;
  if(showContinue&&isMyTurn)return <ContinuePopup onContinue={onContinueOnline} onSkip={onSkipOnline}/>;
  if(showGate&&isMyTurn)return <TurnGate playerName={myName} onReady={()=>{vibrate([100,50,100]);setShowGate(false);startTimer();}}/>;

  const sl=scoreLimit||300;
  const opponents=activePlayers.filter(n=>n!==myName);

  return(
    <div style={{minHeight:"100vh",maxWidth:480,margin:"0 auto",background:T.bg,fontFamily:T.font,display:"flex",flexDirection:"column",position:"relative"}}>
      <style>{GS.base}</style>

      {/* ── Header ── */}
      <div style={{background:T.surface,backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(0,0,0,.07)",padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontWeight:900,fontSize:15,letterSpacing:-.3}}>5 CARDS</span>
          <span style={{fontSize:10,color:T.muted,background:"rgba(0,0,0,.06)",borderRadius:20,padding:"2px 7px"}}>R{round} · 🌐</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {isMyTurn&&<TimerRing timeLeft={timeLeft}/>}
          <Btn small variant="ghost" onClick={()=>setShowHistory(true)}>📜</Btn>
          <Btn small variant="ghost" onClick={()=>setShowRules(true)}>Rules</Btn>
          <Btn small variant="outline" onClick={onQuit}>Exit</Btn>
        </div>
      </div>

      {/* ── Score bar ── */}
      <div style={{padding:"6px 10px",display:"flex",gap:5,overflowX:"auto"}}>
        {activePlayers.map(name=>(
          <ScoreChip key={name} name={name} score={scores?.[name]||0} limit={sl} isActive={currentPlayer===name} isElim={(eliminated||[]).includes(name)} isYou={name===myName}/>
        ))}
      </div>

      {/* ── Opponents row (face-down only) ── */}
      <div style={{display:"flex",gap:8,justifyContent:"center",padding:"6px 10px",flexWrap:"wrap"}}>
        {opponents.map(name=>{
          const h=hands?.[name]||[];
          const isCur=currentPlayer===name;
          return(
            <div key={name} style={{
              background:isCur?"rgba(37,99,235,.08)":T.surface,
              backdropFilter:"blur(12px)",border:isCur?`1.5px solid ${T.accent}`:"1.5px solid rgba(255,255,255,.9)",
              borderRadius:12,padding:"8px 10px",textAlign:"center",minWidth:80,
              boxShadow:T.shadow,
            }}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,marginBottom:6}}>
                <span style={{fontSize:12}}>👤</span>
                <span style={{fontWeight:700,fontSize:11,color:isCur?T.accent:T.ink,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                {isCur&&<span style={{fontSize:9,color:T.accent,fontWeight:700,animation:"pulse 1s infinite"}}>▶</span>}
              </div>
              <div style={{display:"flex",gap:2,justifyContent:"center"}}>
                <FanCards count={h.length||5}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Table: Wild + Stock + Discard ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:"4px 12px"}}>
        {/* Wild card */}
        {wildCard&&(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:9,fontWeight:700,color:T.gold,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>🌟 Wild Card · 0 pts</div>
            <Card card={wildCard}/>
          </div>
        )}

        {/* Stock + Discard side by side */}
        <div style={{display:"flex",gap:24,alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:9,fontWeight:600,color:T.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Stock ({stock?.length||0})</div>
            {stock?.length>0
              ?<Card card={stock[0]} faceDown glowGreen={isMyTurn&&drawFrom==="stock"} onClick={isMyTurn?selStock:undefined} badge={drawFrom==="stock"?"✓ Draw":null}/>
              :<div style={{width:64,height:92,borderRadius:10,border:"2px dashed rgba(0,0,0,.1)"}}/>
            }
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:9,fontWeight:600,color:T.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:.5}}>Discard</div>
            {pileTop
              ?<Card card={pileTop} glowGreen={isMyTurn&&drawFrom==="pile"} onClick={isMyTurn?selPile:undefined} badge={drawFrom==="pile"?"✓ Draw":null}/>
              :<div style={{width:64,height:92,borderRadius:10,border:"2px dashed rgba(0,0,0,.1)"}}/>
            }
          </div>
        </div>

        {/* Step indicator */}
        {isMyTurn&&(
          <div style={{display:"flex",gap:4,alignItems:"center",background:"rgba(0,0,0,.04)",borderRadius:20,padding:"6px 14px"}}>
            {[["Source",drawFrom!=null],["Drop",dropIdxs.length>0],["SWAP",readySwap]].map(([label,done],i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:done?T.green:"rgba(0,0,0,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:done?"#fff":T.muted,fontWeight:700,transition:"all .2s"}}>{done?"✓":i+1}</div>
                <span style={{fontSize:10,color:done?T.green:T.muted,fontWeight:done?700:400}}>{label}</span>
                {i<2&&<span style={{color:"rgba(0,0,0,.15)",fontSize:10}}>›</span>}
              </div>
            ))}
          </div>
        )}

        {/* Status message */}
        <div style={{fontSize:12,color:isMyTurn?T.accent:T.muted,fontWeight:isMyTurn?600:400,textAlign:"center",fontStyle:isMyTurn?"normal":"italic"}}>
          {isMyTurn?msg:`⏳ ${currentPlayer}'s turn...`}
        </div>
      </div>

      {/* ── My hand (pinned bottom) ── */}
      <div style={{background:T.surface,backdropFilter:"blur(16px)",borderTop:"1px solid rgba(0,0,0,.07)",padding:"10px 12px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:800,fontSize:13}}>You</span>
            <span style={{fontSize:11,fontFamily:T.mono,background:"rgba(0,0,0,.06)",borderRadius:6,padding:"2px 7px",color:T.ink}}>{handTotal(myHand,wildCard)} pts</span>
          </div>
          {isMyTurn?(
            <div style={{display:"flex",gap:7}}>
              <Btn small variant="green" onClick={doSwap} disabled={!readySwap}>⇄ SWAP</Btn>
              <Btn small variant="danger" onClick={doShow}>📢 SHOW</Btn>
            </div>
          ):(
            <span style={{fontSize:11,color:T.muted,fontStyle:"italic"}}>Waiting...</span>
          )}
        </div>
        <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"nowrap",overflowX:"auto",paddingTop:14,paddingBottom:2}}>
          {myHand.map((card,idx)=>(
            <Card key={card.id} card={card} selected={dropIdxs.includes(idx)} onClick={isMyTurn?()=>toggleDrop(idx):undefined} badge={dropIdxs.includes(idx)?"Drop":null}/>
          ))}
        </div>
      </div>
      {showRules&&<RulesModal onClose={()=>setShowRules(false)} limit={sl} penalty={penalty||50}/>}
      {showHistory&&<HistoryModal onClose={()=>setShowHistory(false)} history={gs.history||[]} allPlayers={allPlayers} scores={scores} scoreLimit={sl}/>}
    </div>
  );
}

// ── AI Game Screen ─────────────────────────────────────────────────────────────
function AIGameScreen({players,scoreLimit,penaltyPoints,onQuit}){
  const allPlayers=players;
  const YOU=players[0];
  const isAI=n=>n!==YOU;

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
  const aiTimer=useRef(null);
  const turnTimerRef=useRef(null);

  function startTurnTimer(){clearInterval(turnTimerRef.current);setShowContinueAI(false);setTimeLeft(30);vibrate([100,50,100]);turnTimerRef.current=setInterval(()=>{setTimeLeft(p=>{if(p<=1){clearInterval(turnTimerRef.current);return 0;}return p-1;});},1000);}
  useEffect(()=>()=>clearInterval(turnTimerRef.current),[]);

  function deal(ap, roundNum){
    const a=ap||active;
    const d=shuffleDeck(makeDeck());
    const wc=d[0],dr=d.slice(1);
    const h={};let cur=0;
    for(const name of a){h[name]=dr.slice(cur,cur+5);cur+=5;}
    // Rotate starting player each round
    const rn=roundNum||1;
    const startIdx=rn % a.length;
    setWildCard(wc);setStock(dr.slice(cur+1));setPile([dr[cur]]);setHands(h);
    setTurnIdx(startIdx);setDrawFrom(null);setDropIdxs([]);setRoundResult(null);
    setMsg(a[startIdx]==="You"?"Pick source · select drop · SWAP":`${a[startIdx]}'s turn...`);
    if(a[startIdx]==="You") startTurnTimer();
  }
  useEffect(()=>{deal();},[]);// eslint-disable-line

  useEffect(()=>{
    if(timeLeft!==0||roundResult||gameWinner)return;
    if(!isMyTurn)return;
    clearInterval(turnTimerRef.current);
    setShowContinueAI(true);
  },[timeLeft]);// eslint-disable-line

  function onContinueAI(){
    setShowContinueAI(false);
    setTimeLeft(10);
    turnTimerRef.current=setInterval(()=>{setTimeLeft(p=>{if(p<=1){clearInterval(turnTimerRef.current);return 0;}return p-1;});},1000);
  }
  function onSkipAI(){
    setShowContinueAI(false);
    const next=(turnIdx+1)%active.length;
    setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
    setMsg(`⏱ Time's up! ${active[next]==="You"?"Your turn":`${active[next]}'s turn`}`);
    if(!isAI(active[next]))startTurnTimer();
  }

  const currentPlayer=active[turnIdx];
  const isMyTurn=currentPlayer===YOU;

  useEffect(()=>{
    if(roundResult||gameWinner)return;
    if(!isAI(currentPlayer))return;
    aiTimer.current=setTimeout(()=>{
      const hand=hands[currentPlayer];if(!hand)return;
      if(handTotal(hand,wildCard)<=13){handleClaim(currentPlayer,hand);return;}
      const topCard=pile[pile.length-1];
      const worst=Math.max(...hand.map(c=>c.pts));
      const useTop=topCard&&topCard.pts<worst;
      const groups={};
      hand.forEach(c=>{groups[c.rank]=groups[c.rank]||[];groups[c.rank].push(c);});
      let bg=null,bp=-1;
      for(const g of Object.values(groups)){const gp=g.reduce((s,c)=>s+c.pts,0);if(gp>bp){bp=gp;bg=g;}}
      let drew,ns=[...stock],np=[...pile];
      if(useTop&&topCard){drew=topCard;np=pile.slice(0,-1);}
      else{if(!stock.length)return;drew=stock[0];ns=stock.slice(1);}
      const di=new Set(bg.map(c=>c.id));
      const nh=[...hand.filter(c=>!di.has(c.id)),drew];
      np=[...np,...bg];
      setStock(ns);setPile(np);setHands(p=>({...p,[currentPlayer]:nh}));
      const next=(turnIdx+1)%active.length;
      setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
      if(!isAI(active[next])){startTurnTimer();}
      else{vibrate([40]);} // short buzz when AI takes turn
      setMsg(isAI(active[next])?`${active[next]}'s turn...`:"Pick source · select drop · SWAP");
    },1200);
    return()=>clearTimeout(aiTimer.current);
  },[turnIdx,roundResult]);// eslint-disable-line

  function handleClaim(claimerName,claimerHand,wc){
    const results=active.map(name=>({name,hand:name===claimerName?claimerHand:(hands[name]||[]),pts:name===claimerName?handTotal(claimerHand,wc||wildCard):handTotal(hands[name]||[],wc||wildCard)}));
    const lowestPts=Math.min(...results.map(r=>r.pts));
    const claimerPts=results.find(r=>r.name===claimerName).pts;
    const claimerWon=claimerPts===lowestPts;
    const newScores={...scores};
    if(claimerWon){results.forEach(r=>{if(r.name!==claimerName)newScores[r.name]=(newScores[r.name]||0)+r.pts;});}
    else{newScores[claimerName]=(newScores[claimerName]||0)+penaltyPoints;}
    // Record history
    const gained={};
    allPlayers.forEach(n=>{gained[n]=(newScores[n]||0)-(scores[n]||0);});
    setHistory(h=>[...h,{round,winner:claimerWon?claimerName:"❌",gained}]);
    setScores(newScores);
    const justElim=active.filter(n=>newScores[n]>=scoreLimit&&!eliminated.includes(n));
    const newElim=[...eliminated,...justElim];
    const newActive=active.filter(n=>!newElim.includes(n));
    if(justElim.length>0){setEliminated(newElim);setActive(newActive);}
    if(newActive.length<=1)setGameWinner(newActive[0]||active[0]);
    setRoundResult({results,claimerName,claimerWon,claimerPts,lowestPts,newScores,justElim});
  }

  function nextRound(){
    if(roundResult?.justElim?.length>0){setNewlyElim(roundResult.justElim);setRoundResult(null);}
    else{
      const newRound=round+1;
      setRoundResult(null);setRound(newRound);
      deal(null, newRound);
    }
  }

  function selStock(){if(!isMyTurn)return;setDrawFrom(p=>p==="stock"?null:"stock");}
  function selPile(){if(!isMyTurn||!pile.length)return;setDrawFrom(p=>p==="pile"?null:"pile");}
  function toggleDrop(idx){
    if(!isMyTurn)return;
    const hand=hands[YOU];
    setDropIdxs(p=>{
      if(p.includes(idx))return p.filter(i=>i!==idx);
      if(p.length>0&&hand[p[0]].rank!==hand[idx].rank){setMsg("Same rank only for multi-drop!");return p;}
      return[...p,idx];
    });
  }
  function doSwap(){
    if(!drawFrom||!dropIdxs.length)return;
    const hand=hands[YOU];
    const dropping=dropIdxs.map(i=>hand[i]);
    let drew,ns=[...stock],np=[...pile];
    if(drawFrom==="stock"){if(!stock.length)return;drew=stock[0];ns=stock.slice(1);}
    else{if(!pile.length)return;drew=pile[pile.length-1];np=pile.slice(0,-1);}
    const kept=hand.filter((_,i)=>!dropIdxs.includes(i));
    np=[...np,...dropping];
    setStock(ns);setPile(np);setHands(p=>({...p,[YOU]:[...kept,drew]}));
    clearInterval(turnTimerRef.current);setShowContinueAI(false);
    const next=(turnIdx+1)%active.length;
    setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
    if(!isAI(active[next]))startTurnTimer();
    setMsg(isAI(active[next])?`${active[next]}'s turn...`:"Pick source · select drop · SWAP");
  }
  function doShow(){if(!isMyTurn)return;clearInterval(turnTimerRef.current);setShowContinueAI(false);handleClaim(YOU,hands[YOU],wildCard);}

  const myHand=hands[YOU]||[];
  const pileTop=pile[pile.length-1]||null;
  const readySwap=isMyTurn&&drawFrom!==null&&dropIdxs.length>0;

  if(gameWinner)return <GameOverBanner winner={gameWinner} onPlayAgain={()=>{setGameWinner(null);onQuit();}} onQuit={onQuit}/>;
  if(roundResult)return <RoundResult round={round} roundResult={roundResult} allPlayers={allPlayers} scores={scores} scoreLimit={scoreLimit} penaltyPoints={penaltyPoints} onNext={nextRound} canNext={true} history={history}/>;
  if(showContinueAI)return <ContinuePopup onContinue={onContinueAI} onSkip={onSkipAI}/>;
  if(newlyElim.length>0)return <EliminatedBanner name={newlyElim[0]} onClose={()=>{const nr=round+1;setNewlyElim([]);setRound(nr);deal(active.filter(n=>!eliminated.includes(n)),nr);}}/>;

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font,display:"flex",flexDirection:"column"}}>
      <style>{GS.base}</style>
      {/* Header */}
      <div style={{background:T.surface,backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(0,0,0,.07)",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontWeight:900,fontSize:16,letterSpacing:-.3}}>5 CARDS</span>
          <span style={{fontSize:11,color:T.muted,background:"rgba(0,0,0,.06)",borderRadius:20,padding:"2px 8px"}}>Round {round} · 🤖</span>
        </div>
        <div style={{display:"flex",gap:7}}>
          <Btn small variant="ghost" onClick={()=>setShowHistory(true)}>📜</Btn>
          <Btn small variant="ghost" onClick={()=>setShowRules(true)}>Rules</Btn>
          <Btn small variant="outline" onClick={onQuit}>Exit</Btn>
        </div>
      </div>

      {/* Score bar */}
      <div style={{padding:"8px 12px",display:"flex",gap:6,overflowX:"auto"}}>
        {allPlayers.map(name=>(
          <ScoreChip key={name} name={name} score={scores[name]||0} limit={scoreLimit} isActive={active[turnIdx]===name} isElim={eliminated.includes(name)} isYou={name===YOU}/>
        ))}
      </div>

      {/* Main area */}
      <div style={{flex:1,display:"flex",flexDirection:"row",gap:12,padding:"8px 12px",minHeight:0}}>
        {/* Left — opponents */}
        <div style={{display:"flex",flexDirection:"column",gap:8,width:120,flexShrink:0}}>
          {active.filter(n=>n!==YOU).map(name=>{
            const h=hands[name]||[];
            const isCur=currentPlayer===name;
            return(
              <Panel key={name} style={{padding:"10px",border:isCur?`1.5px solid ${T.accent}`:"1.5px solid rgba(255,255,255,.9)"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                  <span style={{fontSize:13}}>🤖</span>
                  <span style={{fontWeight:700,fontSize:11,flex:1}}>{name}</span>
                  {isCur&&<span style={{fontSize:10,color:T.accent,fontWeight:700,animation:"pulse 1s infinite"}}>▶</span>}
                </div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap",justifyContent:"center"}}>
                  <FanCards count={h.length||5}/>
                </div>
              </Panel>
            );
          })}
        </div>

        {/* Centre */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          {wildCard&&(
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.gold,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>🌟 Wild · 0 pts</div>
              <Card card={wildCard}/>
            </div>
          )}
          <div style={{display:"flex",gap:20,alignItems:"flex-end"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,fontWeight:600,color:T.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Stock ({stock.length})</div>
              {stock.length>0
                ?<Card card={stock[0]} faceDown glowGreen={isMyTurn&&drawFrom==="stock"} onClick={isMyTurn?selStock:undefined} badge={drawFrom==="stock"?"Source ✓":null}/>
                :<div style={{width:64,height:92,borderRadius:10,border:"2px dashed rgba(0,0,0,.1)"}}/>
              }
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,fontWeight:600,color:T.muted,marginBottom:6,textTransform:"uppercase",letterSpacing:.5}}>Discard</div>
              {pileTop
                ?<Card card={pileTop} glowGreen={isMyTurn&&drawFrom==="pile"} onClick={isMyTurn?selPile:undefined} badge={drawFrom==="pile"?"Source ✓":null}/>
                :<div style={{width:64,height:92,borderRadius:10,border:"2px dashed rgba(0,0,0,.1)"}}/>
              }
            </div>
          </div>

          {isMyTurn&&(
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {[["Source",drawFrom!=null],["Drop",dropIdxs.length>0],["Swap",readySwap]].map(([label,done],i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                  <div style={{width:20,height:20,borderRadius:"50%",background:done?T.green:"rgba(0,0,0,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:done?"#fff":T.muted,fontWeight:700,transition:"all .2s"}}>{done?"✓":i+1}</div>
                  <span style={{fontSize:11,color:done?T.green:T.muted,fontWeight:done?700:400}}>{label}</span>
                  {i<2&&<span style={{color:"rgba(0,0,0,.15)",fontSize:12}}>›</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{fontSize:12,color:T.muted,textAlign:"center",fontStyle:isMyTurn?"normal":"italic"}}>{msg}</div>
        </div>
      </div>

      {/* Bottom — my hand */}
      <Panel style={{margin:"0 8px 10px",padding:"12px 14px",borderRadius:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontWeight:700,fontSize:13}}>You</span>
            <span style={{fontSize:11,fontFamily:T.mono,color:T.muted}}>{handTotal(myHand,wildCard)} pts</span>
            {isMyTurn&&<TimerRing timeLeft={timeLeft}/>}
          </div>
          {isMyTurn&&(
            <div style={{display:"flex",gap:8}}>
              <Btn small variant="green" onClick={doSwap} disabled={!readySwap}>⇄ SWAP</Btn>
              <Btn small variant="danger" onClick={doShow}>📢 SHOW</Btn>
            </div>
          )}
          {!isMyTurn&&<span style={{fontSize:11,color:T.muted,fontStyle:"italic"}}>{isAI(currentPlayer)?`${currentPlayer} is thinking...`:"Wait..."}</span>}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap",paddingTop:16}}>
          {myHand.map((card,idx)=>(
            <Card key={card.id} card={card} selected={dropIdxs.includes(idx)} onClick={isMyTurn?()=>toggleDrop(idx):undefined} badge={dropIdxs.includes(idx)?"Drop ✓":null}/>
          ))}
        </div>
      </Panel>
      {showRules&&<RulesModal onClose={()=>setShowRules(false)} limit={scoreLimit} penalty={penaltyPoints}/>}
      {showHistory&&<HistoryModal onClose={()=>setShowHistory(false)} history={history} allPlayers={allPlayers} scores={scores} scoreLimit={scoreLimit}/>}
    </div>
  );
}

// ── App Root ───────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("home");
  const [config,setConfig]=useState({players:["You","Muthu"],limit:300,penalty:50,roomCode:null,myName:null});
  return(
    <>
      <Styles/>
      {screen==="home"&&(
        <HomeScreen
          onPlayAI={(n,l,p)=>{setConfig({players:["You",...AI_NAMES.slice(0,n-1)],limit:l,penalty:p||50,roomCode:null,myName:null});setScreen("ai");}}
          onPlayFriends={(l,p)=>{setConfig(prev=>({...prev,limit:l,penalty:p||50}));setScreen("lobby");}}
        />
      )}
      {screen==="lobby"&&(
        <FriendsLobby
          scoreLimit={config.limit} penalty={config.penalty||50}
          onStart={(players,limit,roomCode,myName)=>{setConfig(p=>({...p,players,limit,roomCode,myName}));setScreen("online");}}
          onBack={()=>setScreen("home")}
        />
      )}
      {screen==="online"&&(
        <OnlineGameScreen roomCode={config.roomCode} myName={config.myName} onQuit={()=>setScreen("home")}/>
      )}
      {screen==="ai"&&(
        <AIGameScreen players={config.players} scoreLimit={config.limit} penaltyPoints={config.penalty||50} onQuit={()=>setScreen("home")}/>
      )}
    </>
  );
}