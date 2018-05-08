const request = require("request").defaults({jar: true});
const fs = require("fs");
const program = require("commander");
const kanjiRange = [0x4e00, 0x9faf];

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
                reject(`error logging as ${username}`);
            } else if (response.statusCode !== 302) {
                reject(`invalid username or password`);
            } else {
                console.log(`logged in as ${username}`);
                resolve(response);
            }
        });
    })
}

function ensureDirectoryExists(directory) {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory);
    }

    return directory + "/";
}

function* kanjiList(range) {
    const lower = range[0];
    const upper = range[1];
    
    for (let codepoint = lower; codepoint <= upper; codepoint++) {
        yield String.fromCodePoint(codepoint);
    }
}

function isValidPage(page) {
    return page.indexOf("EditStoryComponent") !== -1;
}

function downloadPage(kanji) {
    return new Promise((resolve, reject) => {
        const url = `https://kanji.koohii.com/study/kanji/${kanji}`;

        request(encodeURI(url), (error, response, body) => {
            if (error) {
                reject(`error downloading ${url}`);
            } else if (!isValidPage(body)) {
                reject(`downloaded ${url}, but not logged in`);
            } else {
                console.log(`downloaded ${url}`);
                resolve(body);
            }
        });
    });
}

function savePage(directory, kanji, page) {
    const file = `${directory}u${kanji.codePointAt(0).toString(16)}.html`;

    fs.writeFileSync(file, page);
    console.log(`saved ${file}`);

    return file;
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function coerceKanjiRange(value, defaultRange) {
    const range = value.split("..").map(token => {
        const codepoint = parseInt(token);
        return isNaN(codepoint) ? token.codePointAt(0) : codepoint;
    });

    if (range.length === 1) {
        range[1] = range[0];
    } else {
        for (let i of [0, 1]) {
            if (isNaN(range[i])) {
                range[i] = kanjiRange[i];
            }
        }
    }

    return range;
}

function initProgram() {
    program
        .version("0.1.0")
        .option("-u, --username [username]", "Koohii username")
        .option("-p, --password [password]", "Koohii password")
        .option("-d, --directory [directory]", "download directory", "pages")
        .option("-w, --wait <ms>", "ms to wait between downloads", parseInt, 1000)
        .option("-r, --range <a>..<b>", "kanji range (Unicode points)", coerceKanjiRange, kanjiRange)
        .parse(process.argv);
};

async function main() {
    initProgram();

    try {
        const directory = ensureDirectoryExists(program.directory);

        await login(program.username, program.password);

        for (let kanji of kanjiList(program.range)) {
            savePage(directory, kanji, await downloadPage(kanji));
            await waitMs(program.wait);
        }
    } catch(error) {
        console.error(error);
    }
}

main();