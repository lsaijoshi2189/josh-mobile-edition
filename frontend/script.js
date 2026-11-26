// ======================================================
// J.A.R.V.I.S PERSONAL AI ASSISTANT
// GEMINI POWERED
// ======================================================


// ======================================================
// 1. API KEY
// ======================================================

let API_KEY = localStorage.getItem("jarvis_key");

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        localStorage.setItem("jarvis_key", API_KEY.trim());
    }
}

const MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite"
];


// ======================================================
// 2. MEMORY SYSTEM
// ======================================================

let MEMORY = [];

try {

    const storedMemory = JSON.parse(
        localStorage.getItem("jarvis_memory") || "[]"
    );

    if (Array.isArray(storedMemory)) {

        MEMORY = storedMemory.filter(m =>
            m &&
            (m.role === "user" || m.role === "model") &&
            typeof m.text === "string" &&
            !(
                m.role === "model" &&
                /^(?:Your strong password:|ఇదిగో strong password:)/i.test(m.text)
            )
        );

        if (MEMORY.length !== storedMemory.length) {
            localStorage.setItem(
                "jarvis_memory",
                JSON.stringify(MEMORY)
            );
        }

    }

} catch (e) {

    localStorage.removeItem("jarvis_memory");

}


function saveMemory() {

    localStorage.setItem(
        "jarvis_memory",
        JSON.stringify(MEMORY)
    );

}


function addMemory(role, text) {

    MEMORY.push({
        role: role,
        text: text
    });

    // Keep memory within browser storage limits.
    MEMORY = MEMORY.slice(-40);

    saveMemory();

}


// ======================================================
// 3. HTML ELEMENTS
// ======================================================

const chat = document.getElementById("chat");

const input = document.getElementById("msg");

const sendBtn = document.getElementById("send");

const micBtn = document.getElementById("mic-btn");

const clearBtn = document.getElementById("clear-btn");

const camBtn = document.getElementById("cam-btn");

const imgInput = document.getElementById("img-input");


// ======================================================
// 4. CHAT DISPLAY
// ======================================================

function add(text, type = "ai") {

    const message = document.createElement("div");

    message.className = "msg " + type;

    message.textContent = text;

    chat.appendChild(message);

    chat.scrollTop = chat.scrollHeight;

}


MEMORY.forEach(m => {

    add(
        (m.role === "user" ? "YOU: " : "J.A.R.V.I.S: ") + m.text,
        m.role === "user" ? "user" : "ai"
    );

});


// ======================================================
// 5. API REQUEST HANDLER
// ======================================================

async function fetchToolJson(url, options = {}, timeoutMs = 15000) {

    const controller = new AbortController();

    const timeoutId = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {

        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error("HTTP ERROR: " + response.status);
        }

        return await response.json();

    } finally {

        clearTimeout(timeoutId);

    }

}


// ======================================================
// 6. GEMINI BRAIN
// ======================================================

async function callGeminiRaw(promptText, imageData = null) {

    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    const contents = MEMORY.slice(-12).map(m => ({

        role: m.role,

        parts: [
            {
                text: m.text
            }
        ]

    }));

    const parts = [
        {
            text: promptText
        }
    ];

    // Image support
    if (imageData) {

        parts.push({

            inlineData: {

                mimeType: imageData.mimeType,

                data: imageData.data

            }

        });

    }

    contents.push({

        role: "user",

        parts: parts

    });


    let lastError;

    for (const model of MODELS) {

        try {

            add("J.A.R.V.I.S: Connecting to " + model, "ai");

            const url =
                "https://generativelanguage.googleapis.com/v1beta/models/" +
                model +
                ":generateContent?key=" +
                encodeURIComponent(API_KEY);

            const response = await fetchToolJson(

                url,

                {

                    method: "POST",

                    headers: {

                        "Content-Type": "application/json"

                    },

                    body: JSON.stringify({

                        contents: contents,

                        generationConfig: {

                            temperature: 0.7,

                            maxOutputTokens: 4096

                        }

                    })

                },

                60000

            );

            if (response.error) {

                throw new Error(response.error.message);

            }

            const result =
                response.candidates?.[0]?.content?.parts
                    ?.filter(p => p.text)
                    .map(p => p.text)
                    .join("\n");

            if (!result) {

                throw new Error("Gemini returned an empty response.");

            }

            return result;

        } catch (error) {

            lastError = error;

            console.error(model, error);

            const message = String(error.message).toLowerCase();

            const shouldFallback =

                message.includes("quota") ||
                message.includes("rate") ||
                message.includes("temporar") ||
                message.includes("unavailable") ||
                message.includes("not found") ||
                message.includes("not supported") ||
                message.includes("high demand") ||
                message.includes("503") ||
                message.includes("429");

            if (!shouldFallback) {

                throw error;

            }

        }

    }

    throw lastError || new Error("All Gemini models failed.");

}


// ======================================================
// 7. GEMINI RESPONSE
// ======================================================

async function callGemini(promptText, imageData = null) {

    const response = await callGeminiRaw(
        promptText,
        imageData
    );

    return response;

}


// ======================================================
// 8. J.A.R.V.I.S PERSONALITY
// ======================================================

const SYSTEM_PROMPT = `

You are J.A.R.V.I.S.

You are a highly intelligent personal AI assistant.

Your personality:

1. Speak professionally and intelligently.
2. Address the user as Boss occasionally.
3. Be friendly and natural.
4. Give accurate technical explanations.
5. Remember relevant previous conversations.
6. Never invent facts.
7. Explain difficult concepts in simple language.
8. Support Telugu and English.
9. Use Telugu-English mix when appropriate.
10. Give detailed answers when necessary.

You are an advanced personal assistant inspired by
the J.A.R.V.I.S system.

Always understand the user's actual intention.

`;


// ======================================================
// 9. BROWSER TOOLS
// ======================================================

async function handleTools(text) {

    const original = String(text).trim();

    const t = original.toLowerCase();


    // TIME

    if (
        /^(?:what(?:'s| is)? the )?time(?: now)?\??$/i.test(t)
    ) {

        return "Current time: " +
            new Date().toLocaleTimeString();

    }


    // DATE

    if (
        /^(?:what(?:'s| is)? the )?date(?: today)?\??$/i.test(t)
    ) {

        return "Today's date: " +
            new Date().toLocaleDateString();

    }


    // OPEN YOUTUBE

    if (
        /^(?:please )?(?:open youtube|youtube open|youtube)(?: please)?[.!?]?$/i.test(original)
    ) {

        window.open(
            "https://youtube.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening YouTube, Boss.";

    }


    // OPEN GOOGLE

    if (
        /^(?:please )?(?:open google|google open|google)(?: please)?[.!?]?$/i.test(original)
    ) {

        window.open(
            "https://google.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening Google, Boss.";

    }


    // OPEN WEBSITE

    const urlCommand = original.match(
        /^(?:open|visit|go to)\s+(https?:\/\/\S+)$/i
    );

    if (urlCommand) {

        try {

            const destination = new URL(urlCommand[1]);

            if (
                destination.protocol !== "https:" &&
                destination.protocol !== "http:"
            ) {

                return "Only HTTP and HTTPS links can be opened.";

            }

            window.open(
                destination.href,
                "_blank",
                "noopener,noreferrer"
            );

            return "Opening " + destination.hostname + ", Boss.";

        } catch (e) {

            return "That link does not look valid.";

        }

    }


    // GOOGLE SEARCH

    const googleSearch = original.match(
        /^(?:google search|search (?:on )?google)(?: for)?\s+(.+)$/i
    );

    if (googleSearch) {

        const query = googleSearch[1].trim();

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(query),
            "_blank",
            "noopener,noreferrer"
        );

        return "Searching Google for " + query + ", Boss.";

    }


    // YOUTUBE SEARCH

    const youtubeSearch = original.match(
        /^(?:play|youtube(?: search)?(?: for)?|search (?:on )?youtube(?: for)?)\s+(.+)$/i
    );

    if (youtubeSearch) {

        const query = youtubeSearch[1].trim();

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(query),
            "_blank",
            "noopener,noreferrer"
        );

        return "Searching YouTube for " + query + ", Boss.";

    }


    // WIKIPEDIA SEARCH

    const searchMatch = original.match(
        /^(?:search|look up)(?: for)?\s+(.+)$/i
    );

    if (searchMatch) {

        const query = searchMatch[1].trim();

        try {

            const url =
                "https://en.wikipedia.org/w/api.php" +
                "?action=query&list=search&srlimit=1&srsearch=" +
                encodeURIComponent(query) +
                "&format=json&origin=*";

            const data = await fetchToolJson(url);

            const result = data?.query?.search?.[0];

            if (!result) {

                return "I could not find that, Boss.";

            }

            const snippet = document.createElement("div");

            snippet.innerHTML = result.snippet || "";

            return "Wikipedia: " +
                result.title +
                ". " +
                snippet.textContent;

        } catch (e) {

            return "Search error, Boss.";

        }

    }


    // WEATHER SEARCH

    if (/\bweather\b/i.test(t)) {

        const location = original
            .replace(/weather/ig, "")
            .replace(/in/ig, "")
            .trim();

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent("weather " + location),
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening weather information.";

    }


    // NEWS SEARCH

    if (/\b(news|headlines)\b/i.test(t)) {

        window.open(
            "https://news.google.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening latest news, Boss.";

    }


    // CRYPTO SEARCH

    if (/\b(bitcoin|crypto|btc)\b/i.test(t)) {

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(original + " latest price"),
            "_blank",
            "noopener,noreferrer"
        );

        return "Opening cryptocurrency information.";

    }


    return null;

}


// ======================================================
// 10. AGENT MODE
// ======================================================

const AGENT_TOOLS = Object.freeze({

    time: async () => {

        return new Date().toLocaleString();

    },

    weather: async () => {

        window.open(
            "https://www.google.com/search?q=current+weather",
            "_blank",
            "noopener,noreferrer"
        );

        return "Weather information opened.";

    },

    news: async () => {

        window.open(
            "https://news.google.com",
            "_blank",
            "noopener,noreferrer"
        );

        return "Latest news opened.";

    },

    crypto: async () => {

        window.open(
            "https://www.google.com/search?q=bitcoin+price",
            "_blank",
            "noopener,noreferrer"
        );

        return "Cryptocurrency information opened.";

    }

});


function isAgentModeRequest(text = "") {

    return /\b(agent mode|run agent|use agent|agent briefing)\b/i.test(text);

}


function parseAgentToolPlan(responseText) {

    const text = String(responseText)
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    const start = text.indexOf("[");

    const end = text.lastIndexOf("]");

    if (start < 0 || end < start) {

        return [];

    }

    const parsed = JSON.parse(
        text.slice(start, end + 1)
    );

    const allowed = Object.keys(AGENT_TOOLS);

    return [
        ...new Set(
            parsed
                .filter(item => typeof item === "string")
                .map(item => item.toLowerCase())
                .filter(item => allowed.includes(item))
        )
    ];

}


async function runAgent(goal) {

    add("AGENT MODE ACTIVATED", "ai");

    add("Analyzing your objective...", "ai");


    const planPrompt = `

Choose the necessary tools for this objective.

Available tools:

["time", "weather", "news", "crypto"]

Return ONLY a JSON array.

Objective: ${goal}

Example:

["time", "news"]

`;

    let toolsToRun = [];

    try {

        const plan = await callGeminiRaw(planPrompt);

        toolsToRun = parseAgentToolPlan(plan);

    } catch (error) {

        console.error(error);

    }


    const results = {};


    for (let i = 0; i < toolsToRun.length; i++) {

        const tool = toolsToRun[i];

        add(
            "Running " + tool + " tool...",
            "ai"
        );

        try {

            results[tool] = await AGENT_TOOLS[tool]();

        } catch (e) {

            results[tool] = "Tool failed.";

        }

    }


    const summary = await callGemini(

        SYSTEM_PROMPT +

        "\n\nObjective: " + goal +

        "\n\nTool results: " +

        JSON.stringify(results) +

        "\n\nProvide a useful summary."

    );


    return summary;

}


// ======================================================
// 11. VOICE OUTPUT
// ======================================================

function speak(text) {

    if (!("speechSynthesis" in window)) {

        return;

    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);

    speech.lang = "en-IN";

    speech.rate = 1;

    speech.pitch = 1;

    speech.volume = 1;

    window.speechSynthesis.speak(speech);

}


// ======================================================
// 12. VOICE INPUT
// ======================================================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;


if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";

    recognition.continuous = false;

    recognition.interimResults = false;

    recognition.onstart = () => {

        add("J.A.R.V.I.S: Listening, Boss...", "ai");

    };


    recognition.onresult = event => {

        const transcript =
            event.results[0][0].transcript;

        input.value = transcript;

        sendMessage();

    };


    recognition.onerror = event => {

        add(
            "Voice error: " + event.error,
            "ai"
        );

    };


    recognition.onend = () => {

        micBtn.style.opacity = "1";

    };

}


micBtn.addEventListener("click", () => {

    if (!recognition) {

        add(
            "Voice recognition is not supported in this browser.",
            "ai"
        );

        return;

    }

    try {

        micBtn.style.opacity = "0.5";

        recognition.start();

    } catch (e) {

        console.error(e);

    }

});


// ======================================================
// 13. IMAGE ANALYSIS
// ======================================================

let selectedImage = null;


camBtn.addEventListener("click", () => {

    imgInput.click();

});


imgInput.addEventListener("change", async event => {

    const file = event.target.files[0];

    if (!file) return;


    if (!file.type.startsWith("image/")) {

        add("Please select a valid image.", "ai");

        return;

    }


    if (file.size > 10 * 1024 * 1024) {

        add("Image must be smaller than 10 MB.", "ai");

        return;

    }


    try {

        const reader = new FileReader();

        reader.onload = async () => {

            const base64 = reader.result.split(",")[1];

            selectedImage = {

                mimeType: file.type,

                data: base64

            };

            add("Image selected. Analyzing...", "ai");

            try {

                const answer = await callGemini(

                    SYSTEM_PROMPT +

                    "\n\nAnalyze this image carefully. " +
                    "Describe its contents and answer accurately.",

                    selectedImage

                );

                add("J.A.R.V.I.S: " + answer, "ai");

                addMemory("model", answer);

            } catch (error) {

                add(
                    "Image analysis error: " + error.message,
                    "ai"
                );

            }

        };


        reader.readAsDataURL(file);

    } catch (error) {

        add(
            "Unable to process image.",
            "ai"
        );

    }

});


// ======================================================
// 14. MAIN MESSAGE HANDLER
// ======================================================

let isProcessing = false;


async function sendMessage() {

    if (isProcessing) return;


    const text = input.value.trim();

    if (!text) return;


    input.value = "";

    add("YOU: " + text, "user");

    addMemory("user", text);


    isProcessing = true;

    sendBtn.disabled = true;


    try {

        let response;


        // AGENT MODE

        if (isAgentModeRequest(text)) {

            response = await runAgent(text);

        }


        // BROWSER TOOLS

        else {

            const toolResponse = await handleTools(text);

            if (toolResponse !== null) {

                response = toolResponse;

            }

        }


        // GEMINI AI

        if (response === undefined) {

            response = await callGemini(

                SYSTEM_PROMPT +

                "\n\nPrevious conversation is available in memory." +

                "\n\nUser: " + text

            );

        }


        add("J.A.R.V.I.S: " + response, "ai");

        addMemory("model", response);


    } catch (error) {

        console.error(error);

        add(
            "SYSTEM ERROR: " + error.message,
            "ai"
        );

    } finally {

        isProcessing = false;

        sendBtn.disabled = false;

        input.focus();

    }

}


// ======================================================
// 15. SEND BUTTON
// ======================================================

sendBtn.addEventListener("click", sendMessage);


input.addEventListener("keydown", event => {

    if (event.key === "Enter") {

        sendMessage();

    }

});


// ======================================================
// 16. CLEAR MEMORY
// ======================================================

clearBtn.addEventListener("click", () => {

    const confirmClear = confirm(
        "Boss, do you want to clear all J.A.R.V.I.S memories?"
    );

    if (!confirmClear) return;


    MEMORY = [];

    localStorage.removeItem("jarvis_memory");

    chat.innerHTML = "";

    add(
        "J.A.R.V.I.S: Memory successfully cleared, Boss.",
        "ai"
    );

});


// ======================================================
// 17. SYSTEM INITIALIZATION
// ======================================================

add(
    "J.A.R.V.I.S ONLINE.",
    "ai"
);

add(
    "Gemini AI connection initialized.",
    "ai"
);

add(
    "Long-term memory: " + MEMORY.length + " records.",
    "ai"
);

add(
    "Voice interface: " +
    (recognition ? "READY" : "NOT SUPPORTED"),
    "ai"
);

add(
    "SYSTEM READY. HOW CAN I HELP YOU, BOSS?",
    "ai"
);


// ======================================================
// END OF J.A.R.V.I.S
// ======================================================
