/**
 * Automated proxy walkthrough of the first-time-player test (docs/first_time_player_test.md).
 * This is NOT a human usability test: it checks that the information each task needs is present,
 * reachable on a phone and desktop, and that hidden information stays hidden.
 *
 * Requirements: a running game (server :4000, web :3000) with long phases, e.g.
 *   PERSISTENCE=off BUILD_SECONDS=60 SCHEME_SECONDS=45 RESOLUTION_SECONDS=12 pnpm dev
 * and Playwright:  pnpm add -D playwright && npx playwright install chromium
 * Run:  node tests/e2e/first-time-player.e2e.mjs [screenshotDir]
 * Env:  BASE_URL (default http://localhost:3000), CHROMIUM_PATH (optional browser binary)
 */
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "first-time-player-shots";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const results = [];
const check = (id, name, ok, evidence = "") => results.push({ id, name, result: ok ? "PASS" : "FAIL", evidence: ok ? "" : String(evidence).slice(0, 300) });
const mk = async (opts) => {
  const c = await browser.newContext(opts);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return p;
};
const text = (p, sel) => p.locator(sel).first().innerText().catch(() => "");
const tab = (p, name) => p.click(`nav[aria-label='Game panels'] button:has-text('${name}')`);

const host = await mk({ viewport: { width: 1440, height: 900 } }); // the "other player"
const phone = await mk({ ...devices["iPhone 13"], deviceScaleFactor: 1 }); // the first-time tester

// --- Joining by link (the usual invite path) ---
await host.goto(`${BASE}/`);
await host.waitForSelector("text=online");
await host.fill("#name", "Rival");
await host.click("text=Create Room");
await host.waitForURL(/room/);
const code = host.url().split("/room/")[1];
await phone.goto(`${BASE}/room/${code}`);
await phone.waitForSelector("text=Join room");
const joinText = await text(phone, "main");
check("T1", "Objective reachable before joining (link invite)", /most (victory )?points/i.test(joinText), joinText);
await phone.fill("input[placeholder='Guest name']", "Newcomer");
await phone.click("button:has-text('Join')");
await phone.waitForSelector("text=Choose your clan");
const lobbyText = await text(phone, "main");
check("T1", "Objective explained in the lobby", /most (victory )?points/i.test(lobbyText) && /8 rounds|eight rounds/i.test(lobbyText), lobbyText.slice(0, 300));
await phone.screenshot({ path: `${OUT}/01-lobby.png`, fullPage: true });
await phone.click("button:has-text('Rats of the Racket')");
await host.click("button:has-text('Mushroom Merchants')");
await host.click("text=I'm ready");
await phone.click("text=I'm ready");
await phone.evaluate(() => window.scrollTo(0, 300));
await host.click("text=Start match");
await phone.waitForSelector("[data-testid=phase-banner]");
await phone.waitForTimeout(800);
await phone.screenshot({ path: `${OUT}/02-first-frame.png` });

// T1: objective from inside the game (persistent help entry point)
const rulesBtn = phone.locator("button:has-text('Rules')").first();
const hasRules = (await rulesBtn.count()) > 0;
let rulesText = "";
if (hasRules) {
  await rulesBtn.click();
  rulesText = await text(phone, "[role=dialog]");
  await phone.keyboard.press("Escape");
}
check("T1", "In-game Rules entry point explains the objective (1 tap)", hasRules && /most (victory )?points/i.test(rulesText) && /last clan standing/i.test(rulesText), rulesText || "no Rules button");

// T2: phase
const banner = await text(phone, "[data-testid=phase-banner]");
const bannerBox = await phone.locator("[data-testid=phase-banner]").boundingBox();
check("T2", "Phase name, purpose and countdown visible on first frame", bannerBox.y >= 0 && bannerBox.y < 10 && /Build & Gather/.test(banner) && /Collect resources/.test(banner) && /\d+s/.test(banner), banner);
await phone.click("button:has-text('What can I do?')");
const can = await text(phone, "[data-testid=phase-banner]");
check("T2", "What-can-I-do lists available and not-yet actions", /Available now/.test(can) && /Gather & recall parties/.test(can) && /Submit your raid/.test(can), can);
await phone.click("button:has-text('Less')");

// T3: resources and fort visible without horizontal scrolling
const vw = phone.viewportSize().width;
const chips = phone.locator("[data-tour=hud] > *");
const labels = ["Gold", "Materials", "Food", "Fort"];
const boxes = [];
for (let i = 0; i < 4; i++) boxes.push(await chips.nth(i).boundingBox());
const hudText = await text(phone, "[data-tour=hud]");
check("T3", "Gold, materials, food and fort all visible on a phone without scrolling", boxes.every((b) => b && b.x >= 0 && b.x + b.width <= vw + 1) && labels.every((l) => hudText.includes(l)), JSON.stringify(boxes.map((b) => b && Math.round(b.x + b.width))));
await chips.nth(3).click();
const fortPop = await text(phone, "[role=dialog]");
check("T3", "Tapping fort explains defense, maximum and exposure", /Fort defense/.test(fortPop) && /exposed/i.test(fortPop), fortPop);
await phone.keyboard.press("Escape");

// T4: send a party to a suitable location
await phone.locator("svg [role=button][aria-label^='Sunny Acres']").click();
const site = await text(phone, "[data-tour=selection]");
check("T4", "Site panel states resource, yield, safety and trip time", /food/.test(site) && /Yields 3 per trip/.test(site) && /Safe/.test(site) && /walk each way/.test(site), site);
await phone.locator("[data-tour=selection] button:has-text('Send here')").first().click();
await phone.waitForTimeout(700);
const toast1 = await text(phone, "[role=status]");
const strip = await text(phone, "[data-tour=parties]");
check("T4", "Dispatch confirmed after server ack and party status visible", /dispatched to Sunny Acres/.test(toast1) && /Walking to Sunny Acres/.test(strip), `${toast1} | ${strip}`);

// T5: when do gathered resources become spendable?
const t5 = `${toast1} ${site}`;
check("T5", "Player is told resources become spendable when the party gets home", /when (it|the party) (gets|returns|reaches) home/i.test(t5) && /spend/i.test(t5), t5);
await phone.screenshot({ path: `${OUT}/03-dispatched.png` });

// T6: inspect a card
await tab(phone, "Cards");
await phone.waitForTimeout(200);
await phone.locator("[data-tour=hand] button").first().click();
const card = await text(phone, "[role=dialog][aria-label='Card details']");
check("T6", "Card details give effect, cost, timing and when it applies", ["Cost", "When", "Takes effect", "Limits", "Counterplay"].every((k) => card.includes(k)), card);
await phone.screenshot({ path: `${OUT}/04-card.png` });
await phone.keyboard.press("Escape");

// Errors explain how to recover (spend gold until something is unaffordable)
await tab(phone, "Actions");
for (let i = 0; i < 2; i++) {
  const b = phone.locator("[data-tour=actions] li:has-text('Buy a card') button:has-text('Pay')");
  if (await b.isEnabled()) {
    await b.click();
    await phone.waitForTimeout(500);
  }
}
const actions = await text(phone, "[data-tour=actions]");
const needs = actions.split("\n").filter((l) => /^Needs /.test(l));
check("P4", "An unaffordable action explains how to get the missing resource", needs.length > 0 && needs.every((l) => /gather|trade|market/i.test(l)), needs.join(" | ") || "no unaffordable action found");

// T7/T8: prepare a legal raid (draft in Build)
await tab(phone, "Raid");
await phone.locator("[data-tour=raid-planner] [role=radio]:has-text('Rival')").click();
const draft = await text(phone, "[data-tour=raid-planner]");
check("T7", "Draft state and why it can't be submitted yet are shown", /Draft \(not sent\)/.test(draft) && /Can't submit yet: Only during Scheme & Commit/.test(draft), draft);
check("T8", "Failure penalty and win/lose verdict visible before committing", /If it fails: you lose 2 gold/.test(draft) && /(Cannot succeed|Beats all known|Uncertain)/.test(draft), draft);
check("P5", "Hidden defense is labelled unknown, not guessed", /Hidden: their resources, committed defense cards/.test(draft) && /Unknown: defense cards/.test(draft));
await phone.screenshot({ path: `${OUT}/05-raid-draft.png` });

// T9: submit before the deadline
await phone.waitForSelector("[data-testid=phase-name]:has-text('Scheme & Commit')", { timeout: 90_000 });
const cardBtn = phone.locator("[data-tour=raid-planner] fieldset button[aria-pressed=false]:not([disabled])").filter({ hasNotText: "No card" }).first();
let usedCard = null;
if (await cardBtn.count()) {
  usedCard = (await cardBtn.innerText()).split("·")[0].replace(/^\S+\s/, "").trim();
  await cardBtn.click();
}
await phone.click("button:has-text('Review & submit raid')");
const confirm = await text(phone, "[role=dialog][aria-label='Submit this raid?']");
check("T9", "Confirmation repeats target, cost, penalty and irreversibility", /Target:/.test(confirm) && /You pay now/.test(confirm) && /lose 2 gold/.test(confirm) && /cannot be changed/.test(confirm), confirm);
await phone.click("[role=dialog] button:has-text('Submit raid')");
await phone.waitForSelector("[data-testid=raid-submitted]");
const status = await text(phone, "[data-testid=raid-status]");
check("T9", "Submitted order shows explicit status and lock countdown", /Submitted\./.test(status) && /Locked in \d+s/.test(status), status);

// Hidden information: the rival must not learn the target or the card
await host.waitForTimeout(600);
const rivalPage = await host.locator("body").innerText();
check("P5", "Rival sees that a raid was submitted, not its target or cards", /Newcomer has committed a secret raid order/.test(rivalPage) && !/raid on Rival/.test(rivalPage) && !(usedCard && new RegExp(`Newcomer.*${usedCard}`).test(rivalPage)), usedCard ?? "");

// T10: interpret the result
await phone.waitForSelector("text=raids revealed", { timeout: 90_000 });
await phone.waitForTimeout(1500);
const overlay = await text(phone, "[role=dialog][aria-label='Raid results']");
check("T10", "Result explains outcome, totals, breakdown and why", /What happened to you/.test(overlay) && /final attack/i.test(overlay) && /final defense/i.test(overlay) && /(is not greater than|is greater than)/.test(overlay) && /Base 2/.test(overlay), overlay);
check("T10", "Countdown to the next round is visible during the reveal", /starts in \d+s/.test(overlay), overlay);
await phone.screenshot({ path: `${OUT}/06-result.png` });
await phone.click("button:has-text('Back to the map')");

// T11: upkeep and insufficient food
const food = phone.locator("[data-tour=hud] > *").nth(2);
await food.click();
const foodPop = await text(phone, "[role=dialog]");
check("T11", "Food explanation covers upkeep and what happens without food", /upkeep/i.test(foodPop) && /1 gold instead/i.test(foodPop), foodPop);
await phone.keyboard.press("Escape");
await phone.waitForSelector("[data-testid=phase-name]:has-text('Build & Gather')", { timeout: 60_000 });
await tab(phone, "Feed");
await phone.waitForTimeout(300);
const feed = await text(phone, "[data-testid=feed]");
check("T11", "Upkeep payment appears in the feed with the change and reason", /Upkeep: you paid 1 food/.test(feed) && /-1 🍖/.test(feed) && /Every clan pays 1 food/.test(feed), feed.slice(0, 400));

// T12: points and match end
await tab(phone, "Players");
const players = await text(phone, "[data-testid=players]");
check("T12", "Scoring, tie-breakers and how the match ends are explained", /Successful raid: \+2/.test(players) && /Ties/.test(players) && /last clan standing/i.test(players) && /round 8/.test(players), players.slice(0, 300));

// Mobile basics
const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check("P7", "No horizontal page scroll on a phone", overflow <= 1, String(overflow));

console.log(JSON.stringify(results, null, 1));
console.log(`${results.filter((r) => r.result === "PASS").length}/${results.length} checks passed`);
console.log("Browser errors:", JSON.stringify(errors));
await browser.close();
process.exitCode = results.every((r) => r.result === "PASS") && errors.length === 0 ? 0 : 1;
