const ac = require("@antiadmin/anticaptchaofficial");
const puppeteer = require("puppeteer");
require('dotenv').config();

/* DOTENV Variables
    AC_API_KEY => Get from https://anti-captcha.com/
    PROXY_ADDRESS => Numbers only, i.e. 52.45.225.10
    PROXY_PORT
    PROXY_USERNAME
    PROXY_PASSWORD
 */


ac.setAPIKey(process.env.AC_API_KEY);
ac.getBalance()
    .then(balance => console.log(`Anti-Captcha Balance: ${balance}`))
    .catch(error => console.log(`There was an error with your API key: ${error}`));

const proxyAddress = process.env.PROXY_ADDRESS;
const proxyPort = process.env.PROXY_PORT;
const proxyUser = process.env.PROXY_USER;
const proxyPassword = process.env.PROXY_PASSWORD;

// Recommended to use a unique user agent & viewport.
let userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36';
let viewPort = {width: 1920, height: 1080};

(async () => {
    const page_with_captcha = 'https://www.amazon.com/ap/cvf/request?arb=c362ddb5-725d-4112-9814-08859b168b7a';
    const page = await prepareBrowser(userAgent, viewPort, proxyAddress, proxyPort, proxyUser, proxyPassword);
    await page.goto(page_with_captcha);
    await solveAmazonCaptchaUsingRequestHook(page, proxyAddress, proxyPort, proxyUser, proxyPassword);

    // execute some code here
    console.log("Your captcha is now solved!");
    await page.waitForTimeout(5000);
    await page.browser().close();
})();

// Returns a Puppeteer Page, configured to use our proxy settings.
async function prepareBrowser(userAgent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36',
                              viewPort={width: 1920, height: 1080},
                              proxyAddr=null, proxyPort=null, proxyUser=null, proxyPassword=null) {
    let options = {
        headless: false,
        ignoreHTTPSErrors: true,
        devtools: false,
        ignoreDefaultArgs: ["--disable-extensions","--enable-automation"],
        args: []
    };

    if(proxyAddr && proxyPort) {
        options["args"].push(`--proxy-server=${proxyAddr}:${proxyPort}`);
    }

    const browser = await puppeteer.launch(options);
    const page = await browser.newPage()

    if (proxyPassword && proxyUser) {
        await page.authenticate({
            username: proxyUser,
            password: proxyPassword,
        });
    }

    await page.setUserAgent(userAgent);
    await page.setViewport(viewPort);

    return page;
}

async function solveAwsWafCaptcha(page, proxyAddress, proxyPort, proxyUser, proxyPassword) {
    // Use your own Anti-Gate template configured as instructed.
    return new Promise(async (resolve, reject) => {
        try {
            const result = await ac.solveAntiGateTask(page.url(), 'amazon register', {}, proxyAddress, proxyPort, proxyUser, proxyPassword);
            const fingerprint = result.fingerprint;
            const userAgent = fingerprintToUserAgent(fingerprint);

            console.log(`Setting Browser UserAgent to ${userAgent}`);
            await page.setUserAgent(userAgent);

            console.log(`Setting Cookies`);
            const cookies = Object.entries(result.cookies).map(([name, value]) => ({ name, value, domain: result.domain }));
            await page.setCookie(...cookies);

            console.log('Proceeding...')
            page.goto(result.url);
            resolve();
        } catch (error) {
            console.error(`Could not solve Captcha: ${error}`);
            reject(error);
        }
    })
}

function fingerprintToUserAgent(fingerprint) {
    if (fingerprint['self.navigator.userAgent']) {
        userAgent = fingerprint['self.navigator.userAgent'];
    } else {
        if (fingerprint['self.navigator.appVersion'] && fingerprint['self.navigator.appCodeName']) {
            userAgent = fingerprint['self.navigator.appCodeName'] + '/' + fingerprint['self.navigator.appVersion']
        }
    }
    return userAgent;
}

async function solveAmazonCaptchaUsingRequestHook(page, proxyAddress, proxyPort, proxyUser, proxyPassword) {
    return new Promise(async (resolve) => {
        const requestHandler = async (request) => {
            if (request.url().includes('captcha.awswaf.com/ait/ait/ait/problem?kind=visual')) {
                page.removeListener('request', requestHandler);
                clearTimeout(timeout);
                console.log('Captcha detected. Solving captcha...');
                await solveAwsWafCaptcha(page, proxyAddress, proxyPort, proxyUser, proxyPassword);
                resolve();
            }
        };

        page.on('request', requestHandler);

        const timeout = setTimeout(() => {
            page.removeListener('request', requestHandler);
            console.log('No captcha was detected within 5 seconds. Proceeding...')
            resolve();
        }, 5000);
    })
}