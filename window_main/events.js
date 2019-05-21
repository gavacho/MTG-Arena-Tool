/*
globals
  Aggregator,
  allMatches
  compare_cards,
  compare_courses,
  DataScroller,
  eventsHistory,
  FilterPanel,
  get_deck_colors,
  get_rank_index_16,
  getEventWinLossClass,
  getReadableEvent,
  ipc_send,
  matchesHistory,
  ListItem,
  open_match,
  playerData,
  StatsPanel,
  timeSince,
  toMMSS
*/

const { createDivision, queryElementsByClass } = require("../shared/dom-fns");

const { MANA } = require("../shared/constants.js");

let filters = Aggregator.getDefaultFilters();
filters.eventId = Aggregator.ALL_EVENT_TRACKS;
let filteredMatches;

function openEventsTab(_filters) {
  const mainDiv = document.getElementById("ux_0");
  mainDiv.classList.remove("flex_item");
  mainDiv.innerHTML = "";
  const d = createDivision(["list_fill"]);
  mainDiv.appendChild(d);

  eventsHistory.courses.sort(compare_courses);
  filters = { ...filters, ..._filters };
  filteredMatches = new Aggregator(filters);

  const eventsTop = createDivision(["events_top"]);
  eventsTop.style.display = "flex";
  eventsTop.style.width = "100%";
  eventsTop.style.alignItems = "center";
  eventsTop.style.justifyContent = "space-between";

  const filterPanel = new FilterPanel(
    "events_top",
    selected => openEventsTab(selected),
    filters,
    allMatches.trackEvents,
    [],
    [],
    false,
    [],
    false,
    null,
    true
  );

  const eventsTopFilter = filterPanel.render();
  eventsTop.appendChild(eventsTopFilter);

  const statsPanel = new StatsPanel("events_top", filteredMatches);
  const eventsTopWinrate = statsPanel.render();
  eventsTopWinrate.style.width = "300px";
  eventsTopWinrate.style.marginRight = "16px";
  eventsTop.appendChild(eventsTopWinrate);

  mainDiv.appendChild(eventsTop);
  const dataScroller = new DataScroller(
    mainDiv,
    renderData,
    20,
    eventsHistory.courses.length
  );
  dataScroller.render(25);
}

// return val = how many rows it rendered into container
function renderData(container, index) {
  // for performance reasons, we leave events order mostly alone
  // to display most-recent-first, we use a reverse index
  const revIndex = eventsHistory.courses.length - index - 1;
  var course_id = eventsHistory.courses[revIndex];
  var course = eventsHistory[course_id];

  if (
    course === undefined ||
    course.CourseDeck === undefined ||
    (course.archived && !filters.showArchived)
  ) {
    return 0;
  }

  if (!filteredMatches) return 0;
  if (!filteredMatches.filterDate(course.date)) return 0;
  if (!filteredMatches.filterEvent(course.InternalEventName)) {
    return 0;
  }

  var tileGrpid = course.CourseDeck.deckTileId;

  let archiveCallback = archiveEvent;
  if (course.archived) {
    archiveCallback = unarchiveEvent;
  }

  const listItem = new ListItem(
    tileGrpid,
    course.id,
    expandEvent,
    archiveCallback,
    course.archived
  );
  listItem.divideLeft();
  listItem.divideRight();
  attachEventData(listItem, course);

  var divExp = createDivision([course.id + "exp", "list_event_expand"]);

  container.appendChild(listItem.container);
  container.appendChild(divExp);
  return 1;
}

// converts a match index from a courses
// object into a valid index into the
// matchesHistory object
function getMatchesHistoryIndex(matchIndex) {
  if (matchesHistory.hasOwnProperty(matchIndex)) {
    return matchIndex;
  }

  let newStyleMatchIndex = `${matchIndex}-${playerData.arenaId}`;
  if (matchesHistory.hasOwnProperty(newStyleMatchIndex)) {
    return newStyleMatchIndex;
  }

  // We couldn't find a matching index
  // data might be corrupt
  return undefined;
}

function getWlGate(course) {
  // quick hack to handle new War of the Spark Lore Events
  const wlGate =
    course.ModuleInstanceData.WinLossGate ||
    course.ModuleInstanceData.WinNoGate;
  return wlGate;
}

// Given a courses object returns all of the matches
function getCourseStats(course) {
  const wlGate = getWlGate(course);
  let matchesList = wlGate ? wlGate.ProcessedMatchIds : undefined;
  const stats = { wins: 0, losses: 0, duration: 0 };
  if (!matchesList) return stats;

  matchesList
    .map(getMatchesHistoryIndex)
    .map(index => matchesHistory[index])
    .filter(
      match =>
        match !== undefined &&
        match.type === "match" &&
        (!match.archived || filters.showArchived)
    )
    .forEach(match => {
      // some of the data is wierd. Games which last years or have no data.
      if (match.duration && match.duration < 3600) {
        stats.duration += match.duration;
      }
      stats.duration += match.duration || 0;
      if (match.player.win > match.opponent.win) {
        stats.wins++;
      }
      if (match.player.win < match.opponent.win) {
        stats.losses++;
      }
    });
  return stats;
}

function attachEventData(listItem, course) {
  let deckName = getReadableEvent(course.InternalEventName);
  let deckNameDiv = createDivision(["list_deck_name"], deckName);
  listItem.leftTop.appendChild(deckNameDiv);

  course.CourseDeck.colors.forEach(color => {
    let m = createDivision(["mana_s20", `mana_${MANA[color]}`]);
    listItem.leftBottom.appendChild(m);
  });

  var eventState = course.CurrentEventState;
  if (eventState == "DoneWithMatches" || eventState == 2) {
    listItem.rightTop.appendChild(
      createDivision(["list_event_phase"], "Completed")
    );
  } else {
    listItem.rightTop.appendChild(
      createDivision(["list_event_phase_red"], "In progress")
    );
  }

  const stats = getCourseStats(course);

  listItem.rightBottom.appendChild(
    createDivision(
      ["list_match_time"],
      timeSince(new Date(course.date)) + " ago - " + toMMSS(stats.duration)
    )
  );

  let { wins, losses } = stats;
  const wlGate = getWlGate(course);
  if (filters.showArchived && wlGate) {
    wins = wlGate.CurrentWins;
    losses = wlGate.CurrentLosses;
  }
  wins = wins || 0;
  losses = losses || 0;
  const wl = `${wins}:${losses}`;
  const winLossClass = getEventWinLossClass({
    CurrentWins: wins,
    CurrentLosses: losses
  });

  let resultDiv = createDivision(["list_match_result", winLossClass], wl);
  resultDiv.style.marginLeft = "8px";
  listItem.right.after(resultDiv);
}

function archiveEvent(id) {
  ipc_send("archive_course", id);
  eventsHistory[id].archived = true;
  openEventsTab();
}

function unarchiveEvent(id) {
  ipc_send("unarchive_course", id);
  eventsHistory[id].archived = false;
  openEventsTab();
}

// Given the data of a match will return a data row to be
// inserted into one of the screens.
function createMatchRow(match) {
  //  if (match.opponent == undefined) continue;
  //  if (match.opponent.userid.indexOf("Familiar") !== -1) continue;
  match.playerDeck.mainDeck.sort(compare_cards);
  match.oppDeck.mainDeck.sort(compare_cards);

  var tileGrpid = match.playerDeck.deckTileId;

  let matchRow = new ListItem(tileGrpid, match.id, openMatch);
  matchRow.divideLeft();
  matchRow.divideRight();

  let deckNameDiv = createDivision(["list_deck_name"], match.playerDeck.name);
  matchRow.leftTop.appendChild(deckNameDiv);

  match.playerDeck.colors.forEach(color => {
    var m = createDivision(["mana_s20", "mana_" + MANA[color]]);
    matchRow.leftBottom.appendChild(m);
  });

  // Insert contents of flexCenterTop
  if (match.opponent.name == null) {
    match.opponent.name = "-#000000";
  }
  let oppNameDiv = createDivision(
    ["list_match_title"],
    "vs " + match.opponent.name.slice(0, -6)
  );
  matchRow.rightTop.appendChild(oppNameDiv);

  var oppRankDiv = createDivision(["ranks_16"]);
  oppRankDiv.style.backgroundPosition = `${get_rank_index_16(
    match.opponent.rank
  ) * -16}px 0px`;
  oppRankDiv.title = match.opponent.rank + " " + match.opponent.tier;
  matchRow.rightTop.appendChild(oppRankDiv);

  let timeDiv = createDivision(
    ["list_match_time"],
    timeSince(new Date(match.date)) + " ago - " + toMMSS(match.duration)
  );
  matchRow.rightBottom.appendChild(timeDiv);

  get_deck_colors(match.oppDeck).forEach(function(color) {
    var m = createDivision(["mana_s20", "mana_" + MANA[color]]);
    matchRow.rightBottom.appendChild(m);
  });

  matchRow.rightBottom.style.marginRight = "16px";

  var winLossClass = match.player.win > match.opponent.win ? "green" : "red";
  let resultDiv = createDivision(
    ["list_match_result", winLossClass],
    match.player.win + ":" + match.opponent.win
  );
  matchRow.right.after(resultDiv);

  return matchRow.container;
}

function openMatch(id) {
  open_match(id);
  $(".moving_ux").animate({ left: "-100%" }, 250, "easeInOutCubic");
}

// This code is executed when an event row is clicked and adds
// rows below the event for every match in that event.
function expandEvent(id) {
  let course = eventsHistory[id];
  let expandDiv = queryElementsByClass(id + "exp")[0];

  if (expandDiv.hasAttribute("style")) {
    expandDiv.removeAttribute("style");
    setTimeout(function() {
      expandDiv.innerHTML = "";
    }, 200);
    return;
  }

  expandDiv.innerHTML = "";
  const wlGate = getWlGate(course);
  if (!wlGate) return;
  const matchesList = wlGate.ProcessedMatchIds;
  if (!matchesList) return;

  var matchRows = matchesList
    .map(
      index =>
        matchesHistory[index] ||
        matchesHistory[index + "-" + playerData.arenaId]
    )
    .filter(
      match =>
        match !== undefined &&
        match.type === "match" &&
        (!match.archived || filters.showArchived)
    )
    .map(match => {
      let row = createMatchRow(match);
      expandDiv.appendChild(row);
      return row;
    });

  var newHeight = matchRows.length * 64 + 16;

  expandDiv.style.height = `${newHeight}px`;
}

module.exports = {
  openEventsTab: openEventsTab,
  expandEvent: expandEvent
};
