/**
 * Plays a very short match to the end and submits the post-match feedback form from a phone-sized browser.
 * Start the game with short phases first, e.g.
 *   BUILD_SECONDS=4 SCHEME_SECONDS=4 RESOLUTION_SECONDS=2 pnpm dev
 * Run:  node tests/e2e/post-match-feedback.e2e.mjs   (needs Playwright, see first-time-player.e2e.mjs)
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const mk = async (opts) => {
  const p = await (await browser.newContext(opts)).newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
};
const host = await mk({ viewport: { width: 1280, height: 800 } });
const phone = await mk({ ...devices["iPhone 13"], deviceScaleFactor: 1 });
await host.goto(`${BASE}/`);
await host.waitForSelector("text=online");
await host.fill("#name", "Rival");
await host.click("text=Create Room");
await host.waitForURL(/room/);
await phone.goto(host.url());
await phone.fill("input[placeholder='Guest name']", "Newcomer");
await phone.click("button:has-text('Join')");
await phone.waitForSelector("text=Choose your clan");
await host.click("text=I'm ready");
await phone.click("text=I'm ready");
await host.click("text=Start match");
await phone.waitForSelector("text=Final standings", { timeout: 240_000 });
const form = await phone.locator("[data-testid=feedback]").innerText();
const questions = ["What was confusing?", "Which mechanic was hardest to understand?", "What did you think your objective was?", "Which screen or explanation helped most?"];
const results = { questionsShown: questions.every((q) => form.includes(q)), sendDisabledWhenEmpty: await phone.locator("[data-testid=feedback] button:has-text('Send feedback')").isDisabled() };
await phone.locator("[data-testid=feedback] textarea").nth(0).fill("I did not know when my party would bring food back.");
await phone.locator("[data-testid=feedback] textarea").nth(2).fill("Get the most points after 8 rounds.");
await phone.click("[data-testid=feedback] button:has-text('Send feedback')");
await phone.waitForSelector("[data-testid=feedback] [role=status]", { timeout: 10_000 });
results.thanksShown = /Thank you! Your answers were sent/.test(await phone.locator("[data-testid=feedback]").innerText());
await phone.screenshot({ path: process.argv[2] ?? "post-match-feedback.png", fullPage: true });
console.log(JSON.stringify({ ...results, browserErrors: errors }, null, 1));
await browser.close();
process.exitCode = Object.values(results).every(Boolean) && errors.length === 0 ? 0 : 1;
