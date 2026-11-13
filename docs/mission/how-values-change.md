# How Emera's values change

The values are only worth something if members can change them and the organization cannot quietly drop them. Emera is a nonprofit with user-elected board seats, so the members decide. Numbers marked [assumption] are starting points to replace once there are members to measure.

## Who does what

| Who | Power |
| --- | --- |
| Any member (Tier 1 or above) | Proposes a change, comments |
| Verified humans (Tier 2) | One vote each on member votes and the board election |
| Board (some seats user-elected) | Decides patch changes, runs the process, cannot change a "never" alone |
| Staff | Run the values check on product work |

Before the first board election, the founder and an interim board hold the board's role. They follow this same process in public, and the "never" lines are already binding on them.

## How often

| When | What |
| --- | --- |
| Any time | Open a proposal in the public repo |
| Quarterly (Jan, Apr, Jul, Oct) | Amendment window: proposals that reached the support bar get a 14-day comment period, then a decision |
| Yearly (January, same week as the payout-split vote) | Values review: staff publish every values check from the year, which commitments were broken or strained, and a proposed update |

## Proposal types and the bar to pass

| Type | Example | Bar |
| --- | --- | --- |
| Clarify (patch) | Reword a line, same meaning | Board majority after 14 days of comment |
| Amend a commitment (minor) | Change the creator fee cap from 5% to 4% | 50 supporters to enter the window [assumption], majority of votes cast, at least 5% of verified humans voting [assumption] |
| Add or retire a value (major) | Add a value on accessibility | Same as minor, plus board approval |
| Change a "never" (major) | Allow any ad | 2/3 of votes cast, 10% of verified humans voting [assumption], board 3/4, 30 days notice. Written into the bylaws so staff and the board cannot skip it |

Every decision ships with a version bump in `CHANGELOG.md`, the vote counts, and the dissenting arguments.

## How a value settles a product argument

Every product proposal in the public repo carries a values check: for each of the 7 values, one of "serves", "neutral" or "strains", with one line. Rules:

1. Hitting a "never" ends the proposal. It can only come back as a change proposal.
2. A "strains" needs a named tradeoff and the person who accepted it.
3. Between two options that both pass, pick the one the affected person can verify without asking us.

### Example 1: should we allow paid boosts?

Proposal: creators and brands pay to have a post shown higher in the default feed.

| Value | Check |
| --- | --- |
| Open by default | Strains. The reach log would say "shown because paid". That is explainable, but it stops the ranking from being one rule everyone can read. |
| Real people | Strains. Money would buy reach that a bought following cannot buy, so reach stops being a signal of real people's interest. |
| Paid, not harvested | Hits the never. Selling placement in the feed is selling members' attention. |
| Welcome first | Strains. A first post cannot outbid a brand. |

Ruling: rejected under value 6's never. What stays open under the values: a creator pays nothing for reach; third-party feeds that members chose themselves may sell labeled placement inside their own feed, because the member picked it (rule 3). A proposal to change the never would need the 2/3 vote above.

### Example 2: should we train AI on posts?

Two proposals hide in this one question, and the values split them.

| Use | Check |
| --- | --- |
| Hashes and embeddings of posts to find copies and detect abuse | Serves value 3 and 1. Allowed. Listed publicly in a data-use ledger with what is stored and for how long. |
| Training a generative model on member work | Hits value 6's never unless each creator opts in and is paid. Also strains value 5 (you own it). |
| Licensing member work to an outside AI company | Same: per creator, opt-in, paid, with the license terms attached to each post. |

Ruling: matching and safety models are allowed and logged. Generative training or licensing is off by default, and Emera does not do it itself. Honest limit (value 1): posts on an open protocol can be scraped by outsiders, and we cannot technically stop that. We attach a no-training license term to every post by default, treat violations as copy-watch matches, and say plainly on the site what we can and cannot prevent.

## Decision record

Every values check and ruling is stored as `docs/mission/decisions/YYYY-MM-DD-slug.md` with: the proposal, the check table, the ruling, who decided, and whether it changed a value. A pattern of the same strain showing up three times is itself a proposal at the next values review.
