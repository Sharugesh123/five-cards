import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue, update } from "firebase/database";

// ─── Firebase Setup ───────────────────────────────────────────────────────────
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

// ─── Deck Setup ───────────────────────────────────────────────────────────────
const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RANK_PTS = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:10,Q:10,K:10};
const AI_NAMES = ["Muthu","Priya","Rajan"];

function genCode(){ return Math.random().toString(36).substring(2,7).toUpperCase(); }
function makeDeck(){
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r,pts:RANK_PTS[r],id:`${r}-${s}`});
  return d; // 52 cards, no Jokers
}
function shuffleDeck(d){const a=[...d];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function cardPts(card,jokerCard){
  if(jokerCard&&card.rank===jokerCard.rank&&card.suit===jokerCard.suit)return 0;
  return card.pts;
}
function handTotal(cards,jokerCard){return cards.reduce((s,c)=>s+cardPts(c,jokerCard),0);}

// ─── Card Component ───────────────────────────────────────────────────────────
function PlayingCard({card,faceDown,selected,glowing,small,onClick,badge}){
  if(!card)return null;
  const w=small?46:68,h=small?68:100;
  const isRed=card.suit==="♥"||card.suit==="♦";
  const bc=selected?"#facc15":glowing?"#4ade80":"#d1d5db";
  const bw=(selected||glowing)?3:2;
  const sh=selected?"0 0 14px rgba(250,204,21,.8),0 4px 8px rgba(0,0,0,.3)":glowing?"0 0 14px rgba(74,222,128,.7),0 4px 8px rgba(0,0,0,.3)":"0 2px 6px rgba(0,0,0,.2)";
  const ty=selected?-12:glowing?-5:0;
  return(
    <div style={{position:"relative",display:"inline-block"}}>
      {badge&&<div style={{position:"absolute",top:-17,left:"50%",transform:"translateX(-50%)",background:selected?"#facc15":"#4ade80",color:"#000",fontSize:9,fontWeight:900,borderRadius:5,padding:"2px 6px",whiteSpace:"nowrap",zIndex:5}}>{badge}</div>}
      <div onClick={onClick} style={{width:w,height:h,borderRadius:8,border:`${bw}px solid ${bc}`,boxShadow:sh,transform:`translateY(${ty}px)`,transition:"all .15s",cursor:onClick?"pointer":"default",userSelect:"none",flexShrink:0,display:"flex",flexDirection:"column",justifyContent:"space-between",background:faceDown?"linear-gradient(135deg,#1e3a5f,#0f2447)":"#fff",padding:small?"3px 4px":"5px 7px"}}>
        {faceDown?(
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",opacity:.35}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:3}}>
              {["♠","♥","♦","♣","♠","♥","♦","♣","♠"].map((s,i)=><div key={i} style={{fontSize:9,color:i%2===0?"#e63946":"#fff",textAlign:"center"}}>{s}</div>)}
            </div>
          </div>
):(
          <>
            <div style={{fontSize:small?11:14,fontWeight:900,color:isRed?"#dc2626":"#111",lineHeight:1.1}}>{card.rank}<br/><span style={{fontSize:small?9:11}}>{card.suit}</span></div>
            <div style={{fontSize:small?17:25,textAlign:"center",color:isRed?"#dc2626":"#111"}}>{card.suit}</div>
            <div style={{fontSize:small?11:14,fontWeight:900,color:isRed?"#dc2626":"#111",lineHeight:1.1,textAlign:"right",transform:"rotate(180deg)"}}>{card.rank}<br/><span style={{fontSize:small?9:11}}>{card.suit}</span></div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Rules Modal ──────────────────────────────────────────────────────────────
function RulesModal({onClose,limit}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:480,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:900}}>📋 Rules</h2>
          <button onClick={onClose} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:8,width:32,height:32,fontSize:16,fontWeight:900,cursor:"pointer"}}>✕</button>
        </div>
        {[
          ["Goal",`Lowest points when someone claims wins the round. Reach ${limit||300} pts = eliminated. Last player standing wins!`],
          ["Card Points","A=1 · 2–9=face value · 10/J/Q/K=10 · Wild card shown at start=0"],
          ["Your Turn","Tap Stock OR top Discard (green=draw source). Tap a hand card (yellow=drop). Tap SWAP!"],
          ["Multi-Drop","Select multiple same-rank cards to drop all at once."],
          ["SHOW","Tap SHOW to claim lowest hand. Wrong = double penalty."],
          ["Wild Card","One card is revealed face-up at the start of each round. Any card of that rank AND suit is worth 0 points!"],
          ["Friends Mode","Create a room → share 5-letter code → friends join from any device → play together online!"],
        ].map(([t,b])=>(
          <div key={t} style={{marginBottom:12}}>
            <div style={{fontWeight:900,fontSize:13,marginBottom:3}}>{t}</div>
            <div style={{fontSize:13,color:"#555",lineHeight:1.5}}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Banners ──────────────────────────────────────────────────────────────────
function EliminatedBanner({name,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"36px 40px",textAlign:"center",maxWidth:320,width:"92%"}}>
        <div style={{fontSize:64,marginBottom:12}}>💀</div>
        <h2 style={{margin:"0 0 8px",fontSize:26,fontWeight:900,color:"#dc2626"}}>ELIMINATED!</h2>
        <p style={{fontSize:15,color:"#555",margin:"0 0 24px"}}><strong>{name}</strong> has reached the score limit and is out!</p>
        <button onClick={onClose} style={{background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:12,padding:"13px 32px",fontSize:16,fontWeight:900,cursor:"pointer"}}>Continue</button>
      </div>
    </div>
  );
}

function GameOverBanner({winner,onPlayAgain,onQuit}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"linear-gradient(135deg,#1e3a5f,#0f2447)",borderRadius:24,padding:"40px 36px",textAlign:"center",maxWidth:340,width:"92%"}}>
        <div style={{fontSize:72,marginBottom:12}}>🏆</div>
        <h2 style={{margin:"0 0 8px",fontSize:28,fontWeight:900,color:"#facc15"}}>WINNER!</h2>
        <p style={{fontSize:20,color:"#fff",margin:"0 0 28px",fontWeight:700}}>{winner}</p>
        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <button onClick={onPlayAgain} style={{background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:12,padding:"13px 22px",fontSize:15,fontWeight:900,cursor:"pointer"}}>Play Again</button>
          <button onClick={onQuit}      style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:12,padding:"13px 22px",fontSize:15,fontWeight:900,cursor:"pointer"}}>Quit</button>
        </div>
      </div>
    </div>
  );
}

// ─── Pass-and-Play Turn Gate ──────────────────────────────────────────────────
function TurnGate({playerName,onReady}){
  return(
    <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#1e3a5f,#0f2447)",zIndex:250,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",padding:"0 24px"}}>
        <div style={{fontSize:64,marginBottom:16}}>🃏</div>
        <h2 style={{color:"#facc15",fontSize:28,fontWeight:900,margin:"0 0 8px"}}>{playerName}'s Turn</h2>
        <p style={{color:"rgba(255,255,255,.7)",fontSize:15,margin:"0 0 32px"}}>Hand the device to <strong style={{color:"#fff"}}>{playerName}</strong></p>
        <button onClick={onReady} style={{background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:16,padding:"16px 48px",fontSize:18,fontWeight:900,cursor:"pointer"}}>I'm Ready! →</button>
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({onPlayAI,onPlayFriends}){
  const [players,setPlayers]=useState(2);
  const [limit,setLimit]=useState(300);
  const [rules,setRules]=useState(false);
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f59e0b,#d97706)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:20}}>
      <div style={{background:"rgba(255,255,255,.15)",borderRadius:24,padding:"32px 26px",textAlign:"center",maxWidth:380,width:"100%",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.3)"}}>
        <div style={{fontSize:44,marginBottom:4}}>🃏</div>
        <h1 style={{margin:"0 0 4px",fontSize:46,fontWeight:900,color:"#fff",letterSpacing:2}}>5 CARDS</h1>
        <p style={{margin:"0 0 24px",color:"rgba(255,255,255,.85)",fontSize:13,letterSpacing:1}}>SWAP · CLAIM · SURVIVE</p>

        <div style={{background:"rgba(255,255,255,.92)",borderRadius:16,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Elimination Score</div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            {[100,200,300].map(v=>(
              <button key={v} onClick={()=>setLimit(v)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:900,background:limit===v?"#dc2626":"#fef2f2",color:limit===v?"#fff":"#7f1d1d",transform:limit===v?"scale(1.05)":"scale(1)"}}>{v}</button>
            ))}
          </div>
          <div style={{fontSize:11,color:"#92400e",marginTop:7}}>First to <strong>{limit} pts</strong> = eliminated 💀</div>
        </div>

        <div style={{background:"rgba(255,255,255,.92)",borderRadius:16,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>🤖 Play vs AI</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:12}}>
            {[2,3,4].map(n=>(
              <button key={n} onClick={()=>setPlayers(n)} style={{width:50,height:50,borderRadius:12,border:"none",cursor:"pointer",fontSize:20,fontWeight:900,background:players===n?"#d97706":"#fef3c7",color:players===n?"#fff":"#78350f",transform:players===n?"scale(1.1)":"scale(1)"}}>{n}</button>
            ))}
          </div>
          <button onClick={()=>onPlayAI(players,limit)} style={{width:"100%",background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer"}}>▶ Play vs AI</button>
        </div>

        <div style={{background:"rgba(255,255,255,.92)",borderRadius:16,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>👫 Play with Friends</div>
          <div style={{fontSize:12,color:"#555",marginBottom:10}}>🌐 Real online multiplayer — play from different devices!</div>
          <button onClick={()=>onPlayFriends(limit)} style={{width:"100%",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer"}}>🎮 Create / Join Room</button>
        </div>

        <button onClick={()=>setRules(true)} style={{width:"100%",background:"rgba(255,255,255,.2)",color:"#fff",border:"2px solid rgba(255,255,255,.5)",borderRadius:12,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer"}}>📋 Rules</button>
      </div>
      {rules&&<RulesModal onClose={()=>setRules(false)} limit={limit}/>}
    </div>
  );
}

// ─── Firebase Friends Lobby ───────────────────────────────────────────────────
function FriendsLobby({scoreLimit,onStart,onBack}){
  const [mode,    setMode]   =useState(null);
  const [myName,  setMyName] =useState("");
  const [joinCode,setJoinCode]=useState("");
  const [room,    setRoom]   =useState(null);
  const [myCode,  setMyCode] =useState("");
  const [error,   setError]  =useState("");
  const [maxP,    setMaxP]   =useState(4);
  const [loading, setLoading]=useState(false);
  const unsubRef=useRef(null);

  async function createRoom(){
    if(!myName.trim()){setError("Enter your name first!");return;}
    setLoading(true);
    const c=genCode();
    const roomData={
      code:c, host:myName.trim(),
      players:[myName.trim()],
      maxPlayers:maxP,
      scoreLimit,
      started:false,
      createdAt:Date.now(),
    };
    await set(ref(db,`rooms/${c}`),roomData);
    setMyCode(c);
    setLoading(false);
    setError("");
    listenToRoom(c);
  }

  async function joinRoom(){
    if(!myName.trim()){setError("Enter your name first!");return;}
    if(!joinCode.trim()){setError("Enter the room code!");return;}
    const c=joinCode.trim().toUpperCase();
    setLoading(true);
    const snap=await get(ref(db,`rooms/${c}`));
    if(!snap.exists()){setError("Room not found! Check the code.");setLoading(false);return;}
    const r=snap.val();
    if(r.started){setError("Game already started!");setLoading(false);return;}
    if(r.players.length>=r.maxPlayers){setError("Room is full!");setLoading(false);return;}
    if(r.players.includes(myName.trim())){setError("Name already taken!");setLoading(false);return;}
    await update(ref(db,`rooms/${c}`),{players:[...r.players,myName.trim()]});
    setMyCode(c);
    setLoading(false);
    setError("");
    listenToRoom(c);
  }

  function listenToRoom(c){
    if(unsubRef.current) unsubRef.current();
    const unsub=onValue(ref(db,`rooms/${c}`),(snap)=>{
      if(!snap.exists()) return;
      const r=snap.val();
      setRoom(r);
      if(r.started) onStart(r.players, r.scoreLimit, c, myName);
    });
    unsubRef.current=unsub;
  }

  async function startGame(){
    if(!room||room.players.length<2){setError("Need at least 2 players!");return;}
    // Deal cards and save to Firebase
    const ap=room.players;
    const d=shuffleDeck(makeDeck());
    const wildCard=d[0]; // first card revealed as wild (worth 0)
    const deckRest=d.slice(1);
    const hands={};let cur=0;
    for(const name of ap){hands[name]=deckRest.slice(cur,cur+5);cur+=5;}
    const gameState={
      stock:deckRest.slice(cur+1),
      pile:[deckRest[cur]],
      wildCard,
      hands,
      scores:Object.fromEntries(ap.map(p=>[p,0])),
      eliminated:[],
      activePlayers:ap,
      turnIdx:0,
      round:1,
      roundResult:null,
      gameWinner:null,
      lastAction:Date.now(),
    };
    await update(ref(db,`rooms/${room.code}`),{started:true, gameState});
  }

  useEffect(()=>{ return()=>{ if(unsubRef.current) unsubRef.current(); }; },[]);

  const isHost=room&&room.host===myName.trim();

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#7c3aed,#5b21b6)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:20}}>
      <div style={{background:"rgba(255,255,255,.12)",borderRadius:24,padding:"28px 24px",maxWidth:380,width:"100%",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.25)"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",fontSize:13,cursor:"pointer",marginBottom:16,padding:0}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:36,marginBottom:4}}>👫</div>
          <h2 style={{margin:0,color:"#fff",fontSize:22,fontWeight:900}}>Play with Friends</h2>
          <p style={{margin:"4px 0 0",color:"rgba(255,255,255,.7)",fontSize:12}}>🌐 Real online — play from different devices!</p>
        </div>

        {!room&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Your Name</div>
            <input value={myName} onChange={e=>setMyName(e.target.value)} placeholder="Enter your name..."
              style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"2px solid rgba(255,255,255,.3)",background:"rgba(255,255,255,.15)",color:"#fff",fontSize:15,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
          </div>
        )}

        {!room&&!mode&&(
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <button onClick={()=>setMode("create")} style={{flex:1,background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:900,cursor:"pointer"}}>➕ Create Room</button>
            <button onClick={()=>setMode("join")}   style={{flex:1,background:"rgba(255,255,255,.2)",color:"#fff",border:"2px solid rgba(255,255,255,.4)",borderRadius:12,padding:"13px",fontSize:15,fontWeight:900,cursor:"pointer"}}>🔑 Join Room</button>
          </div>
        )}

        {!room&&mode==="create"&&(
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Max Players</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[2,3,4].map(n=>(
                <button key={n} onClick={()=>setMaxP(n)} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",fontSize:16,fontWeight:900,background:maxP===n?"#facc15":"rgba(255,255,255,.15)",color:maxP===n?"#1e3a5f":"#fff"}}>{n}</button>
              ))}
            </div>
            <button onClick={createRoom} disabled={loading} style={{width:"100%",background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer",marginBottom:8,opacity:loading?.6:1}}>
              {loading?"Creating...":"Create Room"}
            </button>
            <button onClick={()=>setMode(null)} style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,.6)",fontSize:13,cursor:"pointer"}}>← Back</button>
          </div>
        )}

        {!room&&mode==="join"&&(
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Room Code</div>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={5} placeholder="e.g. A1B2C"
              style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"2px solid rgba(255,255,255,.3)",background:"rgba(255,255,255,.15)",color:"#fff",fontSize:18,fontWeight:900,outline:"none",letterSpacing:4,textAlign:"center",boxSizing:"border-box",marginBottom:12}}/>
            <button onClick={joinRoom} disabled={loading} style={{width:"100%",background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer",marginBottom:8,opacity:loading?.6:1}}>
              {loading?"Joining...":"Join Room"}
            </button>
            <button onClick={()=>setMode(null)} style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,.6)",fontSize:13,cursor:"pointer"}}>← Back</button>
          </div>
        )}

        {room&&(
          <div>
            <div style={{background:"rgba(255,255,255,.15)",borderRadius:14,padding:"14px",textAlign:"center",marginBottom:14,border:"2px dashed rgba(255,255,255,.4)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",marginBottom:4,textTransform:"uppercase",letterSpacing:2}}>Room Code</div>
              <div style={{fontSize:36,fontWeight:900,color:"#facc15",letterSpacing:8}}>{myCode}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:4}}>Share this with friends 📲</div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Players ({room.players.length}/{room.maxPlayers})</div>
              {room.players.map((p,i)=>(
                <div key={p} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.12)",borderRadius:10,padding:"10px 14px",marginBottom:6,border:p===myName.trim()?"2px solid #facc15":"2px solid transparent"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{i===0?"👑":"👤"}</div>
                  <span style={{color:"#fff",fontWeight:700,fontSize:14,flex:1}}>{p}</span>
                  {p===myName.trim()&&<span style={{fontSize:11,color:"#facc15",fontWeight:700}}>(You)</span>}
                  {i===0&&p!==myName.trim()&&<span style={{fontSize:11,color:"#facc15",fontWeight:700}}>Host</span>}
                </div>
              ))}
              {Array(room.maxPlayers-room.players.length).fill(0).map((_,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.05)",borderRadius:10,padding:"10px 14px",marginBottom:6,border:"2px dashed rgba(255,255,255,.15)"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,opacity:.4}}>⏳</div>
                  <span style={{color:"rgba(255,255,255,.35)",fontSize:13}}>Waiting for player...</span>
                </div>
              ))}
            </div>

            {isHost?(
              <button onClick={startGame} disabled={room.players.length<2}
                style={{width:"100%",background:room.players.length>=2?"#facc15":"rgba(255,255,255,.2)",color:room.players.length>=2?"#1e3a5f":"rgba(255,255,255,.4)",border:"none",borderRadius:12,padding:"14px",fontSize:16,fontWeight:900,cursor:room.players.length>=2?"pointer":"not-allowed"}}>
                {room.players.length>=2?"🚀 Start Game!":"Waiting for players..."}
              </button>
            ):(
              <div style={{textAlign:"center",padding:"12px",background:"rgba(255,255,255,.1)",borderRadius:12}}>
                <div style={{fontSize:22,marginBottom:4}}>⏳</div>
                <div style={{color:"rgba(255,255,255,.8)",fontSize:14,fontWeight:700}}>Waiting for host to start...</div>
              </div>
            )}
          </div>
        )}

        {error&&<div style={{marginTop:12,background:"rgba(220,38,38,.3)",border:"1px solid rgba(220,38,38,.6)",borderRadius:10,padding:"10px 14px",color:"#fca5a5",fontSize:13,fontWeight:700,textAlign:"center"}}>{error}</div>}
      </div>
    </div>
  );
}

// ─── Online Game Screen (Firebase) ────────────────────────────────────────────
function OnlineGameScreen({roomCode,myName,onQuit}){
  const [gs,setGs]=useState(null); // game state from Firebase
  const [drawFrom,setDrawFrom]=useState(null);
  const [dropIdxs,setDropIdxs]=useState([]);
  const [msg,setMsg]=useState("");
  const [showRules,setShowRules]=useState(false);
  const [showGate,setShowGate]=useState(false);
  const [newlyElim,setNewlyElim]=useState([]);
  const unsubRef=useRef(null);
  const prevTurnRef=useRef(null);

  useEffect(()=>{
    const unsub=onValue(ref(db,`rooms/${roomCode}/gameState`),(snap)=>{
      if(!snap.exists())return;
      const g=snap.val();
      setGs(g);
      const curPlayer=g.activePlayers[g.turnIdx];
      if(curPlayer===myName && prevTurnRef.current!==g.turnIdx){
        prevTurnRef.current=g.turnIdx;
        setDrawFrom(null);setDropIdxs([]);
        setShowGate(true);
        setMsg("Pick source, select drop card, then SWAP");
      }
      if(g.roundResult?.justElim?.length>0 && !g.roundResult.shown){
        setNewlyElim(g.roundResult.justElim);
      }
    });
    unsubRef.current=unsub;
    return()=>unsub();
  },[roomCode,myName]);

  if(!gs) return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#1e3a5f,#0f2447)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",color:"#fff"}}>
        <div style={{fontSize:48,marginBottom:16}}>⏳</div>
        <div style={{fontSize:18,fontWeight:700}}>Loading game...</div>
      </div>
    </div>
  );

  const {stock,pile,hands,scores,activePlayers,turnIdx,round,roundResult,gameWinner,eliminated,scoreLimit} = gs;
  const currentPlayer=activePlayers[turnIdx];
  const isMyTurn=currentPlayer===myName;
  const myHand=hands?.[myName]||[];
  const pileTop=pile?.[pile.length-1]||null;
  const readySwap=isMyTurn&&drawFrom!==null&&dropIdxs.length>0;
  const allPlayers=gs.allPlayers||activePlayers;

  async function pushGs(updates){
    await update(ref(db,`rooms/${roomCode}/gameState`),updates);
  }

  function advanceTurn(newStock,newPile,newHands,newScores,newEliminated,newActive){
    const next=(turnIdx+1)%newActive.length;
    pushGs({
      stock:newStock||stock,
      pile:newPile||pile,
      hands:newHands||hands,
      scores:newScores||scores,
      eliminated:newEliminated||eliminated,
      activePlayers:newActive||activePlayers,
      turnIdx:next,
      lastAction:Date.now(),
    });
  }

  function selStock(){if(!isMyTurn)return;setDrawFrom(p=>p==="stock"?null:"stock");}
  function selPile(){if(!isMyTurn||!pile?.length)return;setDrawFrom(p=>p==="pile"?null:"pile");}
  function toggleDrop(idx){
    if(!isMyTurn)return;
    setDropIdxs(p=>{
      if(p.includes(idx))return p.filter(i=>i!==idx);
      if(p.length>0&&myHand[p[0]].rank!==myHand[idx].rank){setMsg("Multi-drop: same rank only!");return p;}
      return[...p,idx];
    });
  }

  async function doSwap(){
    if(!drawFrom){setMsg("Tap Stock or Discard first!");return;}
    if(!dropIdxs.length){setMsg("Tap a card in your hand to drop!");return;}
    const dropping=dropIdxs.map(i=>myHand[i]);
    let drew,ns=[...stock],np=[...pile];
    if(drawFrom==="stock"){if(!stock.length){setMsg("Stock empty!");return;}drew=stock[0];ns=stock.slice(1);}
    else{if(!pile.length){setMsg("Discard empty!");return;}drew=pile[pile.length-1];np=pile.slice(0,-1);}
    const kept=myHand.filter((_,i)=>!dropIdxs.includes(i));
    np=[...np,...dropping];
    const newHands={...hands,[myName]:[...kept,drew]};
    const next=(turnIdx+1)%activePlayers.length;
    await pushGs({stock:ns,pile:np,hands:newHands,turnIdx:next,lastAction:Date.now(),
});
    setDrawFrom(null);setDropIdxs([]);
  }

  async function doShow(){
    if(!isMyTurn)return;
    const claimerHand=myHand;
    const wc=gs.wildCard||null;
    const results=activePlayers.map(name=>({name,hand:hands[name]||[],pts:handTotal(hands[name]||[],wc)}));
    const claimerPts=handTotal(claimerHand,wc);
    const lowestPts=Math.min(...results.map(r=>r.pts));
    const claimerWon=claimerPts===lowestPts;
    const newScores={...scores};
    if(claimerWon){results.forEach(r=>{if(r.name!==myName)newScores[r.name]=(newScores[r.name]||0)+r.pts;});}
    else{results.forEach(r=>{newScores[r.name]=(newScores[r.name]||0)+(r.name===myName?r.pts*2:r.pts);});}
    const sl=scoreLimit||gs.scoreLimit||300;
    const justElim=activePlayers.filter(n=>newScores[n]>=sl&&!(eliminated||[]).includes(n));
    const newElim=[...(eliminated||[]),...justElim];
    const newActive=activePlayers.filter(n=>!newElim.includes(n));
    const winner=newActive.length<=1?newActive[0]||activePlayers[0]:null;
    await pushGs({
      scores:newScores,eliminated:newElim,activePlayers:newActive,
      roundResult:{results,claimerName:myName,claimerWon,claimerPts,lowestPts,justElim,newScores,shown:false},
      gameWinner:winner,
      lastAction:Date.now(),
    });
  }

  async function nextRound(){
    const ap=gs.activePlayers;
    const d=shuffleDeck(makeDeck());
    const wildCard=d[0];
    const deckRest=d.slice(1);
    const h={};let cur=0;
    for(const name of ap){h[name]=deckRest.slice(cur,cur+5);cur+=5;}
    await pushGs({
      stock:deckRest.slice(cur+1),pile:[deckRest[cur]],wildCard,hands:h,
      turnIdx:0,round:(round||1)+1,
      roundResult:null,lastAction:Date.now(),
    });
  }

  // ── GAME OVER
  if(gameWinner) return <GameOverBanner winner={gameWinner} onPlayAgain={onQuit} onQuit={onQuit}/>;

  // ── ROUND RESULT
  if(roundResult){
    const sl=scoreLimit||gs.scoreLimit||300;
    return(
      <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f59e0b,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:16}}>
        <div style={{background:"#fff",borderRadius:20,padding:"22px 20px",maxWidth:440,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
          <div style={{textAlign:"center",marginBottom:14}}>
            <div style={{fontSize:44}}>{roundResult.claimerWon?"🎉":"😬"}</div>
            <h2 style={{margin:"4px 0",fontSize:20,fontWeight:900}}>Round {round}</h2>
            <p style={{margin:0,color:roundResult.claimerWon?"#059669":"#dc2626",fontWeight:700,fontSize:13}}>
              {roundResult.claimerWon?`${roundResult.claimerName} wins! (${roundResult.claimerPts} pts)`:`${roundResult.claimerName} mis-claimed! (had ${roundResult.claimerPts}, min ${roundResult.lowestPts})`}
            </p>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:900,color:"#92400e",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Hands</div>
            {roundResult.results.map(r=>(
              <div key={r.name} style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4,marginBottom:7}}>
                <span style={{fontWeight:700,fontSize:12,minWidth:55}}>{r.name}:</span>
                {r.hand.map((c,i)=><PlayingCard key={i} card={c} small/>)}
                <span style={{fontWeight:900,fontSize:12,marginLeft:3,color:r.pts<=15?"#059669":"#dc2626"}}>{r.pts}pt</span>
              </div>
            ))}
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:900,color:"#92400e",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Scores (limit: {sl})</div>
            {(roundResult.results||[]).map(({name})=>{
              const sc=roundResult.newScores?.[name]||0;
              const isElim=(roundResult.justElim||[]).includes(name)||(eliminated||[]).includes(name);
              const pct=Math.min(100,(sc/sl)*100);
              return(
                <div key={name} style={{marginBottom:7,opacity:isElim?.5:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:12}}>{isElim?"💀 ":""}{name}{(roundResult.justElim||[]).includes(name)&&<span style={{background:"#dc2626",color:"#fff",fontSize:9,fontWeight:900,borderRadius:4,padding:"1px 5px",marginLeft:5}}>OUT</span>}</span>
                    <span style={{fontWeight:900,fontSize:12,color:sc>=sl?"#dc2626":sc>sl*.7?"#f97316":"#059669"}}>{sc}/{sl}</span>
                  </div>
                  <div style={{height:5,background:"#f3f4f6",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:sc>=sl?"#dc2626":sc>sl*.7?"#f97316":"#059669",borderRadius:3}}/>
                  </div>
                </div>
              );
            })}
          </div>
          {isMyTurn||roundResult.claimerName===myName?(
            <button onClick={nextRound} style={{width:"100%",background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:12,padding:13,fontSize:14,fontWeight:900,cursor:"pointer"}}>Next Round →</button>
          ):(
            <div style={{textAlign:"center",padding:12,color:"#666",fontSize:13}}>Waiting for {roundResult.claimerName} to continue...</div>
          )}
        </div>
      </div>
    );
  }

  if(newlyElim.length>0) return <EliminatedBanner name={newlyElim[0]} onClose={()=>setNewlyElim([])}/>;
  if(showGate&&isMyTurn) return <TurnGate playerName={myName} onReady={()=>setShowGate(false)}/>;

  const sl=scoreLimit||gs.scoreLimit||300;

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f59e0b,#d97706)",fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <div style={{background:"rgba(0,0,0,.2)",padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:"#fff",fontWeight:900,fontSize:14}}>5 CARDS · Round {round} 🌐</span>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setShowRules(true)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer"}}>RULES</button>
          <button onClick={onQuit} style={{background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer"}}>EXIT</button>
        </div>
      </div>

      {/* Score bars */}
      <div style={{display:"flex",gap:5,padding:"6px 10px",overflowX:"auto"}}>
        {activePlayers.map(name=>{
          const sc=scores?.[name]||0;
          const pct=Math.min(100,(sc/sl)*100);
          const isElim=(eliminated||[]).includes(name);
          const isCur=currentPlayer===name;
          return(
            <div key={name} style={{flex:1,minWidth:65,background:isElim?"rgba(0,0,0,.1)":"rgba(255,255,255,.85)",borderRadius:9,padding:"5px 7px",border:isCur?"2px solid #facc15":"2px solid transparent",opacity:isElim?.4:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:10,fontWeight:900,color:"#1e3a5f",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:65}}>{isCur?"▶":""} {name=== myName?"You":name}</span>
                <span style={{fontSize:10,fontWeight:900,color:sc>=sl*.8?"#dc2626":"#059669"}}>{sc}</span>
              </div>
              <div style={{height:4,background:"#e5e7eb",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:sc>=sl*.8?"#dc2626":sc>sl*.5?"#f97316":"#059669",borderRadius:3}}/>
              </div>
              <div style={{fontSize:8,color:"#92400e",textAlign:"right"}}>/{sl}</div>
            </div>
          );
        })}
      </div>

      {/* Other players */}
      <div style={{display:"flex",gap:8,padding:"6px 10px",justifyContent:"center",flexWrap:"wrap"}}>
        {activePlayers.filter(n=>n!==myName).map(name=>{
          const h=hands?.[name]||[];
          const isCur=currentPlayer===name;
          return(
            <div key={name} style={{background:isCur?"rgba(250,204,21,.9)":"rgba(255,255,255,.78)",borderRadius:12,padding:"7px 11px",textAlign:"center",minWidth:100,border:isCur?"3px solid #facc15":"2px solid transparent"}}>
              <div style={{fontSize:16,marginBottom:2}}>👤</div>
              <div style={{fontWeight:900,fontSize:11,marginBottom:4}}>{name}{isCur?" ⏳":""}</div>
              <div style={{display:"flex",gap:2,justifyContent:"center"}}>
                {h.map((_,ci)=><PlayingCard key={ci} card={{rank:"?",suit:"?"}} faceDown small/>)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:24,flexWrap:"wrap"}}>

        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#facc15",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>🃏 Wild (0pt)</div>
          {gs.wildCard
            ?<PlayingCard card={gs.wildCard}/>
            :<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>
          }
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Stock ({stock?.length||0})</div>
          {stock?.length>0
            ?<PlayingCard card={stock[0]} faceDown glowing={isMyTurn&&drawFrom==="stock"} onClick={isMyTurn?selStock:undefined} badge={drawFrom==="stock"?"✓ Draw here":null}/>
            :<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>
          }
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Discard</div>
          {pileTop
            ?<PlayingCard card={pileTop} glowing={isMyTurn&&drawFrom==="pile"} onClick={isMyTurn?selPile:undefined} badge={drawFrom==="pile"?"✓ Draw here":null}/>
            :<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>
          }
        </div>
      </div>

      {isMyTurn&&(
        <div style={{textAlign:"center",paddingBottom:4}}>
          <div style={{display:"inline-flex",gap:6,background:"rgba(0,0,0,.25)",borderRadius:20,padding:"5px 14px"}}>
            <span style={{fontSize:12,fontWeight:700,color:drawFrom?"#4ade80":"rgba(255,255,255,.4)"}}>{drawFrom?"✓":"○"} Source</span>
            <span style={{color:"rgba(255,255,255,.3)"}}>·</span>
            <span style={{fontSize:12,fontWeight:700,color:dropIdxs.length?"#facc15":"rgba(255,255,255,.4)"}}>{dropIdxs.length?"✓":"○"} Drop</span>
            <span style={{color:"rgba(255,255,255,.3)"}}>·</span>
            <span style={{fontSize:12,fontWeight:700,color:readySwap?"#4ade80":"rgba(255,255,255,.4)"}}>{readySwap?"✓ Ready!":"○ Swap"}</span>
          </div>
        </div>
      )}

      <div style={{textAlign:"center",padding:"4px 14px 4px"}}>
        <div style={{display:"inline-block",background:"rgba(0,0,0,.5)",color:"#facc15",borderRadius:10,padding:"6px 16px",fontSize:13,fontWeight:700}}>
          {isMyTurn?msg:`${currentPlayer}'s turn...`}
        </div>
      </div>

      {/* My hand */}
      <div style={{background:"rgba(0,0,0,.25)",padding:"9px 12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
          <span style={{color:"#fff",fontWeight:900,fontSize:13}}>You · {handTotal(myHand,wildCard)} pts</span>
          {isMyTurn&&(
            <div style={{display:"flex",gap:7}}>
              <button onClick={doSwap} disabled={!readySwap} style={{background:readySwap?"#059669":"#6b7280",color:"#fff",border:"none",borderRadius:10,padding:"8px 13px",fontSize:13,fontWeight:900,cursor:readySwap?"pointer":"not-allowed"}}>⇄ SWAP</button>
              <button onClick={doShow} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:900,cursor:"pointer"}}>📢 SHOW</button>
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap",paddingTop:18}}>
          {myHand.map((card,idx)=>(
            <PlayingCard key={card.id} card={card} selected={dropIdxs.includes(idx)} onClick={isMyTurn?()=>toggleDrop(idx):undefined} badge={dropIdxs.includes(idx)?"Drop":null}/>
          ))}
        </div>
        {!isMyTurn&&<div style={{textAlign:"center",marginTop:8,fontSize:12,color:"rgba(255,255,255,.5)",fontWeight:600}}>Waiting for {currentPlayer}...</div>}
      </div>


      {showRules&&<RulesModal onClose={()=>setShowRules(false)} limit={sl}/>}
    </div>
  );
}

// ─── AI Game Screen ───────────────────────────────────────────────────────────
function AIGameScreen({players,scoreLimit,onQuit}){
  const allPlayers=players;
  const YOU=players[0];
  const isAI=name=>name!==YOU;

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
  const aiTimer=useRef(null);


  function deal(ap){
    const a=ap||active;
    const d=shuffleDeck(makeDeck());
    const h={};let cur=0;
    for(const name of a){h[name]=d.slice(cur,cur+5);cur+=5;}
    const wc=d[0];
    const dr=d.slice(1);
    const h2={};let c2=0;
    for(const name of a){h2[name]=dr.slice(c2,c2+5);c2+=5;}
    setWildCard(wc);
    setStock(dr.slice(c2+1));setPile([dr[c2]]);setHands(h2);
    setTurnIdx(0);setDrawFrom(null);setDropIdxs([]);setRoundResult(null);
    setMsg("Pick source, select drop card, then SWAP");
  }

  useEffect(()=>{deal();},[]);// eslint-disable-line

  const currentPlayer=active[turnIdx];
  const isMyTurn=currentPlayer===YOU;

  useEffect(()=>{
    if(roundResult||gameWinner)return;
    if(!isAI(currentPlayer))return;
    aiTimer.current=setTimeout(()=>{
      const hand=hands[currentPlayer];
      if(!hand)return;
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
      setStock(ns);setPile(np);
      setHands(p=>({...p,[currentPlayer]:nh}));
      const next=(turnIdx+1)%active.length;
      setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
      setMsg(isAI(active[next])?`${active[next]}'s turn...`:"Pick source, select drop card, then SWAP");
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
    else{results.forEach(r=>{newScores[r.name]=(newScores[r.name]||0)+(r.name===claimerName?r.pts*2:r.pts);});}
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
      if(p.length>0&&hand[p[0]].rank!==hand[idx].rank){setMsg("Multi-drop: same rank only!");return p;}
      return[...p,idx];
    });
  }
  function doSwap(){
    if(!drawFrom){setMsg("Tap Stock or Discard first!");return;}
    if(!dropIdxs.length){setMsg("Tap a card in your hand to drop!");return;}
    const hand=hands[YOU];
    const dropping=dropIdxs.map(i=>hand[i]);
    let drew,ns=[...stock],np=[...pile];
    if(drawFrom==="stock"){if(!stock.length){setMsg("Stock empty!");return;}drew=stock[0];ns=stock.slice(1);}
    else{if(!pile.length){setMsg("Discard empty!");return;}drew=pile[pile.length-1];np=pile.slice(0,-1);}
    const kept=hand.filter((_,i)=>!dropIdxs.includes(i));
    np=[...np,...dropping];
    setStock(ns);setPile(np);
    setHands(p=>({...p,[YOU]:[...kept,drew]}));
    const next=(turnIdx+1)%active.length;
    setTurnIdx(next);setDrawFrom(null);setDropIdxs([]);
    setMsg(isAI(active[next])?`${active[next]}'s turn...`:"Pick source, select drop card, then SWAP");
  }
  function doShow(){if(!isMyTurn)return;handleClaim(YOU,hands[YOU],wildCard);}

  const myHand=hands[YOU]||[];
  const pileTop=pile[pile.length-1]||null;
  const readySwap=isMyTurn&&drawFrom!==null&&dropIdxs.length>0;

  if(gameWinner)return <GameOverBanner winner={gameWinner} onPlayAgain={()=>{setGameWinner(null);onQuit();}} onQuit={onQuit}/>;

  if(roundResult){
    return(
      <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f59e0b,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:16}}>
        <div style={{background:"#fff",borderRadius:20,padding:"22px 20px",maxWidth:440,width:"100%"}}>
          <div style={{textAlign:"center",marginBottom:14}}>
            <div style={{fontSize:44}}>{roundResult.claimerWon?"🎉":"😬"}</div>
            <h2 style={{margin:"4px 0",fontSize:20,fontWeight:900}}>Round {round}</h2>
            <p style={{margin:0,color:roundResult.claimerWon?"#059669":"#dc2626",fontWeight:700,fontSize:13}}>
              {roundResult.claimerWon?`${roundResult.claimerName} wins! (${roundResult.claimerPts} pts)`:`${roundResult.claimerName} mis-claimed!`}
            </p>
          </div>
          <div style={{marginBottom:12}}>
            {roundResult.results.map(r=>(
              <div key={r.name} style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4,marginBottom:7}}>
                <span style={{fontWeight:700,fontSize:12,minWidth:50}}>{r.name=== YOU?"You":r.name}:</span>
                {r.hand.map((c,i)=><PlayingCard key={i} card={c} small/>)}
                <span style={{fontWeight:900,fontSize:12,marginLeft:3,color:r.pts<=15?"#059669":"#dc2626"}}>{r.pts}pt</span>
              </div>
            ))}
          </div>
          <div style={{marginBottom:16}}>
            {allPlayers.map(name=>{
              const sc=roundResult.newScores[name]||0;
              const isElim=(roundResult.justElim||[]).includes(name)||eliminated.includes(name);
              const pct=Math.min(100,(sc/scoreLimit)*100);
              return(
                <div key={name} style={{marginBottom:7,opacity:isElim?.5:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:12}}>{isElim?"💀 ":""}{name=== YOU?"You":name}</span>
                    <span style={{fontWeight:900,fontSize:12,color:sc>=scoreLimit?"#dc2626":"#059669"}}>{sc}/{scoreLimit}</span>
                  </div>
                  <div style={{height:5,background:"#f3f4f6",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:sc>=scoreLimit?"#dc2626":sc>scoreLimit*.7?"#f97316":"#059669",borderRadius:3}}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={nextRound} style={{flex:1,background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:12,padding:12,fontSize:14,fontWeight:900,cursor:"pointer"}}>Next Round →</button>
            <button onClick={onQuit}   style={{flex:1,background:"#dc2626",color:"#fff",border:"none",borderRadius:12,padding:12,fontSize:14,fontWeight:900,cursor:"pointer"}}>Quit</button>
          </div>
        </div>
      </div>
    );
  }

  if(newlyElim.length>0)return <EliminatedBanner name={newlyElim[0]} onClose={()=>{setNewlyElim([]);setRound(r=>r+1);deal();}}/>;

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f59e0b,#d97706)",fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      <div style={{background:"rgba(0,0,0,.2)",padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:"#fff",fontWeight:900,fontSize:14}}>5 CARDS · Round {round} 🤖</span>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setShowRules(true)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer"}}>RULES</button>
          <button onClick={onQuit} style={{background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer"}}>EXIT</button>
        </div>
      </div>
      <div style={{display:"flex",gap:5,padding:"6px 10px",overflowX:"auto"}}>
        {allPlayers.map(name=>{
          const sc=scores[name]||0;const pct=Math.min(100,(sc/scoreLimit)*100);
          const isElim=eliminated.includes(name);const isCur=active[turnIdx]===name;
          return(
            <div key={name} style={{flex:1,minWidth:65,background:isElim?"rgba(0,0,0,.1)":"rgba(255,255,255,.85)",borderRadius:9,padding:"5px 7px",border:isCur?"2px solid #facc15":"2px solid transparent",opacity:isElim?.4:1}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:10,fontWeight:900,color:"#1e3a5f"}}>{isCur?"▶":""}{name===YOU?"You":name}</span>
                <span style={{fontSize:10,fontWeight:900,color:sc>=scoreLimit*.8?"#dc2626":"#059669"}}>{sc}</span>
              </div>
              <div style={{height:4,background:"#e5e7eb",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:sc>=scoreLimit*.8?"#dc2626":sc>scoreLimit*.5?"#f97316":"#059669",borderRadius:3}}/>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,padding:"6px 10px",justifyContent:"center",flexWrap:"wrap"}}>
        {active.filter(n=>n!==YOU).map(name=>{
          const h=hands[name]||[];const isCur=currentPlayer===name;
          return(
            <div key={name} style={{background:isCur?"rgba(250,204,21,.9)":"rgba(255,255,255,.78)",borderRadius:12,padding:"7px 11px",textAlign:"center",minWidth:100,border:isCur?"3px solid #facc15":"2px solid transparent"}}>
              <div style={{fontSize:16,marginBottom:2}}>🤖</div>
              <div style={{fontWeight:900,fontSize:11,marginBottom:4}}>{name}{isCur?" ⏳":""}</div>
              <div style={{display:"flex",gap:2,justifyContent:"center"}}>{h.map((_,ci)=><PlayingCard key={ci} card={{rank:"?",suit:"?"}} faceDown small/>)}</div>
            </div>
          );
        })}
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:24,flexWrap:"wrap"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#facc15",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>🃏 Wild (0pt)</div>
          {wildCard?<PlayingCard card={wildCard}/>:<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>}
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Stock ({stock.length})</div>
          {stock.length>0?<PlayingCard card={stock[0]} faceDown glowing={isMyTurn&&drawFrom==="stock"} onClick={isMyTurn?selStock:undefined} badge={drawFrom==="stock"?"✓ Draw here":null}/>:<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>}
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Discard</div>
          {pileTop?<PlayingCard card={pileTop} glowing={isMyTurn&&drawFrom==="pile"} onClick={isMyTurn?selPile:undefined} badge={drawFrom==="pile"?"✓ Draw here":null}/>:<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>}
        </div>
      </div>
      {isMyTurn&&(
        <div style={{textAlign:"center",paddingBottom:4}}>
          <div style={{display:"inline-flex",gap:6,background:"rgba(0,0,0,.25)",borderRadius:20,padding:"5px 14px"}}>
            <span style={{fontSize:12,fontWeight:700,color:drawFrom?"#4ade80":"rgba(255,255,255,.4)"}}>{drawFrom?"✓":"○"} Source</span>
            <span style={{color:"rgba(255,255,255,.3)"}}>·</span>
            <span style={{fontSize:12,fontWeight:700,color:dropIdxs.length?"#facc15":"rgba(255,255,255,.4)"}}>{dropIdxs.length?"✓":"○"} Drop</span>
            <span style={{color:"rgba(255,255,255,.3)"}}>·</span>
            <span style={{fontSize:12,fontWeight:700,color:readySwap?"#4ade80":"rgba(255,255,255,.4)"}}>{readySwap?"✓ Ready!":"○ Swap"}</span>
          </div>
        </div>
      )}
      <div style={{textAlign:"center",padding:"4px 14px 4px"}}>
        <div style={{display:"inline-block",background:"rgba(0,0,0,.5)",color:"#facc15",borderRadius:10,padding:"6px 16px",fontSize:13,fontWeight:700}}>{msg}</div>
      </div>
      <div style={{background:"rgba(0,0,0,.25)",padding:"9px 12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
          <span style={{color:"#fff",fontWeight:900,fontSize:13}}>You · {handTotal(myHand,wildCard)} pts</span>
          {isMyTurn&&(
            <div style={{display:"flex",gap:7}}>
              <button onClick={doSwap} disabled={!readySwap} style={{background:readySwap?"#059669":"#6b7280",color:"#fff",border:"none",borderRadius:10,padding:"8px 13px",fontSize:13,fontWeight:900,cursor:readySwap?"pointer":"not-allowed"}}>⇄ SWAP</button>
              <button onClick={doShow} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:900,cursor:"pointer"}}>📢 SHOW</button>
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap",paddingTop:18}}>
          {myHand.map((card,idx)=>(
            <PlayingCard key={card.id} card={card} selected={dropIdxs.includes(idx)} onClick={isMyTurn?()=>toggleDrop(idx):undefined} badge={dropIdxs.includes(idx)?"Drop":null}/>
          ))}
        </div>
      </div>

      {showRules&&<RulesModal onClose={()=>setShowRules(false)} limit={scoreLimit}/>}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("home");
  const [config,setConfig]=useState({players:["You","Muthu"],limit:300,roomCode:null,myName:null});

  if(screen==="home") return(
    <HomeScreen
      onPlayAI={(n,l)=>{
        setConfig({players:["You",...AI_NAMES.slice(0,n-1)],limit:l,roomCode:null,myName:null});
        setScreen("ai");
      }}
      onPlayFriends={(l)=>{
        setConfig(p=>({...p,limit:l}));
        setScreen("lobby");
      }}
    />
  );

  if(screen==="lobby") return(
    <FriendsLobby
      scoreLimit={config.limit}
      onStart={(players,limit,roomCode,myName)=>{
        setConfig(p=>({...p,players,limit,roomCode,myName}));
        setScreen("online");
      }}
      onBack={()=>setScreen("home")}
    />
  );

  if(screen==="online") return(
    <OnlineGameScreen
      roomCode={config.roomCode}
      myName={config.myName}
      onQuit={()=>setScreen("home")}
    />
  );

  return(
    <AIGameScreen
      players={config.players}
      scoreLimit={config.limit}
      onQuit={()=>setScreen("home")}
    />
  );
}