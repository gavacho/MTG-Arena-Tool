/*
global
    add,
    Aggregator,
    change_background,
    db,
    drawDeck,
    drawDeckVisual,
    economyHistory,
    get_deck_export,
    get_deck_export_txt,
    get_deck_missing,
    get_deck_types_ammount,
    getBoosterCountEstimate,
    ipc_send,
    makeResizable,
    pop,
    sidebarSize,
    StatsPanel
*/

const { createDivision } = require("../shared/dom-fns");
const ConicGradient = require("../shared/conic-gradient");

const {
  MANA,
  CARD_RARITIES,
  CARD_TYPE_CODES,
  CARD_TYPES,
  COLORS_ALL,
  MANA_COLORS
} = require("../shared/constants.js");

// We need to store a sorted list of card types so we create the card counts in the same order.
let currentOpenDeck = null;
let currentFilters = null;

//
function get_deck_colors_ammount(deck) {
  var colors = { total: 0, w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 };

  //var mana = {0: "", 1: "white", 2: "blue", 3: "black", 4: "red", 5: "green", 6: "colorless", 7: "", 8: "x"}
  deck.mainDeck.forEach(function(card) {
    if (card.quantity > 0) {
      db.card(card.id).cost.forEach(function(c) {
        if (c.indexOf("w") !== -1) {
          colors.w += card.quantity;
          colors.total += card.quantity;
        }
        if (c.indexOf("u") !== -1) {
          colors.u += card.quantity;
          colors.total += card.quantity;
        }
        if (c.indexOf("b") !== -1) {
          colors.b += card.quantity;
          colors.total += card.quantity;
        }
        if (c.indexOf("r") !== -1) {
          colors.r += card.quantity;
          colors.total += card.quantity;
        }
        if (c.indexOf("g") !== -1) {
          colors.g += card.quantity;
          colors.total += card.quantity;
        }
        if (c.indexOf("c") !== -1) {
          colors.c += card.quantity;
          colors.total += card.quantity;
        }
      });
    }
  });

  return colors;
}

//
function get_deck_lands_ammount(deck) {
  var colors = { total: 0, w: 0, u: 0, b: 0, r: 0, g: 0, c: 0 };

  //var mana = {0: "", 1: "white", 2: "blue", 3: "black", 4: "red", 5: "green", 6: "colorless", 7: "", 8: "x"}
  deck.mainDeck.forEach(function(card) {
    var quantity = card.quantity;
    card = db.card(card.id);
    if (quantity > 0) {
      if (card.type.indexOf("Land") != -1 || card.type.indexOf("land") != -1) {
        if (card.frame.length < 5) {
          card.frame.forEach(function(c) {
            if (c == 1) {
              colors.w += quantity;
              colors.total += quantity;
            }
            if (c == 2) {
              colors.u += quantity;
              colors.total += quantity;
            }
            if (c == 3) {
              colors.b += quantity;
              colors.total += quantity;
            }
            if (c == 4) {
              colors.r += quantity;
              colors.total += quantity;
            }
            if (c == 5) {
              colors.g += quantity;
              colors.total += quantity;
            }
            if (c == 6) {
              colors.c += quantity;
              colors.total += quantity;
            }
          });
        }
      }
    }
  });

  return colors;
}

//
function get_deck_curve(deck) {
  var curve = [];

  deck.mainDeck.forEach(function(card) {
    var grpid = card.id;
    var cmc = db.card(grpid).cmc;
    if (curve[cmc] == undefined) curve[cmc] = [0, 0, 0, 0, 0, 0];

    let card_cost = db.card(grpid).cost;

    if (db.card(grpid).type.indexOf("Land") == -1) {
      card_cost.forEach(function(c) {
        if (c.indexOf("w") !== -1) curve[cmc][1] += card.quantity;
        if (c.indexOf("u") !== -1) curve[cmc][2] += card.quantity;
        if (c.indexOf("b") !== -1) curve[cmc][3] += card.quantity;
        if (c.indexOf("r") !== -1) curve[cmc][4] += card.quantity;
        if (c.indexOf("g") !== -1) curve[cmc][5] += card.quantity;
      });

      curve[cmc][0] += card.quantity;
    }
  });
  /*
  // Do not account sideboard?
  deck.sideboard.forEach(function(card) {
    var grpid = card.id;
    var cmc = db.card(grpid).cmc;
    if (curve[cmc] == undefined)  curve[cmc] = 0;
    curve[cmc] += card.quantity

    if (db.card(grpid).rarity !== 'land') {
      curve[cmc] += card.quantity
    }
  });
  */
  //console.log(curve);
  return curve;
}

function deckManaCurve(deck) {
  let manaCounts = get_deck_curve(deck);
  let curveMax = Math.max(
    ...manaCounts
      .filter(v => {
        if (v == undefined) return false;
        return true;
      })
      .map(v => v[0] || 0)
  );

  // console.log("deckManaCurve", manaCounts, curveMax);

  let curve = $('<div class="mana_curve"></div>');
  let numbers = $('<div class="mana_curve_numbers"></div>');
  manaCounts.forEach((cost, i) => {
    let total = cost[0];
    let manaTotal = cost.reduce(add, 0) - total;

    let curve_column = $(
      `<div style="height: ${(total / curveMax) *
        100}%;" class="mana_curve_column"><div class="mana_curve_number">${
        total > 0 ? total : ""
      }</div></div>`
    );
    MANA_COLORS.forEach((mc, ind) => {
      if (ind < 5 && cost[ind + 1] > 0) {
        let h = Math.round((cost[ind + 1] / manaTotal) * 100);
        let col = $(
          `<div style="height: ${h}%; background-color: ${mc};" class="mana_curve_column_color"></div>`
        );
        col.appendTo(curve_column);
      }
    });

    curve_column.appendTo(curve);

    numbers.append(
      $(
        `<div class="mana_curve_column_number"><div style="margin: 0 auto !important" class="mana_s16 mana_${i}"></div></div>`
      )
    );
  });

  let container = $("<div>").append(curve, numbers);
  return container;
}

function colorPieChart(colorCounts, title) {
  /*
    used for land / card pie charts.
    colorCounts should be object with values for each of the color codes wubrgc and total.
    */
  // console.log("making colorPieChart", colorCounts, title);

  var stops = [];
  var start = 0;
  COLORS_ALL.forEach((colorCode, i) => {
    let currentColor = MANA_COLORS[i];
    var stop =
      start + ((colorCounts[colorCode] || 0) / colorCounts.total) * 100;
    stops.push(`${currentColor} 0 ${stop}%`);
    // console.log('\t', start, stop, currentColor);
    start = stop;
  });
  let gradient = new ConicGradient({
    stops: stops.join(", "),
    size: 400
    // Default size: Math.max(innerWidth, innerHeight)
  });
  let chart = $(
    `<div class="pie_container"><span>${title}</span><svg class="pie">${
      gradient.svg
    }</svg></div>`
  );
  return chart;
}

function deckStatsSection(deck) {
  let stats = $('<div class="stats"></div>');

  $(`<div class="button_simple visualView">Visual View</div>
    <div class="button_simple openHistory">History of changes</div>
    <div class="button_simple exportDeck">Export to Arena</div>
    <div class="button_simple exportDeckStandard">Export to .txt</div>`).appendTo(
    stats
  );

  let cardTypes = get_deck_types_ammount(deck);
  let typesContainer = $('<div class="types_container"></div>');
  CARD_TYPE_CODES.forEach((cardTypeKey, index) => {
    $(`<div class="type_icon_cont">
            <div title="${
              CARD_TYPES[index]
            }" class="type_icon type_${cardTypeKey}"></div>
            <span>${cardTypes[cardTypeKey]}</span>
        </div>`).appendTo(typesContainer);
  });
  typesContainer.appendTo(stats);

  // Mana Curve
  deckManaCurve(deck).appendTo(stats);

  // Deck colors
  let pieContainer = $('<div class="pie_container_outer"></div>');
  pieContainer.appendTo(stats);
  let colorCounts = get_deck_colors_ammount(deck);
  let pieChart;
  pieChart = colorPieChart(colorCounts, "Mana Symbols");
  pieChart.appendTo(pieContainer);

  // Lands colors
  let landCounts = get_deck_lands_ammount(deck);
  pieChart = colorPieChart(landCounts, "Mana Sources");
  pieChart.appendTo(pieContainer);

  // Deck crafting cost section
  let ownedWildcards = {
    common: economyHistory.wcCommon,
    uncommon: economyHistory.wcUncommon,
    rare: economyHistory.wcRare,
    mythic: economyHistory.wcMythic
  };

  let missingWildcards = get_deck_missing(deck);
  let boosterCost = getBoosterCountEstimate(missingWildcards);
  let costSection = $(
    '<div class="wildcards_cost"><span>Wildcards you have/need</span></div>'
  );
  CARD_RARITIES.forEach(cardRarity => {
    $(
      `<div title="${cardRarity}" class="wc_cost wc_${cardRarity}">${
        ownedWildcards[cardRarity] > 0 ? ownedWildcards[cardRarity] + " / " : ""
      }${missingWildcards[cardRarity]}</div>`
    ).appendTo(costSection);
  });
  $(
    `<div title="Aproximate boosters" class="wc_cost wc_booster">${Math.round(
      boosterCost
    )}</div>`
  ).appendTo(costSection);
  costSection.appendTo(stats);
  return stats;
}

function openDeck(deck = currentOpenDeck, filters = currentFilters) {
  if (!deck) return;
  currentOpenDeck = deck;
  if (filters && deck.id !== filters.deckId) filters = null;
  currentFilters = filters;

  // #ux_1 is right side, #ux_0 is left side
  const mainDiv = document.getElementById("ux_1");
  mainDiv.classList.remove("flex_item");
  mainDiv.innerHTML = "";

  let container = mainDiv;
  let showStatsPanel = false;
  if (filters) {
    const aggregator = new Aggregator(filters);
    showStatsPanel = aggregator.stats.total > 0;
    if (showStatsPanel) {
      mainDiv.classList.add("flex_item");
      const wrap_r = createDivision(["wrapper_column", "sidebar_column_l"]);
      wrap_r.setAttribute("id", "stats_column");
      wrap_r.style.width = sidebarSize + "px";
      wrap_r.style.flex = `0 0 ${sidebarSize}px`;
      const statsPanel = new StatsPanel(
        "decks_top",
        aggregator,
        sidebarSize,
        true
      );
      const deck_top_winrate = statsPanel.render();
      deck_top_winrate.style.display = "flex";
      deck_top_winrate.style.flexDirection = "column";
      deck_top_winrate.style.marginTop = "16px";
      deck_top_winrate.style.padding = "12px";

      const drag = createDivision(["dragger"]);
      wrap_r.appendChild(drag);
      const finalCallback = width => {
        ipc_send("save_user_settings", { right_panel_width: width });
      };
      makeResizable(drag, statsPanel.handleResize, finalCallback);

      wrap_r.appendChild(deck_top_winrate);

      const wrap_l = createDivision(["wrapper_column"]);
      wrap_l.setAttribute("id", "deck_column");
      mainDiv.appendChild(wrap_l);
      mainDiv.appendChild(wrap_r);
      container = wrap_l;
    }
  }

  const d = document.createElement("div");
  d.classList.add("list_fill");
  container.appendChild(d);

  const top = createDivision(["decklist_top"]);
  top.appendChild(createDivision(["button", "back"]));
  top.appendChild(createDivision(["deck_name"], deck.name));

  const deckColors = createDivision(["deck_top_colors"]);
  deckColors.style.alignSelf = "center";
  deck.colors.forEach(color => {
    const m = createDivision(["mana_s20", "mana_" + MANA[color]]);
    deckColors.appendChild(m);
  });
  top.appendChild(deckColors);

  const tileGrpId = deck.deckTileId;
  if (db.card(tileGrpId)) {
    change_background("", tileGrpId);
  }

  const deckListSection = createDivision(["decklist"]);
  drawDeck($(deckListSection), deck, true);

  const statsSection = deckStatsSection(deck);

  const fld = createDivision(["flex_item"]);
  fld.appendChild(deckListSection);
  fld.appendChild(statsSection[0]);

  container.appendChild(top);
  container.appendChild(fld);

  // Attach event handlers
  $(".visualView").click(() => {
    if (showStatsPanel) {
      $("#stats_column").hide();
    }
    drawDeckVisual(deckListSection, statsSection, deck);
  });

  $(".openHistory").click(() => ipc_send("get_deck_changes", deck.id));

  $(".exportDeck").click(() => {
    const list = get_deck_export(deck);
    pop("Copied to clipboard", 1000);
    ipc_send("set_clipboard", list);
  });

  $(".exportDeckStandard").click(() => {
    const list = get_deck_export_txt(deck);
    ipc_send("export_txt", { str: list, name: deck.name });
  });

  $(".back").click(() => {
    change_background("default");
    $(".moving_ux").animate({ left: "0px" }, 250, "easeInOutCubic");
  });
}

module.exports = {
  openDeck: openDeck
};
