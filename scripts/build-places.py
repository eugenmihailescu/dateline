#!/usr/bin/env python3
"""Refresh src/data/places.js from the system ISO 3166-1 list.

Requires Debian/Ubuntu iso-codes (/usr/share/iso-codes/json/iso_3166-1.json).
The generated module is committed so a build machine does not need that package.
"""

import json
from pathlib import Path

ISO_PATH = Path("/usr/share/iso-codes/json/iso_3166-1.json")
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "places.js"

REGIONS = {
    "africa": "Africa",
    "europe": "Europe",
    "middle_east": "Middle East",
    "north_america": "North America",
    "central_america_caribbean": "Central America and Caribbean",
    "south_america": "South America",
    "central_asia": "Central Asia",
    "south_asia": "South Asia",
    "southeast_asia": "Southeast Asia",
    "east_asia": "East Asia",
    "oceania": "Oceania",
}

ASSIGNED = {}


def assign(region, codes):
    if region not in REGIONS:
        raise SystemExit(f"unknown region {region}")
    for code in codes.split():
        if code in ASSIGNED:
            raise SystemExit(f"duplicate {code}")
        ASSIGNED[code] = region


assign(
    "europe",
    """
    AD AL AT AX BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM
    IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA
    VA XK
    """,
)
assign(
    "middle_east",
    "AE AM AZ BH CY GE IL IQ IR JO KW LB OM PS QA SA SY TR YE",
)
assign(
    "africa",
    """
    AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM
    LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD
    TG TN TZ UG YT ZA ZM ZW IO
    """,
)
assign("north_america", "BM CA GL MX PM US")
assign(
    "central_america_caribbean",
    """
    AG AI AW BB BL BQ BS BZ CR CU CW DM DO GD GP GT HN HT JM KN KY LC MF MQ MS
    NI PA PR SV SX TC TT VC VG VI
    """,
)
assign("south_america", "AR BO BR CL CO EC FK GF GY GS PE PY SR UY VE")
assign("central_asia", "KG KZ TJ TM UZ")
assign("south_asia", "AF BD BT IN LK MV NP PK")
assign("southeast_asia", "BN ID KH LA MM MY PH SG TH TL VN")
assign("east_asia", "CN HK JP KP KR MN MO TW")
assign(
    "oceania",
    """
    AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TF TK TO
    TV UM VU WF WS AQ BV
    """,
)

DISPLAY = {
    "BO": "Bolivia",
    "CD": "DR Congo",
    "CZ": "Czechia",
    "FM": "Micronesia",
    "IR": "Iran",
    "KP": "North Korea",
    "KR": "South Korea",
    "LA": "Laos",
    "MD": "Moldova",
    "PS": "Palestine",
    "RU": "Russia",
    "SY": "Syria",
    "TR": "Turkey",
    "TW": "Taiwan",
    "TZ": "Tanzania",
    "VE": "Venezuela",
    "VN": "Vietnam",
    "XK": "Kosovo",
}

# Extra phrases a person would type. ISO names are added automatically.
ALIASES = {
    "US": ["usa", "u.s.", "u.s.a.", "united states of america", "the united states"],
    "GB": [
        "uk",
        "u.k.",
        "great britain",
        "britain",
        "england",
        "scotland",
        "wales",
        "northern ireland",
    ],
    "AE": ["uae", "u.a.e."],
    "NL": ["holland"],
    "CI": ["ivory coast", "cote d'ivoire"],
    "MM": ["burma"],
    "SZ": ["swaziland"],
    "CV": ["cape verde"],
    "TL": ["east timor"],
    "VA": ["vatican", "vatican city", "holy see"],
    "KR": ["south korea", "republic of korea"],
    "KP": ["north korea"],
    "TW": ["taiwan"],
    "TR": ["turkey"],
    "VN": ["vietnam"],
    "RU": ["russia"],
    "SY": ["syria"],
    "IR": ["iran"],
    "MD": ["moldova"],
    "LA": ["laos"],
    "TZ": ["tanzania"],
    "BO": ["bolivia"],
    "VE": ["venezuela"],
    "PS": ["palestine"],
    "MO": ["macau", "macao"],
    "BN": ["brunei"],
    "FM": ["micronesia"],
    "CD": ["drc", "dr congo", "democratic republic of the congo"],
    "CG": ["republic of the congo", "congo brazzaville"],
    "CZ": ["czech republic"],
    "MK": ["macedonia"],
    "XK": ["kosovo"],
    "GE": ["georgia usa"],  # replaced below if we need both; Georgia the country is the ISO name
}

# "georgia usa" must not be the only Georgia alias. The ISO name "Georgia" is the country.
# The qualified form is a longer phrase so it wins over the country name.
ALIASES["GE"] = []
ALIASES["US"].extend(["georgia usa", "georgia us", "georgia united states"])

NOTES = {
    "TR": "Starts in the Middle East. Move it to Europe if you want that instead.",
    "CY": "Starts in the Middle East. Move it to Europe if you want that instead.",
    "RU": "Starts in Europe.",
    "MX": "Starts in North America.",
    "EG": "Starts in Africa. Move it to the Middle East if you want that instead.",
    "IL": "Starts in the Middle East. A country rule for Israel does not use this region.",
    "AM": "Starts in the Middle East (Western Asia). You can move it to Europe.",
    "AZ": "Starts in the Middle East (Western Asia). You can move it to Europe.",
    "GE": "Starts in the Middle East (Western Asia). You can move it to Europe. The US state is not this code.",
    "AQ": "Antarctica is filed under Oceania so every code has one region.",
    "TF": "French Southern Territories are filed under Oceania.",
    "BV": "Bouvet Island is filed under Oceania.",
    "XK": "Kosovo uses the common code XK. It is not in the assigned ISO list.",
    "IO": "British Indian Ocean Territory is filed under Africa.",
}

# Curated cities. Short keys are exact-match only. An array is ambiguous until a
# longer qualifier or a country name is present.
CITIES = {
    "paris": ["FR", "US"],
    "paris texas": "US",
    "paris tx": "US",
    "lyon": "FR",
    "marseille": "FR",
    "toulouse": "FR",
    "nice": "FR",
    "london": "GB",
    "london ontario": "CA",
    "london on": "CA",
    "manchester": ["GB", "US"],
    "manchester uk": "GB",
    "manchester england": "GB",
    "birmingham": ["GB", "US"],
    "birmingham uk": "GB",
    "birmingham england": "GB",
    "birmingham alabama": "US",
    "cambridge": ["GB", "US"],
    "cambridge uk": "GB",
    "cambridge england": "GB",
    "cambridge massachusetts": "US",
    "edinburgh": "GB",
    "glasgow": "GB",
    "cardiff": "GB",
    "belfast": "GB",
    "dublin": "IE",
    "dublin ohio": "US",
    "dublin oh": "US",
    "cork": "IE",
    "berlin": "DE",
    "munich": "DE",
    "hamburg": "DE",
    "cologne": "DE",
    "frankfurt": "DE",
    "madrid": "ES",
    "barcelona": "ES",
    "valencia": "ES",
    "seville": "ES",
    "lisbon": "PT",
    "porto": "PT",
    "rome": "IT",
    "milan": "IT",
    "naples": "IT",
    "turin": "IT",
    "florence": "IT",
    "venice": "IT",
    "amsterdam": "NL",
    "rotterdam": "NL",
    "the hague": "NL",
    "brussels": "BE",
    "antwerp": "BE",
    "vienna": "AT",
    "zurich": "CH",
    "geneva": "CH",
    "bern": "CH",
    "stockholm": "SE",
    "gothenburg": "SE",
    "oslo": "NO",
    "bergen": "NO",
    "copenhagen": "DK",
    "helsinki": "FI",
    "reykjavik": "IS",
    "warsaw": "PL",
    "krakow": "PL",
    "prague": "CZ",
    "budapest": "HU",
    "bucharest": "RO",
    "sofia": "BG",
    "athens": "GR",
    "thessaloniki": "GR",
    "belgrade": "RS",
    "zagreb": "HR",
    "ljubljana": "SI",
    "bratislava": "SK",
    "vilnius": "LT",
    "riga": "LV",
    "tallinn": "EE",
    "kyiv": "UA",
    "kiev": "UA",
    "kharkiv": "UA",
    "odessa": "UA",
    "odesa": "UA",
    "lviv": "UA",
    "minsk": "BY",
    "moscow": "RU",
    "saint petersburg": "RU",
    "st petersburg": "RU",
    "istanbul": "TR",
    "ankara": "TR",
    "izmir": "TR",
    "nicosia": "CY",
    "jerusalem": "IL",
    "tel aviv": "IL",
    "haifa": "IL",
    "beirut": "LB",
    "amman": "JO",
    "damascus": "SY",
    "aleppo": "SY",
    "baghdad": "IQ",
    "tehran": "IR",
    "riyadh": "SA",
    "jeddah": "SA",
    "mecca": "SA",
    "doha": "QA",
    "dubai": "AE",
    "abu dhabi": "AE",
    "muscat": "OM",
    "kuwait city": "KW",
    "manama": "BH",
    "sanaa": "YE",
    "ramallah": "PS",
    "gaza": "PS",
    "cairo": "EG",
    "alexandria": "EG",
    "alexandria virginia": "US",
    "alexandria va": "US",
    "lagos": "NG",
    "abuja": "NG",
    "kano": "NG",
    "ibadan": "NG",
    "accra": "GH",
    "nairobi": "KE",
    "mombasa": "KE",
    "johannesburg": "ZA",
    "cape town": "ZA",
    "durban": "ZA",
    "pretoria": "ZA",
    "casablanca": "MA",
    "rabat": "MA",
    "marrakesh": "MA",
    "algiers": "DZ",
    "tunis": "TN",
    "addis ababa": "ET",
    "dar es salaam": "TZ",
    "kampala": "UG",
    "kigali": "RW",
    "dakar": "SN",
    "kinshasa": "CD",
    "luanda": "AO",
    "maputo": "MZ",
    "harare": "ZW",
    "lusaka": "ZM",
    "gaborone": "BW",
    "windhoek": "NA",
    "new york": "US",
    "new york city": "US",
    "nyc": "US",
    "brooklyn": "US",
    "los angeles": "US",
    "san francisco": "US",
    "seattle": "US",
    "chicago": "US",
    "boston": "US",
    "houston": "US",
    "dallas": "US",
    "austin": "US",
    "miami": "US",
    "atlanta": "US",
    "washington": "US",
    "washington dc": "US",
    "washington d c": "US",
    "philadelphia": "US",
    "phoenix": "US",
    "denver": "US",
    "portland": "US",
    "detroit": "US",
    "minneapolis": "US",
    "toronto": "CA",
    "montreal": "CA",
    "vancouver": "CA",
    "ottawa": "CA",
    "calgary": "CA",
    "edmonton": "CA",
    "winnipeg": "CA",
    "mexico city": "MX",
    "guadalajara": "MX",
    "monterrey": "MX",
    "sao paulo": "BR",
    "rio de janeiro": "BR",
    "brasilia": "BR",
    "buenos aires": "AR",
    "cordoba": "AR",
    "santiago": "CL",
    "lima": "PE",
    "bogota": "CO",
    "medellin": "CO",
    "caracas": "VE",
    "quito": "EC",
    "montevideo": "UY",
    "asuncion": "PY",
    "la paz": "BO",
    "panama city": ["PA", "US"],
    "panama city florida": "US",
    "san jose": ["CR", "US"],
    "san jose costa rica": "CR",
    "san juan": "PR",
    "havana": "CU",
    "kingston": "JM",
    "beijing": "CN",
    "shanghai": "CN",
    "shenzhen": "CN",
    "guangzhou": "CN",
    "chengdu": "CN",
    "hong kong": "HK",
    "taipei": "TW",
    "tokyo": "JP",
    "osaka": "JP",
    "kyoto": "JP",
    "yokohama": "JP",
    "seoul": "KR",
    "busan": "KR",
    "pyongyang": "KP",
    "ulaanbaatar": "MN",
    "singapore": "SG",
    "bangkok": "TH",
    "chiang mai": "TH",
    "hanoi": "VN",
    "ho chi minh city": "VN",
    "saigon": "VN",
    "manila": "PH",
    "jakarta": "ID",
    "bali": "ID",
    "denpasar": "ID",
    "kuala lumpur": "MY",
    "phnom penh": "KH",
    "vientiane": "LA",
    "yangon": "MM",
    "rangoon": "MM",
    "new delhi": "IN",
    "delhi": "IN",
    "mumbai": "IN",
    "bombay": "IN",
    "bengaluru": "IN",
    "bangalore": "IN",
    "chennai": "IN",
    "kolkata": "IN",
    "calcutta": "IN",
    "hyderabad": "IN",
    "karachi": "PK",
    "lahore": "PK",
    "islamabad": "PK",
    "dhaka": "BD",
    "colombo": "LK",
    "kathmandu": "NP",
    "kabul": "AF",
    "sydney": "AU",
    "melbourne": "AU",
    "brisbane": "AU",
    "perth": "AU",
    "adelaide": "AU",
    "canberra": "AU",
    "auckland": "NZ",
    "wellington": "NZ",
    "christchurch": "NZ",
    "suva": "FJ",
    "almaty": "KZ",
    "astana": "KZ",
    "tashkent": "UZ",
    "bishkek": "KG",
    "dushanbe": "TJ",
    "ashgabat": "TM",
    "yerevan": "AM",
    "baku": "AZ",
    "tbilisi": "GE",
}


def main():
    iso = json.loads(ISO_PATH.read_text())
    by_code = {row["alpha_2"]: row for row in iso["3166-1"]}
    missing = sorted(set(by_code) - set(ASSIGNED))
    extra = sorted(set(ASSIGNED) - set(by_code) - {"XK"})
    if missing or extra:
        raise SystemExit(f"missing={missing} extra={extra}")

    countries = []
    for code in sorted(ASSIGNED):
        if code == "XK":
            name = "Kosovo"
            aliases = ALIASES.get(code, [])
        else:
            row = by_code[code]
            name = DISPLAY.get(code, row["name"])
            aliases = []
            for candidate in (row["name"], row.get("official_name"), name):
                if candidate and candidate != name and candidate not in aliases:
                    aliases.append(candidate)
            for candidate in ALIASES.get(code, []):
                if candidate not in aliases:
                    aliases.append(candidate)
        countries.append({"code": code, "name": name, "aliases": aliases})

    countries.sort(key=lambda item: item["name"])
    payload = {
        "regions": [{"id": key, "label": label} for key, label in REGIONS.items()],
        "countries": countries,
        "regionByCountry": ASSIGNED,
        "notes": NOTES,
        "cities": CITIES,
    }
    text = (
        "/* Generated by scripts/build-places.py. Refresh with: python3 scripts/build-places.py */\n"
        f"export const places = {json.dumps(payload, indent=2, ensure_ascii=False)};\n"
    )
    OUT.write_text(text)
    print(f"wrote {OUT} ({len(countries)} countries, {len(CITIES)} cities)")


if __name__ == "__main__":
    main()
