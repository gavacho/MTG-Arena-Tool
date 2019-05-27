/*
global
  cards
  cardQuality
  decks
*/

const {
  FORMATS,
  BLACK,
  BLUE,
  GREEN,
  RED,
  WHITE
} = require("../shared/constants.js");

const db = require("../shared/database.js");

function playerDataDefault() {
  return {
    name: null,
    userName: null,
    arenaId: "",
    arenaVersion: "",
    patreon: false,
    patreon_tier: 0,
    decks_last_used: [],
    rank: {
      constructed: {
        rank: "",
        tier: 0,
        step: 0,
        steps: 4,
        won: 0,
        lost: 0,
        drawn: 0
      },
      limited: {
        rank: "",
        tier: 0,
        step: 0,
        steps: 4,
        won: 0,
        lost: 0,
        drawn: 0
      }
    }
  };
}

//
function get_card_image(cardObj) {
  if (typeof cardObj !== "object") {
    cardObj = db.card(cardObj);
  }

  if (!cardObj) {
    return "../images/notfound.png";
  } else {
    return "https://img.scryfall.com/cards" + cardObj.images[cardQuality];
  }
}

//
function get_rank_index(_rank, _tier) {
  var ii = 0;
  if (_rank == "Unranked") ii = 0;
  if (_rank == "Bronze") ii = 1 + (_tier - 1); //1 2 3 4
  if (_rank == "Silver") ii = 5 + (_tier - 1); //5 6 7 8
  if (_rank == "Gold") ii = 9 + (_tier - 1); //9 0 1 2
  if (_rank == "Platinum") ii = 13 + (_tier - 1); //3 4 5 6
  if (_rank == "Diamond") ii = 17 + (_tier - 1); //7 8 9 0
  if (_rank == "Mythic") ii = 21 + (_tier - 1); //1 2 3 4
  return ii;
}

//
function get_rank_index_16(_rank) {
  var ii = 0;
  if (_rank == "Unranked") ii = 0;
  if (_rank == "Bronze") ii = 1;
  if (_rank == "Silver") ii = 2;
  if (_rank == "Gold") ii = 3;
  if (_rank == "Platinum") ii = 4;
  if (_rank == "Diamond") ii = 5;
  if (_rank == "Mythic") ii = 6;
  return ii;
}

function getDeck(deckId) {
  const matches = decks.filter(deck => deck.id === deckId);
  if (!matches.length) return null;
  return matches[0];
}

function doesDeckStillExist(deckId) {
  return decks.filter(deck => deck.id === deckId).length > 0;
}

function getRecentDeckName(deckId) {
  if (doesDeckStillExist(deckId)) {
    return getDeck(deckId).name;
  }
  return deckId;
}

//
function getReadableEvent(arg) {
  if (db.events[arg] != undefined) {
    return db.events[arg];
  }

  return arg;
}

//
function getReadableFormat(format) {
  if (format in FORMATS) {
    return FORMATS[format];
  }
  return format || "Unknown";
}

//
function removeDuplicates(decklist) {
  var newList = [];
  try {
    decklist.forEach(function(card) {
      var cname = db.card(card.id).name;
      var added = false;
      newList.forEach(function(c) {
        var cn = db.card(c.id).name;
        if (cn == cname) {
          if (c.quantity !== 9999) {
            c.quantity += card.quantity;
          }
          if (c.chance != undefined) {
            c.chance += card.chance;
          }
          added = true;
        }
      });

      if (!added) {
        newList.push(card);
      }
    });
    return newList;
  } catch (e) {
    return [];
  }
}

//
function get_card_type_sort(a) {
  if (a == undefined) return 0;
  if (a.includes("Creature", 0)) return 1;
  if (a.includes("Planeswalker", 0)) return 2;
  if (a.includes("Instant", 0)) return 3;
  if (a.includes("Sorcery", 0)) return 4;
  if (a.includes("Artifact", 0)) return 5;
  if (a.includes("Enchantment", 0)) return 6;
  if (a.includes("Land", 0)) return 7;
  if (a.includes("Special", 0)) return 8;
  return 0;
}

//
function compare_cards(a, b) {
  // Yeah this is lazy.. I know
  a = db.card(a.id);
  b = db.card(b.id);

  if (!a) return 1;
  if (!b) return -1;

  var _as = get_card_type_sort(a.type);
  var _bs = get_card_type_sort(b.type);

  // Order by type?
  if (_as < _bs) {
    return -1;
  }
  if (_as > _bs) {
    return 1;
  }

  // by cmc
  if (a.cmc < b.cmc) {
    return -1;
  }
  if (a.cmc > b.cmc) {
    return 1;
  }

  // then by name
  if (a.name < b.name) {
    return -1;
  }
  if (a.name > b.name) {
    return 1;
  }

  return 0;
}

//
function compare_archetypes(a, b) {
  if (a.average > b.average) return -1;
  if (a.average < b.average) return 1;
  return 0;
}

//
function get_set_scryfall(set) {
  if (set == undefined) return "";
  let s = db.sets[set].scryfall;
  if (s == undefined) s = set;
  return s;
}

//
function get_set_code(set) {
  if (set == undefined) return "";
  let s = db.sets[set].code;
  if (s == undefined) s = set;
  return s;
}

function getRaritySortValue(rarity) {
  rarity = rarity.toLowerCase();
  switch (rarity) {
    case "land":
      return 5;
    case "common":
      return 4;
    case "uncommon":
      return 3;
    case "rare":
      return 2;
    case "mythic":
      return 1;
    default:
      return 0;
  }
}
//
function collectionSortRarity(a, b) {
  a = db.card(a);
  b = db.card(b);
  if (getRaritySortValue(a.rarity) < getRaritySortValue(b.rarity)) return -1;
  if (getRaritySortValue(a.rarity) > getRaritySortValue(b.rarity)) return 1;

  if (a.set < b.set) return -1;
  if (a.set > b.set) return 1;

  if (parseInt(a.cid) < parseInt(b.cid)) return -1;
  if (parseInt(a.cid) > parseInt(b.cid)) return 1;
  return 0;
}

// When passed a `deck` object sets `deck.colors` to a sorted array
// of deck colour indices and returns the array.
//
// FIXME: Consider renaming to `set_deck_colors` or removing side
//        effects. `get*` functions should not have side effects.
// FIXME: Rename to camelCase to match javsascript function naming.

function get_deck_colors(deck) {
  var colorIndices = [];
  try {
    deck.mainDeck.forEach(card => {
      if (card.quantity < 1) {
        return;
      }

      let cardData = db.card(card.id);

      if (!cardData) {
        return;
      }

      let isLand = cardData.type.indexOf("Land") !== -1;
      let frame = cardData.frame;
      if (isLand && frame.length < 3) {
        colorIndices = colorIndices.concat(frame);
      }

      cardData.cost.forEach(cost => {
        if (cost === "w") {
          colorIndices.push(WHITE);
        } else if (cost === "u") {
          colorIndices.push(BLUE);
        } else if (cost === "b") {
          colorIndices.push(BLACK);
        } else if (cost === "r") {
          colorIndices.push(RED);
        } else if (cost === "g") {
          colorIndices.push(GREEN);
        }
      });
    });

    colorIndices = Array.from(new Set(colorIndices));
    colorIndices.sort((a, b) => {
      return a - b;
    });
  } catch (e) {
    // FIXME: Errors shouldn't be caught silently. If this is an
    //        expected error then there should be a test to catch only that error.
    colorIndices = [];
  }

  deck.colors = colorIndices;
  return colorIndices;
}

//
function get_wc_missing(deck, grpid, isSideboard) {
  let mainQuantity = 0;
  let mainMatches = deck.mainDeck.filter(card => card.id == grpid);
  if (mainMatches.length) {
    mainQuantity = mainMatches[0].quantity;
  }

  let sideboardQuantity = 0;
  let sideboardMatches = deck.sideboard.filter(card => card.id == grpid);
  if (sideboardMatches.length) {
    sideboardQuantity = sideboardMatches[0].quantity;
  }

  let needed = mainQuantity;
  if (isSideboard) {
    needed = sideboardQuantity;
  }
  // cap at 4 copies to handle petitioners, rat colony, etc
  needed = Math.min(4, needed);

  let card = db.card(grpid);
  let arr = card.reprints;
  if (!arr) arr = [grpid];
  else arr.push(grpid);

  let have = 0;
  arr.forEach(id => {
    let n = cards[id];
    if (n !== undefined) {
      have += n;
    }
  });

  let copiesLeft = have;
  if (isSideboard) {
    copiesLeft = Math.max(0, copiesLeft - mainQuantity);

    let infiniteCards = [67306, 69172]; // petitioners, rat colony, etc
    if (have >= 4 && infiniteCards.indexOf(grpid) >= 0) {
      copiesLeft = 4;
    }
  }

  return Math.max(0, needed - copiesLeft);
}

//
function get_deck_missing(deck) {
  let missing = { rare: 0, common: 0, uncommon: 0, mythic: 0 };
  let alreadySeenIds = new Set(); // prevents double counting cards across main/sideboard
  let entireDeck = [...deck.mainDeck, ...deck.sideboard];

  entireDeck.forEach(card => {
    let grpid = card.id;
    // process each card at most once
    if (alreadySeenIds.has(grpid)) {
      return;
    }
    let rarity = db.card(grpid).rarity;
    missing[rarity] += getCardsMissingCount(deck, grpid);
    alreadySeenIds.add(grpid); // remember this card
  });

  return missing;
}

//
function getCardsMissingCount(deck, grpid) {
  let mainMissing = get_wc_missing(deck, grpid, false);
  let sideboardMissing = get_wc_missing(deck, grpid, true);
  return mainMissing + sideboardMissing;
}

//
function getBoosterCountEstimate(wildcards) {
  let boosterCost = 0;
  let boosterEstimates = {
    common: 3.36,
    uncommon: 2.6,
    rare: 5.72,
    mythic: 13.24
  };
  for (let rarity in boosterEstimates) {
    // accept either short or long form of keys in argument
    let shortForm = rarity[0]; // grab first letter
    let missing = wildcards[rarity] || wildcards[shortForm] || 0;
    boosterCost = Math.max(boosterCost, boosterEstimates[rarity] * missing);
  }
  return Math.round(boosterCost);
}

//
function get_deck_types_ammount(deck) {
  var types = { art: 0, cre: 0, enc: 0, ins: 0, lan: 0, pla: 0, sor: 0 };

  deck.mainDeck.forEach(function(card) {
    var c = db.card(card.id);
    if (c) {
      if (c.type.includes("Land", 0)) types.lan += card.quantity;
      else if (c.type.includes("Creature", 0)) types.cre += card.quantity;
      else if (c.type.includes("Artifact", 0)) types.art += card.quantity;
      else if (c.type.includes("Enchantment", 0)) types.enc += card.quantity;
      else if (c.type.includes("Instant", 0)) types.ins += card.quantity;
      else if (c.type.includes("Sorcery", 0)) types.sor += card.quantity;
      else if (c.type.includes("Planeswalker", 0)) types.pla += card.quantity;
    }
  });

  return types;
}

//
function get_deck_export(deck) {
  let str = "";
  deck.mainDeck = removeDuplicates(deck.mainDeck);
  deck.mainDeck.forEach(function(card) {
    let grpid = card.id;
    let cardObj = db.card(grpid);

    if (cardObj.set == "Mythic Edition") {
      grpid = cardObj.reprints[0];
      cardObj = db.card(grpid);
    }

    let card_name = cardObj.name;
    let card_set = cardObj.set;
    let card_cn = cardObj.cid;
    let card_q = card.quantity;
    if (card_q == 9999) card_q = 1;

    try {
      card_set = db.sets[card_set].arenacode;
      str +=
        card_q + " " + card_name + " (" + card_set + ") " + card_cn + "\r\n";
    } catch (e) {
      str +=
        card_q +
        " " +
        card_name +
        " (" +
        get_set_code(card_set) +
        ") " +
        card_cn +
        "\r\n";
    }
  });

  str += "\r\n";

  deck.sideboard = removeDuplicates(deck.sideboard);
  deck.sideboard.forEach(function(card) {
    let grpid = card.id;
    let cardObj = db.card(grpid);

    if (cardObj.set == "Mythic Edition") {
      grpid = cardObj.reprints[0];
      cardObj = db.card(grpid);
    }

    let card_name = cardObj.name;
    let card_set = cardObj.set;
    let card_cn = cardObj.cid;
    let card_q = card.quantity;
    if (card_q == 9999) card_q = 1;

    try {
      card_set = db.sets[card_set].arenacode;
      str +=
        card_q + " " + card_name + " (" + card_set + ") " + card_cn + "\r\n";
    } catch (e) {
      str +=
        card_q +
        " " +
        card_name +
        " (" +
        get_set_code(card_set) +
        ") " +
        card_cn +
        "\r\n";
    }
  });

  return str;
}

//
function get_deck_export_txt(deck) {
  var str = "";
  deck.mainDeck = removeDuplicates(deck.mainDeck);
  deck.mainDeck.forEach(function(card) {
    var grpid = card.id;
    var card_name = db.card(grpid).name;
    //var card_set = db.card(grpid).set;
    //var card_cn = db.card(grpid).cid;

    str +=
      (card.quantity == 9999 ? 1 : card.quantity) + " " + card_name + "\r\n";
  });

  str += "\r\n";

  deck.sideboard = removeDuplicates(deck.sideboard);
  deck.sideboard.forEach(function(card) {
    var grpid = card.id;
    var card_name = db.card(grpid).name;
    //var card_set = db.card(grpid).set;
    //var card_cn = db.card(grpid).cid;

    str +=
      (card.quantity == 9999 ? 1 : card.quantity) + " " + card_name + "\r\n";
  });

  return str;
}

//
function timeSince(_date) {
  var seconds = Math.floor((new Date() - _date) / 1000);

  var interval = Math.floor(seconds / 31536000);
  if (interval == 1) return interval + " year";
  if (interval > 0) return interval + " years";
  interval = Math.floor(seconds / 2592000);
  if (interval == 1) return interval + " month";
  if (interval > 0) return interval + " months";
  interval = Math.floor(seconds / 86400);
  if (interval == 1) return interval + " day";
  if (interval > 0) return interval + " days";
  interval = Math.floor(seconds / 3600);
  if (interval == 1) return interval + " hour";
  if (interval > 0) return interval + " hours";
  interval = Math.floor(seconds / 60);
  if (interval == 1) return interval + " minute";
  if (interval > 0) return interval + " minutes";
  return Math.floor(seconds) + " seconds";
}

//
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(find, "g"), replace);
}

//
function urlDecode(url) {
  return decodeURIComponent(url.replace(/\+/g, " "));
}

//
function makeId(length) {
  var ret = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++)
    ret += possible.charAt(Math.floor(Math.random() * possible.length));

  return ret;
}

//
function timestamp() {
  return Math.floor(Date.now() / 1000);
}

// Converts an integer number of seconds into a string of either:
// HH:MM:SS or MM:SS depending on if the duration
// is longer than an hour
function toMMSS(sec_num) {
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - hours * 3600) / 60);
  var seconds = sec_num - hours * 3600 - minutes * 60;

  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }
  if (hours > 0) {
    return hours + ":" + minutes + ":" + seconds;
  } else {
    return minutes + ":" + seconds;
  }
}

//
function toDDHHMMSS(sec_num) {
  let dd = Math.floor(sec_num / 86400);
  let hh = Math.floor((sec_num - dd * 86400) / 3600);
  let mm = Math.floor((sec_num - dd * 86400 - hh * 3600) / 60);
  let ss = sec_num - dd * 86400 - hh * 3600 - mm * 60;

  let days = dd + (dd > 1 ? " days" : " day");
  let hours = hh + (hh > 1 ? " hours" : " hour");
  let minutes = mm + (mm > 1 ? " minutes" : " minute");
  let seconds = ss + (ss > 1 ? " seconds" : " second");

  return `${dd > 0 ? days + ", " : ""}
${hh > 0 ? hours + ", " : ""}
${minutes}, 
${seconds}`;
}

//
function toHHMMSS(sec_num) {
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - hours * 3600) / 60);
  var seconds = sec_num - hours * 3600 - minutes * 60;

  if (hours < 10) {
    hours = "0" + hours;
  }
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  if (seconds < 10) {
    seconds = "0" + seconds;
  }
  return hours + ":" + minutes + ":" + seconds;
}

//
function toHHMM(sec_num) {
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - hours * 3600) / 60);
  if (hours < 10) {
    hours = "0" + hours;
  }
  if (minutes < 10) {
    minutes = "0" + minutes;
  }
  return hours + ":" + minutes;
}

//
function add(a, b) {
  return a + b;
}

//
function objectClone(originalObject) {
  return JSON.parse(JSON.stringify(originalObject));
}
