"use strict";
const { DEFAULT_TILE } = require("../shared/constants.js");
const db = require("../shared/database.js");
const { createDivision } = require("../shared/dom-fns");

class ListItem {
  constructor(_grpId, _id, _onClick, _onDelete = false, isArchived = false) {
    this.onClickCallback = _onClick;
    if (typeof _onDelete == "function") {
      this.onDeleteCallback = _onDelete;
    }

    this.id = _id;

    this.container = createDivision(["list_item_container", _id]);
    this.left = createDivision(["list_item_left"]);
    this.center = createDivision(["list_item_center"]);
    this.right = createDivision(["list_item_right"]);
    const archiveClass = isArchived
      ? "list_item_unarchive"
      : "list_item_archive";
    this.deleteButton = createDivision([archiveClass]);
    this.deleteButton.title = isArchived
      ? "restore"
      : "archive (will not delete data)";
    let cardObj = db.card(_grpId || DEFAULT_TILE);
    this.imageContainer = createDivision(["list_item_image"]);
    try {
      this.imageContainer.style.backgroundImage = `url(https://img.scryfall.com/cards${
        cardObj.images["art_crop"]
      })`;
    } catch (e) {
      console.log(e, _grpId);
    }

    this.container.appendChild(this.imageContainer);
    this.container.appendChild(this.left);
    this.container.appendChild(this.center);
    this.container.appendChild(this.right);

    // Add event listeners
    // All of these should be stored and removed when we 'unmount' the class
    if (_onDelete) {
      this.container.appendChild(this.deleteButton);
      this.deleteButton.addEventListener("click", e => {
        e.stopPropagation();
        this.onDeleteCallback(this.id);
        this.container.style.height = "0px";
        this.container.style.overflow = "hidden";
      });
    }

    this.imageContainer.style.opacity = 0.66;
    this.imageContainer.style.width = "128px";
    this.container.addEventListener("mouseover", () => {
      this.imageContainer.style.opacity = 1;
      this.imageContainer.style.width = "200px";
      if (_onDelete) {
        this.deleteButton.style.width = "32px";
      }
    });
    this.container.addEventListener("mouseout", () => {
      this.imageContainer.style.opacity = 0.66;
      this.imageContainer.style.width = "128px";
      if (_onDelete) {
        this.deleteButton.style.width = "4px";
      }
    });
    this.container.addEventListener("click", () => {
      this.onClickCallback(this.id);
    });

    return this;
  }

  divideLeft() {
    this.leftTop = createDivision(["flex_top"]);
    this.leftBottom = createDivision(["flex_bottom"]);
    this.left.style.flexDirection = "column";
    this.left.appendChild(this.leftTop);
    this.left.appendChild(this.leftBottom);
  }

  divideCenter() {
    this.centerTop = createDivision(["flex_top"]);
    this.centerBottom = createDivision(["flex_bottom"]);
    this.center.style.flexDirection = "column";
    this.center.appendChild(this.centerTop);
    this.center.appendChild(this.centerBottom);
  }

  divideRight() {
    this.rightTop = createDivision(["flex_top"]);
    this.rightBottom = createDivision(["flex_bottom"]);
    this.right.style.flexDirection = "column";
    this.right.appendChild(this.rightTop);
    this.right.appendChild(this.rightBottom);
  }
}

module.exports = ListItem;
