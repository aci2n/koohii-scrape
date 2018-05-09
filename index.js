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

function codepointGeneratorByList(codepoints) {
    return function*() {
        for (let codepoint of codepoints) {
            yield codepoint;
        }
    }
}

function codepointGeneratorByRange(lower, upper) {
    return function*() {    
        for (let codepoint = lower; codepoint <= upper; codepoint++) {
            yield codepoint;
        }
    }
}

function* kanjiGenerator(codepointsGenerator) {
    for (let codepoint of codepointsGenerator()) {
        yield String.fromCodePoint(codepoint);
    }
}

function coerceCodepoint(value) {
    const codepoint = parseInt(value);
    return isNaN(codepoint) ? value.codePointAt(0) : codepoint;
}

function splitAndCoerceCodepoints(value, separator) {
    return value.split(separator).map(token => coerceCodepoint(token.trim()));
}

function coerceCodepointsGenerator(value) {
    if (value.indexOf(",") !== -1) {
        return codepointGeneratorByList(splitAndCoerceCodepoints(value, ","));
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
    
    return codepointGeneratorByRange(...range);
}

function defaultCodepointsGenerator(directory) {
    let range = kanjiRange;
    const files = fs.readdirSync(directory);
    
    files.sort();
    const lastFile = files[files.length - 1];
    
    if (lastFile) {
        const lastCodepoint = parseInt(lastFile.match(/\d+/));
        
        if (!isNaN(lastCodepoint)) {
            range[0] = lastCodepoint + 1;
        }
    }
    
    return codepointGeneratorByRange(...range);
}

function initProgram() {
    program
        .version("0.1.0")
        .option("-u, --username [username]", "Koohii username")
        .option("-p, --password [password]", "Koohii password")
        .option("-o, --output [directory]", "download directory", "../koohii-pages")
        .option("-w, --wait <ms>", "ms to wait between downloads", parseInt, 1000)
        .option("-r, --range <a>..<b>", "kanji range (Unicode points)", coerceCodepointsGenerator)
        .parse(process.argv);
}

async function retry(callback, times) {
    while (times-- > 0) {
        if (await callback()) {
            console.log(`finished execution with ${times} retry attempts remaining`);
            return true;
        }
        
        console.log(`retrying execution, ${times} retry attempts remaining`);
    }
    
    console.log(`maximum retry attempts reached, aborting`);
    return false;
}

async function startDownloading() {
    let success = false;
    
    try {
        const directory = ensureDirectoryExists(program.output);
        await login(program.username, program.password);

        for (let kanji of kanjiGenerator(program.range || defaultCodepointsGenerator(directory))) {
            savePage(directory, kanji, await downloadPage(kanji));
            await waitMs(program.wait);
        }
        
        success = true;
    } catch(error) {
        console.error(error);
    }
    
    return success;
}

function main() {
    initProgram();
    retry(startDownloading, 5);
}

main();