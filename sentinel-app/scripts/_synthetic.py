"""
Synthetic Sentinel ODI dataset generator.

Mirrors what build_snapshot.py would receive from a live Snowflake gold-layer
query so the React frontend renders identically whether the data came from:

    Dropbox folder (or FDIC API)  →  Snowflake bronze  →  dbt (silver, gold)
                                                              │
                                                              ▼
                                                  frontend/public/data/*.json

…or this deterministic generator.

Pure stdlib — no faker, no snowflake-connector — seeded with 42 so JPMorgan
gets the same risk score and Florida the same failure cluster on every run.
"""
from __future__ import annotations

import datetime as dt
import random
from typing import Any

SEED = 42

# ---------------------------------------------------------------------------
# Geography
# ---------------------------------------------------------------------------

# 51 entries (50 states + DC). Each: (abbr, full_name, region, base_assets_b,
# elevated_failure_bias). Bias 0..3 nudges failure assignment without breaking
# determinism.
STATES: list[tuple[str, str, str, int, int]] = [
    ("AL", "Alabama",        "South",   165, 1),
    ("AK", "Alaska",         "West",     27, 0),
    ("AZ", "Arizona",        "West",    175, 1),
    ("AR", "Arkansas",       "South",   115, 1),
    ("CA", "California",     "West",   1850, 2),
    ("CO", "Colorado",       "West",    225, 1),
    ("CT", "Connecticut",    "Northeast",185, 1),
    ("DE", "Delaware",       "South",   930, 0),
    ("DC", "Dist. of Columbia","South",  85, 0),
    ("FL", "Florida",        "South",   620, 3),
    ("GA", "Georgia",        "South",   485, 3),
    ("HI", "Hawaii",         "West",     65, 0),
    ("ID", "Idaho",          "West",     58, 1),
    ("IL", "Illinois",       "Midwest", 720, 3),
    ("IN", "Indiana",        "Midwest", 245, 1),
    ("IA", "Iowa",           "Midwest", 195, 1),
    ("KS", "Kansas",         "Midwest", 145, 1),
    ("KY", "Kentucky",       "South",   165, 1),
    ("LA", "Louisiana",      "South",   145, 1),
    ("ME", "Maine",          "Northeast", 52, 0),
    ("MD", "Maryland",       "South",   215, 1),
    ("MA", "Massachusetts",  "Northeast",385, 1),
    ("MI", "Michigan",       "Midwest", 295, 2),
    ("MN", "Minnesota",      "Midwest", 545, 2),
    ("MS", "Mississippi",    "South",   115, 1),
    ("MO", "Missouri",       "Midwest", 245, 2),
    ("MT", "Montana",        "West",     42, 0),
    ("NE", "Nebraska",       "Midwest", 175, 1),
    ("NV", "Nevada",         "West",     95, 2),
    ("NH", "New Hampshire",  "Northeast", 48, 0),
    ("NJ", "New Jersey",     "Northeast",285, 1),
    ("NM", "New Mexico",     "West",     55, 1),
    ("NY", "New York",       "Northeast",2350, 2),
    ("NC", "North Carolina", "South",  3850, 1),
    ("ND", "North Dakota",   "Midwest",  68, 0),
    ("OH", "Ohio",           "Midwest", 565, 2),
    ("OK", "Oklahoma",       "South",   145, 1),
    ("OR", "Oregon",         "West",    115, 1),
    ("PA", "Pennsylvania",   "Northeast",525, 2),
    ("RI", "Rhode Island",   "Northeast", 48, 0),
    ("SC", "South Carolina", "South",   135, 1),
    ("SD", "South Dakota",   "Midwest", 685, 0),
    ("TN", "Tennessee",      "South",   235, 1),
    ("TX", "Texas",          "South",   795, 2),
    ("UT", "Utah",           "West",    265, 1),
    ("VT", "Vermont",        "Northeast", 32, 0),
    ("VA", "Virginia",       "South",   285, 1),
    ("WA", "Washington",     "West",    285, 1),
    ("WV", "West Virginia",  "South",    65, 1),
    ("WI", "Wisconsin",      "Midwest", 215, 1),
    ("WY", "Wyoming",        "West",     22, 0),
]
assert len(STATES) == 51, "must include 50 states + DC"

# Hand-curated institution seed (~80 real names + filler). Each:
# (cert, name, city, state, charter_class, established_year, deposits_b).
# Charter class follows FDIC BKCLASS: N=National, NM=Non-member, SM=State member,
# SA=Savings assn, SB=Savings bank, OI=Other.
INSTITUTION_SEED: list[tuple[int, str, str, str, str, int, float]] = [
    (628,    "JPMorgan Chase Bank, National Association",       "Columbus",      "OH", "N",  1824, 2410.0),
    (3510,   "Bank of America, National Association",           "Charlotte",     "NC", "N",  1904, 2025.0),
    (451,    "Wells Fargo Bank, National Association",          "Sioux Falls",   "SD", "N",  1870, 1480.0),
    (7213,   "Citibank, National Association",                  "Sioux Falls",   "SD", "N",  1812, 1280.0),
    (6548,   "U.S. Bank National Association",                  "Cincinnati",    "OH", "N",  1863,  525.0),
    (6384,   "PNC Bank, National Association",                  "Wilmington",    "DE", "N",  1852,  425.0),
    (3511,   "Truist Bank",                                     "Charlotte",     "NC", "SM", 1872,  395.0),
    (32992,  "Goldman Sachs Bank USA",                          "New York",      "NY", "SM", 2008,  390.0),
    (33124,  "Morgan Stanley Bank, N.A.",                       "Salt Lake City","UT", "N",  1985,  220.0),
    (57803,  "Charles Schwab Bank, SSB",                        "Westlake",      "TX", "SB", 2003,  295.0),
    (27314,  "Capital One, National Association",               "McLean",        "VA", "N",  1933,  365.0),
    (16068,  "TD Bank, National Association",                   "Wilmington",    "DE", "N",  1852,  370.0),
    (16571,  "Fifth Third Bank, National Association",          "Cincinnati",    "OH", "N",  1858,  205.0),
    (6672,   "KeyBank National Association",                    "Cleveland",     "OH", "N",  1849,  185.0),
    (12368,  "Regions Bank",                                    "Birmingham",    "AL", "SM", 1971,  155.0),
    (4297,   "M&T Bank",                                        "Buffalo",       "NY", "SM", 1856,  165.0),
    (22146,  "Citizens Bank, National Association",             "Providence",    "RI", "N",  1828,  175.0),
    (33954,  "Huntington National Bank",                        "Columbus",      "OH", "N",  1866,  185.0),
    (3850,   "BMO Bank N.A.",                                   "Chicago",       "IL", "N",  1882,  265.0),
    (16548,  "First Citizens Bank & Trust Company",             "Raleigh",       "NC", "SM", 1898,  205.0),
    (57957,  "Ally Bank",                                       "Sandy",         "UT", "SB", 2004,  150.0),
    (33837,  "Discover Bank",                                   "Greenwood",     "DE", "SB", 1911,  105.0),
    (17534,  "American Express National Bank",                  "Sandy",         "UT", "N",  1989,  130.0),
    (35301,  "Synchrony Bank",                                  "Draper",        "UT", "SB", 1988,   97.0),
    (24387,  "Comerica Bank",                                   "Dallas",        "TX", "SM", 1849,   75.0),
    (33555,  "Webster Bank, National Association",              "Stamford",      "CT", "N",  1935,   65.0),
    (29950,  "First Horizon Bank",                              "Memphis",       "TN", "SM", 1864,   65.0),
    (5972,   "Zions Bancorporation, N.A.",                      "Salt Lake City","UT", "N",  1873,   75.0),
    (628310, "Western Alliance Bank",                           "Phoenix",       "AZ", "SM", 1994,   55.0),
    (34519,  "East West Bank",                                  "Pasadena",      "CA", "SM", 1973,   62.0),
    (19048,  "Cadence Bank",                                    "Tupelo",        "MS", "SM", 1876,   42.0),
    (1976,   "Synovus Bank",                                    "Columbus",      "GA", "SM", 1888,   50.0),
    (4150,   "Pinnacle Bank",                                   "Nashville",     "TN", "SM", 2000,   42.0),
    (29950000, "Valley National Bank",                          "Wayne",         "NJ", "N",  1927,   54.0),
    (16068001, "BankUnited, National Association",              "Miami Lakes",   "FL", "N",  2009,   28.0),
    (57803001, "Texas Capital Bank, National Association",      "Dallas",        "TX", "N",  1998,   26.0),
    (57803002, "Old National Bank",                             "Evansville",    "IN", "N",  1834,   45.0),
    (33555001, "Glacier Bank",                                  "Kalispell",     "MT", "SM", 1955,   23.0),
    (33555002, "South State Bank, National Association",        "Columbia",      "SC", "N",  1933,   38.0),
    (33555003, "Pacific Premier Bank",                          "Irvine",        "CA", "SM", 1983,   20.0),
    (33555004, "Bank of Hawaii",                                "Honolulu",      "HI", "SM", 1897,   22.0),
    (33555005, "First Hawaiian Bank",                           "Honolulu",      "HI", "SM", 1858,   23.0),
    (33555006, "Commerce Bank",                                 "Kansas City",   "MO", "SM", 1865,   28.0),
    (33555007, "UMB Bank, National Association",                "Kansas City",   "MO", "N",  1913,   36.0),
    (33555008, "Bank OZK",                                      "Little Rock",   "AR", "SM", 1903,   29.0),
    (33555009, "BOK Financial Corporation",                     "Tulsa",         "OK", "N",  1910,   42.0),
    (33555010, "Prosperity Bank",                               "Houston",       "TX", "SM", 1983,   28.0),
    (33555011, "Stifel Bank",                                   "Saint Louis",   "MO", "SM", 2007,   25.0),
    (33555012, "Sandy Spring Bank",                             "Olney",         "MD", "SM", 1868,   12.0),
    (33555013, "Beal Bank, SSB",                                "Plano",         "TX", "SB", 2004,   13.0),
    (33555014, "Mercantile Bank of Michigan",                   "Grand Rapids",  "MI", "SM", 1997,    5.0),
    (33555015, "Mechanics Bank",                                "Walnut Creek",  "CA", "SM", 1905,   16.0),
    (33555016, "Heritage Oaks Bank",                            "Paso Robles",   "CA", "SM", 1983,    3.0),
    (33555017, "Independent Bank",                              "McKinney",      "TX", "SM", 1988,   16.0),
    (33555018, "Cathay Bank",                                   "Los Angeles",   "CA", "SM", 1962,   18.0),
    (33555019, "Preferred Bank",                                "Los Angeles",   "CA", "SM", 1991,    6.0),
    (33555020, "First Foundation Bank",                         "Irvine",        "CA", "SM", 1990,    9.0),
    (33555021, "Banner Bank",                                   "Walla Walla",   "WA", "SM", 1890,   12.0),
    (33555022, "Columbia State Bank",                           "Tacoma",        "WA", "SM", 1993,   18.0),
    (33555023, "Washington Federal, N.A.",                      "Seattle",       "WA", "N",  1917,   17.0),
    (33555024, "Northwest Bank",                                "Warren",        "PA", "SM", 1896,   10.0),
    (33555025, "Provident Bank",                                "Iselin",        "NJ", "SM", 1839,   12.0),
    (33555026, "Customers Bank",                                "West Reading",  "PA", "SM", 1997,   16.0),
    (33555027, "Eastern Bank",                                  "Boston",        "MA", "SM", 1818,   17.0),
    (33555028, "Rockland Trust Company",                        "Rockland",      "MA", "SM", 1907,   16.0),
    (33555029, "First Republic Bank",                           "San Francisco", "CA", "SM", 1985,   25.0),
    (33555030, "Cross River Bank",                              "Fort Lee",      "NJ", "SM", 2008,    8.0),
    (33555031, "Live Oak Banking Company",                      "Wilmington",    "NC", "SM", 2008,   10.0),
    (33555032, "Northern Trust Company",                        "Chicago",       "IL", "SM", 1889,  120.0),
    (33555033, "Bank of New York Mellon",                       "New York",      "NY", "N",  1784,  290.0),
    (33555034, "State Street Bank and Trust",                   "Boston",        "MA", "N",  1792,  220.0),
    (33555035, "Silicon Valley Bridge Bank",                    "Santa Clara",   "CA", "N",  1983,   40.0),
    (33555036, "Signature Bridge Bank",                         "New York",      "NY", "SM", 2001,   36.0),
    (33555037, "Pacific Western Bank",                          "Beverly Hills", "CA", "SM", 1999,   18.0),
    (33555038, "WesBanco Bank",                                 "Wheeling",      "WV", "SM", 1870,   12.0),
    (33555039, "Sterling National Bank",                        "Pearl River",   "NY", "N",  1929,   13.0),
    (33555040, "First Commonwealth Bank",                       "Indiana",       "PA", "SM", 1934,   12.0),
    (33555041, "Wintrust Bank, N.A.",                           "Rosemont",      "IL", "N",  1996,   42.0),
    (33555042, "Associated Bank, N.A.",                         "Green Bay",     "WI", "N",  1861,   34.0),
    (33555043, "Atlantic Union Bank",                           "Richmond",      "VA", "SM", 1902,   17.0),
    (33555044, "United Bankshares",                             "Charleston",    "WV", "SM", 1839,   24.0),
    (33555045, "Glacier Republic Bank",                         "Helena",        "MT", "SM", 1955,    6.0),
    (33555046, "Renasant Bank",                                 "Tupelo",        "MS", "SM", 1904,   13.0),
    (33555047, "Trustmark National Bank",                       "Jackson",       "MS", "N",  1889,   13.0),
    (33555048, "Hancock Whitney Bank",                          "Gulfport",      "MS", "SM", 1899,   28.0),
    (33555049, "Servisfirst Bank",                              "Birmingham",    "AL", "SM", 2005,   13.0),
    (33555050, "First Tennessee Bank",                          "Memphis",       "TN", "SM", 1864,   33.0),
]


REGULATORS = ["FDIC", "OCC", "FRB"]
ASSET_CLASSES = ["GSIB", "Regional", "Community"]
RISK_TIERS = ["low", "moderate", "elevated", "high"]


# ---------------------------------------------------------------------------
# File-inventory ground truth (matches the values in the conversation)
# ---------------------------------------------------------------------------

FILE_INVENTORY_BY_EXT = [
    ("csv",   130),
    ("xlsx",   68),
    ("pptx",   63),
    ("pdf",    44),
    ("ldf",    39),
    ("mdf",    39),
    ("json",   37),
    ("docx",   32),
    ("parquet",18),
    ("png",    15),
    ("txt",    15),
    ("zip",    10),
    ("xml",     9),
    ("tsv",     8),
    ("html",    8),
    ("yaml",    7),
    ("ndjson",  5),
    ("sql",     5),
    ("avro",    3),
    ("orc",     2),
    ("bak",     2),
    ("log",     2),
    ("conf",    1),
    ("md",      1),
    ("ini",     1),
    ("cfg",     1),
    ("bin",     1),
    ("dat",     1),
    ("dmp",     1),
    ("bz2",     1),
    ("gz",      1),
    ("tar",     1),
    ("7z",      1),
    ("rar",     1),
    ("pem",     1),
    ("crt",     1),
    ("key",     1),
    ("pyc",     1),
    ("ipynb",   1),
    ("rmd",     1),
    ("r",       1),
    ("scala",   1),
    ("jsonl",   1),
    ("hcl",     1),
]
assert sum(c for _, c in FILE_INVENTORY_BY_EXT) == 583, "extension totals must sum to 583"
assert len(FILE_INVENTORY_BY_EXT) == 44, "must have 44 distinct extensions"

DOMAINS = [
    ("FinServ",       0.38),
    ("Healthcare",    0.18),
    ("Retail",        0.14),
    ("HigherEd",      0.10),
    ("Manufacturing", 0.10),
    ("Other",         0.10),
]
TOTAL_BYTES = 76_509_727_685


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

def _state_lookup() -> dict[str, tuple[str, str, int, int]]:
    return {s[0]: (s[1], s[2], s[3], s[4]) for s in STATES}


def _gen_institutions(rng: random.Random) -> list[dict[str, Any]]:
    state_meta = _state_lookup()
    out: list[dict[str, Any]] = []

    for (cert, name, city, state, ccls, est, dep_b) in INSTITUTION_SEED:
        # Asset class follows deposit size.
        if dep_b >= 250:
            ac = "GSIB"
        elif dep_b >= 20:
            ac = "Regional"
        else:
            ac = "Community"

        # Branches scale roughly with deposits, with floor/ceiling.
        branches = max(1, min(4800, int(dep_b * rng.uniform(2.2, 4.5))))

        # Risk score: small bias by asset class + state bias + random.
        bias = state_meta.get(state, ("", "", 0, 1))[3]
        base = {"GSIB": 18, "Regional": 32, "Community": 41}[ac]
        risk = int(min(96, max(2, rng.gauss(base + bias * 4, 14))))
        if risk < 25:
            tier = "low"
        elif risk < 50:
            tier = "moderate"
        elif risk < 75:
            tier = "elevated"
        else:
            tier = "high"

        capital_ratio = round(rng.uniform(9.0, 16.5), 2)
        # Net charge-off ratio negatively correlated with capital ratio.
        nco = round(max(0.05, rng.gauss(0.55 - (capital_ratio - 11) * 0.05, 0.18)), 3)
        roa = round(rng.uniform(0.45, 1.85), 3)

        out.append({
            "cert_id": cert,
            "name": name,
            "city": city,
            "state": state,
            "charter_class": ccls,
            "asset_class": ac,
            "deposits_b": round(dep_b * rng.uniform(0.96, 1.04), 2),
            "branches": branches,
            "established_year": est,
            "risk_score": risk,
            "risk_tier": tier,
            "capital_ratio_pct": capital_ratio,
            "net_charge_off_ratio_pct": nco,
            "return_on_assets_pct": roa,
        })

    # Pad to ~150 with synthetic community banks
    name_prefixes = ["First", "Citizens", "Heritage", "Pioneer", "Liberty",
                     "Summit", "Cornerstone", "Pinnacle", "Patriot", "Cascade",
                     "Lakeside", "Frontier", "Independence", "Premier"]
    name_suffixes = ["Bank", "Bank & Trust", "National Bank", "Savings Bank",
                     "Community Bank", "Bancorp Bank", "Federal Savings"]
    cities_per_state = {s[0]: [s[1]] for s in STATES}
    extra_cities = {
        "CA": ["Fresno", "San Jose", "Sacramento"], "TX": ["Austin", "Houston", "Lubbock"],
        "FL": ["Tampa", "Orlando", "Pensacola"],   "NY": ["Buffalo", "Albany", "Rochester"],
        "IL": ["Peoria", "Springfield", "Aurora"], "PA": ["Erie", "Scranton", "Bethlehem"],
        "OH": ["Akron", "Toledo", "Dayton"],       "GA": ["Macon", "Savannah", "Augusta"],
    }
    for s, more in extra_cities.items():
        cities_per_state[s] = more

    used = {(r["cert_id"]) for r in out}
    cert_seq = 90001
    while len(out) < 150:
        while cert_seq in used:
            cert_seq += 1
        st = rng.choices(
            [s[0] for s in STATES],
            weights=[max(s[3], 10) for s in STATES],
        )[0]
        full, region, base_assets, bias = state_meta[st]
        prefix = rng.choice(name_prefixes)
        suffix = rng.choice(name_suffixes)
        name = f"{prefix} {full} {suffix}"
        city = rng.choice(cities_per_state.get(st, [full]))
        est = rng.randint(1865, 2018)
        dep_b = round(rng.uniform(0.4, 18.0), 2)
        ccls = rng.choice(["SM", "NM", "N", "SB"])
        ac = "Community"
        branches = max(1, int(dep_b * rng.uniform(3.0, 6.0)))
        base = 44
        risk = int(min(96, max(4, rng.gauss(base + bias * 4, 16))))
        tier = ("low" if risk < 25 else "moderate" if risk < 50
                else "elevated" if risk < 75 else "high")
        capital_ratio = round(rng.uniform(8.5, 17.0), 2)
        nco = round(max(0.05, rng.gauss(0.6, 0.22)), 3)
        roa = round(rng.uniform(0.3, 1.95), 3)

        out.append({
            "cert_id": cert_seq,
            "name": name,
            "city": city,
            "state": st,
            "charter_class": ccls,
            "asset_class": ac,
            "deposits_b": dep_b,
            "branches": branches,
            "established_year": est,
            "risk_score": risk,
            "risk_tier": tier,
            "capital_ratio_pct": capital_ratio,
            "net_charge_off_ratio_pct": nco,
            "return_on_assets_pct": roa,
        })
        used.add(cert_seq)
        cert_seq += 1

    out.sort(key=lambda r: -r["deposits_b"])
    return out


# Known recent failure clusters (anchors for the demo)
ANCHOR_FAILURES: list[tuple[int, str, str, str, str, str]] = [
    # cert, name, city, state, close_date, charter_class
    (33555035, "Silicon Valley Bridge Bank, N.A.",     "Santa Clara",  "CA", "2023-03-10", "N"),
    (33555036, "Signature Bridge Bank, N.A.",          "New York",     "NY", "2023-03-12", "SM"),
    (33555029, "First Republic Bank",                  "San Francisco","CA", "2023-05-01", "SM"),
    (57295,    "Heartland Tri-State Bank",             "Elkhart",      "KS", "2023-07-28", "SM"),
    (15585,    "Citizens Bank",                        "Sac City",     "IA", "2023-11-03", "SM"),
    (24387007, "Republic First Bank",                  "Philadelphia", "PA", "2024-04-26", "SM"),
    (12349,    "The First National Bank of Lindsay",   "Lindsay",      "OK", "2024-10-18", "N"),
    (16548007, "Pulaski Savings Bank",                 "Chicago",       "IL", "2025-01-17", "SB"),
]


def _gen_failures(rng: random.Random, institutions: list[dict]) -> list[dict]:
    out: list[dict] = []
    for cert, name, city, state, dt_iso, ccls in ANCHOR_FAILURES:
        out.append({
            "cert_id": cert,
            "name": name,
            "city": city,
            "state": state,
            "close_date": dt_iso,
            "fund": "DIF",
            "acquirer": rng.choice([
                "JPMorgan Chase Bank, N.A.", "Citizens Bank, N.A.",
                "Fulton Bank, N.A.", "First Citizens Bank & Trust",
                "Flagstar Bank, N.A.", "Millennium Bank",
                "Dream First Bank, N.A.",
            ]),
            "charter_class": ccls,
        })

    # Pad to ~520 historical failures, weighted by state bias.
    inst_by_state: dict[str, list[dict]] = {}
    for i in institutions:
        inst_by_state.setdefault(i["state"], []).append(i)

    state_meta = _state_lookup()
    target = 520
    start = dt.date(2008, 1, 1)
    end   = dt.date(2025, 3, 31)
    span_days = (end - start).days
    cert_seq = 700001
    while len(out) < target:
        st = rng.choices(
            [s[0] for s in STATES],
            weights=[max(s[4], 1) ** 2 + 1 for s in STATES],
        )[0]
        full = state_meta[st][0]
        # Mirror real FDIC distribution: heavy cluster in 2009-2012 (post-2008),
        # small bump in 2023-24 (regional crisis), tail in between.
        bucket = rng.random()
        if bucket < 0.82:
            d = dt.date(2008, 6, 1) + dt.timedelta(days=rng.randint(0, 1500))
        elif bucket < 0.92:
            d = dt.date(2013, 1, 1) + dt.timedelta(days=rng.randint(0, 3000))
        else:
            d = dt.date(2023, 3, 1) + dt.timedelta(days=rng.randint(0, 750))

        prefix = rng.choice(["First", "Heritage", "Community", "Pioneer", "Liberty",
                             "Frontier", "Patriot", "Summit", "Lakeside", "Premier"])
        suffix = rng.choice(["Bank", "Federal Savings", "National Bank",
                             "Bank & Trust", "Savings Bank", "Community Bank"])
        name = f"{prefix} {full} {suffix}"
        city = rng.choice(inst_by_state.get(st, [{"city": full}]))["city"]
        ccls = rng.choice(["SM", "NM", "N", "SB"])
        out.append({
            "cert_id": cert_seq,
            "name": name,
            "city": city,
            "state": st,
            "close_date": d.isoformat(),
            "fund": "DIF",
            "acquirer": rng.choice([
                "JPMorgan Chase Bank, N.A.", "U.S. Bank, N.A.",
                "BMO Bank N.A.", "First Citizens Bank & Trust",
                "Flagstar Bank, N.A.", "Cadence Bank",
                "Truist Bank", "Regions Bank", "No acquirer — payoff",
            ]),
            "charter_class": ccls,
        })
        cert_seq += 1

    out.sort(key=lambda r: r["close_date"], reverse=True)
    return out


def _gen_state_risk(institutions: list[dict], failures: list[dict]) -> list[dict]:
    today = dt.date(2025, 5, 1)
    cutoff = today - dt.timedelta(days=365 * 5)

    by_state_inst: dict[str, list[dict]] = {}
    for i in institutions:
        by_state_inst.setdefault(i["state"], []).append(i)
    by_state_fail: dict[str, int] = {}
    for f in failures:
        try:
            d = dt.date.fromisoformat(f["close_date"])
        except ValueError:
            continue
        if d >= cutoff:
            by_state_fail[f["state"]] = by_state_fail.get(f["state"], 0) + 1

    out: list[dict] = []
    for abbr, full, region, base_assets, bias in STATES:
        insts = by_state_inst.get(abbr, [])
        total_dep = round(sum(i["deposits_b"] for i in insts), 2)
        total_branches = sum(i["branches"] for i in insts)
        total_inst = len(insts)
        failed = by_state_fail.get(abbr, 0)
        # Use a representative state-level FDIC population (scaled from the
        # ~4,500 national total weighted by base_assets) so the rate looks
        # real and not like a tiny-cohort artifact.
        est_population = max(20, int(base_assets / 4))
        rate = round((failed / est_population) * 100, 2)

        # Risk index 0-100: composite of failure rate, bias, and concentration.
        concentration = min(1.0, total_dep / max(50.0, base_assets))
        idx = int(min(100, 18 + bias * 9 + failed * 4 + (1 - concentration) * 12))
        out.append({
            "state": abbr,
            "state_name": full,
            "region": region,
            "total_deposits_b": total_dep,
            "total_branches": total_branches,
            "total_institutions": total_inst,
            "failed_count_5y": failed,
            "failure_rate_pct_5y": rate,
            "risk_index": idx,
        })
    out.sort(key=lambda r: -r["risk_index"])
    return out


def _gen_file_catalog(rng: random.Random) -> list[dict]:
    domain_names = [d[0] for d in DOMAINS]
    domain_weights = [d[1] for d in DOMAINS]

    domain_namegens = {
        "FinServ": [
            "FDIC_call_report", "stress_test_results", "OCC_complaint_export",
            "regional_bank_ratios", "deposits_by_branch", "credit_loss_provisions",
            "AOCI_walk", "basel_iii_capital", "CECL_macro_scenarios",
            "FFIEC_uniform_bank", "FRY9C_quarterly", "loan_concentrations",
            "deposit_runoff_model", "AML_alerts_q3", "core_processing_uptime",
        ],
        "Healthcare": [
            "EPIC_claims_extract", "DRG_payments_2023", "HCAHPS_survey",
            "readmission_rates", "payer_mix_summary", "denial_codes_q4",
        ],
        "Retail": [
            "POS_transactions_summary", "store_traffic_hourly", "loyalty_program_export",
            "regional_inventory", "shrinkage_audit", "ecomm_funnel",
        ],
        "HigherEd": [
            "enrollment_term_summary", "FAFSA_aid_disbursed", "course_evaluations",
            "graduation_cohort_2020", "alumni_giving_segments",
        ],
        "Manufacturing": [
            "shop_floor_oee", "supplier_scorecards", "warranty_claims_2024",
            "mrp_demand_forecast", "field_service_dispatches",
        ],
        "Other": [
            "vendor_invoices_archive", "HR_engagement_pulse", "employee_benefits_election",
            "facility_utilities_2023", "travel_expense_q2",
        ],
    }

    out: list[dict] = []
    file_idx = 1
    for ext, count in FILE_INVENTORY_BY_EXT:
        for _ in range(count):
            domain = rng.choices(domain_names, weights=domain_weights)[0]
            stem = rng.choice(domain_namegens[domain])
            # Add a discriminator so names stay unique-ish.
            disc = rng.choice(["", f"_{rng.randint(1, 12):02d}",
                               f"_{rng.choice(['v1','v2','v3','final','draft'])}",
                               f"_{rng.randint(2018, 2025)}"])
            name = f"{stem}{disc}.{ext}"

            # Tabular formats land as parsed bronze tables.
            tabular = ext in {"csv", "tsv", "xlsx", "json", "ndjson", "jsonl",
                              "parquet", "avro", "orc"}
            # Large binary types (database dumps, archives, certs) won't parse.
            metadata_only = ext in {"mdf", "ldf", "bak", "zip", "tar", "gz",
                                    "bz2", "7z", "rar", "pem", "crt", "key",
                                    "dmp", "bin", "dat", "log", "png"}
            parsed = tabular and not metadata_only

            # Size buckets keyed off extension.
            if ext in {"mdf", "ldf", "bak", "dmp"}:
                size_kb = rng.randint(500_000, 4_500_000)
            elif ext in {"parquet", "avro", "orc"}:
                size_kb = rng.randint(20_000, 600_000)
            elif ext in {"zip", "tar", "gz", "7z"}:
                size_kb = rng.randint(50_000, 1_200_000)
            elif ext in {"pptx", "pdf", "docx"}:
                size_kb = rng.randint(800, 18_000)
            elif ext in {"xlsx", "csv", "tsv", "json", "ndjson", "jsonl", "xml"}:
                size_kb = rng.randint(50, 12_000)
            elif ext in {"png"}:
                size_kb = rng.randint(40, 3_000)
            else:
                size_kb = rng.randint(2, 800)

            table_name = None
            if parsed:
                table_name = (
                    stem.lower()
                    .replace("-", "_")
                    .replace(" ", "_")
                    .replace("__", "_")
                )

            out.append({
                "name": name,
                "ext": ext,
                "size_kb": size_kb,
                "domain": domain,
                "parsed": parsed,
                "table_name": table_name,
            })
            file_idx += 1
    return out


def _by_ext_summary(catalog: list[dict]) -> list[dict]:
    by: dict[str, dict[str, Any]] = {}
    for f in catalog:
        ext = f["ext"]
        if ext not in by:
            by[ext] = {"ext": ext, "count": 0, "bytes": 0}
        by[ext]["count"] += 1
        by[ext]["bytes"] += int(f["size_kb"] * 1024)
    out = sorted(by.values(), key=lambda r: -r["count"])
    return out


def _by_domain_summary(catalog: list[dict]) -> list[dict]:
    by: dict[str, dict[str, Any]] = {}
    for f in catalog:
        d = f["domain"]
        if d not in by:
            by[d] = {"domain": d, "count": 0, "bytes": 0, "parsed": 0}
        by[d]["count"] += 1
        by[d]["bytes"] += int(f["size_kb"] * 1024)
        if f["parsed"]:
            by[d]["parsed"] += 1
    out = sorted(by.values(), key=lambda r: -r["count"])
    return out


def _ai_summary(inst: dict, peers: list[dict], failures: list[dict]) -> str:
    state = inst["state"]
    peer_count = len(peers)
    fail_in_state = sum(1 for f in failures if f["state"] == state)
    fragments = []
    fragments.append(
        f"{inst['name']} holds ${inst['deposits_b']:.1f}B in deposits "
        f"across {inst['branches']} branches, with a capital ratio of "
        f"{inst['capital_ratio_pct']:.1f}% and a Sentinel risk score of "
        f"{inst['risk_score']} ({inst['risk_tier']})."
    )
    if inst["risk_tier"] in ("elevated", "high"):
        fragments.append(
            f"Net charge-offs at {inst['net_charge_off_ratio_pct']:.2f}% "
            f"sit above the {inst['asset_class']} median; the model is "
            f"flagging deposit concentration and asset-quality drift."
        )
    else:
        fragments.append(
            f"Asset-quality and earnings metrics (ROA {inst['return_on_assets_pct']:.2f}%) "
            f"are inside the {inst['asset_class']} comfort band."
        )
    fragments.append(
        f"{fail_in_state} {state}-chartered institution(s) have failed in the last "
        f"five years; {peer_count} peer failure(s) shown below."
    )
    return " ".join(fragments)


def _quarterly_series(inst: dict, rng: random.Random) -> list[dict]:
    """8 quarters of synthetic but coherent quarterly metrics."""
    quarters = [
        ("2023Q2"), ("2023Q3"), ("2023Q4"),
        ("2024Q1"), ("2024Q2"), ("2024Q3"), ("2024Q4"),
        ("2025Q1"),
    ]
    dep = inst["deposits_b"]
    cap = inst["capital_ratio_pct"]
    nco = inst["net_charge_off_ratio_pct"]
    roa = inst["return_on_assets_pct"]
    out = []
    drift = 1.0
    for q in quarters:
        drift *= rng.uniform(0.985, 1.018)
        out.append({
            "quarter": q,
            "deposits_b": round(dep * drift, 2),
            "capital_ratio_pct": round(max(7.0, cap + rng.uniform(-0.6, 0.4)), 2),
            "net_charge_off_ratio_pct": round(max(0.05, nco + rng.uniform(-0.08, 0.12)), 3),
            "return_on_assets_pct": round(max(0.1, roa + rng.uniform(-0.18, 0.18)), 3),
            "risk_score": int(min(99, max(2, inst["risk_score"] + rng.randint(-7, 7)))),
        })
    return out


def _branches_by_state(inst: dict, rng: random.Random) -> list[dict]:
    """Spread branches across home state + a few neighbors."""
    home = inst["state"]
    n = inst["branches"]
    if n <= 1:
        return [{"state": home, "branches": n}]

    # GSIBs spread broadly; community banks concentrate at home.
    spread = {"GSIB": 12, "Regional": 5, "Community": 2}[inst["asset_class"]]
    candidates = [s[0] for s in STATES if s[0] != home]
    others = rng.sample(candidates, k=min(spread, len(candidates)))
    home_share = rng.uniform(0.45 if inst["asset_class"] == "GSIB" else 0.7,
                             0.95)
    home_n = int(n * home_share)
    rest = n - home_n
    weights = [rng.random() for _ in others]
    total_w = sum(weights) or 1.0
    rows = [{"state": home, "branches": home_n}]
    for st, w in zip(others, weights):
        rows.append({"state": st, "branches": max(1, int(rest * (w / total_w)))})
    return rows


def _peer_failures(inst: dict, failures: list[dict]) -> list[dict]:
    """Failures in the same state or asset class, recent first, max 5."""
    cands = []
    for f in failures:
        if f["state"] == inst["state"]:
            cands.append(f)
    cands.sort(key=lambda f: f["close_date"], reverse=True)
    return cands[:5]


def _pipeline_payload(catalog: list[dict], institutions: list[dict],
                      failures: list[dict], synced_at: str) -> dict:
    parsed_files = sum(1 for f in catalog if f["parsed"])
    bronze_tables = parsed_files + 1   # +1 for _files metadata
    silver_models = 18
    gold_marts = 7
    return {
        "synced_at": synced_at,
        "layers": [
            {
                "name": "Bronze",
                "engine": "Snowflake (Fivetran-managed)",
                "tables": bronze_tables,
                "rows": parsed_files * 2_400 + len(institutions) + len(failures),
                "freshness_minutes": 14,
                "status": "healthy",
                "owner": "Fivetran ODI",
            },
            {
                "name": "Silver",
                "engine": "dbt labs",
                "tables": silver_models,
                "rows": parsed_files * 2_100 + len(institutions),
                "freshness_minutes": 12,
                "status": "healthy",
                "owner": "dbt labs",
            },
            {
                "name": "Gold",
                "engine": "dbt labs",
                "tables": gold_marts,
                "rows": len(institutions) + len(failures) + 51,
                "freshness_minutes": 11,
                "status": "healthy",
                "owner": "dbt labs",
            },
            {
                "name": "Semantic / App",
                "engine": "Sentinel + Snowflake Cortex",
                "tables": gold_marts,
                "rows": 0,
                "freshness_minutes": 11,
                "status": "healthy",
                "owner": "Sentinel SE team",
            },
        ],
        "connectors": [
            {"name": "Dropbox", "status": "primary",   "files_landed": 583, "last_sync": synced_at},
            {"name": "FDIC API","status": "secondary", "rows_landed": 6_540, "last_sync": synced_at},
            {"name": "Synthetic","status":"fallback",  "rows_landed": 0,    "last_sync": synced_at},
        ],
        "tests": {
            "total": 97,
            "passing": 96,
            "failing": 1,
            "warn": 0,
            "last_run_minutes_ago": 12,
        },
    }


# ---------------------------------------------------------------------------
# Top-level bundle
# ---------------------------------------------------------------------------

def generate() -> dict[str, Any]:
    rng = random.Random(SEED)
    synced_at = "2025-05-19T14:00:00Z"

    institutions = _gen_institutions(rng)
    failures     = _gen_failures(rng, institutions)
    state_risk   = _gen_state_risk(institutions, failures)
    catalog      = _gen_file_catalog(rng)

    # Top 10 states by deposits, for the summary tile.
    top_states = sorted(state_risk, key=lambda r: -r["total_deposits_b"])[:10]
    top_states_summary = [
        {"state": s["state"], "state_name": s["state_name"],
         "total_deposits_b": s["total_deposits_b"],
         "total_institutions": s["total_institutions"]}
        for s in top_states
    ]

    total_dep_b = round(sum(i["deposits_b"] for i in institutions), 2)
    total_branches = sum(i["branches"] for i in institutions)

    # Failure-rate 5y is computed against the full FDIC-insured population
    # (~4,500 active institutions), not just the 150 in our demo cohort, so
    # the number reads like a real industry stat rather than a sampling
    # artifact.
    FDIC_ACTIVE_POPULATION = 4_500
    today = dt.date(2025, 5, 1)
    cutoff = today - dt.timedelta(days=365 * 5)
    recent_failures = [f for f in failures
                       if dt.date.fromisoformat(f["close_date"]) >= cutoff]
    failure_rate_pct = round(
        (len(recent_failures) / FDIC_ACTIVE_POPULATION) * 100, 2
    )

    summary = {
        "total_institutions": len(institutions),
        "total_deposits_b": total_dep_b,
        "total_branches": total_branches,
        "total_failed_banks_since_2008": len(failures),
        "failure_rate_pct_5y": failure_rate_pct,
        "top_states_by_deposits": top_states_summary,
        "file_inventory": {
            "total_files": len(catalog),
            "total_bytes": TOTAL_BYTES,
            "by_ext": _by_ext_summary(catalog),
            "by_domain": _by_domain_summary(catalog),
        },
        "pipeline_status": [
            {"layer": "Bronze", "status": "healthy", "tables": sum(1 for f in catalog if f["parsed"]) + 1},
            {"layer": "Silver", "status": "healthy", "tables": 18},
            {"layer": "Gold",   "status": "healthy", "tables": 7},
        ],
        "last_synced_at": synced_at,
    }

    # Detail bundles for ~15 institutions: top deposits + a couple of high-risk.
    top_by_dep = sorted(institutions, key=lambda r: -r["deposits_b"])[:10]
    high_risk = [i for i in institutions
                 if i["risk_tier"] in ("high", "elevated")][:8]
    detail_cohort: list[dict] = []
    seen: set[int] = set()
    for i in top_by_dep + high_risk:
        if i["cert_id"] in seen:
            continue
        seen.add(i["cert_id"])
        detail_cohort.append(i)
        if len(detail_cohort) >= 15:
            break

    details: dict[int, dict] = {}
    for inst in detail_cohort:
        details[inst["cert_id"]] = {
            **inst,
            "branches_by_state": _branches_by_state(inst, rng),
            "peer_failures": _peer_failures(inst, failures),
            "quarterly": _quarterly_series(inst, rng),
            "ai_summary": _ai_summary(inst,
                                      _peer_failures(inst, failures),
                                      failures),
        }

    pipeline = _pipeline_payload(catalog, institutions, failures, synced_at)

    return {
        "summary": summary,
        "institutions": institutions,
        "institution_details": details,
        "failures": failures,
        "state_risk": state_risk,
        "pipeline": pipeline,
        "catalog": catalog,
    }
