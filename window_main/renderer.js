/*
global
  set_tou_state
*/

const { app, ipcRenderer: ipc, remote, shell } = require("electron");

if (!remote.app.isPackaged) {
  const { openNewGitHubIssue, debugInfo } = require("electron-util");
  const unhandled = require("electron-unhandled");
  unhandled({
    showDialog: true,
    reportButton: error => {
      openNewGitHubIssue({
        user: "Manuel-777",
        repo: "MTG-Arena-Tool",
        body: `\`\`\`\n${error.stack}\n\`\`\`\n\n---\n\n${debugInfo()}`
      });
    }
  });
}

const _ = require("lodash");
window.$ = window.jQuery = require("jquery");
require("jquery.easing");
require("spectrum-colorpicker");
require("time-elements");
const striptags = require("striptags");

const Aggregator = require("./aggregator.js");
const ListItem = require("./list-item.js");
const FilterPanel = require("./filter-panel.js");
const StatsPanel = require("./stats-panel.js");
const DataScroller = require("./data-scroller.js");
const openHomeTab = require("./home").openHomeTab;
const tournamentOpen = require("./tournaments").tournamentOpen;
const tournamentCreate = require("./tournaments").tournamentCreate;
const tournamentSetState = require("./tournaments").tournamentSetState;
const openDeck = require("./deck-details").openDeck;
const openDecksTab = require("./decks").openDecksTab;
const { openHistoryTab, setFilters } = require("./history");
const openExploreTab = require("./explore").openExploreTab;
const setExploreDecks = require("./explore").setExploreDecks;
const openCollectionTab = require("./collection").openCollectionTab;
const openEventsTab = require("./events").openEventsTab;
const expandEvent = require("./events").expandEvent;
const openSettingsTab = require("./settings").openSettingsTab;
const deckDrawer = require("../shared/deck-drawer");
const cardTypes = require("../shared/card-types");
const openEconomyTab = require("./economy").openEconomyTab;
const db = require("../shared/database");
const { queryElements: $$ } = require("../shared/dom-fns");
const { addCardHover } = require("../shared/card-hover");
const {
  compare_archetypes,
  compare_cards,
  get_card_image,
  get_deck_colors,
  get_deck_export,
  get_deck_export_txt,
  get_deck_types_ammount,
  get_rank_index,
  makeId,
  playerDataDefault,
  removeDuplicates,
  timeSince
} = require("../shared/util");
const {
  DRAFT_RANKS,
  HIDDEN_PW,
  MANA,
  IPC_MAIN,
  IPC_BACKGROUND,
  CARD_TILE_FLAT
} = require("../shared/constants.js");
const {
  hypergeometricSignificance,
  hypergeometricRange
} = require("../shared/stats-fns");

const Menu = remote.Menu;
const MenuItem = remote.MenuItem;

const { RANKED_CONST, RANKED_DRAFT, DATE_SEASON } = Aggregator;

let deck = null;
let decks = null;
let changes = null;
let matchesHistory = [];
let allMatches = null;
let eventsHistory = [];

let explore = null;
let ladder = null;
let cards = {};
let cardsNew = {};

let sidebarActive = -2;
let filterEvent = "All";
let filterSort = "By Winrate";

let draftPosition = 1;
let cardSize = 140;
let cardQuality = "normal";
let cardStyle = CARD_TILE_FLAT;
let loadEvents = 0;
let defaultBackground = "";
let loggedIn = false;
let canLogin = false;
let offlineMode = false;
let lastTab = -1;

let playerData = playerDataDefault();

let economyHistory = [];

let rewards_daily_ends = new Date();
let rewards_weekly_ends = new Date();
let activeEvents = [];

let filteredWildcardsSet = "";

let tags_colors = {};
let authToken = null;
let discordTag = null;

let sidebarSize = 200;

const sha1 = require("js-sha1");
const fs = require("fs");
const path = require("path");

const actionLogDir = path.join(
  (app || remote.app).getPath("userData"),
  "actionlogs"
);

function ipc_send(method, arg, to = IPC_BACKGROUND) {
  // 0: Main window
  // 1: background
  // 2: overlay
  ipc.send("ipc_switch", method, IPC_MAIN, arg, to);
}

//
ipc.on("clear_pwd", function() {
  document.getElementById("signin_pass").value = "";
});

//
ipc.on("auth", function(event, arg) {
  authToken = arg.token;
  if (arg.ok) {
    $(".message_center").css("display", "flex");
    $(".authenticate").hide();
    loggedIn = true;
  } else {
    canLogin = true;
    ipc_send("renderer_show");
    pop(arg.error, -1);
  }
});

ipc.on("set_discord_tag", (event, arg) => {
  discordTag = arg;
  if (sidebarActive == -1) {
    openHomeTab(null, true);
  }
});

ipc.on("set_tou_state", (event, arg) => {
  set_tou_state(arg);
});

//
ipc.on("too_slow", function() {
  pop(
    'Loading is taking too long, please read our <a class="trouble_link">troubleshooting guide</a>.',
    0
  );

  $(".popup").css("left", "calc(50% - 280px)");
  $(".popup").css("width", "560px");
  $(".popup").css("pointer-events", "all");

  $(".trouble_link").click(function() {
    shell.openExternal(
      "https://github.com/Manuel-777/MTG-Arena-Tool/blob/master/TROUBLESHOOTING.md"
    );
  });
});

function getTagColor(tag) {
  let tc = tags_colors[tag];
  if (tc) return tc;

  return "#FAE5D2";
}

//
function setTagColor(tag, color) {
  tags_colors[tag] = color;
}

//
ipc.on("set_tags_colors", function(event, arg) {
  tags_colors = arg;
});

ipc.on("show_login", () => {
  canLogin = true;
  showLogin();
});

function showLogin() {
  $(".authenticate").show();
  $(".message_center").css("display", "none");
  $(".init_loading").hide();
  $(".button_simple_disabled").addClass("button_simple");
  $("#signin_user").focus();
}

//
ipc.on("set_player_data", (event, _data) => {
  playerData = _data;

  if (sidebarActive != -99) {
    $(".top_username").html(playerData.name.slice(0, -6));
    $(".top_username_id").html(playerData.name.slice(-6));

    let rankOffset;
    let constructed = playerData.rank.constructed;
    rankOffset = get_rank_index(constructed.rank, constructed.tier);
    let constructedRankIcon = $$(".top_constructed_rank")[0];
    constructedRankIcon.style.backgroundPosition = rankOffset * -48 + "px 0px";
    constructedRankIcon.setAttribute(
      "title",
      constructed.rank + " " + constructed.tier
    );

    let limited = playerData.rank.limited;
    rankOffset = get_rank_index(limited.rank, limited.tier);
    let limitedRankIcon = $$(".top_limited_rank")[0];
    limitedRankIcon.style.backgroundPosition = rankOffset * -48 + "px 0px";
    limitedRankIcon.setAttribute("title", limited.rank + " " + limited.tier);

    let patreonIcon = $$(".top_patreon")[0];
    if (playerData.patreon) {
      let xoff = -40 * playerData.patreon_tier;
      let title = "Patreon Basic Tier";

      if (playerData.patreon_tier == 1) title = "Patreon Standard Tier";
      if (playerData.patreon_tier == 2) title = "Patreon Modern Tier";
      if (playerData.patreon_tier == 3) title = "Patreon Legacy Tier";
      if (playerData.patreon_tier == 4) title = "Patreon Vintage Tier";

      patreonIcon.style.backgroundPosition = xoff + "px 0px";
      patreonIcon.setAttribute("title", title);
      patreonIcon.style.display = "block";
    } else {
      patreonIcon.style.display = "none";
    }
  }
});

//
ipc.on("set_decks_last_used", (event, arg) => {
  playerData.decks_last_used = arg;
});

ipc.on("set_reward_resets", function(event, arg) {
  rewards_daily_ends = new Date(arg.daily);
  rewards_weekly_ends = new Date(arg.weekly);
});

//
ipc.on("set_decks", function(event, arg) {
  try {
    arg = JSON.parse(arg);
  } catch (e) {
    console.log("Error parsing JSON:", arg);
    return false;
  }
  if (arg != null) {
    delete arg.index;
    decks = Object.values(arg);
    if (matchesHistory.length) {
      allMatches = Aggregator.createAllMatches();
    }
  }
  openDecksTab();
});

//
// Whats this?
ipc.on("set_deck_updated", function(event, str) {
  try {
    deck = JSON.parse(str);
  } catch (e) {
    console.log("Error parsing JSON:", str);
    return false;
  }
});

//
ipc.on("set_history", function(event, arg) {
  if (arg != null) {
    try {
      matchesHistory = JSON.parse(arg);
      if (decks) {
        allMatches = Aggregator.createAllMatches();
      }
    } catch (e) {
      console.log("Error parsing JSON:", arg);
      return false;
    }
  }

  openHistoryTab(0);
});

//
ipc.on("set_history_data", function(event, arg) {
  if (arg != null) {
    matchesHistory = JSON.parse(arg);
    if (decks) {
      allMatches = Aggregator.createAllMatches();
    }
  }
});

//
ipc.on("set_events", function(event, arg) {
  if (arg != null) {
    try {
      eventsHistory = JSON.parse(arg);
    } catch (e) {
      console.log("Error parsing JSON:", arg);
      return false;
    }
  }

  openEventsTab(0);
});

//
ipc.on("set_active_events", (event, arg) => {
  if (arg != null) {
    try {
      activeEvents = JSON.parse(arg);
    } catch (e) {
      console.log("Error parsing JSON:", arg);
      return false;
    }
  }
});

ipc.on("set_economy", function(event, arg) {
  if (arg != null) {
    try {
      economyHistory = JSON.parse(arg);
    } catch (e) {
      console.log("Error parsing JSON:", arg);
      return false;
    }
  }

  if (sidebarActive == 4) {
    openEconomyTab(0);
  }
});

//
ipc.on("set_deck_changes", function(event, arg) {
  if (arg != null) {
    try {
      changes = JSON.parse(arg);
      console.log(changes);
    } catch (e) {
      console.log("Error parsing JSON:", arg);
      return false;
    }
  }

  if (changes != null) {
    setChangesTimeline();
  }
});

//
ipc.on("set_cards", function(event, _cards, _cardsnew) {
  cards = _cards;
  cardsNew = _cardsnew;
});

//
ipc.on("set_status", function(event, arg) {
  var mainStatus = 0;
  var sp = $("<span>" + arg.status.description + "</span>");
  sp.css("text-align", "center");
  sp.css("margin-bottom", "4px");
  $(".top_status_pop").append(sp);
  arg.components.forEach(function(comp) {
    let div = $('<div class="status_item"></div>');
    let st = $('<div class="top_status_span"></div>');
    div.append("<span>" + comp.name + ":</span>");
    let sp = $("<span></span>");

    if (comp.status == "operational") {
      st.addClass("status_green");
      sp.html("Operational");
    } else if (comp.status == "degraded_performance") {
      st.addClass("status_yellow");
      if (mainStatus < 1) mainStatus = 1;
      sp.html("Degraded performance");
    } else if (comp.status == "major_outage") {
      st.addClass("status_red");
      if (mainStatus < 2) mainStatus = 2;
      sp.html("Major outage");
    } else if (comp.status == "partial_outage") {
      st.addClass("status_yellow");
      if (mainStatus < 1) mainStatus = 1;
      sp.html("Partial outage");
    } else if (comp.status == "under_maintenance") {
      st.addClass("status_yellow");
      if (mainStatus < 1) mainStatus = 1;
      sp.html("Under maintenance");
    } else {
      st.addClass("status_yellow");
      if (mainStatus < 1) mainStatus = 1;
      sp.html(comp.status);
    }
    sp.css("margin-left", "auto");
    sp.appendTo(div);
    st.appendTo(div);
    div.appendTo($(".top_status_pop"));
  });

  if (mainStatus == 0) {
    $(".top_status").addClass("status_green");
  }
  if (mainStatus == 1) {
    $(".top_status").addClass("status_yellow");
  }
  if (mainStatus == 2) {
    $(".top_status").addClass("status_red");
  }

  $(".top_status").on("mouseenter", function() {
    $(".top_status_pop").css("opacity", 1);
  });
  $(".top_status").on("mouseleave", function() {
    $(".top_status_pop").css("opacity", 0);
  });
});

//
ipc.on("set_home", function(event, arg) {
  hideLoadingBars();

  ipc_send("set_deck_archetypes", arg.archetypes);
  if (sidebarActive == -1) {
    console.log("Home", arg);
    openHomeTab(arg);
  }
});

//
ipc.on("set_explore_decks", function(event, arg) {
  hideLoadingBars();
  if (sidebarActive == 3) {
    setExploreDecks(arg);
  }
});

/*//
ipc.on("set_explore", function(event, arg) {
  if (sidebarActive == 3) {
    open_explore_tab(arg, 0);
  }
});

//
ipc.on("set_ladder_decks", function(event, arg) {
  set_ladder_decks(arg);
});

//
ipc.on("set_ladder_traditional_decks", function(event, arg) {
  set_ladder_decks(arg);
});

function set_ladder_decks(arg) {
  if (sidebarActive == 3) {

    arg.decks.forEach(function(deck) {
      deck.colors = [];
      deck.colors = get_deck_colors(deck);
      deck.mainDeck.sort(compare_cards);
    });

    open_explore_tab(arg.decks, 0);
  }
}
*/

//
ipc.on("open_course_deck", function(event, arg) {
  $(".moving_ux").animate({ left: "-100%" }, 250, "easeInOutCubic");
  arg = arg.CourseDeck;
  arg.colors = get_deck_colors(arg);
  arg.mainDeck.sort(compare_cards);
  arg.sideboard.sort(compare_cards);
  // console.log(arg);

  arg.mainDeck = removeDuplicates(arg.mainDeck);
  arg.sideboard = removeDuplicates(arg.sideboard);
  openDeck(arg, null);
  hideLoadingBars();
});

//
ipc.on("set_settings", function(event, arg) {
  sidebarSize = arg.right_panel_width;
  if (arg.cards_quality) {
    cardQuality = arg.cards_quality;
  }
  if (arg.card_tile_style) {
    cardStyle = arg.card_tile_style;
  }
  if (arg.back_url) {
    let oldBack = defaultBackground;
    defaultBackground = arg.back_url;
    if (oldBack == "") {
      change_background();
    }
  }
  if (arg.last_open_tab !== undefined) {
    lastTab = arg.last_open_tab;
  }
  $(".main_wrapper").css("background-color", arg.back_color);
  cardSize = 100 + arg.cards_size * 10;
  if (sidebarActive === 6) {
    openSettingsTab();
  }
});

//
ipc.on("set_update_state", function(event, arg) {
  if (sidebarActive == 9) {
    openSettingsTab(5);
  }
});

//
ipc.on("show_notification", function(event, arg) {
  $(".notification").show();
  $(".notification").attr("title", arg);

  if (arg == "Update available" || arg == "Update downloaded") {
    $(".notification").click(function() {
      force_open_about();
    });
  }
});

//
ipc.on("hide_notification", function() {
  $(".notification").hide();
  $(".notification").attr("title", "");
});

//
ipc.on("force_open_settings", function() {
  force_open_settings();
});

//
ipc.on("force_open_about", function() {
  force_open_about();
});

//
ipc.on("prefill_auth_form", function(event, arg) {
  document.getElementById("rememberme").checked = arg.remember_me;
  document.getElementById("signin_user").value = arg.username;
  document.getElementById("signin_pass").value = arg.password;
});

//
function rememberMe() {
  const rSettings = {
    remember_me: document.getElementById("rememberme").checked
  };
  ipc_send("save_app_settings", rSettings);
}

//
function openTab(tab) {
  showLoadingBars();
  $(".top_nav_item").each(function() {
    $(this).removeClass("item_selected");
  });
  let tabClass = "it" + tab;
  $("#ux_0").html("");
  switch (tab) {
    case 0:
      openDecksTab();
      break;
    case 1:
      ipc_send("request_history", 1);
      break;
    case 2:
      ipc_send("request_events", 1);
      break;
    case 3:
      if (offlineMode) {
        showOfflineSplash();
      } else {
        openExploreTab();
      }
      break;
    case 4:
      ipc_send("request_economy", 1);
      break;
    case 5:
      openCollectionTab();
      break;
    case 6:
      openSettingsTab();
      break;
    case -1:
      tabClass = "ith";
      if (offlineMode) {
        showOfflineSplash();
      } else {
        if (discordTag == null) {
          openHomeTab(null, true);
        } else {
          ipc_send("request_home", filteredWildcardsSet);
        }
      }
      break;
    case -2:
    default:
      $(".message_center").css("display", "initial");
      $(".init_loading").show();
      break;
  }
  $("." + tabClass).addClass("item_selected");
  ipc_send("save_user_settings", { last_open_tab: tab });
}

//
ipc.on("initialize", function() {
  $(".top_username").html(playerData.name.slice(0, -6));
  $(".top_username_id").html(playerData.name.slice(-6));

  sidebarActive = lastTab;
  ipc_send("request_home", filteredWildcardsSet);
  openTab(sidebarActive);

  $(".top_nav").removeClass("hidden");
  $(".overflow_ux").removeClass("hidden");
  $(".message_center").css("display", "none");
  $(".init_loading").hide();
});

//
var logDialogOpen = false;
ipc.on("no_log", function(event, arg) {
  if (loggedIn) {
    $(".top_nav").addClass("hidden");
    $(".overflow_ux").addClass("hidden");
    $(".message_center").css("display", "flex");
    $(".message_center").html(
      '<div class="message_big red">No Log Found</div><div class="message_sub_16 white">check if it exists at ' +
        arg +
        '</div><div class="message_sub_16 white">if it does, try closing MTG Arena and deleting it.</div>'
    );
  } else if (!logDialogOpen) {
    logDialogOpen = true;
    $(".dialog_wrapper").css("opacity", 1);
    $(".dialog_wrapper").css("pointer-events", "all");
    $(".dialog_wrapper").show();
    $(".dialog").css("width", "600px");
    $(".dialog").css("height", "200px");
    $(".dialog").css("top", "calc(50% - 100px)");

    $(".dialog_wrapper").on("click", function() {
      console.log(".dialog_wrapper on click");
      //e.stopPropagation();
      $(".dialog_wrapper").css("opacity", 0);
      $(".dialog_wrapper").css("pointer-events", "none");
      setTimeout(function() {
        logDialogOpen = false;
        $(".dialog_wrapper").hide();
        $(".dialog").css("width", "500px");
        $(".dialog").css("height", "160px");
        $(".dialog").css("top", "calc(50% - 80px)");
      }, 250);
    });

    $(".dialog").on("click", function(e) {
      e.stopPropagation();
      console.log(".dialog on click");
    });

    var dialog = $(".dialog");
    dialog.html("");

    var cont = $('<div class="dialog_container"></div>');

    cont.append(
      '<div class="share_title">Enter output_log.txt location:</div>'
    );
    var icd = $('<div class="share_input_container"></div>');
    var sin = $(
      '<input style="border-radius: 3px; height: 28px;font-size: 14px;" id="log_input" autofocus autocomplete="off" value="' +
        arg +
        '" />'
    );
    var but = $('<div class="button_simple">Save</div>');

    sin.appendTo(icd);
    icd.appendTo(cont);

    cont.appendTo(dialog);
    but.appendTo(dialog);

    but.click(function() {
      ipc_send("set_log", document.getElementById("log_input").value);
      console.log(".dialog_wrapper on click");
      //e.stopPropagation();
      $(".dialog_wrapper").css("opacity", 0);
      $(".dialog_wrapper").css("pointer-events", "none");
      setTimeout(function() {
        logDialogOpen = false;
        $(".dialog_wrapper").hide();
        $(".dialog").css("width", "500px");
        $(".dialog").css("height", "160px");
        $(".dialog").css("top", "calc(50% - 80px)");
      }, 250);
    });
  }
});

ipc.on("log_ok", function() {
  logDialogOpen = false;
  $(".dialog_wrapper").css("opacity", 0);
  $(".dialog_wrapper").css("pointer-events", "none");
  setTimeout(function() {
    $(".dialog_wrapper").hide();
    $(".dialog").css("width", "500px");
    $(".dialog").css("height", "160px");
    $(".dialog").css("top", "calc(50% - 80px)");
  }, 250);
});

//
ipc.on("set_offline", (_event, arg) => {
  offlineMode = arg;
});

//
ipc.on("offline", function() {
  showOfflineSplash();
});

function showOfflineSplash() {
  hideLoadingBars();
  $("#ux_0").html(
    '<div class="message_center" style="display: flex; position: fixed;"><div class="message_unlink"></div><div class="message_big red">Oops, you are offline!</div><div class="message_sub_16 white">You can <a class="signup_link">sign up</a> to access online features.</div></div>'
  );
  $(".signup_link").click(function() {
    shell.openExternal("https://mtgatool.com/signup/");
  });
}

//
ipc.on("log_read", function() {
  if ($(".top_nav").hasClass("hidden")) {
    $(".top_nav").removeClass("hidden");
    $(".overflow_ux").removeClass("hidden");
    $(".message_center").css("display", "none");
  }
});

$(".list_deck").on("mouseenter mouseleave", function(e) {
  $(".deck_tile").trigger(e.type);
});

//
ipc.on("popup", function(event, arg, time) {
  pop(arg, time);
});

var popTimeout = null;
function pop(str, timeout) {
  $(".popup").css("opacity", 1);
  $(".popup").html(str);
  if (popTimeout != null) {
    clearTimeout(popTimeout);
  }
  if (timeout < 1) {
    popTimeout = null;
  } else {
    popTimeout = setTimeout(function() {
      $(".popup").css("opacity", 0);
      popTimeout = null;
    }, timeout);
  }
}

function force_open_settings() {
  sidebarActive = 6;
  $(".top_nav_item").each(function() {
    $(this).removeClass("item_selected");
    if ($(this).hasClass("it6")) {
      $(this).addClass("item_selected");
    }
  });
  $(".moving_ux").animate({ left: "0px" }, 250, "easeInOutCubic");
  openSettingsTab();
}

function force_open_about() {
  sidebarActive = 9;
  $(".top_nav_item").each(function() {
    $(this).removeClass("item_selected");
    if ($(this).hasClass("it7")) {
      $(this).addClass("item_selected");
    }
  });
  $(".moving_ux").animate({ left: "0px" }, 250, "easeInOutCubic");
  openSettingsTab(5);
}

let top_compact = false;
let resizeTimer;
window.addEventListener("resize", event => {
  hideLoadingBars();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if ($(".top_nav_icons").width() < 500) {
      if (!top_compact) {
        $("span.top_nav_item_text").css("opacity", 0);
        $(".top_nav_icon").css("display", "block");
        $(".top_nav_icon").css("opacity", 1);
        top_compact = true;
      }
    } else {
      if (top_compact) {
        $("span.top_nav_item_text").css("opacity", 1);
        $(".top_nav_icon").css("opacity", 0);
        window.setTimeout(() => {
          $(".top_nav_icon").css("display", false);
        }, 500);
        top_compact = false;
      }
    }
  }, 100);
});

$(document).ready(function() {
  $(".signup_link").click(function() {
    shell.openExternal("https://mtgatool.com/signup/");
  });

  $(".offline_link").click(function() {
    ipc_send("login", { username: "", password: "" });
    $(".unlink").show();
  });

  $(".forgot_link").click(function() {
    shell.openExternal("https://mtgatool.com/resetpassword/");
  });

  function submitAuthenticateForm() {
    if (canLogin) {
      var user = document.getElementById("signin_user").value;
      var pass = document.getElementById("signin_pass").value;
      if (pass != HIDDEN_PW) {
        pass = sha1(pass);
      }
      ipc_send("login", { username: user, password: pass });
      canLogin = false;
    }
  }

  $("#authenticate_form").on("submit", e => {
    e.preventDefault();
    submitAuthenticateForm();
  });

  $(".login_link").click(submitAuthenticateForm);

  //
  $(".close").click(function() {
    ipc_send("renderer_window_close", 1);
  });

  //
  $(".minimize").click(function() {
    ipc_send("renderer_window_minimize", 1);
  });

  //
  $(".settings").click(function() {
    force_open_settings();
  });

  //
  $(".top_nav_item").click(function() {
    $("#ux_0").off();
    $("#ux_0")[0].removeEventListener("scroll", () => {}, false);
    $("#history_column").off();
    change_background("default");
    document.body.style.cursor = "auto";
    if (!$(this).hasClass("item_selected")) {
      $(".moving_ux").animate({ left: "0px" }, 250, "easeInOutCubic");
      if ($(this).hasClass("ith")) {
        sidebarActive = -1;
      } else if ($(this).hasClass("it0")) {
        sidebarActive = 0;
      } else if ($(this).hasClass("it1")) {
        sidebarActive = 1;
      } else if ($(this).hasClass("it2")) {
        sidebarActive = 2;
      } else if ($(this).hasClass("it3")) {
        sidebarActive = 3;
      } else if ($(this).hasClass("it4")) {
        sidebarActive = 4;
      } else if ($(this).hasClass("it5")) {
        sidebarActive = 5;
      } else if ($(this).hasClass("it6")) {
        sidebarActive = 6;
      } else if ($(this).hasClass("it7")) {
        sidebarActive = 1;
        setFilters({
          ...Aggregator.getDefaultFilters(),
          date: DATE_SEASON,
          eventId: RANKED_CONST,
          rankedMode: true
        });
      } else if ($(this).hasClass("it8")) {
        sidebarActive = 1;
        setFilters({
          ...Aggregator.getDefaultFilters(),
          date: DATE_SEASON,
          eventId: RANKED_DRAFT,
          rankedMode: true
        });
      }
      openTab(sidebarActive);
    } else {
      $(".moving_ux").animate({ left: "0px" }, 250, "easeInOutCubic");
    }
  });
});

function showLoadingBars() {
  $$(".main_loading")[0].style.display = "block";
  document.body.style.cursor = "progress";
}

//
//ipc.on("show_loading", () => showLoadingBars());

function hideLoadingBars() {
  $$(".main_loading")[0].style.display = "none";
  document.body.style.cursor = "auto";
}

//
//ipc.on("hide_loading", () => hideLoadingBars());

//
ipc.on("set_draft_link", function(event, arg) {
  hideLoadingBars();
  document.getElementById("share_input").value = arg;
});

//
function addHover(_match, tileGrpid) {
  $("." + _match.id).on("mouseenter", function() {
    $("." + _match.id + "t").css("opacity", 1);
    $("." + _match.id + "t").css("width", "200px");
  });

  $("." + _match.id).on("mouseleave", function() {
    $("." + _match.id + "t").css("opacity", 0.66);
    $("." + _match.id + "t").css("width", "128px");
  });

  $("." + _match.id).on("click", function() {
    if (_match.type == "match") {
      open_match(_match.id);
      $(".moving_ux").animate({ left: "-100%" }, 250, "easeInOutCubic");
    } else if (_match.type == "draft") {
      draftPosition = 1;
      open_draft(_match.id, tileGrpid, _match.set);
      $(".moving_ux").animate({ left: "-100%" }, 250, "easeInOutCubic");
    } else if (_match.type == "Event") {
      expandEvent(_match, tileGrpid);
    }
  });
}

//
ipc.on("tou_set", function(event, arg) {
  document.body.style.cursor = "auto";
  tournamentOpen(arg);
  $(".moving_ux").animate({ left: "-100%" }, 250, "easeInOutCubic");
});

//
function makeResizable(div, resizeCallback, finalCallback) {
  var m_pos;
  let finalWidth;

  let resize = function(e) {
    var parent = div.parentNode;
    var dx = m_pos - e.x;
    m_pos = e.x;
    let newWidth = Math.max(10, parseInt(parent.style.width) + dx);
    sidebarSize = newWidth;
    parent.style.width = `${newWidth}px`;
    parent.style.flex = `0 0 ${newWidth}px`;
    if (resizeCallback instanceof Function) resizeCallback(newWidth);
    finalWidth = newWidth;
  };

  div.addEventListener(
    "mousedown",
    event => {
      m_pos = event.x;
      document.addEventListener("mousemove", resize, false);
    },
    false
  );

  document.addEventListener(
    "mouseup",
    event => {
      document.removeEventListener("mousemove", resize, false);
      if (finalWidth && finalCallback instanceof Function) {
        finalCallback(finalWidth);
        finalWidth = null;
      }
    },
    false
  );
}

//
function drawDeck(div, deck, showWildcards = false) {
  div.html("");
  const unique = makeId(4);

  // draw maindeck grouped by cardType
  const cardsByGroup = _(deck.mainDeck)
    .map(card => ({ data: db.card(card.id), ...card }))
    .groupBy(card => {
      const cardType = cardTypes.cardType(card.data);
      switch (cardType) {
        case "Creature":
          return "Creatures";
        case "Planeswalker":
          return "Planeswalkers";
        case "Instant":
        case "Sorcery":
          return "Spells";
        case "Enchantment":
          return "Enchantments";
        case "Artifact":
          return "Artifacts";
        case "Land":
          return "Lands";
        default:
          throw new Error(`Unexpected card type: ${cardType}`);
      }
    })
    .value();

  _([
    "Creatures",
    "Planeswalkers",
    "Spells",
    "Enchantments",
    "Artifacts",
    "Lands"
  ])
    .filter(group => !_.isEmpty(cardsByGroup[group]))
    .forEach(group => {
      // draw a separator for the group
      const cards = cardsByGroup[group];
      const count = _.sumBy(cards, "quantity");
      const separator = deckDrawer.cardSeparator(`${group} (${count})`);
      div.append(separator);

      // draw the cards
      _(cards)
        .filter(card => card.quantity > 0)
        .orderBy(["data.cmc", "data.name"])
        .forEach(card => {
          const tile = deckDrawer.cardTile(
            cardStyle,
            card.id,
            unique + "a",
            card.quantity,
            showWildcards,
            deck,
            false
          );
          div.append(tile);
        });
    });

  const sideboardSize = _.sumBy(deck.sideboard, "quantity");
  if (sideboardSize) {
    // draw a separator for the sideboard
    let separator = deckDrawer.cardSeparator(`Sideboard (${sideboardSize})`);
    div.append(separator);

    // draw the cards
    _(deck.sideboard)
      .filter(card => card.quantity > 0)
      .map(card => ({ data: db.card(card.id), ...card }))
      .orderBy(["data.cmc", "data.name"])
      .forEach(card => {
        const tile = deckDrawer.cardTile(
          cardStyle,
          card.id,
          unique + "b",
          card.quantity,
          showWildcards,
          deck,
          true
        );
        div.append(tile);
      });
  }
}

//
function drawCardList(div, cards) {
  let unique = makeId(4);
  let counts = {};
  cards.forEach(cardId => (counts[cardId] = (counts[cardId] || 0) + 1));
  Object.keys(counts).forEach(cardId => {
    let tile = deckDrawer.cardTile(cardStyle, cardId, unique, counts[cardId]);
    div.append(tile);
  });
}

//
function drawDeckVisual(_div, _stats, deck) {
  // PLACEHOLDER
  if (!(_div instanceof jQuery)) {
    _div = $(_div);
  }
  // attempt at sorting visually..
  var newMainDeck = [];

  for (var cmc = 0; cmc < 21; cmc++) {
    for (var qq = 4; qq > -1; qq--) {
      deck.mainDeck.forEach(function(c) {
        var grpId = c.id;
        var card = db.card(grpId);
        var quantity;
        if (card.type.indexOf("Land") == -1 && grpId != 67306) {
          if (card.cmc == cmc) {
            quantity = c.quantity;

            if (quantity == qq) {
              newMainDeck.push(c);
            }
          }
        } else if (cmc == 20) {
          quantity = c.quantity;
          if (qq == 0 && quantity > 4) {
            newMainDeck.push(c);
          }
          if (quantity == qq) {
            newMainDeck.push(c);
          }
        }
      });
    }
  }

  var types = get_deck_types_ammount(deck);
  var typesdiv = $('<div class="types_container"></div>');
  $(
    '<div class="type_icon_cont"><div title="Creatures" class="type_icon type_cre"></div><span>' +
      types.cre +
      "</span></div>"
  ).appendTo(typesdiv);
  $(
    '<div class="type_icon_cont"><div title="Lands" class="type_icon type_lan"></div><span>' +
      types.lan +
      "</span></div>"
  ).appendTo(typesdiv);
  $(
    '<div class="type_icon_cont"><div title="Instants" class="type_icon type_ins"></div><span>' +
      types.ins +
      "</span></div>"
  ).appendTo(typesdiv);
  $(
    '<div class="type_icon_cont"><div title="Sorceries" class="type_icon type_sor"></div><span>' +
      types.sor +
      "</span></div>"
  ).appendTo(typesdiv);
  $(
    '<div class="type_icon_cont"><div title="Enchantments" class="type_icon type_enc"></div><span>' +
      types.enc +
      "</span></div>"
  ).appendTo(typesdiv);
  $(
    '<div class="type_icon_cont"><div title="Artifacts" class="type_icon type_art"></div><span>' +
      types.art +
      "</span></div>"
  ).appendTo(typesdiv);
  $(
    '<div class="type_icon_cont"><div title="Planeswalkers" class="type_icon type_pla"></div><span>' +
      types.pla +
      "</span></div>"
  ).appendTo(typesdiv);
  typesdiv.prependTo(_div.parent());

  if (_stats) {
    _stats.hide();
  }
  _div.css("display", "flex");
  _div.css("width", "auto");
  _div.css("margin", "0 auto");
  _div.html("");

  _div.parent().css("flex-direction", "column");

  if (_stats) {
    $('<div class="button_simple openDeck">Normal view</div>').appendTo(
      _div.parent()
    );

    $(".openDeck").click(function() {
      openDeck();
    });
  }

  var sz = cardSize;
  let div = $('<div class="visual_mainboard"></div>');
  div.css("display", "flex");
  div.css("flex-wrap", "wrap");
  div.css("align-content", "start");
  div.css("max-width", (sz + 6) * 5 + "px");
  div.appendTo(_div);

  //var unique = makeId(4);
  //var prevIndex = 0;

  var tileNow;
  var _n = 0;
  newMainDeck.forEach(function(c) {
    var grpId = c.id;
    var card = db.card(grpId);

    if (c.quantity > 0) {
      let dfc = "";
      if (card.dfc == "DFC_Back") dfc = "a";
      if (card.dfc == "DFC_Front") dfc = "b";
      if (card.dfc == "SplitHalf") dfc = "a";
      if (dfc != "b") {
        for (let i = 0; i < c.quantity; i++) {
          if (_n % 4 == 0) {
            tileNow = $('<div class="deck_visual_tile"></div>');
            tileNow.appendTo(div);
          }

          let d = $(
            '<div style="width: ' +
              sz +
              'px !important;" class="deck_visual_card"></div>'
          );
          let img = $(
            '<img style="width: ' +
              sz +
              'px !important;" class="deck_visual_card_img"></img>'
          );

          img.attr("src", get_card_image(card));
          img.appendTo(d);
          d.appendTo(tileNow);

          addCardHover(img, card);
          _n++;
        }
      }
    }
  });

  div = $('<div class="visual_sideboard"></div>');
  div.css("display", "flex");
  div.css("flex-wrap", "wrap");
  div.css("margin-left", "32px");
  div.css("align-content", "start");
  div.css("max-width", (sz + 6) * 1.5 + "px");
  div.appendTo(_div);

  if (deck.sideboard != undefined) {
    tileNow = $('<div class="deck_visual_tile_side"></div>');
    tileNow.css("width", (sz + 6) * 5 + "px");
    tileNow.appendTo(div);

    if (deck.sideboard.length == 0) {
      tileNow.css("display", "none");
    }

    _n = 0;
    deck.sideboard.forEach(function(c) {
      var grpId = c.id;
      var card = db.card(grpId);
      if (c.quantity > 0) {
        let dfc = "";
        if (card.dfc == "DFC_Back") dfc = "a";
        if (card.dfc == "DFC_Front") dfc = "b";
        if (card.dfc == "SplitHalf") dfc = "a";
        if (dfc != "b") {
          for (let i = 0; i < c.quantity; i++) {
            var d;
            if (_n % 2 == 1) {
              d = $(
                '<div style="width: ' +
                  sz +
                  'px !important;" class="deck_visual_card_side"></div>'
              );
            } else {
              d = $(
                '<div style="margin-left: 60px; width: ' +
                  sz +
                  'px !important;" class="deck_visual_card_side"></div>'
              );
            }
            let img = $(
              '<img style="width: ' +
                sz +
                'px !important;" class="deck_visual_card_img"></img>'
            );
            img.attr("src", get_card_image(card));
            img.appendTo(d);
            d.appendTo(tileNow);

            addCardHover(img, card);
            _n++;
          }
        }
      }
    });
  }
}

//
function setChangesTimeline() {
  var cont = $(".stats");
  cont.html("");

  var time = $('<div class="changes_timeline"></div>');

  changes.sort(compare_changes);

  // CURRENT DECK
  let div = $('<div class="change"></div>');
  let butbox = $(
    '<div class="change_button_cont" style="transform: scaleY(-1);"></div>'
  );
  let button = $('<div class="change_button"></div>');
  button.appendTo(butbox);
  let datbox = $('<div class="change_data"></div>');

  // title
  let title = $('<div class="change_data_box"></div>');
  title.html("Current Deck");

  butbox.appendTo(div);
  datbox.appendTo(div);
  title.appendTo(datbox);
  div.appendTo(time);

  butbox.on("mouseenter", function() {
    button.css("width", "32px");
    button.css("height", "32px");
    button.css("top", "calc(50% - 16px)");
  });

  butbox.on("mouseleave", function() {
    button.css("width", "24px");
    button.css("height", "24px");
    button.css("top", "calc(50% - 12px)");
  });

  butbox.on("click", function() {
    var hasc = button.hasClass("change_button_active");

    $(".change_data_box_inside").each(function() {
      $(this).css("height", "0px");
    });

    $(".change_button").each(function() {
      $(this).removeClass("change_button_active");
    });

    if (!hasc) {
      button.addClass("change_button_active");
    }
  });
  //

  var cn = 0;
  changes.forEach(function(change) {
    change.changesMain.sort(compare_changes_inner);
    change.changesSide.sort(compare_changes_inner);

    let div = $('<div class="change"></div>');
    let butbox;
    if (cn < changes.length - 1) {
      butbox = $(
        '<div style="background-size: 100% 100% !important;" class="change_button_cont"></div>'
      );
    } else {
      butbox = $('<div class="change_button_cont"></div>');
    }
    var button = $('<div class="change_button"></div>');
    button.appendTo(butbox);
    let datbox = $('<div class="change_data"></div>');

    // title
    let title = $('<div class="change_data_box"></div>');
    // inside
    let data = $('<div class="change_data_box_inside"></div>');
    var innherH = 54;
    let nc = 0;
    if (change.changesMain.length > 0) {
      let dd = $('<div class="change_item_box"></div>');
      let separator = deckDrawer.cardSeparator("Mainboard");
      dd.append(separator);
      dd.appendTo(data);
    }

    change.changesMain.forEach(function(c) {
      innherH += 30;
      if (c.quantity > 0) nc += c.quantity;
      let dd = $('<div class="change_item_box"></div>');
      if (c.quantity > 0) {
        let ic = $('<div class="change_add"></div>');
        ic.appendTo(dd);
      } else {
        let ic = $('<div class="change_remove"></div>');
        ic.appendTo(dd);
      }

      let tile = deckDrawer.cardTile(
        cardStyle,
        c.id,
        "chm" + cn,
        Math.abs(c.quantity)
      );
      dd.append(tile);
      dd.appendTo(data);
    });

    if (change.changesSide.length > 0) {
      let dd = $('<div class="change_item_box"></div>');
      let separator = deckDrawer.cardSeparator("Sideboard");
      dd.append(separator);
      innherH += 30;
      dd.appendTo(data);
    }

    change.changesSide.forEach(function(c) {
      innherH += 30;
      if (c.quantity > 0) nc += c.quantity;
      let dd = $('<div class="change_item_box"></div>');
      if (c.quantity > 0) {
        let ic = $('<div class="change_add"></div>');
        ic.appendTo(dd);
      } else {
        let ic = $('<div class="change_remove"></div>');
        ic.appendTo(dd);
      }

      let tile = deckDrawer.cardTile(
        cardStyle,
        c.id,
        "chs" + cn,
        Math.abs(c.quantity)
      );
      dd.append(tile);
      dd.appendTo(data);
    });

    title.html(
      nc + " changes, " + timeSince(Date.parse(change.date)) + " ago."
    );

    butbox.appendTo(div);
    datbox.appendTo(div);
    title.appendTo(datbox);
    data.appendTo(datbox);
    div.appendTo(time);

    butbox.on("mouseenter", function() {
      button.css("width", "32px");
      button.css("height", "32px");
      button.css("top", "calc(50% - 16px)");
    });

    butbox.on("mouseleave", function() {
      button.css("width", "24px");
      button.css("height", "24px");
      button.css("top", "calc(50% - 12px)");
    });

    butbox.on("click", function() {
      // This requires some UX indicators
      //drawDeck($('.decklist'), {mainDeck: change.previousMain, sideboard: change.previousSide});
      var hasc = button.hasClass("change_button_active");

      $(".change_data_box_inside").each(function() {
        $(this).css("height", "0px");
      });

      $(".change_button").each(function() {
        $(this).removeClass("change_button_active");
      });

      if (!hasc) {
        button.addClass("change_button_active");
        data.css("height", innherH + "px");
      }
    });

    cn++;
  });

  $('<div class="button_simple openDeck">View stats</div>').appendTo(cont);

  $(".openDeck").click(function() {
    openDeck();
  });
  time.appendTo(cont);
}

//
function open_draft(id) {
  console.log("OPEN DRAFT", id, draftPosition);
  $("#ux_1").html("");
  $("#ux_1").removeClass("flex_item");
  let draft = matchesHistory[id];
  let tileGrpid = db.sets[draft.set].tile;

  if (draftPosition < 1) draftPosition = 1;
  if (draftPosition > packSize * 6) draftPosition = packSize * 6;

  var packSize = 14;
  if (draft.set == "Guilds of Ravnica" || draft.set == "Ravnica Allegiance") {
    packSize = 15;
  }

  var pa = Math.floor((draftPosition - 1) / 2 / packSize);
  var pi = Math.floor(((draftPosition - 1) / 2) % packSize);
  var key = "pack_" + pa + "pick_" + pi;

  var pack = (draft[key] && draft[key].pack) || [];
  var pick = (draft[key] && draft[key].pick) || "";

  var top = $(
    '<div class="decklist_top"><div class="button back"></div><div class="deck_name">' +
      draft.set +
      " Draft</div></div>"
  );
  let flr = $('<div class="deck_top_colors"></div>');
  top.append(flr);

  if (db.card(tileGrpid)) {
    change_background("", tileGrpid);
  }

  var cont = $('<div class="flex_item" style="flex-direction: column;"></div>');
  cont.append(
    '<div class="draft_nav_container"><div class="draft_nav_prev"></div><div class="draft_nav_next"></div></div>'
  );

  $(
    '<div class="draft_title">Pack ' +
      (pa + 1) +
      ", Pick " +
      (pi + 1) +
      "</div>"
  ).appendTo(cont);

  var slider = $('<div class="slidecontainer"></div>');
  slider.appendTo(cont);
  var sliderInput = $(
    '<input type="range" min="1" max="' +
      packSize * 6 +
      '" value="' +
      draftPosition +
      '" class="slider" id="draftPosRange">'
  );
  sliderInput.appendTo(slider);

  var pd = $('<div class="draft_pack_container"></div>');
  pd.appendTo(cont);

  pack.forEach(function(grpId) {
    var d = $(
      '<div style="width: ' +
        cardSize +
        'px !important;" class="draft_card"></div>'
    );
    var img = $(
      '<img style="width: ' +
        cardSize +
        'px !important;" class="draft_card_img"></img>'
    );
    if (grpId == pick && draftPosition % 2 == 0) {
      img.addClass("draft_card_picked");
    }
    var card = db.card(grpId);
    img.attr("src", get_card_image(card));

    img.appendTo(d);
    var r = $(
      '<div style="" class="draft_card_rating">' +
        DRAFT_RANKS[card.rank] +
        "</div>"
    );
    r.appendTo(d);
    addCardHover(img, card);
    d.appendTo(pd);
  });

  $("#ux_1").append(top);
  $("#ux_1").append(cont);

  var posRange = $("#draftPosRange")[0];

  $(".draft_nav_prev").off();
  $(".draft_nav_next").off();
  $("#draftPosRange").off();

  $("#draftPosRange").on("click mousemove", function() {
    var pa = Math.floor((posRange.value - 1) / 2 / packSize);
    var pi = Math.floor(((posRange.value - 1) / 2) % packSize);
    $(".draft_title").html("Pack " + (pa + 1) + ", Pick " + (pi + 1));
  });

  $("#draftPosRange").on("click mouseup", function() {
    draftPosition = parseInt(posRange.value);
    open_draft(id, tileGrpid, draft.set);
  });

  $(".draft_nav_prev").on("click mouseup", function() {
    draftPosition -= 1;
    open_draft(id, tileGrpid, draft.set);
  });

  $(".draft_nav_next").on("click mouseup", function() {
    draftPosition += 1;
    open_draft(id, tileGrpid, draft.set);
  });
  //
  $(".back").click(function() {
    change_background("default");
    $(".moving_ux").animate({ left: "0px" }, 250, "easeInOutCubic");
  });
}

function open_match(id) {
  $("#ux_1").html("");
  $("#ux_1").removeClass("flex_item");
  var match = matchesHistory[id];

  let top = $(
    '<div class="decklist_top"><div class="button back"></div><div class="deck_name">' +
      match.playerDeck.name +
      "</div></div>"
  );
  let flr = $('<div class="deck_top_colors"></div>');

  if (match.playerDeck.colors != undefined) {
    match.playerDeck.colors.forEach(function(color) {
      var m = $('<div class="mana_s20 mana_' + MANA[color] + '"></div>');
      flr.append(m);
    });
  }
  top.append(flr);

  var flc = $(
    '<div class="flex_item" style="justify-content: space-evenly;"></div>'
  );
  if (fs.existsSync(path.join(actionLogDir, id + ".txt"))) {
    $('<div class="button_simple openLog">Action log</div>').appendTo(flc);
  }

  var tileGrpid = match.playerDeck.deckTileId;
  if (db.card(tileGrpid)) {
    change_background("", tileGrpid);
  }
  var fld = $('<div class="flex_item"></div>');

  // this is a mess
  var flt = $('<div class="flex_item"></div>');
  var fltl = $('<div class="flex_item"></div>');
  var r = $('<div class="rank"></div>');
  r.appendTo(fltl);

  var fltr = $('<div class="flex_item"></div>');
  fltr.css("flex-direction", "column");
  var fltrt = $('<div class="flex_top"></div>');
  var fltrb = $('<div class="flex_bottom"></div>');
  fltrt.appendTo(fltr);
  fltrb.appendTo(fltr);

  fltl.appendTo(flt);
  fltr.appendTo(flt);

  var rank = match.player.rank;
  var tier = match.player.tier;
  r.css(
    "background-position",
    get_rank_index(rank, tier) * -48 + "px 0px"
  ).attr("title", rank + " " + tier);

  var name = $(
    '<div class="list_match_player_left">' +
      match.player.name.slice(0, -6) +
      " (" +
      match.player.win +
      ")</div>"
  );
  name.appendTo(fltrt);

  if (match.player.win > match.opponent.win) {
    var w = $('<div class="list_match_player_left green">Winner</div>');
    w.appendTo(fltrb);
  }

  var dl = $('<div class="decklist"></div>');
  flt.appendTo(dl);

  drawDeck(dl, match.playerDeck);

  $(
    '<div class="button_simple centered exportDeckPlayer">Export to Arena</div>'
  ).appendTo(dl);
  $(
    '<div class="button_simple centered exportDeckStandardPlayer">Export to .txt</div>'
  ).appendTo(dl);

  flt = $('<div class="flex_item" style="flex-direction: row-reverse;"></div>');
  fltl = $('<div class="flex_item"></div>');
  r = $('<div class="rank"></div>');
  r.appendTo(fltl);

  fltr = $('<div class="flex_item"></div>');
  fltr.css("flex-direction", "column");
  fltr.css("align-items", "flex-end");
  fltrt = $('<div class="flex_top"></div>');
  fltrb = $('<div class="flex_bottom"></div>');
  fltrt.appendTo(fltr);
  fltrb.appendTo(fltr);

  fltl.appendTo(flt);
  fltr.appendTo(flt);

  rank = match.opponent.rank;
  tier = match.opponent.tier;
  r.css(
    "background-position",
    get_rank_index(rank, tier) * -48 + "px 0px"
  ).attr("title", rank + " " + tier);

  name = $(
    '<div class="list_match_player_right">' +
      match.opponent.name.slice(0, -6) +
      " (" +
      match.opponent.win +
      ")</div>"
  );
  name.appendTo(fltrt);

  if (match.player.win < match.opponent.win) {
    w = $('<div class="list_match_player_right green">Winner</div>');
    w.appendTo(fltrb);
  }

  var odl = $('<div class="decklist"></div>');
  flt.appendTo(odl);

  match.oppDeck.mainDeck.sort(compare_cards);
  match.oppDeck.sideboard.sort(compare_cards);
  /*
  match.oppDeck.mainDeck.forEach(function(c) {
    c.quantity = 9999;
  });
  match.oppDeck.sideboard.forEach(function(c) {
    c.quantity = 9999;
  });
  */
  drawDeck(odl, match.oppDeck);

  $(
    '<div class="button_simple centered exportDeck">Export to Arena</div>'
  ).appendTo(odl);
  $(
    '<div class="button_simple centered exportDeckStandard">Export to .txt</div>'
  ).appendTo(odl);

  dl.appendTo(fld);
  odl.appendTo(fld);

  $("#ux_1").append(top);
  $("#ux_1").append(flc);
  $("#ux_1").append(fld);

  if (match.gameStats) {
    match.gameStats.forEach((game, gameIndex) => {
      if (game.sideboardChanges) {
        let separator1 = deckDrawer.cardSeparator(
          `Game ${gameIndex + 1} Sideboard Changes`
        );
        $("#ux_1").append(separator1);
        let sideboardDiv = $('<div class="card_lists_list"></div>');
        let additionsDiv = $('<div class="cardlist"></div>');
        if (
          game.sideboardChanges.added.length == 0 &&
          game.sideboardChanges.removed.length == 0
        ) {
          let separator2 = deckDrawer.cardSeparator("No changes");
          additionsDiv.append(separator2);
          additionsDiv.appendTo(sideboardDiv);
        } else {
          let separator3 = deckDrawer.cardSeparator("Sideboarded In");
          additionsDiv.append(separator3);
          drawCardList(additionsDiv, game.sideboardChanges.added);
          additionsDiv.appendTo(sideboardDiv);
          let removalsDiv = $('<div class="cardlist"></div>');
          let separator4 = deckDrawer.cardSeparator("Sideboarded Out");
          removalsDiv.append(separator4);
          drawCardList(removalsDiv, game.sideboardChanges.removed);
          removalsDiv.appendTo(sideboardDiv);
        }

        $("#ux_1").append(sideboardDiv);
      }

      let separator5 = deckDrawer.cardSeparator(
        `Game ${gameIndex + 1} Hands Drawn`
      );
      $("#ux_1").append(separator5);

      let handsDiv = $('<div class="card_lists_list"></div>');
      if (game.handsDrawn.length > 3) {
        // The default value of "center" apparently causes padding to be omitted in the calculation of how far
        // the scrolling should go. So, if there are enough hands to actually need scrolling, override it.
        handsDiv.css("justify-content", "start");
      }

      game.handsDrawn.forEach((hand, i) => {
        let handDiv = $('<div class="cardlist"></div>');
        drawCardList(handDiv, hand);
        handDiv.appendTo(handsDiv);
        if (game.bestOf == 1 && i == 0) {
          let landDiv = $(
            '<div style="margin: auto; text-align: center;" tooltip-top tooltip-content=' +
              '"This hand was drawn with weighted odds that Wizards of the Coast has not disclosed because it is the first hand in a best-of-one match. ' +
              'It should be more likely to have a close to average number of lands, but only they could calculate the exact odds.">Land Percentile: Unknown</div>'
          );
          landDiv.appendTo(handDiv);
        } else {
          let likelihood = hypergeometricSignificance(
            game.handLands[i],
            game.deckSize,
            hand.length,
            game.landsInDeck
          );
          let landDiv = $(
            '<div style="margin: auto; text-align: center;" tooltip-top tooltip-content=' +
              '"The probability of a random hand of the same size having a number of lands at least as far from average as this one, ' +
              'calculated as if the distribution were continuous. Over a large number of games, this should average about 50%.">Land Likelihood: ' +
              (likelihood * 100).toFixed(2) +
              "%</div>"
          );
          landDiv.appendTo(handDiv);
        }
      });

      $("#ux_1").append(handsDiv);

      let separator6 = deckDrawer.cardSeparator(
        `Game ${gameIndex + 1} Shuffled Order`
      );
      $("#ux_1").append(separator6);
      let libraryDiv = $('<div class="library_list"></div>');
      let unique = makeId(4);
      let handSize = 8 - game.handsDrawn.length;

      game.shuffledOrder.forEach((cardId, libraryIndex) => {
        let rowShade =
          libraryIndex === handSize - 1
            ? "line_dark line_bottom_border"
            : libraryIndex < handSize - 1
            ? "line_dark"
            : (libraryIndex - handSize) % 2 === 0
            ? "line_light"
            : "line_dark";
        let cardDiv = $(`<div class="library_card ${rowShade}"></div>`);
        let tile = deckDrawer.cardTile(
          cardStyle,
          cardId,
          unique + libraryIndex,
          "#" + (libraryIndex + 1)
        );
        cardDiv.append(tile);
        cardDiv.appendTo(libraryDiv);
      });
      let unknownCards = game.deckSize - game.shuffledOrder.length;
      if (unknownCards > 0) {
        let cardDiv = $('<div class="library_card"></div>');
        let tile = deckDrawer.cardTile(
          cardStyle,
          null,
          unique + game.deckSize,
          unknownCards + "x"
        );
        cardDiv.append(tile);
        cardDiv.appendTo(libraryDiv);
      }

      let handExplanation = $(
        '<div class="library_hand">The opening hand is excluded from the below statistics to prevent mulligan choices from influencing them.</div>'
      );
      handExplanation.css("grid-row-end", "span " + (handSize - 1));
      handExplanation.appendTo(libraryDiv);

      let headerDiv = $(
        '<div class="library_header" tooltip-bottom tooltip-content="The number of lands in the library at or before this point.">Lands</div>'
      );
      headerDiv.css("grid-area", handSize + " / 2");
      headerDiv.appendTo(libraryDiv);
      headerDiv = $(
        '<div class="library_header" tooltip-bottom tooltip-content="The average number of lands expected in the library at or before this point.">Expected</div>'
      );
      headerDiv.css("grid-area", handSize + " / 3");
      headerDiv.appendTo(libraryDiv);
      headerDiv = $(
        '<div class="library_header" tooltip-bottom tooltip-content="The probability of the number of lands being at least this far from average, calculated as if the distribution were continuous. For details see footnote. Over a large number of games, this should average about 50%.">Likelihood</div>'
      );
      headerDiv.css("grid-area", handSize + " / 4");
      headerDiv.appendTo(libraryDiv);
      headerDiv = $(
        '<div class="library_header" tooltip-bottomright tooltip-content="The expected percentage of games where the actual number of lands is equal or less than this one. This is easier to calculate and more widely recognized but harder to assess the meaning of.">Percentile</div>'
      );
      headerDiv.css("grid-area", handSize + " / 5");
      headerDiv.appendTo(libraryDiv);

      game.libraryLands.forEach((count, index) => {
        let rowShade = index % 2 === 0 ? "line_light" : "line_dark";
        let landsDiv = $(
          `<div class="library_stat ${rowShade}">${count}</div>`
        );
        landsDiv.css("grid-area", handSize + index + 1 + " / 2");
        landsDiv.appendTo(libraryDiv);
        let expected = (
          ((index + 1) * game.landsInLibrary) /
          game.librarySize
        ).toFixed(2);
        let expectedDiv = $(
          `<div class="library_stat ${rowShade}">${expected}</div>`
        );
        expectedDiv.css("grid-area", handSize + index + 1 + " / 3");
        expectedDiv.appendTo(libraryDiv);
        let likelihood = hypergeometricSignificance(
          count,
          game.librarySize,
          index + 1,
          game.landsInLibrary
        );
        let likelihoodDiv = $(
          `<div class="library_stat ${rowShade}">${(likelihood * 100).toFixed(
            2
          )}</div>`
        );
        likelihoodDiv.css("grid-area", handSize + index + 1 + " / 4");
        likelihoodDiv.appendTo(libraryDiv);
        let percentile = hypergeometricRange(
          0,
          count,
          game.librarySize,
          index + 1,
          game.landsInLibrary
        );
        let percentileDiv = $(
          `<div class="library_stat ${rowShade}">${(percentile * 100).toFixed(
            2
          )}</div>`
        );
        percentileDiv.css("grid-area", handSize + index + 1 + " / 5");
        percentileDiv.appendTo(libraryDiv);
      });

      let footnoteLabel = $(
        '<div id="library_footnote_label' +
          gameIndex +
          '" class="library_footnote" tooltip-bottom ' +
          'tooltip-content="Click to show footnote" onclick="toggleVisibility(\'library_footnote_label' +
          gameIndex +
          "', 'library_footnote" +
          gameIndex +
          "')\">Footnote on Likelihood</div>"
      );
      footnoteLabel.css("grid-row", game.shuffledOrder.length + 1);
      footnoteLabel.appendTo(libraryDiv);
      let footnote = $(
        '<div id="library_footnote' +
          gameIndex +
          '" class="library_footnote hidden" ' +
          "onclick=\"toggleVisibility('library_footnote_label" +
          gameIndex +
          "', 'library_footnote" +
          gameIndex +
          "')\">" +
          "<p>The Likelihood column calculations are designed to enable assessment of fairness at a glance, in a way " +
          "that is related to percentile but differs in important ways. In short, it treats the count of lands as if " +
          "it were actually a bucket covering a continuous range, and calculates the cumulative probability of the " +
          "continuous value being at least as far from the median as a randomly selected value within the range covered " +
          "by the actual count. Importantly, this guarantees that the theoretical average will always be exactly 50%.</p>" +
          "<p>For values that are not the median, the result is halfway between the value's own percentile and the " +
          "next one up or down. For the median itself, the covered range is split and weighted for how much of it is " +
          "on each side of the 50th percentile. In both cases, the result's meaning is the same for each direction " +
          "from the 50th percentile, and scaled up by a factor of 2 to keep the possible range at 0% to 100%. " +
          "For precise details, see the source code on github.</p></div>"
      );
      footnote.css("grid-row", game.shuffledOrder.length + 1);
      footnote.appendTo(libraryDiv);

      $("#ux_1").append(libraryDiv);
    });
  }

  $(".openLog").click(function() {
    openActionLog(id, $("#ux_1"));
  });

  $(".exportDeckPlayer").click(function() {
    var list = get_deck_export(match.playerDeck);
    ipc_send("set_clipboard", list);
  });
  $(".exportDeckStandardPlayer").click(function() {
    var list = get_deck_export_txt(match.playerDeck);
    ipc_send("export_txt", { str: list, name: match.playerDeck.name });
  });

  $(".exportDeck").click(function() {
    var list = get_deck_export(match.oppDeck);
    ipc_send("set_clipboard", list);
  });
  $(".exportDeckStandard").click(function() {
    var list = get_deck_export_txt(match.oppDeck);
    ipc_send("export_txt", {
      str: list,
      name: match.opponent.name.slice(0, -6) + "'s deck"
    });
  });

  $(".back").click(function() {
    change_background("default");
    $(".moving_ux").animate({ left: "0px" }, 250, "easeInOutCubic");
  });
}

function openActionLog(actionLogId) {
  $("#ux_2").html("");
  let top = $(
    `<div class="decklist_top"><div class="button back actionlog_back"></div><div class="deck_name">Action Log</div><div class="deck_name"></div></div>`
  );

  let actionLogContainer = $(`<div class="action_log_container"></div>`);

  let actionLogFile = path.join(actionLogDir, actionLogId + ".txt");
  let str = fs.readFileSync(actionLogFile).toString();

  let actionLog = str.split("\n");
  for (let line = 1; line < actionLog.length - 1; line += 3) {
    let seat = actionLog[line];
    let time = actionLog[line + 1];
    let str = actionLog[line + 2];
    str = striptags(str, ["log-card", "log-ability"]);

    var boxDiv = $('<div class="actionlog log_p' + seat + '"></div>');
    var timeDiv = $('<div class="actionlog_time">' + time + "</div>");
    var strDiv = $('<div class="actionlog_text">' + str + "</div>");

    boxDiv.append(timeDiv);
    boxDiv.append(strDiv);
    actionLogContainer.append(boxDiv);
  }

  $("#ux_2").append(top);
  $("#ux_2").append(actionLogContainer);

  $$("log-card").forEach(obj => {
    let grpId = obj.getAttribute("id");
    addCardHover(obj, db.card(grpId));
  });

  $$("log-ability").forEach(obj => {
    let grpId = obj.getAttribute("id");
    let abilityText = db.abilities[grpId] || "";
    obj.title = abilityText;
  });

  $(".moving_ux").animate({ left: "-200%" }, 250, "easeInOutCubic");

  $(".actionlog_back").click(() => {
    $(".moving_ux").animate({ left: "-100%" }, 250, "easeInOutCubic");
  });
}

//
function toggleVisibility(...ids) {
  ids.forEach(id => {
    let el = document.getElementById(id);
    if (el.classList.contains("hidden")) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}

//
function add_checkbox(div, label, iid, def, func) {
  label = $('<label class="check_container hover_label">' + label + "</label>");
  label.appendTo(div);
  var check_new = $('<input type="checkbox" id="' + iid + '" />');
  check_new.on("click", func);
  check_new.appendTo(label);
  check_new.prop("checked", def);

  var span = $('<span class="checkmark"></span>');
  span.appendTo(label);
  return label;
}

//
function change_background(arg = "default", grpId = 0) {
  let artistLine = "";
  const _card = db.card(grpId);

  //console.log(arg, grpId, _card);
  if (arg === "default") {
    $(".top_artist").html("Ghitu Lavarunner by Jesper Ejsing");
    if (defaultBackground == "") {
      $(".main_wrapper").css(
        "background-image",
        "url(../images/Ghitu-Lavarunner-Dominaria-MtG-Art.jpg)"
      );
    } else {
      $(".top_artist").html("");
      $(".main_wrapper").css(
        "background-image",
        "url(" + defaultBackground + ")"
      );
    }
  } else if (_card) {
    // console.log(_card.images["art_crop"]);
    $(".main_wrapper").css(
      "background-image",
      "url(https://img.scryfall.com/cards" + _card.images["art_crop"] + ")"
    );
    try {
      artistLine = _card.name + " by " + _card.artist;
      $(".top_artist").html(artistLine);
    } catch (e) {
      console.log(e);
    }
  } else if (fs.existsSync(arg)) {
    $(".top_artist").html("");
    $(".main_wrapper").css("background-image", "url(" + arg + ")");
  } else {
    $(".top_artist").html("");
    $.ajax({
      url: arg,
      type: "HEAD",
      error: function() {
        $(".main_wrapper").css("background-image", "");
      },
      success: function() {
        $(".main_wrapper").css("background-image", "url(" + arg + ")");
      }
    });
  }
}

//
function formatPercent(value, config = {}) {
  return value.toLocaleString([], {
    style: "percent",
    maximumSignificantDigits: 2,
    ...config
  });
}

//
function formatNumber(value, config = {}) {
  return value.toLocaleString([], {
    style: "decimal",
    ...config
  });
}

//
function getWinrateClass(wr) {
  if (wr > 0.65) return "blue";
  if (wr > 0.55) return "green";
  if (wr < 0.45) return "orange";
  if (wr < 0.35) return "red";
  return "white";
}

function getEventWinLossClass(wlGate) {
  if (wlGate === undefined) return "white";
  if (wlGate.MaxWins === wlGate.CurrentWins) return "blue";
  if (wlGate.CurrentWins > wlGate.CurrentLosses) return "green";
  if (wlGate.CurrentWins * 2 > wlGate.CurrentLosses) return "orange";
  return "red";
}

function compare_winrates(a, b) {
  let _a = a.wins / a.losses;
  let _b = b.wins / b.losses;

  if (_a < _b) return 1;
  if (_a > _b) return -1;

  return compare_color_winrates(a, b);
}

function compare_color_winrates(a, b) {
  a = a.colors;
  b = b.colors;

  if (a.length < b.length) return -1;
  if (a.length > b.length) return 1;

  let sa = a.reduce(function(_a, _b) {
    return _a + _b;
  }, 0);
  let sb = b.reduce(function(_a, _b) {
    return _a + _b;
  }, 0);
  if (sa < sb) return -1;
  if (sa > sb) return 1;

  return 0;
}

//
function sort_decks(compareFunc = compare_decks) {
  decks.sort(compareFunc);
  decks.forEach(function(deck) {
    deck.colors = [];
    deck.colors = get_deck_colors(deck);
    deck.mainDeck.sort(compare_cards);
  });
}

//
function compare_decks(a, b) {
  a = playerData.decks_last_used.indexOf(a.id);
  b = playerData.decks_last_used.indexOf(b.id);

  if (a == b) {
    a = Date.parse(a.lastUpdated);
    b = Date.parse(b.lastUpdated);
    if (a < b) return 1;
    if (a > b) return -1;
    return 0;
  } else {
    if (a < b) return 1;
    if (a > b) return -1;
    return 0;
  }
}

//
function compare_changes(a, b) {
  a = Date.parse(a.date);
  b = Date.parse(b.date);
  if (a < b) return 1;
  if (a > b) return -1;
  return 0;
}

//
function compare_changes_inner(a, b) {
  a = a.quantity;
  b = b.quantity;
  if (a > 0 && b > 0) {
    if (a < b) return -1;
    if (a > b) return 1;
  }
  if (a < 0 && b < 0) {
    if (a < b) return 1;
    if (a > b) return -1;
  }
  if (a < 0 && b > 0) {
    return -1;
  }
  if (a > 0 && b < 0) {
    return 1;
  }
  return 0;
}

//
function compare_courses(a, b) {
  if (a === undefined) return 0;
  if (b === undefined) return 0;

  a = eventsHistory[a];
  b = eventsHistory[b];

  if (a === undefined) return 0;
  if (b === undefined) return 0;

  return Date.parse(a.date) - Date.parse(b.date);
}
