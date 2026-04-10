const SockJS = require('sockjs-client');
const axios = require('axios');

/**
 * ==========================================
 * CONFIG
 * ==========================================
 */
const WEB_APP_URLS = [
    "https://script.google.com/macros/s/AKfycbyEz810OPYqc1b1St3YRnBt7EtO83aZ682wTw_OiJWqjmfAMDuSr1fa98v59saNQ6psnA/exec"
];

const USERNAME = "CS_KELVIN_HUGO";
const PASSWORD = "22122002";
const ROOM_ID = "68b15a95043435514f98a542";

let AUTH_TOKEN = "";
let USER_ID = "";

/**
 * ==========================================
 * SHIO CONFIG
 * ==========================================
 */
const SHIO_MAP = {
    "KUDA": [1,13,25,37,49,61,73,85,97],
    "ULAR": [2,14,26,38,50,62,74,86,98],
    "NAGA": [3,15,27,39,51,63,75,87,99],
    "KELINCI": [4,16,28,40,52,64,76,88,0],
    "HARIMAU": [5,17,29,41,53,65,77,89],
    "KERBAU": [6,18,30,42,54,66,78,90],
    "TIKUS": [7,19,31,43,55,67,79,91],
    "BABI": [8,20,32,44,56,68,80,92],
    "ANJING": [9,21,33,45,57,69,81,93],
    "AYAM": [10,22,34,46,58,70,82,94],
    "MONYET": [11,23,35,47,59,71,83,95],
    "KAMBING": [12,24,36,48,60,72,84,96]
};

function getShioFromNumber(num) {
    const lastTwo = parseInt(num.toString().slice(-2));
    for (const [shio, numbers] of Object.entries(SHIO_MAP)) {
        if (numbers.includes(lastTwo)) return shio;
    }
    return null;
}

/**
 * ==========================================
 * LOGIN API
 * ==========================================
 */
async function loginAPI(retry = 0) {
    try {
        const res = await axios.post("https://rocketday88.com/api/v1/login", {
            user: USERNAME,
            password: PASSWORD
        });

        AUTH_TOKEN = res.data.data.authToken;
        USER_ID = res.data.data.userId;

        console.log("[LOGIN API] SUCCESS");
        return true;

    } catch (err) {
        console.log("[LOGIN ERROR]", err.response?.status || err.message);

        let delay = 30000;
        if (err.response?.status === 429) delay = 60000;

        if (retry < 5) {
            console.log(`[RETRY LOGIN] ${delay / 1000}s`);
            await new Promise(r => setTimeout(r, delay));
            return loginAPI(retry + 1);
        }

        return false;
    }
}

/**
 * ==========================================
 * SEND TO ALL GAS
 * ==========================================
 */
async function sendToAllGas(data) {
    for (const url of WEB_APP_URLS) {
        try {
            const res = await axios.post(url, data, { timeout: 20000 });
            console.log("[GAS OK]", url, res.data);
        } catch (err) {
            console.log("[GAS ERROR]", url, err.message);
        }
    }
}

/**
 * ==========================================
 * MAIN BOT
 * ==========================================
 */
async function main() {

    const loginOK = await loginAPI();
    if (!loginOK) return;

    const sock = new SockJS('https://rocketday88.com/sockjs');

    sock.onopen = () => {
        console.log("[CONNECTED]");
        sock.send(JSON.stringify({ msg: "connect", version: "1", support: ["1"] }));
    };

    sock.onmessage = async (e) => {
        let data;

        try {
            data = JSON.parse(e.data);
        } catch {
            return;
        }

        if (data.msg === "ping") {
            sock.send(JSON.stringify({ msg: "pong" }));
            return;
        }

        if (data.msg === "connected") {
            sock.send(JSON.stringify({
                msg: "method",
                method: "login",
                id: "L1",
                params: [{ resume: AUTH_TOKEN }]
            }));
        }

        if (data.msg === "result" && data.id === "L1") {
            sock.send(JSON.stringify({
                msg: "sub",
                id: "sub-1",
                name: "stream-room-messages",
                params: [ROOM_ID, false]
            }));
        }

        if (data.msg === "changed" && data.collection === "stream-room-messages") {
            try {
                const msgData = data.fields.args[0];
                if (!msgData) return;

                let text = msgData.msg || "";
                const user = msgData.u ? msgData.u.username : "SYSTEM";

                if (!text) return;

                const lower = text.toLowerCase();

                const isTarget =
                    lower.includes("pasaran") ||
                    lower.includes("prize") ||
                    lower.includes("hasil");

                if (!isTarget) return;

                const prizeMatch = text.match(/Prize\s*1\s*[:\-]?\s*(\d+)/i);
                if (!prizeMatch) return;

                const prizeNumber = prizeMatch[1];
                const shioResult = getShioFromNumber(prizeNumber);

                console.log("[SHIO]", prizeNumber, shioResult);

                await sendToAllGas({
                    text: text,
                    sender: user,
                    prize: prizeNumber,
                    shio: shioResult
                });

            } catch (err) {
                console.log("[ERROR]", err.message);
            }
        }
    };

    sock.onclose = () => {
        console.log("[DISCONNECT] Reconnect...");
        setTimeout(main, 5000);
    };

    sock.onerror = () => {
        sock.close();
    };
}

main();