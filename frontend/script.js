// ======================================================
// J.A.R.V.I.S - PERSONAL AI ASSISTANT
// Gemini Pro + Voice + Memory + WhatsApp + Image Analysis
// ======================================================


// ================= CONFIGURATION ======================

const MODELS = [
    "gemini-3.1-pro-preview",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite"
];

const API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/";

const STORAGE = {
    key: "jarvis_key",
    memory: "jarvis_memory",
    contacts: "jarvis_contacts"
};


// ================= HTML ELEMENTS ======================

const chat = document.getElementById("chat");
const msg = document.getElementById("msg");
const sendBtn = document.getElementById("send");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const clearBtn = document.getElementById("clear-btn");
const imgInput = document.getElementById("img-input");


// ================= API KEY ============================

let API_KEY = localStorage.getItem(STORAGE.key);

if (!API_KEY) {
    API_KEY = prompt("Enter your Gemini API Key:");

    if (API_KEY) {
        localStorage.setItem(STORAGE.key, API_KEY.trim());
        API_KEY = API_KEY.trim();
    }
}


// ================= MEMORY =============================

let memory = JSON.parse(
    localStorage.getItem(STORAGE.memory) || "[]"
);

function saveMemory() {
    localStorage.setItem(
        STORAGE.memory,
        JSON.stringify(memory.slice(-40))
    );
}

function addMemory(role, text) {
    memory.push({
        role,
        text,
        time: new Date().toISOString()
    });

    saveMemory();
}


// ================= CONTACTS ===========================

let contacts = JSON.parse(
    localStorage.getItem(STORAGE.contacts) || "{}"
);

function saveContacts() {
    localStorage.setItem(
        STORAGE.contacts,
        JSON.stringify(contacts)
    );
}

function addContact(name, phone) {
    name = name.trim();

    phone = phone.replace(/\D/g, "");

    if (phone.length < 10 || phone.length > 15) {
        return "Please provide a valid phone number with country code.";
    }

    contacts[name.toLowerCase()] = {
        name,
        phone
    };

    saveContacts();

    return `Contact ${name} saved successfully.`;
}

function findContact(name) {
    return contacts[name.toLowerCase()] || null;
}

function deleteContact(name) {
    const key = name.toLowerCase();

    if (!contacts[key]) {
        return `I could not find ${name} in your contacts.`;
    }

    delete contacts[key];

    saveContacts();

    return `${name} has been deleted from your contacts.`;
}

function showContacts() {
    const list = Object.values(contacts);

    if (!list.length) {
        return "Your contact list is empty.";
    }

    return list.map(c =>
        `${c.name}: ${c.phone}`
    ).join("\n");
}


// ================= CHAT DISPLAY =======================

function add(text, type = "ai") {

    const div = document.createElement("div");

    div.className = "msg " + type;

    div.textContent = text;

    chat.appendChild(div);

    chat.scrollTop = chat.scrollHeight;

    return div;
}


// ================= TEXT TO SPEECH =====================

let speechEnabled = true;

function speak(text) {

    if (!speechEnabled || !window.speechSynthesis) {
        return;
    }

    window.speechSynthesis.cancel();

    const cleanText = String(text)
        .replace(/```[\s\S]*?```/g, "Code omitted.")
        .replace(/[*#`]/g, "")
        .replace(/https?:\/\/\S+/g, "link")
        .replace(/\n+/g, ". ")
        .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onerror = event => {
        console.error("Speech error:", event.error);
    };

    window.speechSynthesis.speak(utterance);

    window.speechSynthesis.resume();
}


// ================= GEMINI API =========================

async function askGemini(promptText, imageData = null) {

    if (!API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    const conversation = memory
        .slice(-20)
        .map(item => ({
            role: item.role === "model" ? "model" : "user",
            parts: [{ text: item.text }]
        }));

    const currentParts = [
        { text: promptText }
    ];

    if (imageData) {
        currentParts.push({
            inlineData: {
                mimeType: imageData.mimeType,
                data: imageData.data
            }
        });
    }

    conversation.push({
        role: "user",
        parts: currentParts
    });

    const systemInstruction = `
You are J.A.R.V.I.S., an intelligent personal AI assistant.

Your personality:
- Speak professionally, politely and confidently.
- Be intelligent, friendly and helpful.
- Address the user as Boss occasionally.
- Give clear and accurate answers.
- Explain difficult technical concepts simply.
- Use Indian English when appropriate.
- Do not reveal internal model names or technical connection details.
- Do not claim that you performed an action unless it was actually performed.
- Keep normal answers concise unless detailed explanation is requested.
- When asked to speak, respond naturally and conversationally.
`;

    let lastError;

    for (const model of MODELS) {

        try {

            const response = await fetch(
                API_URL + model + ":generateContent",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": API_KEY
                    },

                    body: JSON.stringify({

                        systemInstruction: {
                            parts: [{
                                text: systemInstruction
                            }]
                        },

                        contents: conversation,

                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048
                        }
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {

                lastError = new Error(
                    data.error?.message || "AI request failed."
                );

                // Try another supported model for model/quota errors.
                if (
                    [400, 403, 404, 429, 500, 503].includes(response.status)
                ) {
                    continue;
                }

                throw lastError;
            }

            const answer = data.candidates?.[0]?.content?.parts
                ?.map(part => part.text || "")
                .join("")
                .trim();

            if (!answer) {
                throw new Error("No response received.");
            }

            return answer;

        } catch (error) {

            lastError = error;

            if (error instanceof TypeError) {
                throw new Error(
                    "Network connection failed. Please check your internet."
                );
            }
        }
    }

    throw lastError || new Error("Unable to get an AI response.");
}


// ================= WHATSAPP ===========================

let pendingWhatsApp = null;

function prepareWhatsApp(name, message) {

    const contact = findContact(name);

    if (!contact) {
        return `I cannot find ${name}. Please save their number first.`;
    }

    pendingWhatsApp = {
        name: contact.name,
        phone: contact.phone,
        message
    };

    return `I have prepared a WhatsApp message for ${contact.name}.

Message: ${message}

Say Confirm WhatsApp to open WhatsApp, or Cancel to stop.`;
}

function openWhatsApp() {

    if (!pendingWhatsApp) {
        return "There is no pending WhatsApp message.";
    }

    const { phone, message } = pendingWhatsApp;

    const url =
        "https://wa.me/" +
        phone +
        "?text=" +
        encodeURIComponent(message);

    window.open(url, "_blank");

    const name = pendingWhatsApp.name;

    pendingWhatsApp = null;

    return `WhatsApp opened for ${name}. Please press Send in WhatsApp to deliver the message.`;
}


// ================= COMMAND PROCESSING ==================

function processCommand(text) {

    const lower = text.toLowerCase().trim();

    // Save contact:
    // Remember Rahul's number is 919876543210

    let match = text.match(
        /(?:remember|save|add)\s+(.+?)(?:'s)?\s+(?:number|phone)\s+(?:is\s+)?(\+?\d[\d\s-]{8,})/i
    );

    if (match) {
        return addContact(match[1], match[2]);
    }

    // Show contacts

    if (
        lower.includes("show contacts") ||
        lower.includes("list contacts") ||
        lower.includes("my contacts")
    ) {
        return showContacts();
    }

    // Delete contact

    match = text.match(
        /(?:forget|delete|remove)\s+(.+?)(?:'s)?\s+(?:number|contact)/i
    );

    if (match) {
        return deleteContact(match[1]);
    }

    // Confirm WhatsApp

    if (
        lower === "confirm whatsapp" ||
        lower === "send whatsapp" ||
        lower === "confirm"
    ) {
        return openWhatsApp();
    }

    // Cancel WhatsApp

    if (
        lower === "cancel" ||
        lower === "cancel whatsapp"
    ) {
        pendingWhatsApp = null;
        return "WhatsApp action cancelled.";
    }

    // WhatsApp message

    match = text.match(
        /(?:send whatsapp to|send)\s+(.+?)\s+(?:saying|message|that)\s+(.+)/i
    );

    if (match) {
        return prepareWhatsApp(match[1], match[2]);
    }

    // Birthday wishes

    match = text.match(
        /wish\s+(.+?)\s+(?:a\s+)?happy birthday/i
    );

    if (match) {
        return prepareWhatsApp(
            match[1],
            `Happy Birthday ${match[1]}! Wishing you lots of happiness, success and good health!`
        );
    }

    // Anniversary wishes

    match = text.match(
        /wish\s+(.+?)\s+(?:a\s+)?happy anniversary/i
    );

    if (match) {
        return prepareWhatsApp(
            match[1],
            `Happy Anniversary ${match[1]}! Wishing you both a lifetime of love and happiness!`
        );
    }

    // Open YouTube

    if (
        lower === "open youtube" ||
        lower === "youtube"
    ) {
        window.open("https://www.youtube.com", "_blank");
        return "Opening YouTube.";
    }

    // Search YouTube

    match = text.match(
        /(?:search youtube for|play on youtube|youtube search)\s+(.+)/i
    );

    if (match) {

        window.open(
            "https://www.youtube.com/results?search_query=" +
            encodeURIComponent(match[1]),
            "_blank"
        );

        return `Searching YouTube for ${match[1]}.`;
    }

    // Open Google

    if (
        lower === "open google" ||
        lower === "google"
    ) {
        window.open("https://www.google.com", "_blank");
        return "Opening Google.";
    }

    // Google search

    match = text.match(
        /(?:search google for|google search|search for)\s+(.+)/i
    );

    if (match) {

        window.open(
            "https://www.google.com/search?q=" +
            encodeURIComponent(match[1]),
            "_blank"
        );

        return `Searching Google for ${match[1]}.`;
    }

    // Open website

    match = text.match(
        /(?:open website|open site|visit)\s+([^\s]+)/i
    );

    if (match) {

        let url = match[1];

        if (!/^https?:\/\//i.test(url)) {
            url = "https://" + url;
        }

        try {
            const parsed = new URL(url);

            if (!["http:", "https:"].includes(parsed.protocol)) {
                return "That website address is not supported.";
            }

            window.open(parsed.href, "_blank");

            return `Opening ${parsed.hostname}.`;

        } catch {
            return "Please provide a valid website address.";
        }
    }

    // Time

    if (
        lower.includes("what is the time") ||
        lower === "time" ||
        lower.includes("current time")
    ) {
        return "The current time is " +
            new Date().toLocaleTimeString("en-IN");
    }

    // Date

    if (
        lower.includes("what is the date") ||
        lower === "date" ||
        lower.includes("today's date")
    ) {
        return "Today's date is " +
            new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
    }

    // Clear memory

    if (
        lower === "clear memory" ||
        lower === "forget everything"
    ) {
        memory = [];
        saveMemory();

        return "Conversation memory has been cleared.";
    }

    return null;
}


// ================= IMAGE HANDLING =====================

let selectedImage = null;

imgInput.addEventListener("change", event => {

    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        add("Please select a valid image.", "ai");
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {

        const base64 = reader.result.split(",")[1];

        selectedImage = {
            mimeType: file.type,
            data: base64
        };

        add("Image selected. Ask me to analyze it.", "ai");

        speak("Image selected. What would you like me to analyze?");
    };

    reader.readAsDataURL(file);
});

camBtn.addEventListener("click", () => {
    imgInput.click();
});


// ================= MAIN MESSAGE FUNCTION ==============

let isProcessing = false;

async function sendMessage() {

    const text = msg.value.trim();

    if (!text || isProcessing) return;

    isProcessing = true;

    msg.value = "";

    add("You: " + text, "user");

    addMemory("user", text);

    const commandResult = processCommand(text);

    if (commandResult !== null) {

        add("J.A.R.V.I.S: " + commandResult, "ai");

        speak(commandResult);

        addMemory("model", commandResult);

        isProcessing = false;

        return;
    }

    const loading = add("J.A.R.V.I.S is thinking...", "ai");

    try {

        const response = await askGemini(
            text,
            selectedImage
        );

        loading.remove();

        add("J.A.R.V.I.S: " + response, "ai");

        addMemory("model", response);

        // Automatically speak every AI response.
        speak(response);

        selectedImage = null;

    } catch (error) {

        loading.remove();

        const errorMessage =
            "I am unable to process that request right now. " +
            error.message;

        add("J.A.R.V.I.S: " + errorMessage, "ai");

        speak(errorMessage);

        console.error(error);

    } finally {

        isProcessing = false;
    }
}


// ================= SEND BUTTON ========================

sendBtn.addEventListener("click", sendMessage);

msg.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        sendMessage();
    }
});


// ================= VOICE INPUT ========================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognition) {

    recognition = new SpeechRecognition();

    recognition.lang = "en-IN";

    recognition.continuous = false;

    recognition.interimResults = false;

    recognition.onresult = event => {

        const voiceText =
            event.results[0][0].transcript;

        msg.value = voiceText;

        sendMessage();
    };

    recognition.onerror = event => {

        console.error("Voice recognition error:", event.error);

        if (event.error !== "no-speech") {
            add("Voice input failed. Please try again.", "ai");
        }
    };

    recognition.onend = () => {
        micBtn.textContent = "🎙";
    };

}

micBtn.addEventListener("click", () => {

    if (!recognition) {

        const message =
            "Voice recognition is not supported in this browser. Please use Chrome or Edge.";

        add(message, "ai");

        speak(message);

        return;
    }

    try {

        micBtn.textContent = "🔴";

        recognition.start();

    } catch (error) {

        console.error(error);

        micBtn.textContent = "🎙";
    }
});


// ================= CLEAR MEMORY BUTTON ================

clearBtn.addEventListener("click", () => {

    const confirmation = confirm(
        "Are you sure you want to clear conversation memory?"
    );

    if (!confirmation) return;

    memory = [];

    saveMemory();

    chat.innerHTML = "";

    const message = "All conversation memory has been cleared.";

    add("J.A.R.V.I.S: " + message, "ai");

    speak(message);
});


// ================= INITIALIZATION =====================

add(
    "J.A.R.V.I.S online. All systems are ready. How may I assist you, Boss?",
    "ai"
);

speak("J.A.R.V.I.S online. All systems are ready. How may I assist you, Boss?");
