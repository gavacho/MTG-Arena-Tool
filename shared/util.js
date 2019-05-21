/*
global
  cards
  cardsNew
  cardQuality
  decks
*/
const math = require("mathjs");
math.config({ precision: 2000 });

const {
  FORMATS,
  BLACK,
  BLUE,
  GREEN,
  RED,
  WHITE
} = require("../shared/constants.js");

const db = require("../shared/database.js");

var renderer = 0;

var playerDataDefault = {
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

// Mostly an alias to document.querySelectorAll but
// allows second argument to specify an alternative parent
// Also returns an array.
// Usage:
// queryElements(".classname").forEach(el => do_something(el))
// queryElements("#elementId")
// queryElements("#elementId", otherElement)
function queryElements(selectors, parentNode = document) {
  return [...parentNode.querySelectorAll(selectors)];
}

function queryElementsByClass(selectors, parentNode = document) {
  return [...parentNode.getElementsByClassName(selectors)];
}

// useful alias
const $$ = (window.$$ = queryElements);

// several utility functions to replace useful jQuery methods
function show(element, mode) {
  if (!mode) {
    mode = "block";
  }
  element.style.display = mode;
  return element;
}

function hide(element) {
  element.style.display = "none";
  return element;
}

function wrap(element, wrapper) {
  element.parentNode.insertBefore(wrapper, element);
  wrapper.appendChild(element);
  return element;
}

/**
 * Creates a select box
 * This is a "fixed" version of SelectAdd and should replace it.
 **/
function createSelect(
  parent,
  options,
  current,
  callback,
  divClass,
  optionFormatter
) {
  let selectContainer = createDivision(["select_container", divClass]);
  selectContainer.id = divClass;
  if (!options.includes(current)) current = options[0];
  selectContainer.value = current;
  let currentDisplay = current;
  if (typeof optionFormatter === "function") {
    currentDisplay = optionFormatter(current);
  }
  let selectButton = createDivision(["select_button"], currentDisplay);
  let selectOptions = createDivision(["select_options_container"]);

  selectContainer.appendChild(selectButton);
  selectContainer.appendChild(selectOptions);

  selectButton.addEventListener("click", () => {
    if (!selectButton.classList.contains("active")) {
      current = selectContainer.value;

      selectButton.classList.add("active");
      selectOptions.style.display = "block";
      for (let i = 0; i < options.length; i++) {
        if (options[i] !== current) {
          let optionDisplay = options[i];
          if (typeof optionFormatter === "function") {
            optionDisplay = optionFormatter(optionDisplay);
          }

          let option = createDivision(["select_option"], optionDisplay);
          selectOptions.appendChild(option);

          option.addEventListener("click", () => {
            selectButton.classList.remove("active");
            selectButton.innerHTML = optionDisplay;
            selectContainer.value = options[i];
            selectOptions.style.display = "none";
            selectOptions.innerHTML = "";
            callback(options[i]);
          });
        }
      }
    } else {
      selectButton.classList.remove("active");
      selectOptions.innerHTML = "";
      selectOptions.style.display = "none";
    }
  });

  parent.appendChild(selectContainer);

  return selectContainer;
}

// When given a <select> element will convert to
// list format to allow more style options
function selectAdd(selectElement, callback) {
  if (selectElement instanceof jQuery) {
    selectElement = selectElement[0];
  }

  selectElement.classList.add("select-hidden");

  // dom structure is
  // container
  //   selectElement
  //   styledSelect
  //   list

  var container = createDivision(["select"]);
  wrap(selectElement, container);

  var styledSelect = createDivision(
    ["select-styled"],
    selectElement.options[0].textContent
  );
  container.appendChild(styledSelect);

  var list = document.createElement("ul");
  list.className = "select-options";
  container.appendChild(list);

  // insert list entries
  [...selectElement.options].forEach(option => {
    var li = document.createElement("li");
    li.innerHTML = option.textContent;
    li.rel = option.value;
    list.appendChild(li);
  });

  // Open and close the dropdown
  styledSelect.addEventListener("click", evt => {
    evt.stopPropagation();

    // toggle current select
    if (styledSelect.classList.contains("active")) {
      styledSelect.classList.remove("active");
    } else {
      styledSelect.classList.add("active");
    }

    // disable other selects on the page
    $$("div.select-styled")
      .filter(select => select !== styledSelect)
      .forEach(select => select.remove("active"));
  });

  // var listItems = list.childNodes;
  list.addEventListener("click", evt => {
    evt.stopPropagation();
    var option = evt.target;
    console.log("option", option, evt);

    styledSelect.innerHTML = option.textContent;
    styledSelect.classList.remove("active");

    selectElement.value = option.rel;

    callback(selectElement.value);
  });

  // hide the select if the document is clicked.
  document.addEventListener("click", evt => {
    styledSelect.classList.remove("active");
  });
}

// Attaches a hover event to any DOM element.
// Howver over the element with the mouse pops up
// card info for `card`
function addCardHover(element, card) {
  if (!card || !card.images) return;

  if (element instanceof jQuery) {
    element = element[0];
  }

  element.addEventListener("mouseover", evt => {
    $$(".loader, .main_hover").forEach(element => (element.style.opacity = 1));

    // Split cards are readable both halves, no problem
    if (card.dfc != "None" && card.dfc != "SplitHalf" && renderer == 0) {
      $$(".loader_dfc, .main_hover_dfc").forEach(el => {
        show(el);
        el.style.opacity = 1;
      });

      var dfcCard = db.card(card.dfcId);
      var dfcCardImage = get_card_image(dfcCard);

      var dfcImageElement = $$(".main_hover_dfc")[0];
      dfcImageElement.src = dfcCardImage;
      dfcImageElement.addEventListener("load", evt => {
        $$(".loader_dfc").forEach(el => (el.style.opacity = 0));
      });
    } else {
      $$(".main_hover_dfc, .loader_dfc").forEach(hide);
    }

    var mainImageElement = $$(".main_hover")[0];
    mainImageElement.src = get_card_image(card);
    mainImageElement.addEventListener("load", evt => {
      $$(".loader").forEach(el => (el.style.opacity = 0));
    });

    // show card quantity
    if (renderer == 0) {
      attachOwnerhipStars(card, $$(".hover_card_quantity")[0]);
    }
  });

  element.addEventListener("mouseleave", () => {
    $$(
      ".hover_card_quantity, .main_hover, .main_hover_dfc, .loader, .loader_dfc"
    ).forEach(element => (element.style.opacity = 0));
  });
}

function attachOwnerhipStars(card, starContainer) {
  starContainer.innerHTML = "";
  starContainer.style.opacity = 1;

  let owned = cards[card.id];
  let aquired = cardsNew[card.id];
  for (let i = 0; i < 4; i++) {
    let color = "gray";

    if (i < owned) color = "green";
    if (aquired && i >= owned - aquired && i < owned) color = "orange";

    starContainer.appendChild(
      createDivision([`inventory_card_quantity_${color}`])
    );
  }
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
function convert_deck_from_v3(deck) {
  return JSON.parse(JSON.stringify(deck), (key, value) => {
    if (key === "mainDeck" || key === "sideboard") {
      let ret = [];
      for (let i = 0; i < value.length; i += 2) {
        if (value[i + 1] > 0) {
          ret.push({ id: value[i], quantity: value[i + 1] });
        }
      }
      return ret;
    }
    return value;
  });
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
function createDivision(classNames, innerHTML) {
  // Utility function. Create a <div> element with specified class names and content
  let div = document.createElement("div");

  if (classNames !== undefined) {
    classNames.forEach(className => div.classList.add(className));
  }
  if (innerHTML !== undefined) {
    div.innerHTML = innerHTML;
  }
  return div;
}

//
function objectClone(originalObject) {
  return JSON.parse(JSON.stringify(originalObject));
}

//
function hypergeometric(
  exact,
  population,
  sample,
  hitsInPop,
  returnBig = false
) {
  return hypergeometricRange(
    exact,
    exact,
    population,
    sample,
    hitsInPop,
    returnBig
  );
}

//
function hypergeometricRange(
  lowerBound,
  upperBound,
  population,
  sample,
  hitsInPop,
  returnBig = false
) {
  if (lowerBound > upperBound || lowerBound > hitsInPop) {
    return returnBig ? math.bignumber(0) : 0;
  }

  let _population = math.bignumber(population);
  let _sample = math.bignumber(sample);
  let _hitsInPop = math.bignumber(hitsInPop);
  let matchingCombos = math.bignumber(0);
  // Can't have more non-hits in the sample than exist in the population
  for (
    let i = math.max(lowerBound, sample - (population - hitsInPop));
    i <= upperBound && i <= sample;
    i++
  ) {
    let _hitsInSample = math.bignumber(i);
    let _hitCombos = math.combinations(_hitsInPop, _hitsInSample);
    let _missCombos = math.combinations(
      math.max(0, math.subtract(_population, _hitsInPop)),
      math.max(0, math.subtract(_sample, _hitsInSample))
    );
    matchingCombos = math.add(
      matchingCombos,
      math.multiply(_hitCombos, _missCombos)
    );
  }

  let totalCombos = math.combinations(_population, _sample);
  let probability = math.divide(matchingCombos, totalCombos);
  return returnBig ? probability : math.number(probability);
}

// This function is designed to assess the "significance" of a particular result by calculating an alternative to
// percentile designed to measure deviation from median in both directions the same way and ensure the average returned
// value (assuming true random) is always 50%. This is done by treating the given result as a range of values
// distributed evenly throughout the percentile range covered by the result. For example, a result of 0 that has a 20%
// chance of happening is treated as a composite distributed evenly by percentile through the 0% to 20% percentile
// range. The returned value is the probability that a result is at least as far from median as the given value. Return
// values close to 1 indicate the passed in value was very close to average, return values close to 0 indicate it was
// very far from average.
function hypergeometricSignificance(
  value,
  population,
  sample,
  hitsInPop,
  returnBig = false
) {
  let percentile = hypergeometricRange(
    0,
    value,
    population,
    sample,
    hitsInPop,
    true
  );
  let chance = hypergeometric(value, population, sample, hitsInPop, true);
  if (math.smallerEq(percentile, 0.5)) {
    let midpoint = math.subtract(percentile, math.divide(chance, 2));
    let retVal = math.multiply(midpoint, 2);
    return returnBig ? retVal : math.number(retVal);
  }
  let reversePercentile = hypergeometricRange(
    value,
    math.min(hitsInPop, sample),
    population,
    sample,
    hitsInPop,
    true
  );
  if (math.smallerEq(reversePercentile, 0.5)) {
    let midpoint = math.subtract(reversePercentile, math.divide(chance, 2));
    let retVal = math.multiply(midpoint, 2);
    return returnBig ? retVal : math.number(retVal);
  }
  // If we get here, then value is the median and we need to weight things for how off-center its percentile range is.
  let smaller, larger;
  if (math.smallerEq(percentile, reversePercentile)) {
    smaller = percentile;
    larger = reversePercentile;
  } else {
    smaller = reversePercentile;
    larger = percentile;
  }
  // Divide the range into a symmetric portion centered on .5, and another portion for the rest. Calculate the average
  // distance from center for each, and use the average of that weighted by each portion's size.
  let centeredSize = math.multiply(math.subtract(smaller, 0.5), 2);
  let otherSize = math.subtract(larger, smaller);
  let centeredAverage = math.divide(centeredSize, 4); // half for being centered, half again for average
  // Average of the farther bound (otherSize + centeredSize/2) and the closer bound (centeredSize/2). Works out to
  // ((otherSize + centeredSize/2) + (centeredSize/2)) / 2, simplified to (otherSize + centeredSize) / 2.
  let otherAverage = math.divide(math.add(centeredSize, otherSize), 2);
  let weightedAverage = math.divide(
    math.add(
      math.multiply(centeredSize, centeredAverage),
      math.multiply(otherSize, otherAverage)
    ),
    chance
  );
  let retVal = math.subtract(1, math.multiply(weightedAverage, 2));
  return returnBig ? retVal : math.number(retVal);
}
