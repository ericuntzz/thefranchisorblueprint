# Intake weight-sweep results

Generated: 2026-05-10T21:41:01.891Z

Scenarios: 4, weight combos: 12, total runs: 48.

Each row's `intuition match` column counts how many of Eric's expected top-3 states appear in this combo's top 3 (out of 3). Higher = closer to the expected ranking.

## Costa Vida (UT, mature franchise)

> 94 locations across UT/CO/NV/AZ. SLC and Phoenix get filtered out by existing-footprint exclusion (tranche 4). Remaining candidates are far-flung. Eric's intuition: surface adjacent states or short drive (Boise, Albuquerque) over LA/Denver.

Source: UT · home HHI $87,000 · expected top-3 states: ID, OR, NM

| combo | intuition match | top 3 (state, finalScore, bias) |
|---|---|---|
| 01-no-bias | 1/3 | CA Los Angeles (77, +0) · TX Austin (76, +0) · ID Boise (72, +0) |
| 02-default | 2/3 | ID Boise (82, +10) · TX Austin (76, +0) · NM Albuquerque (75, +10) |
| 03-light-home | 1/3 | ID Boise (77, +5) · CA Los Angeles (76, -1) · TX Austin (76, +0) |
| 04-aggressive-home | 2/3 | ID Boise (89, +17) · NM Albuquerque (82, +17) · TX Austin (76, +0) |
| 05-state-only | 1/3 | ID Boise (80, +8) · CA Los Angeles (80, +3) · TX Austin (76, +0) |
| 06-drive-time-only | 1/3 | ID Boise (78, +6) · CA Los Angeles (77, +0) · TX Austin (76, +0) |
| 07-no-cost-parity | 1/3 | ID Boise (82, +10) · CA Los Angeles (79, +2) · TX Austin (76, +0) |
| 08-heavy-cost-parity | 2/3 | ID Boise (82, +10) · TX Austin (76, +0) · NM Albuquerque (75, +10) |
| 09-state-heavy-time-light | 2/3 | ID Boise (83, +11) · NM Albuquerque (76, +11) · CA Los Angeles (76, -1) |
| 10-time-heavy-state-light | 2/3 | ID Boise (82, +10) · TX Austin (76, +0) · NM Albuquerque (75, +10) |
| 11-balanced-symmetric | 1/3 | ID Boise (82, +10) · CA Los Angeles (76, -1) · TX Austin (76, +0) |
| 12-extreme-no-bias-restored | 3/3 | ID Boise (92, +20) · NM Albuquerque (85, +20) · OR Portland (76, +6) |

## High Point Coffee (AL, single location)

> Single coffee shop in Daphne, AL (Baldwin County). Eric's intuition: South-region picks (TN, GA, MS, FL) should beat Northeast or West Coast on proximity bias.

Source: AL · home HHI $74,000 · expected top-3 states: GA, TN, NC

| combo | intuition match | top 3 (state, finalScore, bias) |
|---|---|---|
| 01-no-bias | 2/3 | GA Atlanta (79, +0) · NC Charlotte (79, +0) · TX Dallas (79, +0) |
| 02-default | 3/3 | GA Atlanta (85, +6) · TN Nashville (85, +10) · NC Charlotte (81, +2) |
| 03-light-home | 2/3 | GA Atlanta (82, +3) · NC Charlotte (80, +1) · TX Dallas (80, +1) |
| 04-aggressive-home | 3/3 | TN Nashville (92, +17) · GA Atlanta (90, +11) · NC Charlotte (83, +4) |
| 05-state-only | 3/3 | GA Atlanta (87, +8) · TN Nashville (83, +8) · NC Charlotte (82, +3) |
| 06-drive-time-only | 3/3 | GA Atlanta (85, +6) · TN Nashville (81, +6) · NC Charlotte (79, +0) |
| 07-no-cost-parity | 3/3 | GA Atlanta (89, +10) · TN Nashville (85, +10) · NC Charlotte (81, +2) |
| 08-heavy-cost-parity | 2/3 | TN Nashville (85, +10) · NC Charlotte (81, +2) · TX Dallas (81, +2) |
| 09-state-heavy-time-light | 3/3 | GA Atlanta (86, +7) · TN Nashville (86, +11) · NC Charlotte (82, +3) |
| 10-time-heavy-state-light | 3/3 | GA Atlanta (85, +6) · TN Nashville (85, +10) · NC Charlotte (80, +1) |
| 11-balanced-symmetric | 3/3 | GA Atlanta (86, +7) · TN Nashville (85, +10) · NC Charlotte (81, +2) |
| 12-extreme-no-bias-restored | 3/3 | TN Nashville (95, +20) · GA Atlanta (91, +12) · NC Charlotte (85, +6) |

## NYC concept (single location, Manhattan)

> Coastal Northeast operator. Eric's intuition: Northeast/Mid-Atlantic picks first (NJ, MA, PA), then drive-time chains. Tests that high-HHI coastal stays competitive without massive penalty for cost-parity-mismatch with itself.

Source: NY · home HHI $95,000 · expected top-3 states: NJ, MA, PA

| combo | intuition match | top 3 (state, finalScore, bias) |
|---|---|---|
| 01-no-bias | 2/3 | NJ Hoboken (80, +0) · MA Boston (78, +0) · IL Chicago (76, +0) |
| 02-default | 3/3 | NJ Hoboken (94, +14) · MA Boston (92, +14) · PA Philadelphia (87, +14) |
| 03-light-home | 3/3 | NJ Hoboken (87, +7) · MA Boston (85, +7) · PA Philadelphia (80, +7) |
| 04-aggressive-home | 3/3 | MA Boston (100, +24) · NJ Hoboken (100, +24) · PA Philadelphia (97, +24) |
| 05-state-only | 3/3 | NJ Hoboken (88, +8) · MA Boston (86, +8) · PA Philadelphia (81, +8) |
| 06-drive-time-only | 3/3 | NJ Hoboken (92, +12) · MA Boston (90, +12) · PA Philadelphia (85, +12) |
| 07-no-cost-parity | 3/3 | NJ Hoboken (94, +14) · MA Boston (92, +14) · PA Philadelphia (87, +14) |
| 08-heavy-cost-parity | 3/3 | NJ Hoboken (94, +14) · MA Boston (92, +14) · PA Philadelphia (87, +14) |
| 09-state-heavy-time-light | 3/3 | NJ Hoboken (93, +13) · MA Boston (91, +13) · PA Philadelphia (86, +13) |
| 10-time-heavy-state-light | 3/3 | NJ Hoboken (97, +17) · MA Boston (95, +17) · PA Philadelphia (90, +17) |
| 11-balanced-symmetric | 3/3 | NJ Hoboken (95, +15) · MA Boston (93, +15) · PA Philadelphia (88, +15) |
| 12-extreme-no-bias-restored | 3/3 | MA Boston (100, +28) · PA Philadelphia (100, +28) · NJ Hoboken (100, +28) |

## Texas BBQ concept (Austin)

> TX home, regional concept. Adjacent-state fires for AR/LA/NM/OK. Same-state for TX. Tests how aggressively the bias pulls Texas-adjacent ahead of higher-pillar coastal picks.

Source: TX · home HHI $91,000 · expected top-3 states: TX, OK, LA

| combo | intuition match | top 3 (state, finalScore, bias) |
|---|---|---|
| 01-no-bias | 1/3 | GA Atlanta (79, +0) · CA San Diego (78, +0) · TX Houston (68, +0) |
| 02-default | 1/3 | TX Houston (88, +20) · GA Atlanta (81, +2) · CA San Diego (78, +0) |
| 03-light-home | 1/3 | GA Atlanta (80, +1) · TX Houston (78, +10) · CA San Diego (78, +0) |
| 04-aggressive-home | 1/3 | TX Houston (100, +34) · GA Atlanta (83, +4) · CA San Diego (78, +0) |
| 05-state-only | 1/3 | TX Houston (82, +14) · GA Atlanta (82, +3) · CA San Diego (78, +0) |
| 06-drive-time-only | 1/3 | TX Houston (80, +12) · GA Atlanta (79, +0) · CA San Diego (78, +0) |
| 07-no-cost-parity | 1/3 | TX Houston (88, +20) · GA Atlanta (81, +2) · CA San Diego (78, +0) |
| 08-heavy-cost-parity | 1/3 | TX Houston (88, +20) · GA Atlanta (81, +2) · CA San Diego (78, +0) |
| 09-state-heavy-time-light | 1/3 | TX Houston (90, +22) · GA Atlanta (82, +3) · CA San Diego (78, +0) |
| 10-time-heavy-state-light | 1/3 | TX Houston (88, +20) · GA Atlanta (80, +1) · CA San Diego (78, +0) |
| 11-balanced-symmetric | 1/3 | TX Houston (88, +20) · GA Atlanta (81, +2) · CA San Diego (78, +0) |
| 12-extreme-no-bias-restored | 2/3 | TX Houston (100, +41) · GA Atlanta (85, +6) · OK OKC (78, +14) |

## Aggregate score across all scenarios

| combo | total intuition match | notes |
|---|---|---|
| 12-extreme-no-bias-restored | 11/12 | Maximum aggressiveness. Tests the upper bound — does the algorithm break down (always picks home regardless of pillar score)? |
| 02-default | 9/12 | Current production weights as of tranche 3. |
| 04-aggressive-home | 9/12 | ~1.7× the default. Tests whether home is over-weighted — does it overshadow real fit signals? |
| 09-state-heavy-time-light | 9/12 | State weighted heavier than drive-time. For franchisor support radius, state lines often matter more than miles (regulatory + brand recognition). |
| 10-time-heavy-state-light | 9/12 | Drive-time weighted heavier than state. Operationally accurate — actual cost of supporting a unit scales with distance, not arbitrary state lines. |
| 05-state-only | 8/12 | State and region only — no drive-time, no cost-parity. Simpler model. |
| 06-drive-time-only | 8/12 | Drive-time-only. Tests whether geographic distance is the simpler/better proxy for proximity than state codes. |
| 07-no-cost-parity | 8/12 | Default minus cost-parity. Tests whether cost-parity adds signal or just noise. |
| 08-heavy-cost-parity | 8/12 | Default but cost-parity is now a hammer. Tests whether penalizing income mismatch hard improves fit. |
| 11-balanced-symmetric | 8/12 | State and drive-time both at 10/5; cost-parity symmetric. Even-handed test combo. |
| 03-light-home | 7/12 | Half the default bias. Tests whether a lighter touch still surfaces home-region. |
| 01-no-bias | 6/12 | Pure 4-pillar score. Baseline — what production looked like before tranche 3. |

## Top 3 combos detailed

### 12-extreme-no-bias-restored (11/12 match)

> Maximum aggressiveness. Tests the upper bound — does the algorithm break down (always picks home regardless of pillar score)?

| weight | value |
|---|---|
| sameStateBonus | +25 |
| adjacentStateBonus | +12 |
| sameRegionBonus | +6 |
| within250MiBonus | +16 |
| within500MiBonus | +8 |
| costParityHighPenalty | -8 |
| costParityLowPenalty | -6 |

### 02-default (9/12 match)

> Current production weights as of tranche 3.

| weight | value |
|---|---|
| sameStateBonus | +12 |
| adjacentStateBonus | +6 |
| sameRegionBonus | +2 |
| within250MiBonus | +8 |
| within500MiBonus | +4 |
| costParityHighPenalty | -4 |
| costParityLowPenalty | -3 |

### 04-aggressive-home (9/12 match)

> ~1.7× the default. Tests whether home is over-weighted — does it overshadow real fit signals?

| weight | value |
|---|---|
| sameStateBonus | +20 |
| adjacentStateBonus | +10 |
| sameRegionBonus | +4 |
| within250MiBonus | +14 |
| within500MiBonus | +7 |
| costParityHighPenalty | -6 |
| costParityLowPenalty | -4 |

