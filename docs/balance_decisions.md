# Balance Decisions and Interpretations

Values the spec did not define, chosen conservatively. All of them live in `packages/game-content` and can be tuned there.

| Topic | Decision | Why |
|---|---|---|
| Deck size | 22 card types × 2 copies (44 cards) | 8 players × 3 starting cards = 24, more than 22 single cards |
| Party capacity | 6 units (+2 at a Resource Rush site) | Matches the 6-unit steal cap |
| Yields and gather times | Safe 3 / 8s, contested 5 / 12s, Ruins 4 random / 15s | Within the required 8–15s; risk earns more |
| Site stock | Safe 40, contested 30, Ruins 24; +2 (Ruins +1) every 10s | Gives a reason to compete for contested sites |
| Fort level vs repair | Repair restores defense up to the fort level; Clan growth raises the level (maximum 7) | Gives the two actions distinct roles |
| Barricades | +2 each, maximum +4; all are used up by the first raid on your stronghold | "Until used" |
| Mercenaries | Stack up to +6; consumed by your next raid commit | Prevents a runaway attack value |
| Troops | None in v1.2; defense = fort + barricade + reinforcements + cards | The spec mentions "troops" but defines none |
| Extra parties | "Train party": 2 gold + 3 food, maximum 4 | The spec sets a maximum of 4 but gives no way to get more |
| Market | Trading Post exchange at 3:1 | Gives Merchant Caravan something to improve |
| Theft limit | Theft is limited by the attacker's free storage; the rest stays with the defender | Prevents duplication or loss |
| Storage overflow on delivery | Excess spoils | Keeps the 100 cap simple |
| Ambushes | Defense = 1 per enemy party at the site; steal their partial loads; no penalty if the site is empty | Makes contested sites risky |
| Stronghold-only cards | Sneaky Heist, Tunnel Rats, Battering Ram, Decoy Caravan can't be used on ambushes | Their effects need a fort |
| Defense cards | Committed in Build or Scheme; maximum 2 per round; no duplicates; Last-Minute Reinforcements counts towards both (it previously bypassed them) | Limits defensive stacking |
| Booby Trap | Applies to the first raid only; if that raid fails, +2 extra gold loss | "Against one raid" |
| Reinforcements | +2 that stays until the next raid, even across rounds | "Next incoming raid" |
| Counter-Ambush | −3 to raids with attack 6+, −1 to others; a raid that still succeeds steals half and deals no fort damage | "Reduce its associated penalty" |
| Decoy Vault | Steal cap −3 per successful raid | |
| Emergency Evacuation | Up to 8 units, safe until after upkeep; counts as resources for elimination | |
| Effect durations | Most timed cards last this round and next | |
| Eagle-Eye / Trail Markers / Counter-Intel / False Flag / Rations / Rush / Sabotage / Bounty / Truce / Merchant Caravan / Hit and Run | Costs of 1–3 resources, values as in `card_reference.md` | Conservative; none is decisive alone |
| Truce | The target must accept; each side that never raids the other (including ambushes on its parties) gets +2 at the end | Betrayal is allowed and forfeits the bonus |
| Hidden resources | Rivals' resources are hidden unless scouted | Makes scouting worth paying for |
| Raid order | Seat order (shuffled at start), rotated by one seat each round | Deterministic and fair over time |
| Duplicate clans | Allowed | 8 players but only 4 clans |
| Bounty Board target | All clans tied for wealthiest when the event activates | |
| Wandering Merchant | One card from the deck; unsold, it goes to the discard pile | |
| Elimination timing | Checked only after a successful raid; upkeep can't eliminate | Spec: "after successful raid resolution" |
