const fs = require("fs");
const path = require("path");
const process = require("process");
const util = require("util");

const yargs = require("yargs");

const {languages} = require("./languages");
const {exec, spawn, handleError} = require("./spawn_util");

const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);
const exists = util.promisify(fs.exists);

async function main({language, dir, inputDir}) {
    const {compile, execute} = languages.find(({name}) => name === language);

    if (compile) {
        await within(dir, async () => {
            console.log("compile:", compile);
            await spawn(compile);
        });
    }

    if (execute) {
        for await (const fixture of collectFixtures(inputDir || dir)) {
            console.group("fixture:", fixture.name);
            const actual = await within(dir, () => exec(execute, fixture.input)).then(x => x.trimEnd());
            if (actual !== fixture.expected) {
                console.error("actual:");
                console.error(fixture.actual);
                console.error("expected:")
                console.error(fixture.expected);
                process.exit(-1);
            }
            console.groupEnd();
        }
    }
}

async function* collectFixtures(inputDir) {
    const files = await readdir(inputDir);
    const fixtureNames = new Set();
    for (const file of files) {
        if (file.endsWith(".input")) {
            fixtureNames.add(file.substr(0, file.length - ".input".length));
        } else if (file.endsWith(".expected")) {
            fixtureNames.add(file.substr(0, file.length - ".expected".length));
        }
    }

    for (const fixtureName of fixtureNames) {
        const inputPath = path.join(inputDir, `${fixtureName}.input`);
        const expectedPath = path.join(inputDir, `${fixtureName}.expected`);
        if ((await exists(inputPath)) && (await exists(expectedPath))) {
            yield {
                name: fixtureName,
                input: await readFile(inputPath, "utf-8").then(x => x.trimEnd()),
                expected: await readFile(expectedPath, "utf-8").then(x => x.trimEnd()),
            };
        }
    }
}

/**
 * @param {string} dir
 * @param {CallableFunction<Promise<*>>} func
 * @returns {Promise<*>}
 */
async function within(dir, func) {
    const cwd = process.cwd();
    process.chdir(dir);
    try {
        return await func();
    } finally {
        process.chdir(cwd);
    }
}

const args = yargs
    .command(["$0 <language> <dir> [input-dir]"], "백준 문제 빌드 및 검사", yargs => {
        yargs
            .positional("language", {
                choices: languages.map(({name}) => name),
                demandOption: true,
                describe: "사용 언어",
            })
            .positional("dir", {
                type: "string",
                normalize: true,
                demandOption: true,
                describe: "코드가 포함된 디렉토리",
            })
            .positional("input-dir", {
                type: "string",
                describe: "dir이 아닌 다른곳에서 입력을 찾습니다",
            })
    })
    .help()
    .argv;

main(args).catch(handleError);
