/*
global
  createDivision,
  cardsDb,
  addCardHover,
  shell,
  get_wc_missing,
  get_set_scryfall,
*/

//
function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

var rarities = ["common", "uncommon", "rare", "mythic"];

//
function get_frame_class(frame) {
  if (frame.length == 0) {
    return "tile_c";
  }
  if (frame.length == 1) {
    if (frame.includes(1)) {
      return "tile_w";
    }
    if (frame.includes(2)) {
      return "tile_u";
    }
    if (frame.includes(3)) {
      return "tile_b";
    }
    if (frame.includes(4)) {
      return "tile_r";
    }
    if (frame.includes(5)) {
      return "tile_g";
    }
  }
  if (frame.length == 2) {
    if (frame.includes(4) && frame.includes(1)) {
      return "tile_wr";
    }
    if (frame.includes(1) && frame.includes(3)) {
      return "tile_wb";
    }
    if (frame.includes(1) && frame.includes(2)) {
      return "tile_uw";
    }
    if (frame.includes(2) && frame.includes(4)) {
      return "tile_ur";
    }
    if (frame.includes(2) && frame.includes(5)) {
      return "tile_ug";
    }
    if (frame.includes(2) && frame.includes(3)) {
      return "tile_ub";
    }
    if (frame.includes(4) && frame.includes(5)) {
      return "tile_rg";
    }
    if (frame.includes(5) && frame.includes(1)) {
      return "tile_gw";
    }
    if (frame.includes(3) && frame.includes(4)) {
      return "tile_br";
    }
    if (frame.includes(3) && frame.includes(5)) {
      return "tile_bg";
    }
  }
  if (frame.length > 2) {
    return "tile_multi";
  }
}

function get_rank_class(ranking) {
  switch (ranking) {
    case "A+":
      return "blue";
    case "A":
      return "blue";

    case "A-":
      return "green";
    case "B+":
      return "green";
    case "B":
      return "green";

    case "C-":
      return "orange";
    case "D+":
      return "orange";

    case "D":
      return "orange";
    case "D-":
      return "red";
    case "F":
      return "red";

    default:
      return "white";
  }
}

class DeckDrawer {
  constructor(div, deck) {
    this.div = div;
    this.deck = deck;
  }

  separator(i, number = 0) {
    var str = "";
    switch (i) {
      case 1:
        str = "Creature";
        break;
      case 2:
        str = "Planeswalker";
        break;
      case 3:
        str = "Instant";
        break;
      case 4:
        str = "Sorcery";
        break;
      case 5:
        str = "Artifact";
        break;
      case 6:
        str = "Enchantment";
        break;
      case 7:
        str = "Land";
        break;
      case 98:
        str = "Mainboard";
        break;
      case 99:
        str = "Sideboard";
        break;
      default:
        str = i;
        break;
    }
    if (number > 0) {
      str += ` (${number})`;
    }

    let element = this.div;
    if (element instanceof jQuery) {
      element = element[0];
    }
    element.appendChild(createDivision(["card_tile_separator"], str));
  }

  card(grpId, indent, quantity, showWildcards = false, isSideboard = false) {
    let element = this.div;
    let deck = this.deck || null;

    // if element is a jquery object convert to bare DOM element
    // TODO: Remove this once jQuery is removed.
    if (element instanceof jQuery) {
      element = element[0];
    }

    if (quantity !== 0) {
      var cont = createDivision(["card_tile_container", "click-on"]);

      cont.dataset["grpId"] = grpId;
      cont.dataset["id"] = indent;
      cont.dataset["quantity"] = quantity;

      var ww, ll;
      if (!isNumber(quantity)) {
        ww = 64;
        ll = 48;
        let col = get_rank_class(quantity);
        cont.appendChild(
          createDivision(["card_tile_odds", col], `<span>${quantity}</span>`)
        );
      } else if (quantity == 9999) {
        quantity = 1;
        ww = 32;
        ll = 17;

        let quantityDiv = createDivision(
          ["card_tile_quantity"],
          `<span>${quantity}</span>`
        );
        quantityDiv.style.cssText =
          "color: rgba(255, 255, 255, 0); min-width: 0px; width: 0px;";
        cont.appendChild(quantityDiv);
      } else {
        ww = 64;
        ll = 49;
        let quantityDiv = createDivision(
          ["card_tile_quantity"],
          `<span>${quantity}</span>`
        );
        cont.appendChild(quantityDiv);
      }
      element.appendChild(cont);
      var card = cardsDb.get(grpId);
      var cardTile = createDivision([
        "card_tile",
        get_frame_class(card ? card.frame : [])
      ]);
      cardTile.id = `t${grpId + indent}`;
      cardTile.style.cssText = `min-width: calc(100% - ${ww}px);`;
      // cardTile.style.minWidth = `calc(100% - ${ww}px)`;
      cont.appendChild(cardTile);

      // Glow hover
      var glow = createDivision(["card_tile_glow"]);
      glow.id = `t${grpId + indent}`;
      glow.style.cssText = `min-width: calc(100% - ${ww}px); left: calc(0px - 100% + ${ll}px)`;
      cont.appendChild(glow);

      if (card) {
        addCardHover(glow, card);
        glow.addEventListener("mouseenter", () => {
          cardTile.style.marginTop = "0";
        });
        glow.addEventListener("mouseleave", () => {
          cardTile.style.marginTop = "3px";
        });

        glow.addEventListener("click", () => {
          if (card.dfc == "SplitHalf") {
            card = cardsDb.get(card.dfcId);
          }
          shell.openExternal(
            `https://scryfall.com/card/${get_set_scryfall(card.set)}/${
              card.cid
            }/${card.name}`
          );
        });
      }

      //
      var fl = createDivision(["flex_item"]);
      fl.appendChild(
        createDivision(["card_tile_name"], card ? card.name : "Unknown")
      );
      cardTile.appendChild(fl);

      var fl2 = createDivision(["flex_item"]);
      fl2.style.lineHeight = "26px";
      cardTile.appendChild(fl2);

      if (!card) return cont;

      let prevc = true;
      const hasSplitCost = card.dfc === "SplitHalf";

      card.cost.forEach(cost => {
        if (hasSplitCost) {
          if (/^(x|\d)+$/.test(cost) && prevc === false) {
            fl2.innerHTML += "//";
          }
          prevc = /^\d+$/.test(cost);
        }
        fl2.appendChild(
          createDivision(["mana_s16", "flex_end", `mana_${cost}`])
        );
      });

      if (showWildcards) {
        if (card.type.indexOf("Basic Land") == -1) {
          let missing = 0;
          if (deck) {
            missing = get_wc_missing(deck, grpId, isSideboard);
          }

          let xoff = rarities.indexOf(card.rarity) * -24;

          if (missing > 0) {
            let yoff = missing * -24;

            var asasdf = createDivision(["not_owned_sprite"]);
            asasdf.style.cssText = `background-position: ${xoff}px ${yoff}px; left: calc(0px - 100% + ${ww -
              14}px);`;
            asasdf.title = `${missing} missing`;
            cont.appendChild(asasdf);
          }
        }
      }

      return cont;
    }
    return false;
  }
}

module.exports = DeckDrawer;
