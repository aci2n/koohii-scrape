const fs = require("fs");
const program = require("commander");
const kanjiRange = require("./kanji-range").range;

function initProgram() {
    program
        .version("0.1.0")
        .option("-i, --input [directory]", "directory with html files", "../koohii-pages")
        .parse(process.argv);
}

function checkIntegrity(directory) {
    let expected = kanjiRange[0];
    const files = fs.readdirSync(directory);

    files.sort();

    for (let file of files) {
        if (file !== (expected + ".html")) {
            return {success: false, at: expected};
        }
        
        expected++;
    }

    return {success: true, remaining: kanjiRange[1] - expected};
}


function main() {
    initProgram();

    console.log(`checking integrity of files at ${program.input}`);
    const result = checkIntegrity(program.input);
    
    if (result.success) {
        console.log(`integrity OK, missing ${result.remaining} files`);
    } else {
        console.log(`integrity error, missing ${result.at}.html`);
    }
}

main();