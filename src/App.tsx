import './index.css';
import { useState, useEffect, useRef } from 'react'; 
import { db } from './firebase'; 
import { 
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, 
  doc, updateDoc, deleteDoc 
} from "firebase/firestore";

// --- 커스텀 훅: 로컬 스토리지 저장 (프로필 유지용) ---
function useLocalStorage(key: string, initialValue: any) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: any) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };
  return [storedValue, setValue];
}

const KBO_TEAMS = [
  { id: 'kia', name: 'KIA', logo: '/logos/kia.png', logoUrl: '/logos/kia.png', enlarged: '/logos/kia.png', color: 'bg-red-700', youtubeId: 'p6rFHkWu1Zg' },
  { id: 'samsung', name: '삼성', logo: '/logos/samsung.png', logoUrl: '/logos/samsung.png', enlarged: '/logos/samsung.png', color: 'bg-blue-600', youtubeId: 'S_m6HKQVaAU' },
  { id: 'lg', name: 'LG', logo: '/logos/lg.png', logoUrl: '/logos/lg.png', enlarged: '/logos/lg.png', color: 'bg-red-800', youtubeId: '4aBE5iA6aQc' },
  { id: 'doosan', name: '두산', logo: '/logos/doosan.png', logoUrl: '/logos/doosan.png', enlarged: '/logos/doosan.png', color: 'bg-blue-900', youtubeId: '4UiIXEYjkyU' },
  { id: 'kt', name: 'KT', logo: '/logos/kt.png', logoUrl: '/logos/kt.png', enlarged: '/logos/kt.png', color: 'bg-gray-900', youtubeId: 'JF2TEiYUUPM' },
  { id: 'ssg', name: 'SSG', logo: '/logos/ssg.png', logoUrl: '/logos/ssg.png', enlarged: '/logos/ssg.png', color: 'bg-red-600', youtubeId: 'E2Xxz6bYfL8' },
  { id: 'lotte', name: '롯데', logo: '/logos/Lotte.png', logoUrl: '/logos/Lotte.png', enlarged: '/logos/Lotte.png', color: 'bg-blue-800', youtubeId: 'yBqnXG2XoSE' },
  { id: 'hanwha', name: '한화', logo: '/logos/hanwha.png', logoUrl: '/logos/hanwha.png', enlarged: '/logos/hanwha.png', color: 'bg-orange-500', youtubeId: 'Xu7HvaUX2YM' },
  { id: 'kiwoom', name: '키움', logo: '/logos/kiwoom.png', logoUrl: '/logos/kiwoom.png', enlarged: '/logos/kiwoom.png', color: 'bg-red-900', youtubeId: 'KFnGYWBCI4k' },
  { id: 'nc', name: 'NC', logo: '/logos/nc.png', logoUrl: '/logos/nc.png', enlarged: '/logos/nc.png', color: 'bg-blue-700', youtubeId: 't2OMvwfA610' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isFirstVisit, setIsFirstVisit] = useLocalStorage('yagu_isFirstVisit', true);
  const [user, setUser] = useLocalStorage('yagu_user_v8', { 
    name: '', team: 'LG', favPlayer: '아직 없음', seat: '네이비석 (시야 최고 가성비)', wins: 0, losses: 0 
  });
  
  // --- 🔥 실시간 데이터 상태 (Firebase 연동) ---
  const [homeChats, setHomeChats] = useState<any[]>([]); 
  const [liveChats, setLiveChats] = useState<any>({});   
  const [matesData, setMatesData] = useState<any>({ stadium: [], outside: [] }); 
  const [balanceChats, setBalanceChats] = useState<any>({}); 
  const [dms, setDms] = useState<any[]>([]); // 🔥 진짜 실시간 DM 저장소!

  // --- Firebase 실시간 리스너 ---
  useEffect(() => {
    const qAll = query(collection(db, "allChats"), orderBy("createdAt", "asc"));
    const unsubAll = onSnapshot(qAll, (snapshot) => {
      setHomeChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qLive = query(collection(db, "liveChats"), orderBy("createdAt", "asc"));
    const unsubLive = onSnapshot(qLive, (snapshot) => {
      const data: any = {};
      snapshot.docs.forEach(doc => {
        const chat = doc.data();
        if (!data[chat.gameId]) data[chat.gameId] = [];
        data[chat.gameId].push({ id: doc.id, ...chat });
      });
      setLiveChats(data);
    });

    const qMates = query(collection(db, "mates"), orderBy("createdAt", "desc")); 
    const unsubMates = onSnapshot(qMates, (snapshot) => {
      const newMates: any = { stadium: [], outside: [] };
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.mateType === 'stadium') newMates.stadium.push({ id: doc.id, ...data });
        else if (data.mateType === 'outside') newMates.outside.push({ id: doc.id, ...data });
      });
      setMatesData(newMates);
    });

    const qBal = query(collection(db, "balanceChats"), orderBy("createdAt", "asc"));
    const unsubBal = onSnapshot(qBal, (snapshot) => {
      const data: any = {};
      snapshot.docs.forEach(doc => {
        const chat = doc.data();
        if (!data[chat.qIdx]) data[chat.qIdx] = [];
        data[chat.qIdx].push({ id: doc.id, ...chat });
      });
      setBalanceChats(data);
    });

    // 🔥 실시간 DM 감시
    const qDm = query(collection(db, "dms"), orderBy("createdAt", "asc"));
    const unsubDm = onSnapshot(qDm, (snapshot) => {
      setDms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubAll(); unsubLive(); unsubMates(); unsubBal(); unsubDm(); };
  }, []);
  
  const [schedule, setSchedule] = useState([] as any[]);
  const [selectedUser, setSelectedUser] = useState<any>(null); 
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // DM 타겟 상태
  const [chatTarget, setChatTarget] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // 📡 구글 스프레드시트 연동
  useEffect(() => {
    const fetchSchedule = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('https://opensheet.elk.sh/1Fes6Wc5Cx5FOAvWIMNViXjSLhWW5KFb0twl8wlTmAiM/%EC%8B%9C%ED%8A%B81');
        const data = await response.json();
        
        const grouped = [] as any[];
        const now = new Date();
        const todayM = now.getMonth() + 1;
        const todayD = now.getDate();

        data.forEach((row: any) => {
          const m = parseInt(row.month);
          const d = parseInt(row.date);
          if (!m || !d) return;

          let dayObj = grouped.find(g => g.month === m && g.date === d);
          if (!dayObj) {
            dayObj = { month: m, date: d, day: row.day || '', isToday: (m === todayM && d === todayD), matches: [] };
            grouped.push(dayObj);
          }
          if (row.home && row.away) {
            dayObj.matches.push({ home: row.home, away: row.away });
          }
        });

        grouped.sort((a, b) => (a.month * 100 + a.date) - (b.month * 100 + b.date));
        setSchedule(grouped);
      } catch (e) {
        console.error("데이터 로드 실패", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchedule();
    if (!isFirstVisit) setActiveTab('home');
  }, [isFirstVisit]);

  const bgLogos = [...KBO_TEAMS, ...KBO_TEAMS, ...KBO_TEAMS, ...KBO_TEAMS];
  const targetName = selectedUser?.user || selectedUser?.name;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap');
        .title-font { font-family: 'Black Han Sans', sans-serif; font-weight: 400; letter-spacing: 1px; }
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; background-color: #000000 !important; overflow: hidden; position: fixed; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #10b981; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes float-bg { 0% { transform: translateY(0px) rotate(-12deg) scale(1.3); } 50% { transform: translateY(-20px) rotate(-12deg) scale(1.3); } 100% { transform: translateY(0px) rotate(-12deg) scale(1.3); } }
        .animate-float-bg { animation: float-bg 20s ease-in-out infinite; }
      `}</style>

      <div className="h-[100dvh] w-full bg-black text-slate-900 font-sans flex justify-center overflow-hidden">
        <div className="w-full max-w-[430px] h-full relative bg-gradient-to-br from-green-50 via-emerald-50/50 to-teal-50 flex flex-col shadow-[0_0_60px_rgba(255,255,255,0.15)] overflow-hidden">
          
          {toastMsg && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[200] bg-slate-800/90 backdrop-blur-xl text-white px-6 py-4 rounded-full shadow-2xl border border-slate-700 text-sm font-black flex items-center gap-3 animate-in slide-in-from-top-4 w-[85%] justify-center">
              <span className="text-lg">⚾</span> {toastMsg}
            </div>
          )}

          <div className="absolute inset-0 z-0 flex justify-center items-center opacity-[0.02] pointer-events-none mix-blend-multiply">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Baseball_diamond_clean.svg/800px-Baseball_diamond_clean.svg.png" alt="" className="w-[180%] max-w-none md:w-full object-cover" />
          </div>

          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center opacity-30">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-10 w-[150%] h-[150%] place-items-center transform -rotate-12 animate-float-bg">
              {bgLogos.map((team, idx) => (
                <img key={idx} src={team.logo} alt="" className={`grayscale object-contain opacity-[0.03] transition-all ${team.enlarged ? 'w-40 h-40' : 'w-24 h-24'}`} />
              ))}
            </div>
          </div>

          <main className="relative z-10 flex-1 w-full min-h-0 flex flex-col px-4 pt-4 sm:px-5 sm:pt-5 pb-[104px] overflow-hidden">
            {activeTab === 'home' && <HomeView user={user} schedule={schedule} setActiveTab={setActiveTab} isLoading={isLoading} homeChats={homeChats} />}
            {activeTab === 'live' && <LiveChatView user={user} schedule={schedule} setActiveTab={setActiveTab} onUserClick={setSelectedUser} showToast={showToast} chats={liveChats} />}
            {activeTab === 'allchat' && <AllChatView user={user} onUserClick={setSelectedUser} setActiveTab={setActiveTab} showToast={showToast} chats={homeChats} />}
            {activeTab === 'cheer' && <CheerRoomView user={user} showToast={showToast} />} 
            {activeTab === 'mate' && <MateView user={user} onUserClick={setSelectedUser} showToast={showToast} mates={matesData} />}
            {activeTab === 'profile' && <ProfileView user={user} setUser={setUser} isFirstVisit={isFirstVisit} setIsFirstVisit={setIsFirstVisit} setActiveTab={setActiveTab} showToast={showToast} />}
            {activeTab === 'game' && <GameView user={user} setActiveTab={setActiveTab} balanceChats={balanceChats} onUserClick={setSelectedUser} showToast={showToast} />}
            
            {/* 🔥 실시간 DM 연결 */}
            {activeTab === 'dm_list' && <DMListView user={user} dms={dms} setActiveTab={setActiveTab} setChatTarget={setChatTarget} />}
            {activeTab === 'dm_chat' && <DMChatView user={user} chatTarget={chatTarget} dms={dms} setActiveTab={setActiveTab} showToast={showToast} />}
          </main>

          {/* 하단 네비게이션 */}
          {!isFirstVisit && (
            <nav className="absolute bottom-0 left-0 w-full bg-white/90 border-t border-slate-200/60 flex justify-between px-2 pt-2 pb-6 z-50 backdrop-blur-2xl shadow-[0_-15px_40px_rgba(0,0,0,0.06)] rounded-t-3xl overflow-x-auto no-scrollbar">
              <NavBtn icon="🏠" label="홈" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
              <NavBtn icon="💬" label="경기톡" active={activeTab === 'live'} onClick={() => setActiveTab('live')} />
              <NavBtn icon="🎤" label="응원가" active={activeTab === 'cheer'} onClick={() => setActiveTab('cheer')} />
              <NavBtn icon="🤝" label="메이트" active={activeTab === 'mate'} onClick={() => setActiveTab('mate')} />
              <NavBtn icon="🎮" label="오락실" active={activeTab === 'game'} onClick={() => setActiveTab('game')} />
              <NavBtn icon="👤" label="내정보" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
            </nav>
          )}

          {/* 프로필 모달 */}
          {selectedUser && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedUser(null)}>
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl w-full max-w-xs p-7 shadow-2xl text-center border border-white/50 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="w-20 h-20 rounded-full mx-auto bg-gradient-to-tr from-green-50 to-white p-1 border-4 border-emerald-500 overflow-hidden shadow-lg mb-4">
                  <img src={KBO_TEAMS.find(t => t.id === selectedUser.team)?.logo} alt="" className="w-full h-full object-contain" />
                </div>
                <div className="mb-4">
                  <h3 className="text-2xl font-black text-slate-800">{targetName}</h3>
                  <p className="text-emerald-600 font-bold text-xs mt-1">{selectedUser.team} 팬</p>
                </div>
                <div className="bg-slate-50/80 p-4 rounded-2xl space-y-3 shadow-inner border border-slate-100 mb-5">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400">🔥 직관 전적</span><span className="text-base font-black text-slate-700">{selectedUser.wins || 0}승 {selectedUser.losses || 0}패</span></div>
                  <hr className="border-slate-200" />
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-400">💖 최애 선수</span><span className="text-xs font-black text-slate-700">{selectedUser.favPlayer || '비밀!'}</span></div>
                </div>
                <div className="flex gap-2 w-full">
                  {targetName !== user.name && (
                    <button onClick={() => { setChatTarget(targetName); setActiveTab('dm_chat'); setSelectedUser(null); }} className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 active:scale-95 transition-all shadow-md">💬 DM 보내기</button>
                  )}
                  <button onClick={() => setSelectedUser(null)} className="flex-1 py-3.5 bg-slate-800 text-white rounded-2xl font-black text-sm hover:bg-slate-700 active:scale-95 transition-all shadow-lg">닫기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// --- 홈 화면 (🔥 명언 위젯 추가) ---
function HomeView({ user, schedule, setActiveTab, isLoading, homeChats }: any) {
  // 간단한 명언 리스트
  const quotes = [
    { text: "끝날 때까지는 끝난 게 아니다.", author: "요기 베라" },
    { text: "공은 둥글고 경기는 9회말 2아웃부터다.", author: "야구 격언" },
    { text: "야구는 실패의 스포츠다. 3할을 치면 훌륭한 타자다.", author: "테드 윌리엄스" },
    { text: "투구는 영리하게, 타격은 멍청하게.", author: "야구 격언" }
  ];
  const todayQuote = quotes[new Date().getDate() % quotes.length];

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto no-scrollbar space-y-6 animate-in fade-in">
      <header className="flex justify-center pt-3 pb-1 relative">
        <h1 className="title-font text-[34px] text-center bg-gradient-to-r from-emerald-600 via-green-600 to-teal-500 text-transparent bg-clip-text drop-shadow-sm leading-[1.1]">
          공부 out!<br/>야구 in!
        </h1>
        <button onClick={() => setActiveTab('dm_list')} className="absolute right-0 top-2 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-md hover:bg-white active:scale-95 transition-all text-xl border border-slate-100">
          📬
        </button>
      </header>

      {/* 🔥 명언 위젯 추가 */}
      <section className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 shadow-lg text-white relative overflow-hidden flex flex-col justify-center">
        <div className="absolute -right-2 -top-4 text-7xl opacity-10">⚾</div>
        <h2 className="text-[10px] font-black text-emerald-400 mb-2 uppercase tracking-widest">Today's Quote</h2>
        <p className="text-sm font-bold leading-relaxed break-keep-all">"{todayQuote.text}"</p>
        <p className="text-xs text-slate-400 mt-2 text-right font-medium">- {todayQuote.author} -</p>
      </section>
      
      <section className="bg-white/80 backdrop-blur-xl rounded-3xl py-5 border border-white shadow-lg overflow-hidden">
        <h2 className="text-base font-bold mb-4 text-slate-800 flex items-center gap-2 px-5">📅 전체 경기 일정</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x px-5">
          {isLoading ? (
            <div className="w-full flex flex-col items-center justify-center py-8 space-y-3">
              <div className="text-3xl animate-bounce">⚾</div>
              <div className="text-xs font-bold text-slate-400">일정을 가져오고 있어요...</div>
            </div>
          ) : schedule.length > 0 ? schedule.map((day: any, idx: number) => (
            <div key={idx} className={`min-w-[170px] snap-center bg-white rounded-2xl overflow-hidden flex flex-col relative transition-all ${day.isToday ? 'border-2 border-emerald-400 shadow-md scale-105' : 'border border-slate-100 shadow-sm'}`}>
              {day.isToday && <span className="absolute top-0 right-0 bg-gradient-to-bl from-red-500 to-pink-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl shadow-md z-10 animate-pulse">TODAY</span>}
              <div className={`text-center py-2.5 font-black text-white text-sm ${day.isToday ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : ['토', '일'].includes(day.day) ? 'bg-gradient-to-r from-red-400 to-red-500' : 'bg-slate-700'}`}>
                {day.month}/{day.date} ({day.day})
              </div>
              <div className="p-3 space-y-2.5 flex-1 flex flex-col justify-center min-h-[130px]">
                {day.matches?.map((m: any, i: number) => (
                  <div key={i} className="text-center text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-2 last:border-0 last:pb-0 whitespace-normal leading-tight">
                    {m.home} <span className="text-slate-400 font-normal mx-1">vs</span> {m.away}
                  </div>
                ))}
              </div>
            </div>
          )) : <div className="text-xs font-bold text-slate-500 p-6 text-center w-full bg-slate-50 rounded-2xl italic mx-5">일정이 없습니다.</div>}
        </div>
      </section>

      <section onClick={() => setActiveTab('allchat')} className="bg-white/80 backdrop-blur-xl rounded-3xl p-5 h-56 flex flex-col cursor-pointer border border-white shadow-lg active:scale-[0.98] transition-all group">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-emerald-600 text-sm flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]"></span> 실시간 전체 잡담방
          </h2>
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-full shadow-sm group-hover:bg-emerald-100 transition-colors">입장하기 ❯</span>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col justify-end space-y-2.5 pb-1">
          {homeChats.length > 0 ? homeChats.slice(-3).map((c: any, i: number) => {
            const isMe = c.user === user.name;
            return (
            <div key={i} className={`flex flex-col animate-in slide-in-from-bottom-2 ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && <span className="text-[9px] font-black text-slate-500 mb-0.5 ml-1 opacity-80">@{c.user}</span>}
              <div className={`px-3.5 py-2 rounded-2xl text-[11px] shadow-sm max-w-[85%] truncate font-medium ${isMe ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}>
                {c.text}
              </div>
            </div>
          )}) : <div className="text-center text-slate-400 flex flex-col items-center justify-center h-full"><span className="text-2xl mb-2 opacity-80">💬</span><p className="text-xs font-bold">첫 인사를 건네보세요!</p></div>}
        </div>
      </section>
    </div>
  );
}

// --- 🔥 진짜 실시간 DM 목록 뷰 ---
function DMListView({ user, dms, setActiveTab, setChatTarget }: any) {
  // 내가 포함된 DM만 필터링해서, 대화 상대별로 마지막 메시지 추출
  const myDms = dms.filter((d: any) => d.sender === user.name || d.receiver === user.name);
  const targetsMap = new Map();
  myDms.forEach((d: any) => {
    const partner = d.sender === user.name ? d.receiver : d.sender;
    targetsMap.set(partner, d);
  });
  const targetList = Array.from(targetsMap.entries()).reverse(); // 최근순

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col animate-in slide-in-from-right-4">
      <div className="flex items-center gap-3 mb-4 mt-2 px-1 shrink-0">
        <button onClick={() => setActiveTab('home')} className="text-emerald-600 font-black text-xl bg-white p-2 rounded-2xl shadow-sm active:scale-90 transition-all w-11 h-11 flex items-center justify-center border border-slate-100">❮</button>
        <h2 className="title-font text-[34px] bg-gradient-to-r from-emerald-600 to-teal-600 text-transparent bg-clip-text leading-none pt-1">📬 내 우편함</h2>
      </div>
      <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-3xl p-5 shadow-lg overflow-y-auto border border-white no-scrollbar">
        {targetList.length === 0 && <div className="text-center text-slate-400 text-xs mt-10 font-bold flex flex-col items-center"><span className="text-4xl mb-3 opacity-50">📭</span>아직 나눈 DM이 없어요!</div>}
        {targetList.map(([target, lastMsg]: any) => (
          <div key={target} onClick={() => { setChatTarget(target); setActiveTab('dm_chat'); }} className="flex items-center gap-4 p-4 mb-3 bg-white rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-200 transition-all">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-xl shadow-inner shrink-0 border border-emerald-100">⚾</div>
            <div className="flex-1 overflow-hidden">
              <h3 className="font-black text-slate-800 text-sm mb-1 truncate">@{target}</h3>
              <p className="text-xs text-slate-500 truncate">{lastMsg.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 🔥 진짜 실시간 1:1 DM 채팅 뷰 ---
function DMChatView({ user, chatTarget, dms, setActiveTab, showToast }: any) {
  const [msg, setMsg] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // 나와 상대방이 주고받은 메시지만 필터링
  const chatList = dms.filter((d: any) => 
    (d.sender === user.name && d.receiver === chatTarget) || 
    (d.sender === chatTarget && d.receiver === user.name)
  );

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatList]);

  const send = async () => {
    if(!msg.trim()) { showToast("메시지를 입력해주세요!"); return; }
    try {
      await addDoc(collection(db, "dms"), {
        sender: user.name,
        receiver: chatTarget,
        text: msg.trim(),
        team: user.team,
        createdAt: serverTimestamp()
      });
      setMsg('');
    } catch (e) { showToast("전송 실패!"); }
  };

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col animate-in slide-in-from-right-4">
      <div className="flex items-center gap-3 mb-4 mt-2 px-1 shrink-0">
        <button onClick={() => setActiveTab('dm_list')} className="text-emerald-600 font-black text-xl bg-white p-2 rounded-2xl shadow-sm active:scale-90 transition-all w-11 h-11 flex items-center justify-center border border-slate-100">❮</button>
        <h2 className="title-font text-[28px] text-slate-800 leading-none pt-1 truncate">@{chatTarget}</h2>
      </div>
      <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-3xl p-5 shadow-lg overflow-y-auto mb-4 border border-white no-scrollbar">
        {chatList.length === 0 && <div className="text-center text-slate-400 text-xs mt-10 font-bold flex flex-col items-center"><span className="text-4xl mb-3 opacity-50">👋</span>첫 인사를 건네보세요!</div>}
        {chatList.map((c: any, i: number) => {
          const isMe = c.sender === user.name;
          return (
          <div key={i} className={`flex flex-col gap-1 mb-5 animate-in fade-in slide-in-from-bottom-1 ${isMe ? 'items-end' : 'items-start'}`}>
            {!isMe && <span className="text-[10px] font-bold text-slate-500 mb-0.5 px-1">@{c.sender}</span>}
            <div className={`text-[13px] font-medium px-4 py-2.5 rounded-2xl shadow-sm max-w-[85%] break-words ${isMe ? 'bg-gradient-to-bl from-emerald-500 to-emerald-600 text-white rounded-tr-sm shadow-emerald-500/20' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}>
              {c.text}
            </div>
          </div>
        )})}
        <div ref={chatEndRef} />
      </div>
      <div className="flex gap-2 shrink-0">
        <input className="flex-1 p-3.5 bg-white rounded-2xl outline-none text-sm shadow-sm border border-slate-100 focus:ring-2 ring-emerald-400 transition-all" placeholder="DM 메시지 입력..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && !e.nativeEvent.isComposing) send()}}/>
        <button onClick={send} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 rounded-2xl font-black shadow-md active:scale-95 transition-all text-sm">전송</button>
      </div>
    </div>
  );
}

// --- 전체 잡담방 ---
function AllChatView({ user, onUserClick, setActiveTab, showToast, chats }: any) {
  const [homeMsg, setHomeMsg] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chats]);

  const send = async () => {
    if(!homeMsg.trim()) { showToast("메시지를 입력해주세요!"); return; }
    try {
      await addDoc(collection(db, "allChats"), {
        user: user.name, text: homeMsg.trim(), team: user.team, createdAt: serverTimestamp()
      });
      setHomeMsg(''); 
    } catch (e) { showToast("전송 실패!"); }
  };

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-3 mb-4 mt-2 px-1 shrink-0">
        <button onClick={() => setActiveTab('home')} className="text-emerald-600 font-black text-xl bg-white p-2 rounded-2xl shadow-sm active:scale-90 transition-all w-11 h-11 flex items-center justify-center border border-slate-100">❮</button>
        <h2 className="title-font text-[34px] bg-gradient-to-r from-emerald-600 to-teal-600 text-transparent bg-clip-text leading-none pt-1">🏠 전체 잡담방</h2>
      </div>
      <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-3xl p-5 shadow-lg overflow-y-auto mb-4 border border-white no-scrollbar">
        {chats.length === 0 && <div className="text-center text-slate-400 text-xs mt-10 font-bold flex flex-col items-center"><span className="text-4xl mb-3 opacity-50">👋</span>채팅을 채워보세요!</div>}
        {chats.map((c: any, i: number) => {
          const isMe = c.user === user.name;
          const teamInfo = KBO_TEAMS.find(t=>t.id===c.team) || KBO_TEAMS[0];
          return (
          <div key={i} className={`flex flex-col gap-1 mb-5 animate-in fade-in ${isMe ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className={`text-[9px] font-black text-white ${teamInfo.color} px-1.5 py-0.5 rounded shadow-sm`}>{c.team}</span>
              <button onClick={() => !isMe && onUserClick(c)} className={`text-[10px] font-bold ${isMe ? 'text-emerald-500' : 'text-slate-500 hover:text-emerald-600'}`}>{c.user}</button>
            </div>
            <div className={`text-[13px] font-medium px-4 py-2.5 rounded-2xl shadow-sm max-w-[85%] break-all ${isMe ? 'bg-gradient-to-bl from-emerald-500 to-emerald-600 text-white rounded-tr-sm' : 'bg-white border text-slate-800 rounded-tl-sm'}`}>
              {c.text}
            </div>
          </div>
        )})}
        <div ref={chatEndRef} />
      </div>
      <div className="flex gap-2 shrink-0">
        <input className="flex-1 p-3.5 bg-white rounded-2xl outline-none text-sm border focus:ring-2 ring-emerald-400" placeholder="메시지 입력..." value={homeMsg} onChange={e => setHomeMsg(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.nativeEvent.isComposing) send()}} />
        <button onClick={send} className="bg-emerald-600 text-white px-6 rounded-2xl font-black shadow-md text-sm">전송</button>
      </div>
    </div>
  );
}

// --- 실시간 경기 톡 ---
function LiveChatView({ user, schedule, setActiveTab, onUserClick, showToast, chats }: any) {
  const [selectedGame, setSelectedGame] = useState(0);
  const [msg, setMsg] = useState('');
  const todaySchedule = schedule.find((s: any) => s.isToday);
  const todaysMatches = todaySchedule?.matches || []; 
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chats, selectedGame]);

  const send = async () => {
    if(!msg.trim()) { showToast("메시지를 입력해주세요!"); return; }
    try {
      await addDoc(collection(db, "liveChats"), { gameId: selectedGame, user: user.name, text: msg.trim(), team: user.team, createdAt: serverTimestamp() });
      setMsg('');
    } catch (e) { showToast("전송 실패!"); }
  };

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col space-y-4">
      <h2 className="title-font text-[34px] bg-gradient-to-r from-emerald-600 to-teal-600 text-transparent bg-clip-text text-center pt-2 leading-none shrink-0">⚾ 실시간 경기 톡</h2>
      {todaysMatches.length > 0 ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0 px-1">
            {todaysMatches.map((g: any, idx: number) => (
              <button key={idx} onClick={() => setSelectedGame(idx)} className={`px-4 py-2.5 rounded-full whitespace-nowrap text-xs font-black border transition-all ${selectedGame === idx ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/80 text-slate-500'}`}> {g.home} vs {g.away} </button>
            ))}
          </div>
          <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-3xl p-4 shadow-sm overflow-y-auto no-scrollbar border border-white">
            {(chats[selectedGame] || []).map((c: any, i: number) => {
              const isMe = c.user === user.name;
              const teamInfo = KBO_TEAMS.find(t=>t.id===c.team) || KBO_TEAMS[0];
              return (
              <div key={i} className={`flex flex-col gap-1 mb-5 animate-in slide-in-from-bottom-2 ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`text-[9px] font-black text-white ${teamInfo.color} px-1.5 py-0.5 rounded shadow-sm`}>{c.team}</span>
                  <button onClick={() => !isMe && onUserClick(c)} className={`text-[10px] font-bold ${isMe ? 'text-emerald-500' : 'text-slate-500'}`}>{c.user}</button>
                </div>
                <div className={`text-[13px] font-medium px-4 py-2.5 rounded-2xl shadow-sm break-all ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border text-slate-800 rounded-tl-sm'}`}>{c.text}</div>
              </div>
            )})}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2 p-2 bg-white rounded-2xl shadow-sm border border-white shrink-0">
            <input className="flex-1 text-sm px-3 outline-none bg-transparent" placeholder="실시간 응원 메시지..." value={msg} onChange={e=>setMsg(e.target.value)} onKeyDown={e=>{if(e.key === 'Enter' && !e.nativeEvent.isComposing) send()}}/>
            <button onClick={send} className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex justify-center items-center shadow-sm">⚾</button>
          </div>
        </>
      ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white/70 rounded-3xl p-8 text-center border border-white space-y-4">
            <div className="text-6xl">🛌</div>
            <p className="text-sm font-bold text-slate-500">오늘은 경기가 없습니다!</p>
            <button onClick={() => setActiveTab('home')} className="mt-4 text-xs text-emerald-600 font-bold bg-white px-4 py-2 rounded-xl shadow-sm">홈으로 가기</button>
          </div>
      )}
    </div>
  );
}

// --- 응원가 방 ---
function CheerRoomView({ user, showToast }: any) {
  const [selectedTeam, setSelectedTeam] = useState(user.team); 
  const [isMicOn, setIsMicOn] = useState(false);
  const teamInfo = KBO_TEAMS.find(t => t.id === selectedTeam) || KBO_TEAMS[0];
  const [count, setCount] = useState(() => Math.floor(Math.random() * 200) + 50);

  useEffect(() => { setCount(Math.floor(Math.random() * 200) + 50); setIsMicOn(false); }, [selectedTeam]);

  const toggleMic = () => { setIsMicOn(!isMicOn); if(!isMicOn) showToast("떼창 시작! 🎙️"); }

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in space-y-4">
      <h2 className="title-font text-[34px] bg-gradient-to-r from-emerald-600 to-teal-600 text-transparent bg-clip-text text-center pt-2 shrink-0 leading-none">🎤 팀별 응원가 방</h2>
      <div className="w-full aspect-[16/10] bg-black rounded-3xl overflow-hidden shadow-md border-4 border-white shrink-0 z-10">
        <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${teamInfo.youtubeId}?autoplay=0&rel=0`} title="YouTube" frameBorder="0" allowFullScreen></iframe>
      </div>
      <div className="grid grid-cols-5 gap-2 shrink-0 z-10">
        {KBO_TEAMS.map((team) => (
          <button key={team.id} onClick={() => setSelectedTeam(team.id)} className={`py-2 rounded-xl text-[10px] font-black transition-all shadow-sm ${selectedTeam === team.id ? `${team.color} text-white scale-105 border-2 border-white` : 'bg-white/80 text-slate-500'}`}> {team.id} </button>
        ))}
      </div>
      <div className="flex-1 bg-white rounded-3xl shadow-sm border flex flex-col items-center justify-center p-4 relative mb-2">
        <h3 className="text-lg font-black text-slate-800 mb-1"> {teamInfo.id} 팬들과 함께 </h3>
        <p className="text-xs font-bold text-slate-500 mb-4 italic">현재 <span className="text-red-500">{count}</span>명 열창 중!</p>
        <button onClick={toggleMic} className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all ${isMicOn ? 'bg-red-500 text-white animate-pulse shadow-xl ring-8 ring-red-100' : 'bg-slate-100 text-slate-400 border active:scale-95'}`}> {isMicOn ? '🎙️' : '🔇'} </button>
      </div>
    </div>
  );
}

// --- 메이트 구인 ---
const STADIUM_LIST = ["기아 챔피언스 필드", "대구 삼성 라이온즈 파크", "잠실 야구장", "고척 스카이돔", "인천 SSG 랜더스필드", "사직 야구장", "대전 한화생명 이글스파크", "창원 NC 파크", "수원 KT 위즈 파크"];

function MateView({ user, onUserClick, showToast, mates }: any) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [mateTab, setMateTab] = useState('stadium');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [gameTag, setGameTag] = useState(STADIUM_LIST[0]);
  const [total, setTotal] = useState('2');
  
  const [viewingMateId, setViewingMateId] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');

  useEffect(() => { setGameTag(mateTab === 'stadium' ? STADIUM_LIST[0] : ''); }, [mateTab]);

  const addMate = async () => {
    if(!title.trim() || !content.trim()) { showToast("제목과 내용을 모두 적어주세요!"); return; }
    try {
      await addDoc(collection(db, "mates"), {
        mateType: mateTab, user: user.name, title: title.trim(), content: content.trim(),
        tag: gameTag, total: parseInt(total), joined: [user.name], chats: [], createdAt: serverTimestamp()
      });
      setTitle(''); setContent('');
      showToast("모집 글이 등록되었습니다! 🙋‍♂️");
    } catch (e) { showToast("등록 실패!"); }
  };

  const handleToggleJoin = async (e: any, post: any) => {
    e.stopPropagation();
    const isJoined = post.joined.includes(user.name);
    const postRef = doc(db, "mates", post.id);

    try {
      if (isJoined) {
        await updateDoc(postRef, { joined: post.joined.filter((n: string) => n !== user.name) });
        showToast("참여를 취소했습니다.");
      } else {
        if (post.joined.length >= post.total) { showToast("이미 마감된 모집입니다!"); return; }
        await updateDoc(postRef, { joined: [...post.joined, user.name] });
        showToast("모임에 참여했습니다! 💬");
      }
    } catch (e) { showToast("에러가 발생했습니다."); }
  };

  const deleteMatePost = async (e: any, postId: string) => {
    e.stopPropagation();
    if(window.confirm('이 모집글을 삭제할까요?')) {
      try { await deleteDoc(doc(db, "mates", postId)); showToast("삭제되었습니다."); } catch (e) { showToast("삭제 실패!"); }
    }
  };

  const viewingMatePost = viewingMateId ? mates[mateTab].find((p: any) => p.id === viewingMateId) : null;
  useEffect(() => { if(viewingMatePost) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [viewingMatePost?.chats]); 

  if (viewingMateId && viewingMatePost) {
    const isJoined = viewingMatePost.joined.includes(user.name);

    const sendGroupChat = async () => {
      if(!chatText.trim()) { showToast("메시지를 입력해주세요!"); return; }
      if(!isJoined) { showToast("모임에 먼저 참여해야 대화할 수 있어요!"); return; }
      try {
        const postRef = doc(db, "mates", viewingMateId);
        await updateDoc(postRef, { chats: [...(viewingMatePost.chats || []), { user: user.name, text: chatText.trim(), team: user.team }] });
        setChatText('');
      } catch (e) { showToast("전송 실패!"); }
    };

    return (
      <div className="flex-1 w-full min-h-0 flex flex-col animate-in slide-in-from-right-4">
        <button onClick={() => setViewingMateId(null)} className="text-emerald-600 font-bold text-xs mb-2 text-left shrink-0 bg-white/80 px-4 py-2 rounded-xl self-start shadow-sm border border-white">❮ 뒤로 가기</button>
        
        <div className="bg-white border border-slate-100 p-5 rounded-3xl shadow-lg flex-1 flex flex-col overflow-hidden">
          <div className="mb-2"><span className={`text-[9px] font-black text-white ${mateTab === 'stadium' ? 'bg-emerald-600' : 'bg-orange-500'} px-2.5 py-1.5 rounded-md shadow-sm`}>{viewingMatePost.tag}</span></div>
          <div className="flex justify-between items-start">
            <h3 className="font-black text-xl text-slate-800 mb-1 pr-10 truncate text-left w-full">{viewingMatePost.title}</h3>
            <div className="text-right shrink-0 mt-1"><span className="text-2xl font-black text-emerald-800">{viewingMatePost.joined.length}</span><span className="text-sm font-bold text-slate-400">/{viewingMatePost.total}</span></div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 mb-3 text-left cursor-pointer hover:text-emerald-500" onClick={() => onUserClick(viewingMatePost)}>작성자: @{viewingMatePost.user}</p>
          <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs font-semibold text-slate-700 mb-3 shrink-0 text-left">{viewingMatePost.content}</div>
          
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shrink-0 mb-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-bold text-emerald-800">모집 현황 <span className="text-lg font-black ml-1">{viewingMatePost.joined.length}/{viewingMatePost.total}</span></span>
              <button onClick={(e) => handleToggleJoin(e, viewingMatePost)} disabled={!isJoined && viewingMatePost.joined.length >= viewingMatePost.total} className={`px-4 py-2.5 rounded-xl text-[11px] font-black shadow-sm transition-all active:scale-95 ${isJoined ? 'bg-white text-red-500 border border-red-100' : viewingMatePost.joined.length >= viewingMatePost.total ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                {isJoined ? '❌ 취소하기' : viewingMatePost.joined.length >= viewingMatePost.total ? '마감' : '🙋‍♂️ 참여하기'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-emerald-100/50">
              {viewingMatePost.joined.map((name: string, i: number) => (
                <span key={i} className="text-[10px] font-bold bg-white text-emerald-600 px-2 py-1 rounded-lg shadow-sm border border-emerald-100/50">@{name} {name === viewingMatePost.user && '👑'}</span>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 bg-slate-50/80 p-3 rounded-xl border shadow-inner no-scrollbar">
            {(viewingMatePost.chats || []).length === 0 && <p className="text-center text-xs text-slate-400 mt-4 font-bold flex flex-col items-center"><span className="text-2xl mb-1">💬</span> 대화를 나눠보세요!</p>}
            {(viewingMatePost.chats || []).map((c: any, i: number) => {
              const isMe = c.user === user.name;
              return (
              <div key={i} className={`flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="font-bold text-[9px] text-slate-500 mb-0.5 px-1">{c.user} {c.user === viewingMatePost.user && <span className="text-emerald-500 ml-0.5">(방장)</span>}</span>
                <span className={`text-xs px-3.5 py-2 rounded-2xl shadow-sm break-words max-w-[85%] ${isMe ? 'bg-emerald-600 text-white rounded-tr-sm' : 'bg-white border text-slate-800 rounded-tl-sm'}`}>{c.text}</span>
              </div> 
            )})}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2 mt-3 shrink-0">
            <input className="flex-1 bg-white border border-slate-200 rounded-xl outline-none text-xs px-3 py-2.5 shadow-sm focus:ring-2 ring-emerald-300 disabled:opacity-50" placeholder={isJoined ? "메시지 전송..." : "참여 후 채팅 가능"} value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendGroupChat(); }} disabled={!isJoined} />
            <button onClick={sendGroupChat} disabled={!isJoined} className="bg-emerald-600 text-white rounded-xl px-5 text-xs font-black disabled:opacity-50 shadow-sm active:scale-95 transition-all">전송</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in space-y-4">
      <h2 className="title-font text-[34px] bg-gradient-to-r from-emerald-600 to-teal-600 text-transparent bg-clip-text text-center pt-2 shrink-0 leading-none">🤝 야구 메이트 찾기</h2>
      
      <div className="flex bg-white/80 backdrop-blur-xl p-1 rounded-2xl shrink-0 border border-white shadow-sm relative">
        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-emerald-50 rounded-xl transition-all duration-300 ease-out ${mateTab==='outside'?'translate-x-full ml-1 bg-orange-50':''}`}></div>
        <button onClick={() => setMateTab('stadium')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all z-10 ${mateTab === 'stadium' ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>🏟️ 야구장 직관</button>
        <button onClick={() => setMateTab('outside')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all z-10 ${mateTab === 'outside' ? 'text-orange-500' : 'text-slate-500 hover:text-slate-700'}`}>🍻 외부/술집</button>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-white p-4 rounded-3xl shadow-sm space-y-3 shrink-0">
        <div className="flex gap-2">
          {mateTab === 'stadium' ? <select className="w-1/3 text-[10px] p-2.5 font-bold bg-slate-50 border rounded-xl outline-none focus:ring-2 ring-emerald-400" value={gameTag} onChange={e=>setGameTag(e.target.value)}> {STADIUM_LIST.map(s => <option key={s}>{s}</option>)} </select> : <input className="w-1/3 text-[10px] p-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 ring-emerald-400" placeholder="어디서?" value={gameTag} onChange={e=>setGameTag(e.target.value)}/>}
          <input className="flex-1 text-[10px] p-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 ring-emerald-400" placeholder="게시글 제목" value={title} onChange={e=>setTitle(e.target.value)}/>
        </div>
        <textarea className="w-full text-[10px] p-2.5 bg-slate-50 border rounded-xl h-12 outline-none focus:ring-2 ring-emerald-400" placeholder="어떤 메이트를 구하시나요?" value={content} onChange={e=>setContent(e.target.value)} />
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-500">모집인원:</span><select className="text-[10px] p-1 border rounded-lg bg-white font-bold outline-none" value={total} onChange={e=>setTotal(e.target.value)}> {Array.from({length: 14}, (_, i) => i + 2).map(n=><option key={n} value={n}>{n}명</option>)} </select></div>
          <button onClick={addMate} className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-2 rounded-xl font-black text-[11px] shadow-sm">모집 올리기</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-2">
        {mates[mateTab].length === 0 && <div className="text-center text-slate-400 text-xs mt-8 font-bold">아직 모집 글이 없어요. 첫 메이트를 구해보세요!</div>}
        {mates[mateTab].map((m: any, idx: number) => (
          <div key={m.id} onClick={() => setViewingMateId(m.id)} style={{animationDelay: `${idx * 0.05}s`}} className="bg-white border p-5 rounded-3xl relative hover:shadow-md cursor-pointer animate-in slide-in-from-bottom-4 shadow-sm text-left">
            {m.user === user.name && (
              <button onClick={(e) => deleteMatePost(e, m.id)} className="absolute top-5 right-5 text-[9px] text-red-400 font-bold hover:text-red-600 z-10 bg-red-50 px-2 py-1 rounded-lg">삭제</button>
            )}
            <div className="mb-2">
              <span className={`text-[9px] font-black text-white ${mateTab==='stadium'?'bg-emerald-500':'bg-orange-500'} px-2.5 py-1.5 rounded-md`}>{m.tag}</span>
            </div>
            <div className="flex justify-between items-start">
              <h3 className="font-black text-base text-slate-800 mb-1 pr-12 truncate w-full">{m.title}</h3>
              <div className="text-right shrink-0 mt-1">
                <span className="text-xl font-black text-emerald-800">{m.joined.length}</span>
                <span className="text-xs font-bold text-slate-400">/{m.total}</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-3">작성자: @{m.user}</div>
            <p className="text-xs text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl border">{m.content}</p>
            <div className="flex justify-between items-center mt-2">
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border">💬 채팅 {(m.chats || []).length}</span>
              <button onClick={(e) => handleToggleJoin(e, m)} className={`px-4 py-2.5 rounded-xl font-black text-[11px] shadow-sm ${m.joined.includes(user.name) ? 'bg-white border text-red-500' : 'bg-slate-800 text-white'}`}>
                {m.joined.includes(user.name) ? '❌ 취소' : '🙋‍♂️ 참여'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 내 정보 ---
function ProfileView({ user, setUser, isFirstVisit, setIsFirstVisit, setActiveTab, showToast }: any) {
  const [isEditing, setIsEditing] = useState(isFirstVisit);
  const [tempName, setTempName] = useState(user.name);
  const [tempTeam, setTempTeam] = useState(user.team || 'LG');
  const [tempFavPlayer, setTempFavPlayer] = useState(user.favPlayer);
  const [tempSeat, setTempSeat] = useState(user.seat);
  const [tempWins, setTempWins] = useState(user.wins || 0);
  const [tempLosses, setTempLosses] = useState(user.losses || 0);
  const [allUsers, setAllUsers] = useLocalStorage('yagu_all_users_pool', ['야구조아', '에이쁠', '야구광', '치맥킬러']);

  const totalGames = user.wins + user.losses;
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0;
  const team = KBO_TEAMS.find(t => t.id === (isEditing ? tempTeam : user.team)) || KBO_TEAMS[0];

  const getLuckLevel = () => {
    if (totalGames === 0) return "직관 기록을 추가해봐요!";
    if (winRate >= 70) return "👑 찐 승리요정";
    if (winRate >= 50) return "💪 기운 좋은 승요";
    if (winRate >= 30) return "😢 아쉬운 패요..";
    return "🛌 집관이 답인가요..";
  };

  const save = () => {
    const trimmedName = tempName.trim();
    if(!trimmedName) { showToast("닉네임을 입력해주세요!"); return; }
    if (trimmedName !== user.name && allUsers.includes(trimmedName)) {
      showToast(`'${trimmedName}' 은(는) 이미 누가 쓰고 있어요! 😅`);
      return;
    }
    if (trimmedName !== user.name) setAllUsers([...allUsers.filter((n:string)=>n!==user.name), trimmedName]);
    setUser({ ...user, name: trimmedName, team: tempTeam, favPlayer: tempFavPlayer, seat: tempSeat, wins: tempWins, losses: tempLosses });
    setIsEditing(false);
    if (isFirstVisit) { setIsFirstVisit(false); setActiveTab('home'); }
    showToast("프로필이 성공적으로 저장되었습니다! 🎉");
  };

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto no-scrollbar space-y-6 animate-in fade-in pb-4 pt-2 text-center flex flex-col">
      <h2 className="title-font text-[34px] bg-gradient-to-r from-emerald-600 to-teal-600 text-transparent bg-clip-text shrink-0 leading-none">👤 내 정보</h2>
      
      <div className={`w-36 h-36 sm:w-40 sm:h-40 ${team.color} rounded-full mx-auto p-1.5 shadow-lg transition-all duration-500 shrink-0 z-10 border-[3px] border-white`}>
        <div className="w-full h-full bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden shadow-inner">
          <img src={team.logo} alt="" className="w-full h-full object-contain" />
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-5 px-2 z-10 animate-in zoom-in-95 duration-300">
          <div>
            <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">{user.name}</h2>
            <p className="text-emerald-600 font-bold text-[10px] mt-2 bg-white/90 backdrop-blur inline-block px-4 py-1.5 rounded-full border border-emerald-50 shadow-sm">{team.name} 팬</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 rounded-3xl px-6 py-6 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden w-full border border-white/20">
            <div className="absolute top-2 right-3 opacity-10 text-7xl italic font-black uppercase">WIN</div>
            <h3 className="text-[10px] font-black opacity-90 mb-1 tracking-[3px] uppercase text-left text-emerald-100">🔥 승요 판독 결과</h3>
            <p className="text-2xl leading-tight font-black text-left mb-6">{getLuckLevel()}</p>
            <div className="flex justify-between items-end border-t border-white/20 pt-4">
              <div className="text-left"><p className="text-3xl font-black">{user.wins}승 {user.losses}패</p><p className="text-[10px] font-bold opacity-70 mt-0.5">올해 총 {totalGames}경기 직관</p></div>
              <div className="text-right"><p className="text-4xl font-black text-lime-200 drop-shadow-md">{winRate}%</p></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm">
              <p className="text-[10px] font-black text-slate-400 mb-1.5">💖 최애 선수</p>
              <p className="text-sm font-black text-slate-800">{user.favPlayer}</p>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col items-center justify-center shadow-sm">
              <p className="text-[10px] font-black text-slate-400 mb-1.5">🏟️ 선호 좌석</p>
              <p className="text-xs font-black text-slate-800 break-keep-all">{user.seat}</p>
            </div>
          </div>
          <button onClick={() => setIsEditing(true)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm hover:bg-slate-700 active:scale-95 transition-all shadow-md block mt-2 border border-slate-700">프로필 편집하기</button>
        </div>
      ) : (
        <div className="space-y-4 px-4 bg-white/90 backdrop-blur-xl border border-white p-6 rounded-3xl text-left z-10 shadow-lg animate-in slide-in-from-bottom-4">
          <div><p className="text-[11px] font-black text-slate-400 ml-1 mb-1.5">나만의 닉네임 (중복방지)</p><input className="w-full p-3.5 bg-white border border-slate-100 rounded-xl text-sm font-black outline-none focus:ring-2 ring-emerald-400 transition-all shadow-sm" value={tempName} onChange={e=>setTempName(e.target.value)} placeholder="닉네임 입력" /></div>
          <div><p className="text-[11px] font-black text-slate-400 ml-1 mb-1.5">나의 최애 선수</p><input className="w-full p-3.5 bg-white border border-slate-100 rounded-xl text-sm font-black outline-none focus:ring-2 ring-emerald-400 transition-all shadow-sm" value={tempFavPlayer} onChange={e=>setTempFavPlayer(e.target.value)} placeholder="최애 선수" /></div>
          <div><p className="text-[11px] font-black text-slate-400 ml-1 mb-1.5">가장 좋아하는 좌석</p>
            <select className="w-full p-3.5 bg-white border border-slate-100 rounded-xl text-sm font-black outline-none appearance-none focus:ring-2 ring-emerald-400 transition-all shadow-sm" value={tempSeat} onChange={e=>setTempSeat(e.target.value)}>
              <option>네이비석 (시야 최고 가성비)</option>
              <option>응원단상 앞 (열정!)</option>
              <option>테이블석 (편안/먹거리)</option>
              <option>포수 후면석 (프리미엄)</option>
              <option>외야석 (가성비/홈런볼)</option>
              <option>익사이팅존 (선수 근접)</option>
            </select>
          </div>
          
          <p className="text-[11px] font-black text-slate-400 ml-1 mt-4">📊 올해 직관 전적</p>
          <div className="flex gap-3 w-full">
            <div className="flex-1 bg-emerald-50 py-4 px-2.5 rounded-2xl flex flex-col items-center gap-2.5 shadow-inner border border-emerald-100">
              <p className="text-[10px] font-black text-emerald-600">WIN (승)</p>
              <div className="flex justify-between items-center w-full px-1">
                <button onClick={()=>setTempWins(Math.max(0, tempWins-1))} className="w-8 h-8 bg-white rounded-full text-xl font-black shadow-sm active:scale-75 transition-all text-slate-400 hover:text-emerald-500">-</button>
                <span className="font-black text-2xl text-emerald-800 text-center">{tempWins}</span>
                <button onClick={()=>setTempWins(tempWins+1)} className="w-8 h-8 bg-white rounded-full text-xl font-black shadow-sm active:scale-75 transition-all text-slate-400 hover:text-emerald-500">+</button>
              </div>
            </div>
            <div className="flex-1 bg-red-50 py-4 px-2.5 rounded-2xl flex flex-col items-center gap-2.5 shadow-inner border border-red-100">
              <p className="text-[10px] font-black text-red-600">LOSS (패)</p>
              <div className="flex justify-between items-center w-full px-1">
                <button onClick={()=>setTempLosses(Math.max(0, tempLosses-1))} className="w-8 h-8 bg-white rounded-full text-xl font-black shadow-sm active:scale-75 transition-all text-slate-400 hover:text-red-500">-</button>
                <span className="font-black text-2xl text-red-800 text-center">{tempLosses}</span>
                <button onClick={()=>setTempLosses(tempLosses+1)} className="w-8 h-8 bg-white rounded-full text-xl font-black shadow-sm active:scale-75 transition-all text-slate-400 hover:text-red-500">+</button>
              </div>
            </div>
          </div>

          <p className="text-[11px] font-black text-slate-400 ml-1 mt-5">나의 응원 구단</p>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {KBO_TEAMS.map(t => (
              <button key={t.id} onClick={()=>setTempTeam(t.id)} className={`py-3 rounded-xl text-[10px] font-black transition-all ${tempTeam === t.id ? `${t.color} text-white shadow-md scale-105 border-2 border-white` : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}`}> {t.name} </button>
            ))}
          </div>
          <button onClick={save} className="w-full py-4 mt-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-black text-base shadow-md shadow-emerald-500/30 active:scale-95 transition-all mb-2"> 저장 완료 🚀 </button>
        </div>
      )}
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: string, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center relative min-w-[64px] h-16 transition-all duration-300 ${active ? '' : 'opacity-40 grayscale hover:opacity-70'}`}>
      <div className={`absolute inset-0 top-1 bottom-1 bg-emerald-50 rounded-2xl transition-all duration-300 -z-10 ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}></div>
      <div className={`text-[22px] transition-all duration-300 ${active ? '-translate-y-2' : 'translate-y-0'}`}>{icon}</div>
      <span className={`text-[9px] font-black transition-all duration-300 absolute bottom-2 ${active ? 'opacity-100 text-emerald-600 translate-y-0' : 'opacity-0 translate-y-2'}`}>{label}</span>
    </button>
  );
}

// --- 🎮 야구장 오락실 (요청된 순서: 도루왕 -> 광클 -> 밸런스 -> 운세) ---
function GameView({ user, setActiveTab, balanceChats, onUserClick, showToast }: any) {
  const [gameState, setGameState] = useState('menu'); 
  const [balIdx, setBalIdx] = useState(0);
  const [voted, setVoted] = useState(false);
  const [clickerActive, setClickerActive] = useState(false);
  const [clickerTime, setClickerTime] = useState(10);
  const [clickerScore, setClickerScore] = useState(0);
  const [pop, setPop] = useState(false);
  const [stealState, setStealState] = useState('idle'); 
  const [stealTime, setStealTime] = useState(0);
  const stealStartRef = useRef(0);
  const stealTimeoutRef = useRef<any>(null);
  const [fortune, setFortune] = useState<any>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 1. ⚖️ 밸런스 게임 질문 15개
  const balanceQuestions = [
    { q: "9회말 2아웃 만루, 1점 차 지고 있는 상황.\n당신의 선택은?", a: "홈런 타자 대타", b: "발 빠른 주자 대주자" },
    { q: "더 킹받는 순간은?", a: "믿었던 마무리 투수의 블론세이브", b: "무사 만루에서 병살타-삼진" },
    { q: "우리 팀에 무조건 데려와야 한다면?", a: "매년 30홈런 치지만 실책 30개 하는 유격수", b: "홈런 0개지만 실책 0개 철벽수비 유격수" },
    { q: "FA 영입! 누가 더 낫나?", a: "1년 60홈런 치고 3년 눕방", b: "4년 내내 2할 5푼 10홈런 꾸준함" },
    { q: "내일 당장 일어났으면 하는 일은?", a: "구단주가 만수르로 바뀜", b: "라이벌 팀 에이스가 우리 팀으로 무상 이적" },
    { q: "직관 시 더 최악인 상황은?", a: "2시간 대기 후 우천 취소", b: "1회초에 선발 10실점 강판" },
    { q: "하나만 평생 봐야 한다면?", a: "매일 1:0 꾸역승 노잼 경기", b: "매일 10:9 엎치락뒤치락 쫄깃 경기" },
    { q: "어떤 선수가 될래?", a: "꼴찌팀의 1선발 에이스", b: "통합우승팀의 벤치 멤버" },
    { q: "우리 팀 감독으로 모신다면?", a: "작전 최고 인터뷰 꽝", b: "작전 제로 팬서비스 쩜" },
    { q: "타석에 섰을 때 더 무서운 투수는?", a: "160km 제구 안됨", b: "120km 완벽 제구" },
    { q: "평생 직관 징크스 하나 고르기", a: "내 화장실 가면 홈런 침", b: "내 맥주 마시면 병살타 침" },
    { q: "한국시리즈 7차전 9회말 투수는?", a: "어제 100구 던진 에이스", b: "한 달 쉰 5선발급 투수" },
    { q: "내 최애 선수의 운명은?", a: "원클럽맨인데 영구결번 안됨", b: "이적했는데 영구결번 됨" },
    { q: "더 끔찍한 실책은?", a: "끝내기 알까기", b: "결정전 낫아웃 악송구" },
    { q: "내일 직관 자리 어디 앉을래?", a: "키 큰 사람 앞 포수석", b: "훈수 두는 사람 옆 응원석" }
  ];

  const balChatRef = useRef<HTMLDivElement>(null);
  const currentBalChats = balanceChats[balIdx] || [];
  useEffect(() => { balChatRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentBalChats, balIdx]);

  const sendBalChat = async () => {
    if(!balIdx.toString() || !user.name) return; // 에러 방지
    const val = (document.getElementById('balInput') as HTMLInputElement)?.value;
    if(!val?.trim()) return;
    try { await addDoc(collection(db, "balanceChats"), { qIdx: balIdx, user: user.name, text: val.trim(), team: user.team, createdAt: serverTimestamp() }); (document.getElementById('balInput') as HTMLInputElement).value = ''; } catch (e) { showToast("실패!"); }
  };

  // 2. ⚡ 광클 타이머 로직
  useEffect(() => {
    let timer: any;
    if (clickerActive && clickerTime > 0) { timer = setTimeout(() => setClickerTime(prev => prev - 1), 1000); } 
    else if (clickerTime === 0) { setClickerActive(false); }
    return () => clearTimeout(timer);
  }, [clickerActive, clickerTime]);

  // 3. 🥠 운세 10개
  const fortunes = ["홈런 관상입니다! ⚾🔥", "우천 취소 기운.. 파전 추천! ☔", "승리요정 확률 99%! 🧚‍♂️", "1점차 쫄깃한 승리 하루! 💦", "침대 야구 주의(잠듦) 🛌", "상대 에이스가 미치는 날.. 🧘‍♂️", "뉴스타 탄생의 날! 🌟", "야구장 먹거리 대성공! 🍗🍺", "태평양 존 심판 만남 🌊", "9회말 역전극 대기 중! 📺"];
  const drawFortune = () => { setIsDrawing(true); setFortune(null); setTimeout(() => { setFortune({ score: Math.floor(Math.random() * 100) + 1, text: fortunes[Math.floor(Math.random() * fortunes.length)] }); setIsDrawing(false); }, 800); };

  // 4. 🏃 도루왕 로직
  const startSteal = () => { setStealState('waiting'); const delay = Math.floor(Math.random() * 4000) + 2000; stealTimeoutRef.current = setTimeout(() => { setStealState('ready'); stealStartRef.current = Date.now(); }, delay); };
  const handleStealClick = () => { if (stealState === 'waiting') { clearTimeout(stealTimeoutRef.current); setStealState('early'); } else if (stealState === 'ready') { setStealTime(Date.now() - stealStartRef.current); setStealState('done'); } };

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in space-y-4 pb-2">
      <div className="flex items-center gap-3 mt-2 px-1 shrink-0">
        {gameState !== 'menu' && <button onClick={() => {setGameState('menu'); setVoted(false); setFortune(null); setClickerActive(false); setStealState('idle');}} className="text-emerald-600 font-black text-xl bg-white p-2 rounded-2xl shadow-sm w-11 h-11 flex items-center justify-center border border-slate-100">❮</button>}
        <h2 className="title-font text-[34px] bg-gradient-to-r from-indigo-500 to-pink-500 text-transparent bg-clip-text drop-shadow-sm truncate">{gameState === 'menu' ? '🎮 오락실' : gameState === 'steal' ? '🏃 도루왕' : gameState === 'clicker' ? '⚡ 10초 광클' : gameState === 'balance' ? '⚖️ 밸런스' : '🥠 야구 운세'}</h2>
      </div>

      {gameState === 'menu' && (
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4 mt-2 px-1">
          {/* 🔥 1. 0.1초 도루왕 (순서 1번) */}
          <button onClick={() => setGameState('steal')} className="bg-gradient-to-br from-rose-500 to-red-600 rounded-[28px] p-5 text-left shadow-lg hover:-translate-y-1 active:scale-95 transition-all relative overflow-hidden border border-white/20">
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-20">🏃</div>
            <span className="bg-white/20 text-rose-50 text-[9px] font-black px-2 py-1 rounded-full">반사신경</span>
            <h3 className="text-xl font-black text-white mt-3 leading-tight">0.1초<br/>도루왕</h3>
          </button>
          {/* 🔥 2. 10초 광클 게임 (순서 2번) */}
          <button onClick={() => setGameState('clicker')} className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-[28px] p-5 text-left shadow-lg hover:-translate-y-1 active:scale-95 transition-all relative overflow-hidden border border-white/20">
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-20">⚡</div>
            <span className="bg-white/20 text-blue-50 text-[9px] font-black px-2 py-1 rounded-full">무한 연타</span>
            <h3 className="text-xl font-black text-white mt-3 leading-tight">10초 무한<br/>광클 타자</h3>
          </button>
          {/* 🔥 3. 밸런스 게임 (순서 3번) */}
          <button onClick={() => setGameState('balance')} className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[28px] p-5 text-left shadow-lg hover:-translate-y-1 active:scale-95 transition-all relative overflow-hidden border border-white/20">
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-20">⚖️</div>
            <span className="bg-white/20 text-indigo-50 text-[9px] font-black px-2 py-1 rounded-full">과몰입 토론</span>
            <h3 className="text-xl font-black text-white mt-3 leading-tight">야구팬<br/>밸런스</h3>
          </button>
          {/* 🔥 4. 운세 게임 (순서 4번) */}
          <button onClick={() => setGameState('fortune')} className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-[28px] p-5 text-left shadow-lg hover:-translate-y-1 active:scale-95 transition-all relative overflow-hidden border border-white/20">
            <div className="absolute -right-2 -bottom-2 text-7xl opacity-20">🥠</div>
            <span className="bg-white/20 text-amber-50 text-[9px] font-black px-2 py-1 rounded-full">행운 지수</span>
            <h3 className="text-xl font-black text-white mt-3 leading-tight">오늘의<br/>야구 운세</h3>
          </button>
        </div>
      )}

      {/* --- 도루왕 뷰 --- */}
      {gameState === 'steal' && (
        <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-3xl p-4 shadow-lg border border-white flex flex-col items-center justify-center animate-in zoom-in-95">
          <h3 className="font-black mb-8 text-slate-800">빨간불에 즉시 터치!!</h3>
          <div onClick={stealState === 'waiting' || stealState === 'ready' ? handleStealClick : undefined} className={`w-full aspect-square max-w-[280px] rounded-[40px] flex flex-col items-center justify-center cursor-pointer transition-all duration-100 select-none ${stealState === 'ready' ? 'bg-red-600 shadow-[0_0_50px_rgba(220,38,38,0.5)]' : 'bg-slate-800 shadow-inner'}`}>
            {stealState === 'idle' && <button onClick={startSteal} className="bg-rose-500 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95">게임 시작 ❯</button>}
            {stealState === 'waiting' && <div className="text-white animate-pulse flex flex-col items-center"><p className="text-7xl mb-4">👀</p><p className="font-black text-xl">견제 중...</p></div>}
            {stealState === 'ready' && <div className="text-white flex flex-col items-center"><p className="text-7xl mb-4">🚨</p><p className="font-black text-5xl">지금!!</p></div>}
            {stealState === 'early' && <div className="text-white flex flex-col items-center gap-4"><p className="text-6xl">🛑</p><p className="font-black text-xl">견제사 당함!</p><button onClick={startSteal} className="mt-4 text-xs font-black text-white bg-rose-600 px-6 py-3 rounded-xl">다시 시도 ↻</button></div>}
            {stealState === 'done' && <div className="text-white flex flex-col items-center gap-4 animate-in zoom-in-90"><p className="font-black text-[50px]">{(stealTime / 1000).toFixed(3)}초</p><p className="text-xs bg-white text-rose-600 px-4 py-2 rounded-lg font-bold">{stealTime < 250 ? "대도 이대형 급! 🚀" : "준수합니다! 🏃‍♂️"}</p><button onClick={startSteal} className="mt-4 text-sm font-black text-slate-900 bg-white px-8 py-3 rounded-xl shadow-md">다시 시도 ↻</button></div>}
          </div>
        </div>
      )}

      {/* --- 광클 뷰 --- */}
      {gameState === 'clicker' && (
        <div className="flex-1 bg-white/90 rounded-3xl p-6 shadow-lg border border-white flex flex-col items-center justify-center animate-in zoom-in-95">
          <div className="flex justify-between w-full mb-10"><div className="flex flex-col items-center"><span className="text-[10px] font-bold text-slate-400">시간</span><span className={`text-4xl font-black ${clickerTime <= 3 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>{clickerTime}s</span></div><div className="flex flex-col items-center"><span className="text-[10px] font-bold text-slate-400">타수</span><span className="text-4xl font-black text-slate-800">{clickerScore}</span></div></div>
          {!clickerActive && clickerTime === 10 ? <button onClick={()=>{setClickerScore(0); setClickerTime(10); setClickerActive(true);}} className="bg-blue-500 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-lg active:scale-95 animate-pulse">도전 시작! 🚀</button> : !clickerActive && clickerTime === 0 ? <div className="flex flex-col items-center gap-4"><p className="text-lg font-black text-slate-800">최종: <span className="text-blue-600 text-4xl">{clickerScore}</span>타!</p><button onClick={()=>{setClickerScore(0); setClickerTime(10); setClickerActive(true);}} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-black active:scale-95">재도전 ↻</button></div> : <button onClick={()=>{setClickerScore(prev=>prev+1); setPop(true); setTimeout(()=>setPop(false),100);}} className={`w-44 h-44 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full shadow-lg flex items-center justify-center text-7xl active:scale-90 transition-all border-4 border-white ${pop ? 'animate-pop' : ''}`}>⚾</button>}
        </div>
      )}

      {/* --- 밸런스 뷰 (댓글 포함) --- */}
      {gameState === 'balance' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white/90 backdrop-blur-xl rounded-3xl p-4 shadow-lg border border-white animate-in zoom-in-95">
          <div className="shrink-0 flex flex-col items-center text-center pb-4 border-b border-slate-100">
            <div className="flex justify-between w-full mb-3"><span className="text-[11px] font-black text-white bg-indigo-500 px-3 py-1.5 rounded-full shadow-md">Q. {balIdx + 1}</span><button onClick={()=>{setVoted(false); setBalIdx((prev) => (prev + 1) % balanceQuestions.length);}} className="text-[10px] font-black text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl active:scale-90 transition-all">건너뛰기 ❯</button></div>
            <h3 className="text-[15px] font-black text-slate-800 mb-5 whitespace-pre-wrap">{balanceQuestions[balIdx].q}</h3>
            <div className="w-full flex gap-2"><button onClick={()=>setVoted(true)} className={`flex-1 p-3 rounded-2xl font-black text-[11px] border-[3px] active:scale-95 ${voted ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-100 text-slate-600'}`}>A. {balanceQuestions[balIdx].a}</button><button onClick={()=>setVoted(true)} className={`flex-1 p-3 rounded-2xl font-black text-[11px] border-[3px] active:scale-95 ${voted ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-slate-100 text-slate-600'}`}>B. {balanceQuestions[balIdx].b}</button></div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col mt-4 bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-indigo-100 text-indigo-800 text-[11px] font-black px-4 py-2 flex justify-between"><span>💬 밸런스 토론장</span><span>{currentBalChats.length}명 참여</span></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {currentBalChats.map((c: any, i: number) => {
                const isMe = c.user === user.name; const teamInfo = KBO_TEAMS.find(t=>t.id===c.team) || KBO_TEAMS[0];
                return (<div key={i} className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}><div className={`flex items-center gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}><span className={`text-[8px] font-black text-white ${teamInfo.color} px-1.5 py-0.5 rounded shadow-sm`}>{c.team}</span><span className="text-[10px] font-bold text-slate-500 cursor-pointer" onClick={()=>!isMe && onUserClick(c)}>{c.user}</span></div><div className={`text-[11px] font-bold px-4 py-2.5 rounded-2xl shadow-sm max-w-[90%] break-keep-all ${isMe ? 'bg-indigo-500 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>{c.text}</div></div>)
              })}
              <div ref={balChatRef} />
            </div>
            <div className="flex gap-2 p-2 bg-white border-t border-slate-200"><input id="balInput" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs px-4 py-3" placeholder="내 생각은..." onKeyDown={e=>e.key==='Enter'&&sendBalChat()} /><button onClick={sendBalChat} className="bg-indigo-500 text-white rounded-xl px-5 text-xs font-black active:scale-95 transition-all">전송</button></div>
          </div>
        </div>
      )}

      {/* --- 운세 뷰 --- */}
      {gameState === 'fortune' && (
        <div className="flex-1 bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white flex flex-col items-center justify-center text-center animate-in zoom-in-95">
          {!fortune ? (
             <div className="flex flex-col items-center gap-8"><div className={`text-8xl transition-all ${isDrawing ? 'animate-spin scale-110' : 'animate-bounce'}`}>🥠</div><p className="text-sm font-black text-slate-600">포춘 쿠키를 열어보세요!</p><button onClick={drawFortune} disabled={isDrawing} className="bg-gradient-to-r from-amber-400 to-red-500 text-white px-10 py-5 rounded-2xl font-black text-lg active:scale-90">{isDrawing ? '분석 중...' : '운세 뽑기 🎯'}</button></div>
          ) : (
            <div className="flex flex-col items-center gap-6 animate-in zoom-in-90 duration-500 w-full"><div className="text-6xl mb-2 drop-shadow-lg">✨</div><p className="text-[11px] font-black text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full border border-orange-200">행운 지수</p><h3 className="text-7xl font-black text-slate-800 tracking-tighter">{fortune.score}<span className="text-3xl text-slate-400 ml-1">점</span></h3><div className="w-full bg-slate-50 border border-slate-200 rounded-[24px] p-6 mt-2 relative shadow-inner"><p className="text-base font-black text-slate-700 leading-relaxed">"{fortune.text}"</p></div><button onClick={drawFortune} className="mt-6 text-[13px] font-black text-slate-400 bg-white px-6 py-3 rounded-xl border active:scale-95 transition-all shadow-sm">↻ 다시 뽑기</button></div>
          )}
        </div>
      )}
    </div>
  );
}

