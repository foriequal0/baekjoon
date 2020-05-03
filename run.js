const fs = require("fs");
const path = require("path");
const process = require("process");
const util = require("util");

const yargs = require("yargs");

const {languages} = require("./languages");
const {fork, handleError} = require("./spawn_util");

async function main({no, language, variant, headless}) {
    const source = languages.find(x => x.name === language).source;
    const input = path.join(no.toString());
    const dir = variant
        ? path.join(no.toString(), language, variant)
        : path.join(no.toString(), language);

    await fork("./execute.js", [language, dir, input]);
    const submitArgs = [
        path.join(dir, source),
        "--no", no.toString(),
        "--language", language,
    ];
    if (headless !== undefined) {
        submitArgs.push("--headless");
    }
    await fork("./submit.js", submitArgs);
}

const args = yargs
    .command(["$0 <no> <language> [variant]"], "백준 문제 빌드 및 자동 제출", yargs => {
        yargs
            .positional("no", {
                type: "number",
                demandOption: true,
                describe: "문제 번호",
            })
            .positional("language", {
                choices: languages.map(({name}) => name),
                demandOption: true,
                describe: "사용 언어",
            })
            .positional("variant", {
                type: "string",
                describe: "변형 풀이",
            })
    })
    .option("headless", {
        type: "boolean",
        describe: "헤드리스 제출",
    })
    .help()
    .argv;

main(args).catch(handleError);
