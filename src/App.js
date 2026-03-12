import { useState, useEffect, useRef } from "react";

// ─── Deck Setup ───────────────────────────────────────────────────────────────
const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RANK_PTS = {A:1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,J:10,Q:10,K:10,Joker:0};
const AI_NAMES = ["Muthu","Priya","Rajan"];

// ─── In-memory "server" for room simulation ───────────────────────────────────
// Rooms stored in module scope so all "players" (tabs / instances) share state
const ROOMS = {};

function genCode() {
  return Math.random().toString(36).substring(2,7).toUpperCase();
}

function makeDeck() {
  const d=[];
  for(const s of SUITS) for(const r of RANKS) d.push({suit:s,rank:r,pts:RANK_PTS[r],id:`${r}-${s}`});
  d.push({suit:"JK",rank:"Joker",pts:0,id:"joker1"});
  d.push({suit:"JK",rank:"Joker",pts:0,id:"joker2"});
  return d;
}
function shuffleDeck(d){const a=[...d];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function handTotal(cards){return cards.reduce((s,c)=>s+c.pts,0);}

// ─── Card Component ───────────────────────────────────────────────────────────
function PlayingCard({card,faceDown,selected,glowing,small,onClick,badge}){
  if(!card)return null;
  const w=small?46:68,h=small?68:100;
  const isRed=card.suit==="♥"||card.suit==="♦";
  const isJoker=card.rank==="Joker";
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
        ):isJoker?(
          <><div style={{fontSize:small?16:24,textAlign:"center"}}>🃏</div><div style={{fontSize:small?8:10,textAlign:"center",color:"#f97316",fontWeight:900}}>JOKER</div></>
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
      <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:480,width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:900}}>📋 Rules</h2>
          <button onClick={onClose} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:8,width:32,height:32,fontSize:16,fontWeight:900,cursor:"pointer"}}>✕</button>
        </div>
        {[
          ["Pack","Standard deck + 2 Jokers = 54 cards. Joker = 0 pts."],
          ["Goal",`Lowest points when someone claims wins the round. Reach ${limit||300} pts = ELIMINATED. Last player standing wins!`],
          ["Card Points","Joker=0 · A=1 · 2–9=face value · 10/J/Q/K=10"],
          ["Your Turn","Tap the Stock OR top Discard card (glows green = draw source). Tap a hand card (glows yellow = drop). Tap SWAP — instant exchange!"],
          ["Multi-Drop","Select multiple same-rank cards to drop them all at once."],
          ["SHOW","Tap SHOW to claim lowest hand. Wrong = double penalty."],
          ["Friends Mode","Create a room → share the 5-letter code → friends join → all play pass-and-play on the same screen."],
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

// ─── Eliminated / Game Over Banners ──────────────────────────────────────────
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

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({onPlayAI, onPlayFriends}){
  const [players,setPlayers]=useState(2);
  const [limit,setLimit]=useState(300);
  const [rules,setRules]=useState(false);

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f59e0b,#d97706)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:20}}>
      <div style={{background:"rgba(255,255,255,.15)",borderRadius:24,padding:"32px 26px",textAlign:"center",maxWidth:380,width:"100%",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.3)"}}>
        <div style={{fontSize:44,marginBottom:4}}>🃏</div>
        <h1 style={{margin:"0 0 4px",fontSize:46,fontWeight:900,color:"#fff",letterSpacing:2}}>5 CARDS</h1>
        <p style={{margin:"0 0 24px",color:"rgba(255,255,255,.85)",fontSize:13,letterSpacing:1}}>SWAP · CLAIM · SURVIVE</p>

        {/* Elimination limit */}
        <div style={{background:"rgba(255,255,255,.92)",borderRadius:16,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>Elimination Score Limit</div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            {[100,200,300].map(v=>(
              <button key={v} onClick={()=>setLimit(v)} style={{flex:1,padding:"9px 0",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:900,transition:"all .15s",background:limit===v?"#dc2626":"#fef2f2",color:limit===v?"#fff":"#7f1d1d",transform:limit===v?"scale(1.05)":"scale(1)",boxShadow:limit===v?"0 4px 12px rgba(220,38,38,.4)":"none"}}>{v}</button>
            ))}
          </div>
          <div style={{fontSize:11,color:"#92400e",marginTop:7}}>First to <strong>{limit} pts</strong> = eliminated 💀</div>
        </div>

        {/* VS AI */}
        <div style={{background:"rgba(255,255,255,.92)",borderRadius:16,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>🤖 Play vs AI</div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:12}}>
            {[2,3,4].map(n=>(
              <button key={n} onClick={()=>setPlayers(n)} style={{width:50,height:50,borderRadius:12,border:"none",cursor:"pointer",fontSize:20,fontWeight:900,transition:"all .15s",background:players===n?"#d97706":"#fef3c7",color:players===n?"#fff":"#78350f",transform:players===n?"scale(1.1)":"scale(1)",boxShadow:players===n?"0 4px 12px rgba(217,119,6,.5)":"none"}}>{n}</button>
            ))}
          </div>
          <button onClick={()=>onPlayAI(players,limit)} style={{width:"100%",background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer"}}>▶ Play vs AI</button>
        </div>

        {/* Friends */}
        <div style={{background:"rgba(255,255,255,.92)",borderRadius:16,padding:"16px 18px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#92400e",marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>👫 Play with Friends</div>
          <button onClick={()=>onPlayFriends(limit)} style={{width:"100%",background:"linear-gradient(135deg,#7c3aed,#5b21b6)",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer",marginBottom:8}}>🎮 Create / Join Room</button>
        </div>

        <button onClick={()=>setRules(true)} style={{width:"100%",background:"rgba(255,255,255,.2)",color:"#fff",border:"2px solid rgba(255,255,255,.5)",borderRadius:12,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer"}}>📋 Rules</button>
      </div>
      {rules&&<RulesModal onClose={()=>setRules(false)} limit={limit}/>}
    </div>
  );
}

// ─── Friends Lobby ────────────────────────────────────────────────────────────
function FriendsLobby({scoreLimit, onStart, onBack}){
  const [mode,    setMode]    = useState(null);
  const [myName,  setMyName]  = useState("");
  const [joinCode,setJoinCode]= useState("");
  const [room,    setRoom]    = useState(null);
  const [error,   setError]   = useState("");
  const [maxP,    setMaxP]    = useState(4);
  const pollRef = useRef(null);

  function createRoom(){
    if(!myName.trim()){setError("Enter your name first!");return;}
    const c=genCode();
    const newRoom={
      code:c, host:myName.trim(), players:[myName.trim()],
      maxPlayers:maxP, scoreLimit, started:false,
    };
    ROOMS[c]=newRoom;
    setRoom(newRoom);
    setError("");
  }

  function joinRoom(){
    if(!myName.trim()){setError("Enter your name first!");return;}
    if(!joinCode.trim()){setError("Enter the room code!");return;}
    const c=joinCode.trim().toUpperCase();
    const r=ROOMS[c];
    if(!r){setError("Room not found! Check the code.");return;}
    if(r.started){setError("Game already started!");return;}
    if(r.players.length>=r.maxPlayers){setError("Room is full!");return;}
    if(r.players.includes(myName.trim())){setError("Name already taken in this room!");return;}
    r.players=[...r.players,myName.trim()];
    ROOMS[c]=r;
    setRoom({...r});
    setError("");
  }

  // Poll room state
  useEffect(()=>{
    if(!room) return;
    pollRef.current=setInterval(()=>{
      const r=ROOMS[room.code];
      if(r){
        setRoom({...r});
        if(r.started) onStart(r.players, r.scoreLimit);
      }
    },800);
    return()=>clearInterval(pollRef.current);
  },[room]);// eslint-disable-line

  function startGame(){
    if(!room) return;
    if(room.players.length<2){setError("Need at least 2 players to start!");return;}
    ROOMS[room.code]={...ROOMS[room.code],started:true};
    onStart(ROOMS[room.code].players, scoreLimit);
  }

  const isHost = room && room.host===myName.trim();

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#7c3aed,#5b21b6)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:20}}>
      <div style={{background:"rgba(255,255,255,.12)",borderRadius:24,padding:"28px 24px",maxWidth:380,width:"100%",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,.25)"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",fontSize:13,cursor:"pointer",marginBottom:16,padding:0}}>← Back</button>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:36,marginBottom:4}}>👫</div>
          <h2 style={{margin:0,color:"#fff",fontSize:22,fontWeight:900}}>Play with Friends</h2>
          <p style={{margin:"4px 0 0",color:"rgba(255,255,255,.7)",fontSize:12}}>Create a room or join with a code</p>
        </div>

        {/* Name input always visible */}
        {!room&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Your Name</div>
            <input
              value={myName} onChange={e=>setMyName(e.target.value)}
              placeholder="Enter your name..."
              style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"2px solid rgba(255,255,255,.3)",background:"rgba(255,255,255,.15)",color:"#fff",fontSize:15,fontWeight:700,outline:"none",boxSizing:"border-box"}}
            />
          </div>
        )}

        {/* Mode picker */}
        {!room&&!mode&&(
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <button onClick={()=>setMode("create")} style={{flex:1,background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:900,cursor:"pointer"}}>➕ Create Room</button>
            <button onClick={()=>setMode("join")}   style={{flex:1,background:"rgba(255,255,255,.2)",color:"#fff",border:"2px solid rgba(255,255,255,.4)",borderRadius:12,padding:"13px",fontSize:15,fontWeight:900,cursor:"pointer"}}>🔑 Join Room</button>
          </div>
        )}

        {/* Create */}
        {!room&&mode==="create"&&(
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Max Players</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[2,3,4].map(n=>(
                <button key={n} onClick={()=>setMaxP(n)} style={{flex:1,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",fontSize:16,fontWeight:900,background:maxP===n?"#facc15":"rgba(255,255,255,.15)",color:maxP===n?"#1e3a5f":"#fff",transform:maxP===n?"scale(1.05)":"scale(1)"}}>{n}</button>
              ))}
            </div>
            <button onClick={createRoom} style={{width:"100%",background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer",marginBottom:8}}>Create Room</button>
            <button onClick={()=>setMode(null)} style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,.6)",fontSize:13,cursor:"pointer",padding:"4px"}}>← Back</button>
          </div>
        )}

        {/* Join */}
        {!room&&mode==="join"&&(
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Room Code</div>
            <input
              value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={5}
              placeholder="e.g. A1B2C"
              style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"2px solid rgba(255,255,255,.3)",background:"rgba(255,255,255,.15)",color:"#fff",fontSize:18,fontWeight:900,outline:"none",letterSpacing:4,textAlign:"center",boxSizing:"border-box",marginBottom:12}}
            />
            <button onClick={joinRoom} style={{width:"100%",background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:12,padding:"13px",fontSize:16,fontWeight:900,cursor:"pointer",marginBottom:8}}>Join Room</button>
            <button onClick={()=>setMode(null)} style={{width:"100%",background:"none",border:"none",color:"rgba(255,255,255,.6)",fontSize:13,cursor:"pointer",padding:"4px"}}>← Back</button>
          </div>
        )}

        {/* Lobby */}
        {room&&(
          <div>
            {/* Room code display */}
            <div style={{background:"rgba(255,255,255,.15)",borderRadius:14,padding:"14px",textAlign:"center",marginBottom:14,border:"2px dashed rgba(255,255,255,.4)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",marginBottom:4,textTransform:"uppercase",letterSpacing:2}}>Room Code</div>
              <div style={{fontSize:36,fontWeight:900,color:"#facc15",letterSpacing:8}}>{room.code}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.6)",marginTop:4}}>Share this code with friends</div>
            </div>

            {/* Players list */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>
                Players ({room.players.length}/{room.maxPlayers})
              </div>
              {room.players.map((p,i)=>(
                <div key={p} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.12)",borderRadius:10,padding:"10px 14px",marginBottom:6,border:p===myName.trim()?"2px solid #facc15":"2px solid transparent"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                    {i===0?"👑":"👤"}
                  </div>
                  <span style={{color:"#fff",fontWeight:700,fontSize:14,flex:1}}>{p}</span>
                  {p===myName.trim()&&<span style={{fontSize:11,color:"#facc15",fontWeight:700}}>(You)</span>}
                  {i===0&&p!==myName.trim()&&<span style={{fontSize:11,color:"#facc15",fontWeight:700}}>Host</span>}
                </div>
              ))}
              {/* Empty slots */}
              {Array(room.maxPlayers-room.players.length).fill(0).map((_,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.05)",borderRadius:10,padding:"10px 14px",marginBottom:6,border:"2px dashed rgba(255,255,255,.15)"}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,opacity:.4}}>⏳</div>
                  <span style={{color:"rgba(255,255,255,.35)",fontSize:13}}>Waiting for player...</span>
                </div>
              ))}
            </div>

            {isHost?(
              <button
                onClick={startGame}
                disabled={room.players.length<2}
                style={{width:"100%",background:room.players.length>=2?"#facc15":"rgba(255,255,255,.2)",color:room.players.length>=2?"#1e3a5f":"rgba(255,255,255,.4)",border:"none",borderRadius:12,padding:"14px",fontSize:16,fontWeight:900,cursor:room.players.length>=2?"pointer":"not-allowed",transition:"all .2s"}}>
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

// ─── Pass-and-Play Turn Gate ──────────────────────────────────────────────────
function TurnGate({playerName, onReady}){
  return(
    <div style={{position:"fixed",inset:0,background:"linear-gradient(135deg,#1e3a5f,#0f2447)",zIndex:250,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:"center",padding:"0 24px"}}>
        <div style={{fontSize:64,marginBottom:16}}>🃏</div>
        <h2 style={{color:"#facc15",fontSize:28,fontWeight:900,margin:"0 0 8px"}}>{playerName}'s Turn</h2>
        <p style={{color:"rgba(255,255,255,.7)",fontSize:15,margin:"0 0 32px"}}>Hand the device to <strong style={{color:"#fff"}}>{playerName}</strong></p>
        <button onClick={onReady} style={{background:"#facc15",color:"#1e3a5f",border:"none",borderRadius:16,padding:"16px 48px",fontSize:18,fontWeight:900,cursor:"pointer",boxShadow:"0 8px 24px rgba(250,204,21,.4)"}}>
          I'm Ready! →
        </button>
      </div>
    </div>
  );
}

// ─── Game Screen (shared by AI and Friends modes) ─────────────────────────────
function GameScreen({players, scoreLimit, isFriendsMode, onQuit}){
  // In friends mode, players = array of names. In AI mode, players[0]="You" + AI names.
  const allPlayers = players;
  const isAI = name => !isFriendsMode && name !== "You";

  const [stock,       setStock]       = useState([]);
  const [pile,        setPile]        = useState([]);
  const [hands,       setHands]       = useState({});
  const [scores,      setScores]      = useState(()=>Object.fromEntries(allPlayers.map(p=>[p,0])));
  const [eliminated,  setEliminated]  = useState([]);
  const [active,      setActive]      = useState(allPlayers);
  const [round,       setRound]       = useState(1);
  const [turnIdx,     setTurnIdx]     = useState(0);

  const [drawFrom,    setDrawFrom]    = useState(null);
  const [dropIdxs,    setDropIdxs]    = useState([]);
  const [msg,         setMsg]         = useState("");
  const [log,         setLog]         = useState([]);
  const [showRules,   setShowRules]   = useState(false);
  const [roundResult, setRoundResult] = useState(null);
  const [newlyElim,   setNewlyElim]   = useState([]);
  const [gameWinner,  setGameWinner]  = useState(null);
  const [showGate,    setShowGate]    = useState(false); // pass-and-play gate

  const aiTimer = useRef(null);

  function pushLog(t){setLog(p=>[t,...p].slice(0,6));}

  function deal(activePlayers){
    const ap = activePlayers||active;
    const d=shuffleDeck(makeDeck());
    const h={};let cur=0;
    for(const name of ap){h[name]=d.slice(cur,cur+5);cur+=5;}
    setStock(d.slice(cur+1));
    setPile([d[cur]]);
    setHands(h);
    setTurnIdx(0);
    setDrawFrom(null);
    setDropIdxs([]);
    setLog([]);
    setRoundResult(null);
    setMsg(isFriendsMode?`${ap[0]}'s turn — Pick source, select drop card, then SWAP`:"Pick source, select drop card, then SWAP");
    // In friends mode, show gate for first player
    if(isFriendsMode) setShowGate(true);
  }

  useEffect(()=>{deal();},[]);// eslint-disable-line

  const currentPlayer = active[turnIdx];
  const isHumanTurn   = !isAI(currentPlayer);

  // ── Show pass-and-play gate when turn changes (friends mode)
  useEffect(()=>{
    if(!isFriendsMode||roundResult||gameWinner) return;
    setShowGate(true);
  },[turnIdx]);// eslint-disable-line

  // ── AI turns
  useEffect(()=>{
    if(roundResult||gameWinner||showGate) return;
    if(!isAI(currentPlayer)) return;

    aiTimer.current=setTimeout(()=>{
      const hand=hands[currentPlayer];
      if(!hand)return;
      if(handTotal(hand)<=13){pushLog(`${currentPlayer} claims!`);handleClaim(currentPlayer,hand);return;}

      const topCard=pile[pile.length-1];
      const worst=Math.max(...hand.map(c=>c.pts));
      const useTop=topCard&&topCard.pts<worst;

      const groups={};
      hand.forEach(c=>{groups[c.rank]=groups[c.rank]||[];groups[c.rank].push(c);});
      let bg=null,bp=-1;
      for(const g of Object.values(groups)){const gp=g.reduce((s,c)=>s+c.pts,0);if(gp>bp){bp=gp;bg=g;}}

      let drew,ns=[...stock],np=[...pile];
      if(useTop&&topCard){drew=topCard;np=pile.slice(0,-1);pushLog(`${currentPlayer} takes ${drew.rank}${drew.suit}`);}
      else{if(!stock.length)return;drew=stock[0];ns=stock.slice(1);pushLog(`${currentPlayer} draws from stock`);}

      const di=new Set(bg.map(c=>c.id));
      const nh=[...hand.filter(c=>!di.has(c.id)),drew];
      np=[...np,...bg];
      pushLog(`${currentPlayer} drops ${bg.map(c=>c.rank+c.suit).join(",")}`);

      setStock(ns);setPile(np);
      setHands(p=>({...p,[currentPlayer]:nh}));
      advanceTurn();
    },1200);
    return()=>clearTimeout(aiTimer.current);
  },[turnIdx,roundResult,showGate]);// eslint-disable-line

  function advanceTurn(){
    const next=(turnIdx+1)%active.length;
    setTurnIdx(next);
    setDrawFrom(null);setDropIdxs([]);
    const nextName=active[next];
    if(isAI(nextName)) setMsg(`${nextName}'s turn...`);
    else setMsg(isFriendsMode?`${nextName}'s turn`:"Pick source, select drop card, then SWAP");
  }

  // ── Claim
  function handleClaim(claimerName,claimerHand){
    const results=active.map(name=>({
      name,
      hand:name===claimerName?claimerHand:(hands[name]||[]),
      pts:name===claimerName?handTotal(claimerHand):handTotal(hands[name]||[]),
    }));
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

    setRoundResult({results,claimerName,claimerWon,claimerPts,lowestPts,newScores,justElim});
    if(justElim.length>0){setEliminated(newElim);setActive(newActive);}
    if(newActive.length<=1){setGameWinner(newActive[0]||active.find(n=>!justElim.includes(n)));}
  }

  function nextRound(){
    if(roundResult?.justElim?.length>0){setNewlyElim(roundResult.justElim);setRoundResult(null);}
    else{setRoundResult(null);setRound(r=>r+1);deal();}
  }

  function afterElimPopup(){
    setNewlyElim([]);
    if(gameWinner)return;
    setRound(r=>r+1);
    deal();
  }

  // ── Human actions
  function selStock(){if(!isHumanTurn)return;setDrawFrom(p=>p==="stock"?null:"stock");}
  function selPile(){if(!isHumanTurn||!pile.length)return;setDrawFrom(p=>p==="pile"?null:"pile");}
  function toggleDrop(idx){
    if(!isHumanTurn)return;
    const hand=hands[currentPlayer];
    setDropIdxs(p=>{
      if(p.includes(idx))return p.filter(i=>i!==idx);
      if(p.length>0&&hand[p[0]].rank!==hand[idx].rank){setMsg("Multi-drop: same rank only!");return p;}
      return[...p,idx];
    });
  }

  function doSwap(){
    if(!drawFrom){setMsg("Tap Stock or Discard card first!");return;}
    if(!dropIdxs.length){setMsg("Tap a card in your hand to drop!");return;}
    const hand=hands[currentPlayer];
    const dropping=dropIdxs.map(i=>hand[i]);
    let drew,ns=[...stock],np=[...pile];
    if(drawFrom==="stock"){if(!stock.length){setMsg("Stock empty!");return;}drew=stock[0];ns=stock.slice(1);}
    else{if(!pile.length){setMsg("Discard empty!");return;}drew=pile[pile.length-1];np=pile.slice(0,-1);}
    const kept=hand.filter((_,i)=>!dropIdxs.includes(i));
    np=[...np,...dropping];
    setStock(ns);setPile(np);
    setHands(p=>({...p,[currentPlayer]:[...kept,drew]}));
    pushLog(`${currentPlayer}: drop ${dropping.map(c=>c.rank+c.suit).join(",")} → ${drew.rank}${drew.suit}`);
    advanceTurn();
  }

  function doShow(){if(!isHumanTurn)return;pushLog(`${currentPlayer} claims!`);handleClaim(currentPlayer,hands[currentPlayer]);}

  // ─── RENDER ──────────────────────────────────────────────────────────────
  const curHand   = hands[currentPlayer]||[];
  const pileTop   = pile[pile.length-1]||null;
  const readySwap = isHumanTurn&&drawFrom!==null&&dropIdxs.length>0;

  if(gameWinner) return <GameOverBanner winner={gameWinner} onPlayAgain={()=>{setGameWinner(null);onQuit();}} onQuit={onQuit}/>;

  if(roundResult){
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
            <div style={{fontSize:11,fontWeight:900,color:"#92400e",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Scores (limit: {scoreLimit})</div>
            {allPlayers.map(name=>{
              const sc=roundResult.newScores[name]||0;
              const isElim=eliminated.includes(name)||(roundResult.justElim||[]).includes(name);
              const justGot=(roundResult.justElim||[]).includes(name);
              const pct=Math.min(100,(sc/scoreLimit)*100);
              return(
                <div key={name} style={{marginBottom:7,opacity:isElim&&!justGot?.5:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:12}}>{isElim?"💀 ":""}{name}{justGot&&<span style={{background:"#dc2626",color:"#fff",fontSize:9,fontWeight:900,borderRadius:4,padding:"1px 5px",marginLeft:5}}>OUT</span>}</span>
                    <span style={{fontWeight:900,fontSize:12,color:sc>=scoreLimit?"#dc2626":sc>scoreLimit*.7?"#f97316":"#059669"}}>{sc}/{scoreLimit}</span>
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

  if(newlyElim.length>0) return <EliminatedBanner name={newlyElim[0]} onClose={afterElimPopup}/>;

  // Pass-and-play gate
  if(showGate&&isFriendsMode){
    return <TurnGate playerName={currentPlayer} onReady={()=>setShowGate(false)}/>;
  }

  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#f59e0b,#d97706)",fontFamily:"system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:"rgba(0,0,0,.2)",padding:"9px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{color:"#fff",fontWeight:900,fontSize:14}}>5 CARDS · Round {round} {isFriendsMode?"👫":"🤖"}</span>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>setShowRules(true)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer"}}>RULES</button>
          <button onClick={onQuit}                 style={{background:"#1e3a5f",color:"#facc15",border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,fontWeight:700,cursor:"pointer"}}>EXIT</button>
        </div>
      </div>

      {/* Score bars */}
      <div style={{display:"flex",gap:5,padding:"6px 10px",overflowX:"auto"}}>
        {allPlayers.map(name=>{
          const sc=scores[name]||0;
          const pct=Math.min(100,(sc/scoreLimit)*100);
          const isElim=eliminated.includes(name);
          const isCur=active[turnIdx]===name;
          return(
            <div key={name} style={{flex:1,minWidth:60,background:isElim?"rgba(0,0,0,.1)":"rgba(255,255,255,.85)",borderRadius:9,padding:"5px 7px",border:isCur?"2px solid #facc15":"2px solid transparent",opacity:isElim?.4:1,transition:"all .3s"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:10,fontWeight:900,color:"#1e3a5f",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:60}}>{isElim?"💀":isCur?"▶":""} {name}</span>
                <span style={{fontSize:10,fontWeight:900,color:sc>=scoreLimit*.8?"#dc2626":"#059669"}}>{sc}</span>
              </div>
              <div style={{height:4,background:"#e5e7eb",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:sc>=scoreLimit*.8?"#dc2626":sc>scoreLimit*.5?"#f97316":"#059669",borderRadius:3}}/>
              </div>
              <div style={{fontSize:8,color:"#92400e",textAlign:"right"}}>/{scoreLimit}</div>
            </div>
          );
        })}
      </div>

      {/* Other players (face-down hands) */}
      <div style={{display:"flex",gap:8,padding:"6px 10px",justifyContent:"center",flexWrap:"wrap"}}>
        {active.filter(n=>n!==currentPlayer).map(name=>{
          const h=hands[name]||[];
          const isElim=eliminated.includes(name);
          return(
            <div key={name} style={{background:isElim?"rgba(0,0,0,.1)":"rgba(255,255,255,.78)",borderRadius:12,padding:"7px 11px",textAlign:"center",minWidth:100,opacity:isElim?.4:1}}>
              <div style={{fontSize:16,marginBottom:2}}>{isAI(name)?"🤖":"👤"}</div>
              <div style={{fontWeight:900,fontSize:11,marginBottom:4}}>{name}{isElim?" 💀":""}</div>
              <div style={{display:"flex",gap:2,justifyContent:"center"}}>
                {h.map((_,ci)=><PlayingCard key={ci} card={{rank:"?",suit:"?"}} faceDown small/>)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:40}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Stock ({stock.length})</div>
          {stock.length>0
            ?<PlayingCard card={stock[0]} faceDown glowing={isHumanTurn&&drawFrom==="stock"} onClick={isHumanTurn?selStock:undefined} badge={drawFrom==="stock"?"✓ Draw here":null}/>
            :<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>
          }
          {isHumanTurn&&drawFrom!=="stock"&&<div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:6,fontWeight:600}}>Tap to select</div>}
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#fff",marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Discard</div>
          {pileTop
            ?<PlayingCard card={pileTop} glowing={isHumanTurn&&drawFrom==="pile"} onClick={isHumanTurn?selPile:undefined} badge={drawFrom==="pile"?"✓ Draw here":null}/>
            :<div style={{width:68,height:100,borderRadius:8,border:"2px dashed rgba(255,255,255,.4)"}}/>
          }
          {isHumanTurn&&drawFrom!=="pile"&&pileTop&&<div style={{fontSize:11,color:"rgba(255,255,255,.8)",marginTop:6,fontWeight:600}}>Tap to select</div>}
        </div>
      </div>

      {/* Checklist */}
      {isHumanTurn&&(
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

      {/* Message */}
      <div style={{textAlign:"center",padding:"4px 14px 4px"}}>
        <div style={{display:"inline-block",background:"rgba(0,0,0,.5)",color:"#facc15",borderRadius:10,padding:"6px 16px",fontSize:13,fontWeight:700}}>{msg}</div>
      </div>

      {/* Current player hand */}
      <div style={{background:"rgba(0,0,0,.25)",padding:"9px 12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
          <span style={{color:"#fff",fontWeight:900,fontSize:13}}>
            {isFriendsMode?`${currentPlayer}`:"You"} · {handTotal(curHand)} pts
            {isFriendsMode&&<span style={{fontSize:11,color:"rgba(255,255,255,.6)",marginLeft:6}}>(your hand)</span>}
          </span>
          {isHumanTurn&&(
            <div style={{display:"flex",gap:7}}>
              <button onClick={doSwap} disabled={!readySwap} style={{background:readySwap?"#059669":"#6b7280",color:"#fff",border:"none",borderRadius:10,padding:"8px 13px",fontSize:13,fontWeight:900,cursor:readySwap?"pointer":"not-allowed",boxShadow:readySwap?"0 4px 12px rgba(5,150,105,.5)":"none"}}>⇄ SWAP</button>
              <button onClick={doShow} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:10,padding:"8px 12px",fontSize:13,fontWeight:900,cursor:"pointer"}}>📢 SHOW</button>
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:7,justifyContent:"center",flexWrap:"wrap",paddingTop:18}}>
          {curHand.map((card,idx)=>(
            <PlayingCard key={card.id} card={card} selected={dropIdxs.includes(idx)} onClick={isHumanTurn?()=>toggleDrop(idx):undefined} badge={dropIdxs.includes(idx)?"Drop":null}/>
          ))}
        </div>
        {isHumanTurn&&<div style={{textAlign:"center",marginTop:7,fontSize:11,color:"rgba(255,255,255,.7)",fontWeight:600}}>Tap cards to mark for dropping</div>}
      </div>

      {/* Log */}
      {log.length>0&&(
        <div style={{position:"fixed",top:56,right:10,background:"rgba(0,0,0,.75)",borderRadius:10,padding:"8px 12px",maxWidth:180,zIndex:50}}>
          {log.map((l,i)=><div key={i} style={{fontSize:11,color:i===0?"#facc15":"rgba(255,255,255,.5)",padding:"2px 0"}}>{l}</div>)}
        </div>
      )}

      {showRules&&<RulesModal onClose={()=>setShowRules(false)} limit={scoreLimit}/>}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,  setScreen]  = useState("home");
  const [config,  setConfig]  = useState({players:["You","Muthu"],limit:300,friends:false});

  if(screen==="home"){
    return(
      <HomeScreen
        onPlayAI={(n,l)=>{
          const ps=["You",...AI_NAMES.slice(0,n-1)];
          setConfig({players:ps,limit:l,friends:false});
          setScreen("game");
        }}
        onPlayFriends={(l)=>{
          setConfig(p=>({...p,limit:l,friends:true}));
          setScreen("lobby");
        }}
      />
    );
  }

  if(screen==="lobby"){
    return(
      <FriendsLobby
        scoreLimit={config.limit}
        onStart={(players,limit)=>{
          setConfig(p=>({...p,players,limit,friends:true}));
          setScreen("game");
        }}
        onBack={()=>setScreen("home")}
      />
    );
  }

  return(
    <GameScreen
      players={config.players}
      scoreLimit={config.limit}
      isFriendsMode={config.friends}
      onQuit={()=>setScreen("home")}
    />
  );
}