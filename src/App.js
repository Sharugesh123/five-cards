import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAyZO47BA0XQ2n7JYJTSHe_-iU20IBwwUY",
  authDomain: "five-cards-f8dcc.firebaseapp.com",
  databaseURL: "https://five-cards-f8dcc-default-rtdb.firebaseio.com",
  projectId: "five-cards-f8dcc",
  storageBucket: "five-cards-f8dcc.firebasestorage.app",
  messagingSenderId: "492585297080",
  appId: "1:492585297080:web:a71e4a2fa4a0ecc4c0404d"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  bg:      "#F4F5F7",
  surface: "rgba(255,255,255,0.72)",
  glass:   "rgba(255,255,255,0.55)",
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
  glow_b:  "0 0 0 2.5px #2563EB, 0 8px 24px rgba(37,99,235,0.25)",
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
  const [mode,setMode]=useState(null);
  const [myName,setMyName]=useState("");
  const [joinCode,setJoinCode]=useState("");
  const [room,setRoom]=useState(null);
  const [myCode,setMyCode]=useState("");
  const [error,setError]=useState("");
  const [maxP,setMaxP]=useState(4);
  const [loading,setLoading]=useState(false);
  const unsubRef=useRef(null);

  async function createRoom(){
    if(!myName.trim()){setError("Enter your name first!");return;}
    setLoading(true);
    const c=genCode();
    await set(ref(db,`rooms/${c}`),{code:c,host:myName.trim(),players:[myName.trim()],maxPlayers:maxP,scoreLimit,penalty,started:false,createdAt:Date.now()});
    setMyCode(c);setLoading(false);setError("");listenToRoom(c);
  }
  async function joinRoom(){
    if(!myName.trim()){setError("Enter your name!");return;}
    if(!joinCode.trim()){setError("Enter the room code!");return;}
    const c=joinCode.trim().toUpperCase();
    setLoading(true);
    const snap=await get(ref(db,`rooms/${c}`));
    if(!snap.exists()){setError("Room not found!");setLoading(false);return;}
    const r=snap.val();
    if(r.started){setError("Game already started!");setLoading(false);return;}
    if(r.players.length>=r.maxPlayers){setError("Room is full!");setLoading(false);return;}
    if(r.players.includes(myName.trim())){setError("Name taken!");setLoading(false);return;}
    await update(ref(db,`rooms/${c}`),{players:[...r.players,myName.trim()]});
    setMyCode(c);setLoading(false);setError("");listenToRoom(c);
  }
  function listenToRoom(c){
    if(unsubRef.current)unsubRef.current();
    const unsub=onValue(ref(db,`rooms/${c}`),(snap)=>{
      if(!snap.exists())return;
      const r=snap.val();setRoom(r);
      if(r.started)onStart(r.players,r.scoreLimit,c,myName);
    });
    unsubRef.current=unsub;
  }
  async function startGame(){
    if(!room||room.players.length<2){setError("Need at least 2 players!");return;}
    const ap=room.players;
    const d=shuffleDeck(makeDeck());
    const wc=d[0],dr=d.slice(1);
    const hands={};let cur=0;
    for(const name of ap){hands[name]=dr.slice(cur,cur+5);cur+=5;}
    const gs={stock:dr.slice(cur+1),pile:[dr[cur]],wildCard:wc,hands,scores:Object.fromEntries(ap.map(p=>[p,0])),eliminated:[],activePlayers:ap,penalty:room.penalty||50,turnIdx:0,round:1,roundResult:null,gameWinner:null,lastAction:Date.now()};
    await update(ref(db,`rooms/${room.code}`),{started:true,gameState:gs});
  }
  useEffect(()=>()=>{if(unsubRef.current)unsubRef.current();},[]);
  const isHost=room&&room.host===myName.trim();

  const inputStyle={width:"100%",padding:"11px 14px",borderRadius:10,border:`1.5px solid rgba(0,0,0,.1)`,fontSize:15,fontWeight:500,color:T.ink,outline:"none",background:"rgba(0,0,0,.03)",fontFamily:T.font,boxSizing:"border-box"};

  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20}}>
      <style>{GS.base}</style>
      <div style={{width:"100%",maxWidth:400}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:T.font,marginBottom:20,display:"flex",alignItems:"center",gap:4}}>← Back</button>
        <div style={{fontWeight:900,fontSize:28,letterSpacing:-.5,marginBottom:4}}>Play with Friends</div>
        <div style={{color:T.muted,fontSize:13,marginBottom:24}}>Real online · any device</div>

        {!room&&(
          <Panel style={{padding:20,marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Your Name</div>
            <input value={myName} onChange={e=>setMyName(e.target.value)} placeholder="Enter your name..." style={inputStyle}/>
          </Panel>
        )}

        {!room&&!mode&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Panel style={{padding:20,textAlign:"center",cursor:"pointer"}} onClick={()=>setMode("create")}>
              <div style={{fontSize:28,marginBottom:6}}>➕</div>
              <div style={{fontWeight:700,fontSize:14}}>Create Room</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>Start a new game</div>
            </Panel>
            <Panel style={{padding:20,textAlign:"center",cursor:"pointer"}} onClick={()=>setMode("join")}>
              <div style={{fontSize:28,marginBottom:6}}>🔑</div>
              <div style={{fontWeight:700,fontSize:14}}>Join Room</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>Enter a code</div>
            </Panel>
          </div>
        )}

        {!room&&mode==="create"&&(
          <Panel style={{padding:20}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Max Players</div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[2,3,4].map(n=>(
                <button key={n} onClick={()=>setMaxP(n)} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:16,fontWeight:700,background:maxP===n?T.accent:"rgba(0,0,0,.06)",color:maxP===n?"#fff":T.ink,transition:"all .15s"}}>{n}</button>
              ))}
            </div>
            <Btn onClick={createRoom} disabled={loading} style={{width:"100%",marginBottom:8}}>{loading?"Creating...":"Create Room"}</Btn>
            <button onClick={()=>setMode(null)} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",width:"100%",fontFamily:T.font}}>← Back</button>
          </Panel>
        )}

        {!room&&mode==="join"&&(
          <Panel style={{padding:20}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Room Code</div>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={5} placeholder="A1B2C"
              style={{...inputStyle,fontSize:24,fontWeight:900,letterSpacing:8,textAlign:"center",fontFamily:T.mono,marginBottom:14}}/>
            <Btn onClick={joinRoom} disabled={loading} style={{width:"100%",marginBottom:8}}>{loading?"Joining...":"Join Room"}</Btn>
            <button onClick={()=>setMode(null)} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",width:"100%",fontFamily:T.font}}>← Back</button>
          </Panel>
        )}

        {room&&(
          <>
            <Panel style={{padding:20,textAlign:"center",marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Room Code</div>
              <div style={{fontSize:40,fontWeight:900,letterSpacing:10,fontFamily:T.mono,color:T.accent}}>{myCode}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:4}}>Share with friends 📲</div>
            </Panel>
            <Panel style={{padding:20,marginBottom:12}}>
              <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Players ({room.players.length}/{room.maxPlayers})</div>
              {room.players.map((p,i)=>(
                <div key={p} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,marginBottom:6,background:p===myName.trim()?"rgba(37,99,235,.06)":"rgba(0,0,0,.03)",border:p===myName.trim()?`1.5px solid ${T.accent}`:"1.5px solid transparent"}}>
                  <span style={{fontSize:16}}>{i===0?"👑":"👤"}</span>
                  <span style={{fontWeight:600,fontSize:14,flex:1}}>{p}</span>
                  {p===myName.trim()&&<span style={{fontSize:10,color:T.accent,fontWeight:700}}>You</span>}
                  {i===0&&p!==myName.trim()&&<span style={{fontSize:10,color:T.gold,fontWeight:700}}>Host</span>}
                </div>
              ))}
              {Array(room.maxPlayers-room.players.length).fill(0).map((_,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,marginBottom:6,background:"rgba(0,0,0,.02)",border:"1.5px dashed rgba(0,0,0,.08)"}}>
                  <span style={{fontSize:16,opacity:.3}}>⏳</span>
                  <span style={{fontSize:13,color:T.muted}}>Waiting...</span>
                </div>
              ))}
            </Panel>
            {isHost
              ?<Btn onClick={startGame} disabled={room.players.length<2} style={{width:"100%"}}>🚀 Start Game</Btn>
              :<Panel style={{padding:"14px 20px",textAlign:"center"}}><div style={{color:T.muted,fontSize:13}}>⏳ Waiting for host to start...</div></Panel>
            }
          </>
        )}
        {error&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:10,background:"rgba(239,68,68,.08)",border:`1px solid rgba(239,68,68,.2)`,color:T.red,fontSize:13,fontWeight:600}}>{error}</div>}
      </div>
    </div>
  );
}

// ── Round Result Screen ────────────────────────────────────────────────────────
function RoundResult({round,roundResult,allPlayers,scores,scoreLimit,penaltyPoints,onNext,canNext}){
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font,padding:20}}>
      <style>{GS.base}</style>
      <Panel style={{maxWidth:480,width:"100%",overflow:"hidden"}}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid rgba(0,0,0,.06)",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:6}}>{roundResult.claimerWon?"🎉":"😬"}</div>
          <div style={{fontWeight:900,fontSize:20,marginBottom:4}}>Round {round} Result</div>
          <div style={{fontSize:13,color:roundResult.claimerWon?T.green:T.red,fontWeight:600}}>
            {roundResult.claimerWon
              ?`${roundResult.claimerName} wins! (+0 pts) ✓`
              :`${roundResult.claimerName} wrong SHOW! (+${penaltyPoints} pts penalty)`
            }
          </div>
        </div>

        {/* Hands */}
        <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(0,0,0,.06)"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Hands Revealed</div>
          {roundResult.results.map(r=>(
            <div key={r.name} style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:5,marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,minWidth:50,color:T.ink}}>{r.name}:</span>
              {r.hand.map((c,i)=><Card key={i} card={c} small/>)}
              <span style={{fontFamily:T.mono,fontSize:12,color:r.pts<=10?T.green:T.red,fontWeight:700,marginLeft:4}}>{r.pts}pt</span>
            </div>
          ))}
        </div>

        {/* Scores */}
        <div style={{padding:"14px 20px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Scores</div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
            {allPlayers.map(name=>{
              const sc=roundResult.newScores?.[name]??scores?.[name]??0;
              const isElim=(roundResult.justElim||[]).includes(name);
              const pct=Math.min(100,(sc/scoreLimit)*100);
              return(
                <div key={name} style={{opacity:isElim?.45:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontWeight:600,fontSize:13}}>{isElim?"💀 ":""}{name}{isElim&&<span style={{marginLeft:6,fontSize:10,background:T.red,color:"#fff",borderRadius:4,padding:"1px 6px",fontWeight:700}}>OUT</span>}</span>
                    <span style={{fontFamily:T.mono,fontSize:12,color:pct>80?T.red:T.muted}}>{sc}/{scoreLimit}</span>
                  </div>
                  <div style={{height:4,background:"rgba(0,0,0,.06)",borderRadius:2}}>
                    <div style={{height:"100%",width:`${pct}%`,background:pct>80?T.red:pct>55?T.gold:T.green,borderRadius:2,transition:"width .5s"}}/>
                  </div>
                </div>
              );
            })}
          </div>
          {canNext
            ?<Btn onClick={onNext} style={{width:"100%"}}>Next Round →</Btn>
            :<div style={{textAlign:"center",color:T.muted,fontSize:13}}>Waiting for host...</div>
          }
        </div>
      </Panel>
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
  const [showGate,setShowGate]=useState(false);
  const [newlyElim,setNewlyElim]=useState([]);
  const [timeLeft,setTimeLeft]=useState(30);
  const unsubRef=useRef(null);
  const prevTurnRef=useRef(null);
  const timerRef=useRef(null);

  function startTimer(){clearInterval(timerRef.current);setTimeLeft(30);timerRef.current=setInterval(()=>{setTimeLeft(p=>{if(p<=1){clearInterval(timerRef.current);return 0;}return p-1;});},1000);}
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  useEffect(()=>{
    if(!gs||!gs.activePlayers||timeLeft!==0)return;
    const cp=gs.activePlayers[gs.turnIdx];
    if(cp!==myName)return;
    const next=(gs.turnIdx+1)%gs.activePlayers.length;
    update(ref(db,`rooms/${roomCode}/gameState`),{turnIdx:next,lastAction:Date.now()});
  },[timeLeft]);// eslint-disable-line

  useEffect(()=>{
    const unsub=onValue(ref(db,`rooms/${roomCode}/gameState`),(snap)=>{
      if(!snap.exists())return;
      const g=snap.val();setGs(g);
      const cp=g.activePlayers[g.turnIdx];
      if(cp===myName&&prevTurnRef.current!==g.turnIdx){
        prevTurnRef.current=g.turnIdx;
        setDrawFrom(null);setDropIdxs([]);setShowGate(true);
        setMsg("Pick source · select drop · SWAP");
        startTimer();
      }
      if(g.roundResult?.justElim?.length>0&&!g.roundResult.shown)setNewlyElim(g.roundResult.justElim);
    });
    unsubRef.current=unsub;
    return()=>unsub();
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

  async function pushGs(u){await update(ref(db,`rooms/${roomCode}/gameState`),u);}
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
    clearInterval(timerRef.current);
    const next=(turnIdx+1)%activePlayers.length;
    await pushGs({stock:ns,pile:np,hands:{...hands,[myName]:[...kept,drew]},turnIdx:next,lastAction:Date.now()});
    setDrawFrom(null);setDropIdxs([]);
  }
  async function doShow(){
    if(!isMyTurn)return;
    clearInterval(timerRef.current);
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
    await pushGs({scores:newScores,eliminated:newElim,activePlayers:newActive,roundResult:{results,claimerName:myName,claimerWon,claimerPts,lowestPts,justElim,newScores,shown:false},gameWinner:winner,lastAction:Date.now()});
  }
  async function nextRound(){
    const ap=gs.activePlayers;
    const d=shuffleDeck(makeDeck());
    const wc=d[0],dr=d.slice(1);
    const h={};let cur=0;
    for(const name of ap){h[name]=dr.slice(cur,cur+5);cur+=5;}
    await pushGs({stock:dr.slice(cur+1),pile:[dr[cur]],wildCard:wc,hands:h,turnIdx:0,round:(round||1)+1,roundResult:null,lastAction:Date.now()});
  }

  if(gameWinner)return <GameOverBanner winner={gameWinner} onPlayAgain={onQuit} onQuit={onQuit}/>;
  if(roundResult)return <RoundResult round={round} roundResult={roundResult} allPlayers={allPlayers} scores={scores} scoreLimit={scoreLimit||300} penaltyPoints={penalty||50} onNext={nextRound} canNext={isMyTurn||roundResult.claimerName===myName}/>;
  if(newlyElim.length>0)return <EliminatedBanner name={newlyElim[0]} onClose={()=>setNewlyElim([])}/>;
  if(showGate&&isMyTurn)return <TurnGate playerName={myName} onReady={()=>{setShowGate(false);startTimer();}}/>;

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
                {h.map((_,ci)=><Card key={ci} card={{rank:"?",suit:"?"}} faceDown small/>)}
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
  const [roundResult,setRoundResult]=useState(null);
  const [newlyElim,setNewlyElim]=useState([]);
  const [gameWinner,setGameWinner]=useState(null);
  const [wildCard,setWildCard]=useState(null);
  const [timeLeft,setTimeLeft]=useState(30);
  const aiTimer=useRef(null);
  const turnTimerRef=useRef(null);

  function startTurnTimer(){clearInterval(turnTimerRef.current);setTimeLeft(30);turnTimerRef.current=setInterval(()=>{setTimeLeft(p=>{if(p<=1){clearInterval(turnTimerRef.current);return 0;}return p-1;});},1000);}
  useEffect(()=>()=>clearInterval(turnTimerRef.current),[]);

  function deal(ap){
    const a=ap||active;
    const d=shuffleDeck(makeDeck());
    const wc=d[0],dr=d.slice(1);
    const h={};let cur=0;
    for(const name of a){h[name]=dr.slice(cur,cur+5);cur+=5;}
    setWildCard(wc);setStock(dr.slice(cur+1));setPile([dr[cur]]);setHands(h);
    setTurnIdx(0);setDrawFrom(null);setDropIdxs([]);setRoundResult(null);
    setMsg("Pick source · select drop · SWAP");
    startTurnTimer();
  }
  useEffect(()=>{deal();},[]);// eslint-disable-line

  useEffect(()=>{
    if(timeLeft!==0||roundResult||gameWinner)return;
    if(!isMyTurn)return;
    clearInterval(turnTimerRef.current);
    const next=(turnIdx+1)%active.length;
    setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
    setMsg(`⏱ Time's up!`);
    if(!isAI(active[next]))startTurnTimer();
  },[timeLeft]);// eslint-disable-line

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
      if(!isAI(active[next]))startTurnTimer();
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
    else{setRoundResult(null);setRound(r=>r+1);deal();}
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
    clearInterval(turnTimerRef.current);
    const next=(turnIdx+1)%active.length;
    setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
    if(!isAI(active[next]))startTurnTimer();
    setMsg(isAI(active[next])?`${active[next]}'s turn...`:"Pick source · select drop · SWAP");
  }
  function doShow(){if(!isMyTurn)return;clearInterval(turnTimerRef.current);handleClaim(YOU,hands[YOU],wildCard);}

  const myHand=hands[YOU]||[];
  const pileTop=pile[pile.length-1]||null;
  const readySwap=isMyTurn&&drawFrom!==null&&dropIdxs.length>0;

  if(gameWinner)return <GameOverBanner winner={gameWinner} onPlayAgain={()=>{setGameWinner(null);onQuit();}} onQuit={onQuit}/>;
  if(roundResult)return <RoundResult round={round} roundResult={roundResult} allPlayers={allPlayers} scores={scores} scoreLimit={scoreLimit} penaltyPoints={penaltyPoints} onNext={nextRound} canNext={true}/>;
  if(newlyElim.length>0)return <EliminatedBanner name={newlyElim[0]} onClose={()=>{setNewlyElim([]);setRound(r=>r+1);deal();}}/>;

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
                  {h.map((_,ci)=><Card key={ci} card={{rank:"?",suit:"?"}} faceDown small/>)}
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