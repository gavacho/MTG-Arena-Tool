const nthLastIndexOf = require("./nth-last-index-of");
const jsonText = require("./json-text");
const { unleakString } = require("../background-util");

const CONNECTION_JSON_PATTERN = /\[(?:UnityCrossThreadLogger|Client GRE)\]WebSocketClient (.*) WebSocketSharp\.WebSocket connecting to .*: (.*)(?:\r\n|\n)/;

const LABEL_JSON_PATTERNS = [
  /\[Client GRE\](?<timestamp>.*): (?:Match to )?(?<playerId>.*)(?: to Match)?: (?<label>.*)(?:\r\n|\n)\[Message (.*)\]/,
  /\[Client GRE\](?<timestamp>.*): (?:Match to )?(?<playerId>.*)(?: to Match)?: (?<label>.*)(?:\r\n|\n)/,
  /\[UnityCrossThreadLogger\](?<timestamp>.*)(?:\r\n|\n){0,}\(.*\) Incoming (?<label>.*) /,
  /\[UnityCrossThreadLogger\]Received unhandled GREMessageType: (?<label>.*)(?:\r\n|\n)/
];

const LABEL_ARROW_JSON_PATTERN = /\[UnityCrossThreadLogger\](.*)(?:\r\n|\n)([<=]=[=>]) (.*)\(.*\):?(?:\r\n|\n)/;

const ALL_PATTERNS = [
  CONNECTION_JSON_PATTERN,
  ...LABEL_JSON_PATTERNS,
  LABEL_ARROW_JSON_PATTERN
];

const maxLinesOfAnyPattern = Math.max(
  ...ALL_PATTERNS.map(regex => occurrences(regex.source, /\\n/g))
);

const logEntryPattern = new RegExp(
  `(${ALL_PATTERNS.map(re => re.source.replace(/\(\?<\w*>/g, "(")).join("|")})`,
  "g"
);

function ArenaLogDecoder() {
  let buffer = "";
  let bufferDiscarded = 0;
  return { append };

  function append(newText, callback) {
    logEntryPattern.lastIndex = 0;

    buffer = buffer.length ? buffer.concat(newText) : newText;
    let bufferUsed = false;
    let match;
    while ((match = logEntryPattern.exec(buffer))) {
      const [type, length, entry] = parseLogEntry(
        buffer,
        match[0],
        match.index
      );
      switch (type) {
        case "invalid":
          bufferUsed = match.index + length;
          break;
        case "partial":
          bufferUsed = match.index;
          break;
        case "full":
          bufferUsed = match.index + length;
          callback({
            ...entry,
            position: bufferDiscarded + match.index
          });
          break;
      }
    }

    if (bufferUsed === false) {
      const i = nthLastIndexOf(buffer, "\n", maxLinesOfAnyPattern);
      bufferUsed = i === -1 ? 0 : i;
    }

    if (bufferUsed > 0) {
      bufferDiscarded += bufferUsed;
      buffer = unleakString(buffer.substr(bufferUsed));
    }
  }
}

function parseLogEntry(text, matchText, position) {
  let rematches;
  if ((rematches = matchText.match(CONNECTION_JSON_PATTERN))) {
    return [
      "full",
      matchText.length,
      {
        type: "connection",
        client: JSON.parse(rematches[1]),
        socket: JSON.parse(rematches[2])
      }
    ];
  }

  if ((rematches = matchText.match(LABEL_ARROW_JSON_PATTERN))) {
    const jsonStart = position + matchText.length;
    if (jsonStart >= text.length) {
      return ["partial"];
    }
    if (!jsonText.starts(text, jsonStart)) {
      return ["invalid", matchText.length];
    }

    const jsonLen = jsonText.length(text, jsonStart);
    if (jsonLen === -1) {
      return ["partial"];
    }

    let textAfterJson = text.substr(jsonStart + jsonLen, 2);
    if (textAfterJson !== "\r\n") {
      textAfterJson = text.substr(jsonStart + jsonLen, 1);
      if (textAfterJson !== "\n") {
        return ["partial"];
      }
    }

    return [
      "full",
      matchText.length + jsonLen + textAfterJson.length,
      {
        type: "label_arrow_json",
        label: rematches[3],
        arrow: rematches[2],
        timestamp: rematches[1],
        json: () => JSON.parse(text.substr(jsonStart, jsonLen))
      }
    ];
  }

  for (let pattern of LABEL_JSON_PATTERNS) {
    rematches = matchText.match(pattern);
    if (!rematches) continue;

    const jsonStart = position + matchText.length;
    if (jsonStart >= text.length) {
      return ["partial"];
    }
    if (!jsonText.starts(text, jsonStart)) {
      return ["invalid", matchText.length];
    }

    const jsonLen = jsonText.length(text, jsonStart);
    if (jsonLen === -1) {
      return ["partial"];
    }

    let textAfterJson = text.substr(jsonStart + jsonLen, 2);
    if (textAfterJson !== "\r\n") {
      textAfterJson = text.substr(jsonStart + jsonLen, 1);
      if (textAfterJson !== "\n") {
        return ["partial"];
      }
    }

    return [
      "full",
      matchText.length + jsonLen + textAfterJson.length,
      {
        type: "label_json",
        ...rematches.groups,
        json: () => JSON.parse(text.substr(jsonStart, jsonLen))
      }
    ];
  }

  // we should never get here. instead, we should
  // have returned a 'partial' or 'invalid' result
  throw new Error("Could not parse an entry");
}

function occurrences(text, re) {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

module.exports = ArenaLogDecoder;
