// ===== 1. API KEY & SMART MODELS =====

let API_KEY = localStorage.getItem('jarvis_key');

if (!API_KEY) {
    API_KEY = prompt('Enter your Gemini API Key:');
    if (API_KEY) localStorage.setItem('jarvis_key', API_KEY);
}

const MODELS = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
];


// ===== 2. MEMORY SYSTEM =====

let MEMORY = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');

function saveMemory() {
    localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
}

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');
const camBtn = document.getElementById('cam-btn');
const imgInput = document.getElementById('img-input');

MEMORY.forEach(m =>
    add(
        (m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text,
        m.role === 'user' ? 'user' : 'ai'
    )
);

// ===== 3. TOOLS (THE HANDS) — 15 TOOLS =====
async function handleTools(text){
const t = text.toLowerCase();
// 1. Time
if(/\btime\b/.test(t)||t.includes('టైమ్')||t.includes('సమయం'))
return 'The time is '+new Date().toLocaleTimeString()+', Boss.';
// 2. Weather
if(t.includes('weather')||t.includes('వాతావరణం')){
return await new Promise(res=>{
navigator.geolocation.getCurrentPosition(async p=>{
try{
const r=await fetch(`https://api.open-meteo.com/v1/forecast?
latitude=${p.coords.latitude}&longitude=${p.coords.longitude}¤t_weather=true`);
const d=await r.json();
res(`It is ${d.current_weather.temperature} degrees Celsius now, Boss.`);
}catch(e){ res('Weather service error, Boss.'); }
}, ()=> res('I need location permission for weather, Boss.'));
});
}
// 3. Timer
const m=t.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i);
if((t.includes('timer')||t.includes('టైమర్'))&&m){
const amount=parseInt(m[1]); const unit=m[2].toLowerCase();
const factor=/^(hours?|hrs?|h)/.test(unit)?3600000:/^(seconds?|secs?|s)/.test(unit)?1000:60000;
const duration=amount*factor;
setTimeout(()=>speak(`టైమర్ పూంది! ${amount} ${unit} అయాయి.`),duration);
return `Timer set for ${amount} ${unit}.`;
}
// 4. Translate
if(t.includes('translate')){
const q=text.replace(/translate (this )?/i,'').trim()||'hello';
try{ 
const r=await fetch('https://api.mymemory.translated.net/get?
q='+encodeURIComponent(q)+'&langpair=en|te');
const d=await r.json(); return 'In Telugu: '+d.responseData.translatedText; 
}catch(e){ return 'Translate error, Boss.'; }
}
// 5. YouTube Play
if(t.includes('play ')||t.includes('youtube ')){
const q=text.replace(/play |youtube (search )?/i,'').trim();
if(q){ window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(q)); 
return 'Searching YouTube for '+q+', Boss.'; }
}
return null; // Tool match కాకపోతే Gemini Brain కి వెళంద
