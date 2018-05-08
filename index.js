const request = require("request").defaults({jar: true});
const fs = require("fs");
const program = require("commander");

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
                console.error(`error logging as ${username}`, error);
                reject(error);
            } else if (response.statusCode !== 302) {
                console.error(`invalid username or password`);
                reject(response);
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

function savePage(directory, kanji, page) {
    const file = `${directory}u${kanji.codePointAt(0).toString(16)}.html`;

    fs.writeFileSync(file, page);
    console.log(`saved page to file ${file}`);

    return file;
}

function waitMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initProgram() {
    program
        .version("0.1.0")
        .option("-u, --username [username]", "Koohii username")
        .option("-p, --password [password]", "Koohii password")
        .option("-d, --directory [directory]", "download directory", "pages")
        .option("-w, --wait <ms>", "ms to wait between downloads", parseInt, 1000)
        .option("-r, --range <a>..<b>", "kanji range (Unicode points)", val => val.split("..").map(parseInt), [0x4e00, 0x9faf])
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
        console.error("terminated due to fatal error");
    }
}

main();