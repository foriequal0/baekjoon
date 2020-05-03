const fs = require("fs");
const process = require("process");

const clipboardy = require("clipboardy");
const puppeteer = require("puppeteer-core");
const which = require("which");
const yargs = require("yargs");

const {languages} = require("./languages");
const {handleError} = require("./spawn_util");

/**
 * @param {string} executable
 * @param {string} cookies
 * @param {number} no
 * @param {string} language
 * @param {string} codeOpen
 * @param {string} source
 * @returns {Promise<void>}
 */
async function main({executable, cookies, no, language, codeOpen, source}) {
    const langCode = languages.find(({name}) => name === language).id;

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        executablePath: executable,
    });
    const page = await browser.newPage();
    const waitUntilLoad = {
        timeout: 0,
        waitUntil: "load",
    };

    await page.goto("https://www.acmicpc.net/login", waitUntilLoad);
    if (await loadCookie(page, cookies)) {
        await page.reload(waitUntilLoad);
    }
    if (page.url().includes("login")) {
        console.log("로그인에 문제가 생겼습니다. 다시 로그인하세요.");
        await waitForUserIntervention("login"); // 로그인, 쿠키 만료, re-captcha
    }
    console.log("로그인 성공");
    await dumpCookie(page, cookies);

    await submit(page, no, langCode, codeOpen, source);

    console.log("제출중");
    await waitForUserIntervention(page, "submit"); // re-captcha

    console.log("완료");
    await dumpCookie(page, cookies);
}

/**
 * @param {puppeteer.Page} page
 * @param {number} no
 * @param {number} langCode
 * @param {string} codeOpen
 * @param {string} source
 * @returns {Promise<void>}
 */
async function submit(page, no, langCode, codeOpen, source) {
    await page.goto(`https://www.acmicpc.net/submit/${no}`, {timeout: 0});

    await page.evaluate((langCode, codeOpen, source) => {
        document.querySelector("#language").value = langCode;
        document.querySelector(`#code_open_${codeOpen}`).checked = true;
    }, langCode, codeOpen, source);

    const clipboard = await clipboardy.read();
    try {
        await clipboardy.write(source);
        await page.keyboard.down("Control");
        await page.keyboard.press("KeyV");
        await page.keyboard.up("Control");
    } finally {
        await clipboardy.write(clipboard);
    }

    console.log("제출 버튼 활성화 대기중");
    await page.waitForFunction(() => {
        return document.querySelector("#submit_preview").style.display === "none";
    }, {
        polling: 1000,
        timeout: 0,
    });

    await page.evaluate(() => {
        document.querySelector("#submit_button").click()
    });
}

/**
 * @param {puppeteer.Page} page
 * @param {string} fragment
 * @returns {Promise<void>}
 */
async function waitForUserIntervention(page, fragment) {
    while (page.url().includes(fragment)) {
        process.stdout.write(".");
        await sleep(1000);
    }
}

/**
 * @param {puppeteer.Page} page
 * @param {string} path
 * @returns {Promise<void>}
 */
async function dumpCookie(page, path) {
    const cookies = await page.cookies();
    fs.writeFileSync(path, JSON.stringify(cookies), "utf-8");
}

/**
 * @param {puppeteer.Page} page
 * @param {string} path
 * @returns {Promise<void>}
 */
async function loadCookie(page, path) {
    if (!fs.existsSync(path)) {
        return false;
    }
    const cookies = JSON.parse(fs.readFileSync(path, "utf-8"));
    await page.setCookie(...cookies);
    return true;
}

/**
 * @param {number} timeout
 * @returns {Promise<void>}
 */
async function sleep(timeout) {
    await new Promise(resolve => setTimeout(resolve, timeout));
}

const args = yargs
    .command(["$0 [source]"], "백준 문제 자동 제출", yargs => {
        yargs
            .positional("input", {
                default: undefined,
                type: "string",
                describe: "소스 코드 경로",
                defaultDescription: "표준 입력",
            })
            .option("no", {
                type: "number",
                demandOption: true,
                describe: "문제 번호",
            })
            .option("language", {
                choices: languages.map(({name}) => name),
                demandOption: true,
                describe: "사용 언어",
            })
            .option("code-open", {
                choices: ["open", "close", "accepted"],
                default: "accepted",
                describe: "코드 공개 여부",
            })
    })
    .option("executable", {
        default: which.sync("google-chrome"),
        type: "string",
        normalize: true,
        describe: "Google Chrome 실행파일 경로",
    })
    .option("cookies", {
        default: "./cookies.json",
        type: "string",
        normalize: true,
        describe: "`cookies.json` 파일 경로",
    })
    .help()
    .argv;

const source =
    args.source === undefined
        ? fs.readFileSync(0, "utf8")
        : fs.readFileSync(args.source, "utf8");

main({...args, source}).catch(handleError);
