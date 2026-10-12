# Glossary

| Term | Meaning |
|---|---|
| **Attack / defense** | Raid strengths. A raid succeeds only if attack is **strictly greater** than defense |
| **Barricade** | +2 defense (max +4) that is used up by the first raid on your stronghold |
| **Build & Gather / Scheme & Commit / Resolution** | The three phases of a round (30 s / 30 s / 15 s) |
| **Command** | A request from a player to the server ("buy card"). Has a unique id so retries can't repeat it |
| **Contested site** | A resource site that pays more but can be ambushed. Safe sites can't |
| **Defense card** | A card committed secretly in advance and revealed when a raid hits |
| **Eliminated** | A clan with a destroyed fort and no resources after a successful raid. It spectates |
| **Event** | A public modifier announced after rounds 3, 5 and 7 |
| **Exposed** | A fort at 0 defense. It adds no defense |
| **Fort level** | Permanent maximum of your fort's defense (5 to 7). Clan growth raises it, repairs restore up to it |
| **Idempotent** | Doing it twice has the same effect as doing it once |
| **Inactive** | A clan that has been disconnected for 60 s. It keeps everything but takes no actions |
| **Intel** | Private scouting information shown in the Intel tab |
| **Load** | Resources a party is carrying home |
| **Party** | A gathering group. Each clan starts with 2 (max 4) |
| **PlayerView** | The server's per-player picture of the match. The only thing clients see |
| **Raid order** | A secret, locked-in decision: target, cards, steal priority, mercenaries |
| **Safe reserve** | Resources hidden by Emergency Evacuation until after upkeep |
| **Seat** | A clan's fixed position (stronghold on the map, resolution order). Rotated each round for ordering |
| **Seq** | A counter of authoritative changes in a match; clients ignore older updates |
| **Snapshot** | A saved copy of full match state at the end of a round (debugging only) |
| **Stock** | How much a site still has to gather. It regenerates slowly |
| **Tick** | The server's 200 ms update loop that advances timers, parties and phases |
| **Truce** | An accepted Unstable Truce: both sides get +2 points if neither raids the other |
| **Upkeep** | 1 food (or 1 gold) paid by every clan at the end of each round |
