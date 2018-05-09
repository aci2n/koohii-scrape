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
    const file = `${directory}${kanji.codePointAt(0)}.html`;

    fs.writeFileSync(file, page);
    console.log(`saved ${file}`);

    return file;
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function kanjiListByRange(lower, upper) {
    const list = [];
    
    for (let codepoint = lower; codepoint < upper; codepoint++) {
        list.push(codepoint);
    }

    return list;
}

function coerceCodepoint(value) {
    const codepoint = parseInt(value);
    return isNaN(codepoint) ? value.codePointAt(0) : codepoint;
}

function splitAndCoerceCodepoints(value, separator) {
    return value.split(separator).map(token => coerceCodepoint(token));
}

function coerceKanjiRange(value, defaultRange) {
    if (value.indexOf(",") !== -1) {
        return splitAndCoerceCodepoints(value, ",");
    }
    
    const range = splitAndCoerceCodepoints(value, "..");

    if (range.length === 1) {
        range[1] = range[0];
    } else {
        for (let i of [0, 1]) {
            if (isNaN(range[i])) {
                range[i] = kanjiRange[i];
            }
        }
    }
    
    return kanjiListByRange(range[0], range[1]);
}

function defaultKanjiList(directory) {
    const files = fs.readdirSync(directory);
    files.sort();
    const lastFile = files[files.length - 1];
    
    if (lastFile) {
        const lastCodepoint = parseInt(lastFile.match(/\d+/));
        
        if (!isNaN(lastCodepoint)) {
            return kanjiListByRange(lastCodepoint + 1, kanjiRange[1]);
        }
    }
    
    return kanjiListByRange(kanjiRange[0], kanjiRange[1]);
}

function* kanjiGenerator(codepoints) {
    for (let codepoint of codepoints) {
        yield String.fromCodePoint(codepoint);
    }
}

function initProgram() {
    program
        .version("0.1.0")
        .option("-u, --username [username]", "Koohii username")
        .option("-p, --password [password]", "Koohii password")
        .option("-o, --output [directory]", "download directory", "../koohii-pages")
        .option("-w, --wait <ms>", "ms to wait between downloads", parseInt, 1000)
        .option("-r, --range <a>..<b>", "kanji range (Unicode points)", coerceKanjiRange)
        .parse(process.argv);
};

async function main() {
    initProgram();

    try {
        const directory = ensureDirectoryExists(program.output);
        await login(program.username, program.password);

        for (let kanji of kanjiGenerator(program.range || defaultKanjiList(directory))) {
            savePage(directory, kanji, await downloadPage(kanji));
            await waitMs(program.wait);
        }
    } catch(error) {
        console.error(error);
    }
}

main();