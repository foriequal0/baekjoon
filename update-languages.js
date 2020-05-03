const fs = require("fs");
const superagent = require("superagent");
const util = require("util");

const {JSDOM} = require("jsdom");

const {handleError} = require("./spawn_util");

const URL = "https://www.acmicpc.net/help/language";

const writeFile = util.promisify(fs.writeFile);

async function main() {
    const page = await superagent.get("https://www.acmicpc.net/help/language");
    const {window: {document}} = new JSDOM(page.text);
    const languages = [];
    for (const section of document.querySelectorAll("section")) {
        const id = parseInt(section.id.substring("language-".length));
        const name = section.querySelector(".headline").textContent;
        let compile = undefined;
        let execute = undefined;
        for (const li of section.querySelectorAll("li")) {
            if (li.textContent.startsWith("컴파일:")) {
                compile = li.textContent.substring("컴파일:".length).trim();
            } else if (li.textContent.startsWith("실행:")) {
                execute = li.textContent.substring("실행:".length).trim();
            }
        }
        let executable = undefined;
        let source = undefined;
        if (!compile && execute) {
            source = /Main(?!\.o|\.exe)\.\w+\b/.exec(execute)[0];
        } else if (compile && execute) {
            executable = /Main(\.\w+\b)?/.exec(execute)[0];
            const re = /Main(?!\.o|\.exe)\.\w+\b/g;
            do {
                const found = re.exec(compile);
                if (found === null) {
                    console.log("uses comple cache?", name);
                    source = executable;
                    executable = undefined;
                    break;
                }
                source = found[0];
            } while (source === executable);
        } else {
            console.log("no way to execute; continue:", name);
            continue
        }
        languages.push({id, name, compile, execute, source, executable});
    }
    const file = `// generated file
module.exports.languages = ${JSON.stringify(languages, null, 4)};
`
    await writeFile("languages.js", file, "utf8");
}

main().catch(handleError);
