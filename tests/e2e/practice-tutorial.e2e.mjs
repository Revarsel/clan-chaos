/**
 * Browser walkthrough of the first-run intro and the guided practice tutorial, on a phone and a desktop.
 * It plays the tutorial the way a newcomer would: it reads each task and clicks the real game controls
 * (never the tutorial's own shortcuts, except the clock buttons), so a panel covering a control fails the run.
 *
 * Requirements: the web app on :3000 (`pnpm dev`, or `next build && next start` in apps/web).
 * The practice match itself needs no game server. Playwright: `pnpm add -D playwright`.
 * Run:  node tests/e2e/practice-tutorial.e2e.mjs [screenshotDir]
 * Env:  BASE_URL (default http://localhost:3000), CHROMIUM_PATH (optional browser binary)
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "practice-tutorial-shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const results = [];
const check = (id, name, ok, evidence = "") => results.push({ id, name, result: ok ? "PASS" : "FAIL", evidence: ok ? "" : String(evidence).slice(0, 300) });

let page;
async function run(label, ctxOpts, isPhone) {
  const errors = [];
  const ctx = await browser.newContext(ctxOpts);
  page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png` });
  const panel = page.locator("[data-testid=tutorial-panel]");
  const panelText = () => panel.innerText().catch(() => "");
  const stepNo = async () => Number((await panelText()).match(/Step (\d+) of/i)?.[1] ?? 0);
  const next = async () => {
    const n = await stepNo();
    await page.click("[data-testid=tutorial-next]");
    await page.waitForFunction((k) => new RegExp(`Step ${k} of`).test(document.querySelector("[data-testid=tutorial-panel]")?.textContent ?? ""), n + 1);
  };
  const success = () => page.locator("[data-testid=tutorial-success]").waitFor({ timeout: 8000 }).then(() => true, () => false);
  const ringVisible = () => page.locator("[data-testid=tutorial-ring]").isVisible();
  const openPanel = async (name) => {
    if (isPhone) {
      const open = await page.locator(`nav[aria-label='Game panels'] button:has-text('${name}')`).getAttribute("aria-pressed");
      if (open !== "true") await page.click(`nav[aria-label='Game panels'] button:has-text('${name}')`);
    } else await page.click(`[role=tablist][aria-label='Primary panels'] [role=tab]:has-text('${name}')`);
  };
  const visible = (sel) => page.locator(sel).locator("visible=true").first();

  // ---- Onboarding (first visit) ----
  await page.goto(`${BASE}/`);
  const intro = page.locator("[data-testid=onboarding]");
  check(`${label}-A1`, "Intro opens automatically on the first visit", await intro.isVisible().catch(() => false) || (await intro.waitFor({ timeout: 4000 }).then(() => true, () => false)));
  const topics = [];
  for (let i = 0; i < 6; i++) {
    topics.push((await intro.locator("h2").innerText()).trim());
    if (i === 0) await page.waitForTimeout(400).then(() => shot("intro-1"));
    if (i > 0 && i < 5) {
      await intro.locator("button:has-text('Back')").click();
      await intro.locator("[data-testid=onboarding-next]").click();
    }
    await intro.locator("[data-testid=onboarding-next]").click();
  }
  check(`${label}-A2`, "Six intro topics with Back/Next", topics.length === 6 && new Set(topics).size === 6, topics.join(" | "));
  await page.reload();
  await page.waitForTimeout(800);
  check(`${label}-A3`, "Completed intro does not reopen by itself", !(await intro.isVisible()));
  await page.click("button:has-text('1-minute intro')");
  check(`${label}-A4`, "Intro can be reopened from home", await intro.isVisible());
  await intro.locator("button:has-text('Skip')").click();
  check(`${label}-A5`, "Intro can be skipped", !(await intro.isVisible()));

  // ---- Guided practice ----
  await page.click("[data-testid=practice-link]");
  await page.waitForURL(/practice/);
  await page.click("[data-testid=start-tutorial]");
  await panel.waitFor();
  await shot("01-welcome");
  check(`${label}-B0`, "Tutorial starts with the clock paused", /paused/i.test(await page.locator("[data-testid=practice-bar]").innerText()));
  const timer1 = await page.locator("[role=timer]").first().innerText();
  await next(); // -> HUD
  check(`${label}-B1`, "HUD step highlights the resource bar", (await ringVisible()) && /fort/i.test(await panelText()));
  await shot("02-hud");
  await page.waitForTimeout(1200);
  check(`${label}-B1b`, "Countdown stays frozen while reading", (await page.locator("[role=timer]").first().innerText()) === timer1);
  await next(); // -> send party

  const site = (await page.locator("[data-testid=tutorial-task]").innerText()).match(/Tap (.+?) \(a gold mine\)/)?.[1];
  await page.locator(`[role=button][aria-label^="${site}:"]`).first().click();
  await visible("[data-tour=send-party] button:has-text('Send here')").click();
  check(`${label}-B2`, "Sending a party through the real UI completes the step", await success(), site);
  await shot("03-party-sent");
  await next(); // -> collect
  await page.click("button:has-text('Fast-forward to the delivery')");
  const collected = await success();
  check(`${label}-B3`, "Fast-forward shows the delivery and capacity", collected && /delivered \d+ gold/i.test(await panelText()) && /at most 6/i.test(await panelText()), await panelText());
  await shot("04-delivered");
  await next(); // -> card
  await page.click("button:has-text('Open my cards')");
  await visible("[data-tour=hand] button:has-text('Sneaky Heist')").click();
  check(`${label}-B4`, "Opening card details completes the card step", await success());
  await shot("05-card");
  await page.keyboard.press("Escape");
  await next(); // -> scheme
  await page.click("button:has-text('Skip to Scheme')");
  check(`${label}-B5`, "Phase lesson moves to Scheme & Commit", (await success()) && /Scheme/.test(await page.locator("[data-testid=phase-name]").innerText()));
  await next(); // -> raid target
  await openPanel("Raid");
  await visible("[role=radiogroup][aria-label='Raid target'] button:has-text('Training Dummy')").click();
  check(`${label}-B6`, "Choosing a target in the raid planner completes the step", await success());
  await next(); // -> preview
  check(`${label}-B7a`, "Preview explains why the raid would fail", /would fail/.test(await panelText()), await panelText());
  await shot("06-preview-fail");
  await visible("fieldset:has(legend:has-text('primary')) button:has-text('Sneaky Heist')").click();
  await openPanel("Actions");
  await visible("li:has-text('Recruit mercenaries') button:has-text('Pay')").click();
  await openPanel("Raid");
  check(`${label}-B7`, "Sneaky Heist + mercenaries make the preview beat the fort", await success(), await panelText());
  await shot("07-preview-win");
  await next(); // -> submit
  await visible("[data-tour=raid-submit]").click();
  await page.locator("[role=dialog][aria-label='Submit this raid?'] button:has-text('Submit raid')").click();
  check(`${label}-B8`, "Secret submission completes the step", await success());
  await shot("08-submitted");
  await next(); // -> deadline
  await page.click("button:has-text('Skip to the deadline')");
  await page.waitForFunction(() => /Resolution|revealed/i.test(document.body.innerText));
  await next(); // -> resolution
  const story = await panelText();
  check(`${label}-B9`, "Resolution explains both raids", /Training Dummy: Success/.test(story) && /Repelled/.test(story) && /lost 2 gold/.test(story), story);
  await shot("09-resolution");
  await next(); // -> upkeep
  await page.click("button:has-text('Finish the round')");
  check(`${label}-B10`, "Upkeep is shown from the real feed", (await success()) && /Upkeep: you paid 1 food/.test(await panelText()), await panelText());
  await shot("10-upkeep");
  await next(); // -> scoring
  check(`${label}-B11`, "Scoring and match end explained", /Most points wins/.test(await panelText()) && /eliminated/.test(await panelText()));
  await next(); // -> finish
  await page.click("button:has-text('Keep practicing')");
  await page.waitForTimeout(300);
  check(`${label}-B12`, "After the tutorial the clock runs and can be paused", !(await panel.isVisible()) && (await page.locator("button:has-text('Pause')").isVisible()));
  const t1 = await page.locator("[role=timer]").first().innerText();
  await page.waitForTimeout(2200);
  check(`${label}-B13`, "Free practice clock is running", (await page.locator("[role=timer]").first().innerText()) !== t1);
  await shot("11-free-practice");
  check(`${label}-B14`, "No page errors", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

for (const [label, opts, isPhone] of [
  ["phone", { ...devices["iPhone 13"], deviceScaleFactor: 1 }, true],
  ["desktop", { viewport: { width: 1440, height: 900 } }, false],
]) {
  try {
    await run(label, opts, isPhone);
  } catch (e) {
    await page?.screenshot({ path: `${OUT}/${label}-STUCK.png` }).catch(() => undefined);
    check(`${label}-X`, "Walkthrough finished without getting stuck", false, e.message.split("\n")[0]);
  }
}
await browser.close();
console.table(results);
const failed = results.filter((r) => r.result === "FAIL");
console.log(`${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
