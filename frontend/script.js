// ======================================================
// 1. API KEY & SMART GEMINI MODELS
// ======================================================

let API_KEY = localStorage.getItem('jarvis_key');

if (!API_KEY) {
    API_KEY = prompt('Enter your Gemini API Key:');

    if (API_KEY) {
        localStorage.setItem('jarvis_key', API_KEY);
    }
}

const MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest"
];


// ======================================================
// 2. MEMORY SYSTEM
// ======================================================

let MEMORY = JSON.parse(
    localStorage.getItem('jarvis_memory') || '[]'
);

function saveMemory() {
    localStorage.setItem(
        'jarvis_memory',
        JSON.stringify(MEMORY)
    );
}

const chat = document.getElementById('chat');
const input = document.getElementById('msg');

const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');
const camBtn = document.getElementById('cam-btn');

const imgInput = document.getElementById('img-input');
const sendBtn = document.getElementById('send');


// Restore previous conversation

MEMORY.forEach(m => {

    add(
        (m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text,
        m.role === 'user' ? 'user' : 'ai'
    );

});


// ======================================================
// 3. GEMINI BRAIN
// ======================================================

async function callGemini(p) {

    const contents = MEMORY.slice(-12).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    contents.push({
        role: 'user',
        parts: [{ text: p }]
    });

    let lastErr;

    for (const model of MODELS) {

        try {

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({

                        contents: contents,

                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048
                        }

                    })
                }
            );

            const data = await res.json();

            if (!res.ok || data.error) {

                lastErr = new Error(
                    data.error?.message || `HTTP ${res.status}`
                );

                continue;
            }

            const reply = data.candidates?.[0]?.content?.parts
                ?.map(part => part.text || '')
                .join('')
                .trim();

            if (!reply) {
                lastErr = new Error('Gemini returned an empty response.');
                continue;
            }

            return reply;

        } catch (e) {

            lastErr = e;

        }
    }

    throw lastErr || new Error('All Gemini models failed.');

}


// ======================================================
// 4. ASK GEMINI
// ======================================================

async function askGemini(p) {

    const thinking = add(
        'J.A.R.V.I.S: Thinking...',
        'ai'
    );

    try {

        const reply = await callGemini(p);

        MEMORY.push({
            role: 'user',
            text: p
        });

        MEMORY.push({
            role: 'model',
            text: reply
        });

        saveMemory();

        thinking.innerText = 'J.A.R.V.I.S: ' + reply;

        speak(reply);

    } catch (e) {

        thinking.innerText =
            'J.A.R.V.I.S: ERROR - ' + e.message;

        console.error('Gemini Error:', e);

    }

}


// ======================================================
// 5. TOOLS - THE HANDS
// ======================================================

async function handleTools(text) {

    const t = text.toLowerCase();


    // 1. TIME

    if (
        /\btime\b/.test(t) ||
        t.includes('టైమ్') ||
        t.includes('సమయం')
    ) {

        return 'The time is ' +
            new Date().toLocaleTimeString() +
            ', Boss.';

    }


    // 2. WEATHER

    if (
        t.includes('weather') ||
        t.includes('వాతావరణం')
    ) {

        return await new Promise(resolve => {

            if (!navigator.geolocation) {
                resolve('Location is not supported by this browser, Boss.');
                return;
            }

            navigator.geolocation.getCurrentPosition(

                async p => {

                    try {

                        const r = await fetch(
                            `https://api.open-meteo.com/v1/forecast?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature`
                        );

                        if (!r.ok) {
                            throw new Error('Weather request failed');
                        }

                        const d = await r.json();

                        const weather = d.current;

                        resolve(
                            `Current temperature is ${weather.temperature_2m} degrees Celsius. ` +
                            `Feels like ${weather.apparent_temperature} degrees. ` +
                            `Humidity is ${weather.relative_humidity_2m} percent, Boss.`
                        );

                    } catch (e) {

                        resolve('Weather service error, Boss.');

                    }

                },

                () => resolve(
                    'I need location permission for weather, Boss.'
                )

            );

        });

    }


    // 3. TIMER

    const timerMatch = t.match(
        /(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/
    );

    if (
        (t.includes('timer') || t.includes('టైమర్')) &&
        timerMatch
    ) {

        const amount = parseInt(timerMatch[1]);

        const unit = timerMatch[2];

        const factor =
            /^(hours?|hrs?)/.test(unit) ? 3600000 :
            /^(seconds?|secs?)/.test(unit) ? 1000 :
            60000;

        const duration = amount * factor;

        setTimeout(() => {

            speak(
                `Boss, your timer is complete. ${amount} ${unit} finished.`
            );

            add(
                'J.A.R.V.I.S: Timer completed!',
                'ai'
            );

        }, duration);

        return `Timer set for ${amount} ${unit}, Boss.`;

    }


    // 4. TRANSLATION

    if (t.includes('translate')) {

        const q = text
            .replace(/translate (this )?/i, '')
            .trim();

        if (!q) {
            return 'Please tell me what you want to translate, Boss.';
        }

        try {

            const r = await fetch(
                'https://api.mymemory.translated.net/get?q=' +
                encodeURIComponent(q) +
                '&langpair=en|te'
            );

            const d = await r.json();

            return 'In Telugu: ' +
                d.responseData.translatedText;

        } catch (e) {

            return 'Translation service error, Boss.';

        }

    }


    // 5. YOUTUBE SEARCH

    if (
        t.includes('play ') ||
        t.includes('youtube ')
    ) {

        const q = text
            .replace(/play\s+/i, '')
            .replace(/youtube\s*(search\s*)?/i, '')
            .trim();

        if (q) {

            window.open(
                'https://www.youtube.com/results?search_query=' +
                encodeURIComponent(q),
                '_blank'
            );

            return `Searching YouTube for ${q}, Boss.`;

        }

    }


    // NO TOOL MATCH

    return null;

}


// ======================================================
// 6. EXECUTE BUTTON
// ======================================================

async function executeCommand() {

    const t = input.value.trim();

    if (!t) return;

    add('YOU: ' + t, 'user');

    input.value = '';

    const toolReply = await handleTools(t);

    if (toolReply !== null) {

        MEMORY.push({
            role: 'user',
            text: t
        });

        MEMORY.push({
            role: 'model',
            text: toolReply
        });

        saveMemory();

        add('J.A.R.V.I.S: ' + toolReply, 'ai');

        speak(toolReply);

    } else {

        askGemini(t);

    }

}

if (sendBtn) {
    sendBtn.onclick = executeCommand;
}


// Enter key support

if (input) {

    input.addEventListener('keydown', e => {

        if (e.key === 'Enter') {
            executeCommand();
        }

    });

}


// ======================================================
// 7. CAMERA & VISION ENGINE
// ======================================================

if (camBtn && imgInput) {

    camBtn.onclick = () => {

        imgInput.click();

    };


    imgInput.onchange = () => {

        const file = imgInput.files[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {

            const base64 = reader.result.split(',')[1];

            const q = input.value.trim() ||
                'What do you see? Describe briefly.';

            add('YOU: [IMAGE] ' + q, 'user');

            input.value = '';

            askVision(base64, file.type, q);

        };

        reader.readAsDataURL(file);

    };

}


async function askVision(base64, mime, q) {

    const thinking = add(
        'J.A.R.V.I.S: Analyzing image...',
        'ai'
    );

    let lastErr;

    for (const model of MODELS) {

        try {

            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
                {

                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({

                        contents: [
                            {
                                role: 'user',

                                parts: [
                                    { text: q },

                                    {
                                        inline_data: {
                                            mime_type: mime,
                                            data: base64
                                        }
                                    }
                                ]
                            }
                        ],

                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048
                        }

                    })

                }
            );

            const data = await res.json();

            if (!res.ok || data.error) {

                lastErr = new Error(
                    data.error?.message || `HTTP ${res.status}`
                );

                continue;

            }

            const reply = data.candidates?.[0]?.content?.parts
                ?.map(part => part.text || '')
                .join('')
                .trim();

            if (!reply) {

                lastErr = new Error('No image response received.');

                continue;

            }

            thinking.innerText = 'J.A.R.V.I.S: ' + reply;

            speak(reply);

            MEMORY.push({
                role: 'user',
                text: '[Image] ' + q
            });

            MEMORY.push({
                role: 'model',
                text: reply
            });

            saveMemory();

            return;

        } catch (e) {

            lastErr = e;

        }

    }

    thinking.innerText =
        'J.A.R.V.I.S: ERROR - ' +
        (lastErr?.message || 'Image analysis failed.');

}


// ======================================================
// 8. VOICE RECOGNITION
// ======================================================

const SR =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SR && micBtn) {

    const rec = new SR();

    rec.lang = 'en-US';

    rec.continuous = false;

    rec.interimResults = false;


    rec.onresult = async e => {

        const t = e.results[0][0].transcript;

        add('YOU: ' + t, 'user');

        const toolReply = await handleTools(t);

        if (toolReply !== null) {

            MEMORY.push({
                role: 'user',
                text: t
            });

            MEMORY.push({
                role: 'model',
                text: toolReply
            });

            saveMemory();

            add('J.A.R.V.I.S: ' + toolReply, 'ai');

            speak(toolReply);

        } else {

            askGemini(t);

        }

    };


    micBtn.onclick = () => {

        try {

            rec.start();

            micBtn.innerText = 'LISTENING...';

        } catch (e) {

            console.error(e);

        }

    };


    rec.onend = () => {

        micBtn.innerText = '🎙';

    };


    rec.onerror = e => {

        console.error('Voice Error:', e.error);

        micBtn.innerText = '🎙';

    };

}


// ======================================================
// 9. TEXT TO SPEECH
// ======================================================

let voices = [];

function loadVoices() {

    voices = speechSynthesis.getVoices();

}

loadVoices();

speechSynthesis.onvoiceschanged = loadVoices;


function speak(t) {

    if (!('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(t);

    u.rate = 1.05;

    u.pitch = 0.85;

    u.volume = 1;

    const v = voices.find(
        voice => voice.lang.startsWith('en')
    );

    if (v) {
        u.voice = v;
    }

    speechSynthesis.speak(u);

}


// ======================================================
// 10. CLEAR MEMORY
// ======================================================

if (clearBtn) {

    clearBtn.onclick = () => {

        MEMORY = [];

        saveMemory();

        chat.innerHTML = '';

        add(
            'SYSTEM: Memory cleared successfully.',
            'ai'
        );

        speak('Memory cleared successfully, Boss.');

    };

}


// ======================================================
// 11. CHAT DISPLAY
// ======================================================

function add(t, w) {

    const d = document.createElement('div');

    d.className = 'msg ' + w;

    d.innerText = t;

    chat.appendChild(d);

    chat.scrollTop = chat.scrollHeight;

    return d;

}


// ======================================================
// 12. SYSTEM READY
// ======================================================

console.log('J.A.R.V.I.S SYSTEM INITIALIZED');

console.log('Gemini Brain: READY');

console.log('Memory System: ACTIVE');

console.log('Voice Interface: READY');

console.log('Vision Engine: READY');

console.log('Tools Engine: READY');
