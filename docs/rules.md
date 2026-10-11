# Rules (v1.2, as implemented)

Numbers come from `packages/game-content/src/config.ts`. Interpretations of points the spec left open are marked ⚙ and explained in `balance_decisions.md`.

## Match flow
- **8 rounds.** Each round has three phases: **Build & Gather (30s)**, **Scheme & Commit (30s)** and **Resolution (15s)**. Durations can be configured with `BUILD_SECONDS`, `SCHEME_SECONDS` and `RESOLUTION_SECONDS`.
- The server owns all timers. Client countdowns are for display only.
- When the Scheme phase ends, every raid is locked and resolved (see Raids). Resolution then shows the results.
- When Resolution ends: upkeep is charged, evacuated resources return, truces pay out, trade offers expire, and the next round starts.
- **Events** are announced at the start of Resolution in rounds 3, 5 and 7. Each becomes active at the start of the next round and lasts 2 rounds (the last one covers round 8 only).
- The match ends after round 8, or immediately after a Resolution that leaves only one clan alive.

## Starting kit
10 gold, 6 materials, 6 food. A fort at 5 defense (fort level 5, maximum 7). 3 random cards (maximum hand size 7). 2 gathering parties (maximum 4). Each resource has a storage cap of 100.

## Actions (Build or Scheme)
| Action | Cost | Effect |
|---|---|---|
| Buy card | 4 gold | Draw a card if your hand has room |
| Recruit mercenaries | 3 gold + 2 food | +2 attack on your next raid (maximum +6 stored) |
| Barricade | 3 materials | +2 defense until a raid hits your stronghold (maximum +4) |
| Repair fort | 2 materials | Restore 2 defense, up to your fort level |
| Clan growth | 5 food | Fort level +1 and defense +1 (maximum 7) |
| Scout a clan | 2 gold | Private report on a rival (see Scouting). Once per rival per round |
| Train party ⚙ | 2 gold + 3 food | Gain an extra gathering party (maximum 4) |
| Market exchange ⚙ | 3 of one resource → 1 of another | The rate is 2:1 with Merchant Caravan |

**Upkeep:** at the end of each round, pay 1 food. If you have no food, pay 1 gold instead. If you have neither, nothing else happens.

## Gathering
Send an idle party to a resource site. The party **travels** (time depends on distance), **gathers** (8–15 seconds), then **returns** and delivers its load. A party carries at most 6 units.
- **Safe sites** (Glimmer Hollow, Whispering Pines, Sunny Acres) yield 3 per trip, take 8s to gather, and can't be ambushed.
- **Contested sites** (Dragon's Teeth Mine, Thornwood, Goblin Fields) yield 5 per trip, take 12s, and parties there can be ambushed.
- **Ancient Ruins** yield 4 of a random resource, take 15s, and are contested.
- When a party starts gathering, its yield is reserved from the site's stock. Sites regenerate their stock every 10 seconds, up to a maximum.
- **Recall:** a travelling party returns empty. A gathering party returns with a share of its load proportional to the time it spent gathering (rounded down). The unearned stock goes back to the site.
- If storage is full when a party delivers, the excess spoils. ⚙

## Raids
- You can commit **one raid per round, during Scheme**. It targets a rival's stronghold or a contested site, and can carry one primary and one support raid card. Committing also consumes your stored mercenaries.
- **Attack** = 2 + mercenaries + card modifiers. **Defense** = fort + barricade + reinforcements + defense cards. Troops don't exist in v1.2. ⚙
- The raid **succeeds only if attack is strictly greater than defense.**
- **Success:** steal up to 6 units, taking your chosen priority resource first, then whatever the target holds most of. Theft is limited by your free storage, and anything you can't store stays with the defender. ⚙ The fort takes 1 damage. You score +2.
- **Failure:** the attacker loses 2 gold if they have it.
- A fort at 0 is **exposed** and adds no defense. Destroying a fort (taking it from above 0 to 0) scores +3.
- **Elimination:** if a raid leaves a clan with a fort at 0 and no resources (safe reserve included), that clan is eliminated. The raider scores +4, and the eliminated player spectates for the rest of the match.
- **Order:** raids resolve one after another in seat order, starting one seat later each round. Each raid sees the state left by the raids before it.
- **Ambushes (location raids)** ⚙ hit enemy parties that are gathering at the site at resolution time. Each party there adds 1 defense. On success, the raider takes the parties' partial loads (up to the steal cap) and the parties are sent home empty. An ambush with no parties present fails with no penalty, and an ambush scores +2 only if something was taken.

## Scouting and secrecy
- Rivals can see whether you have committed a raid (⚔), but not its target or cards.
- **Scouting** reports a rival's resources, fort, barricade, hand size, number of committed defense cards, and raid target. Smoke and Mirrors hides the target. False Flag shows a decoy target. Counter-Intel blocks the scouting entirely.
- Your hand, resources, raid order, committed defenses and party loads are never included in any other player's data.

## Trading and diplomacy
- You can send up to 3 trade offers per round. The recipient can accept or reject. The server re-checks both players' balances and storage caps at the moment of acceptance. Accepted trades are final. You can't trade with eliminated clans.
- Chat is always available. Alliances and promises are not enforced.

## Clans
- 🐀 **Rats of the Racket:** once per match, take 2 gold from every rival holding 5 or more gold.
- 🐸 **Iron Toads:** start with fort 7.
- 🍄 **Mushroom Merchants:** the first card bought each round costs 2 gold.
- 🦊 **Foxfire Bandits:** once per match, change your committed raid target during Scheme for free.
- Several players may pick the same clan. ⚙

## Events
Gold Rush · Food Shortage · Wandering Merchant · Bounty Board (+3 points) · Fort Inspection (+2 points) · Goblin Tax. One-time effects apply only when the event activates, and each event's claims are tracked so nothing triggers twice.

## Scoring
| Outcome | Points |
|---|---|
| Successful raid | +2 |
| Destroying a fort | +3 |
| Eliminating a rival | +4 |
| Fort Inspection / Bounty Board | +2 / +3 |
| Bounty Contract / Unstable Truce honoured | +2 / +2 |
| Fort still standing at the end | +2 |
| Every 5 of each resource at the end | +1 |

**Ties** are broken by successful raids, then total resources, then fort defense. If players are still tied, they share the victory. If the match ends because only one clan is left, that clan wins.

## Disconnects
The match never pauses. Orders already submitted still resolve. A clan disconnected for 60 seconds becomes **inactive**: it keeps its stuff but takes no actions. Reconnecting with the browser's token restores control. Late joining isn't allowed.
