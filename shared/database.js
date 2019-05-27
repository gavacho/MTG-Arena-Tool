const { ipcRenderer: ipc } = require("electron");
const fs = require("fs");

const otherKeys = [
  "sets",
  "events",
  "events_format",
  "cards",
  "ranked_events",
  "abilities",
  "ok"
];

// Some other things should go here later, like updating from MTGA Servers themselves.
class Database {
  constructor() {
    if (Database.instance) return Database.instance;

    this.handleSetDb = this.handleSetDb.bind(this);
    this.handleSetSeason = this.handleSetSeason.bind(this);
    if (ipc) ipc.on("set_db", this.handleSetDb);
    if (ipc) ipc.on("set_season", this.handleSetSeason);
    const dbUri = `${__dirname}/../resources/database.json`;
    const defaultDb = fs.readFileSync(dbUri, "utf8");
    this.handleSetDb(null, defaultDb);

    Database.instance = this;
  }

  handleSetDb(_event, arg) {
    try {
      this.data = JSON.parse(arg);
    } catch (e) {
      console.log("Error parsing metadata", e);
    }
  }

  handleSetSeason(_event, arg) {
    try {
      this.season = arg;
    } catch (e) {
      console.log("Error parsing metadata", e);
    }
  }

  get abilities() {
    return this.data.abilities;
  }

  get cards() {
    if (this.data.cards) return this.data.cards;
    const clone = { ...this.data };
    otherKeys.forEach(key => delete clone[key]);
    return clone;
  }

  get cardIds() {
    return Object.keys(this.cards);
  }

  get cardList() {
    return Object.values(this.cards);
  }

  get events() {
    return this.data.events;
  }

  get eventIds() {
    return Object.keys(this.data.events);
  }

  get eventList() {
    return Object.values(this.events);
  }

  get events_format() {
    return this.data.events_format;
  }

  get ranked_events() {
    return this.data.ranked_events;
  }

  get season_starts() {
    if (!this.season || !this.season.currentSeason) return new Date();
    return new Date(this.season.currentSeason.seasonStartTime);
  }

  get season_ends() {
    if (!this.season || !this.season.currentSeason) return new Date();
    return new Date(this.season.currentSeason.seasonEndTime);
  }

  get sets() {
    return this.data.sets;
  }

  card(id) {
    if (this.data.cards) return this.data.cards[id] || false;
    return this.data[id] || false;
  }

  event(id) {
    return this.events[id] || false;
  }

  get(key) {
    return this.data[key] || false;
  }

  getRankSteps(rank, tier, isLimited) {
    if (!this.season) return 0;
    let rankInfo;
    if (isLimited) {
      if (!this.season.limitedRankInfo) return 0;
      rankInfo = this.season.limitedRankInfo;
    } else {
      if (!this.season.constructedRankInfo) return 0;
      rankInfo = this.season.constructedRankInfo;
    }
    rankInfo.forEach(rank => {
      if (rank.rankClass === rank && rank.level === tier) {
        return rank.steps;
      }
    });
    return 0;
  }

  cardFromArt(artId) {
    const matches = this.cardList.filter(card => card.artid === artId);
    return matches.length ? matches[0] : false;
  }
}

module.exports = new Database();
