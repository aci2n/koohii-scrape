const request = require("request").defaults({jar: true});
const fs = require("fs");

function buildUrl(kanji) {
    return `https://kanji.koohii.com/study/kanji/${kanji}`;
}

function login(username, password) {
    return new Promise((resolve, reject) => {
        request.post("https://kanji.koohii.com/login", {
            form: {
                username,
                password,
                commit: "Sign+In",
                referer: "@homepage"
            }
        }, (error, response, body) => {
            if (error) {
                console.error("error logging in", error);
                reject(error);
            } else {
                console.log("logged in");
                resolve(response);
            }
        });
    })
}

function ensureDirExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    return dir + "/";
}

function* kanjiList() {
    for (let codepoint = 0x4e00; codepoint <= 0x9faf; codepoint++) {
        yield String.fromCodePoint(codepoint);
    }
}

function isValidPage(page) {
    return page.indexOf("EditStoryComponent") !== -1;
}

function downloadPage(url) {
    return new Promise((resolve, reject) => {
        request(encodeURI(url), (error, response, body) => {
            console.log(`downloaded ${url}`);

            if (error) {
                console.error("error downloading page", error);
                reject(error);
            } else if (!isValidPage(body)) {
                console.error("downloaded page, but not logged in", body);
                reject(body);
            } else {
                resolve(body);
            }
        });
    });
}

function savePage(dir, kanji, page) {
    const file = `${dir}u${kanji.codePointAt(0).toString(16)}.html`;

    fs.writeFileSync(file, page);
    console.log(`saved page to file ${file}`);

    return file;
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    try {
        const dir = ensureDirExists("pages");

        await login("alvicala", "darkcloud");

        for (let kanji of kanjiList()) {
            savePage(dir, kanji, await downloadPage(buildUrl(kanji)));
            await waitMs(1000);
        }
    } catch(error) {
        console.error("terminated due to fatal error");
    }
}

main();