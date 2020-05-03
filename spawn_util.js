const child_process = require("child_process");

const {parse} = require("shell-quote");

async function spawn(command) {
    const [cmd, ...args] = parse(command);
    return await new Promise((resolve, reject) => {
        const subprocess = child_process.spawn(cmd, args, {
            stdio: "inherit",
        });
        let listener = (code, signal) => {
            if (code !== 0) {
                reject({
                    message: `Spawn Failed: ${cmd}`,
                    cmd,
                    code,
                    signal,
                });
            } else {
                resolve();
            }
            subprocess.removeListener("close", listener);
            subprocess.removeListener("exit", listener);
        }
        subprocess.once("close", listener);
        subprocess.once("exit", listener);
    });
}

async function exec(command, stdin) {
    const [cmd, ...args] = parse(command);
    return await new Promise((resolve, reject) => {
        const subprocess = child_process.execFile(cmd, args, (error, stdout, stderr) => {
            if (error) {
                console.log("stdout:");
                console.error(stdout);
                console.log("stderr:");
                console.error(stderr);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
        subprocess.stdin.write(stdin);
    });
}

async function fork(modulePath, args) {
    return await new Promise((resolve, reject) => {
        const subprocess = child_process.fork(modulePath, args, {
            stdio: "inherit",
        });
        let listener = (code, signal) => {
            if (code !== 0) {
                reject({
                    message: `Fork failed: ${modulePath}`,
                    cmd: modulePath,
                    code,
                    signal,
                });
            } else {
                resolve();
            }
            subprocess.removeListener("close", listener);
            subprocess.removeListener("exit", listener);
        }
        subprocess.once("close", listener);
        subprocess.once("exit", listener);
    });
}

function handleError(err) {
    let printed = false;
    if (err && err.cmd) {
        console.error("error cmd:", err.cmd);
        printed = true;
    }
    if (err && err.message) {
        console.error("error message:", err.message.trim());
        printed = true;
    }
    if (err && err.signal) {
        console.error("signal:", err.signal);
        printed = true;
    }
    if (!printed) {
        console.error(err);
    }

    if (typeof err === "number") {
        process.exit(err);
    } else if (err.code) {
        process.exit(err.code);
    } else {
        process.exit(-1);
    }
}

module.exports = {
    spawn,
    exec,
    fork,
    handleError
}
