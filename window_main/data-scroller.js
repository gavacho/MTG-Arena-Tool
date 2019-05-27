"use strict";
/*
global
  $
  hideLoadingBars
  showLoadingBars
*/

const { createDivision } = require("../shared/dom-fns");

class DataScroller {
  constructor(container, renderData, loadAmount, maxDataIndex) {
    this.container = container;
    this.renderData = renderData;
    this.loadAmount = loadAmount || 20;
    this.maxDataIndex = maxDataIndex || 0;
    this.renderRows = this.renderRows.bind(this);
    return this;
  }

  render(loadMore) {
    const d = createDivision(["list_fill"]);
    this.container.appendChild(d);
    this.loaded = 0;
    this.dataIndex = 0;

    this.renderRows(loadMore || this.loadAmount);

    const jCont = $(this.container);
    jCont.off();
    jCont.on("scroll", () => {
      const desiredHeight = Math.round(jCont.scrollTop() + jCont.innerHeight());
      if (desiredHeight >= jCont[0].scrollHeight) {
        this.renderRows(this.loadAmount);
      }
    });
  }

  renderRows(loadMore) {
    showLoadingBars();
    const loadEnd = this.loaded + loadMore;
    while (this.loaded < loadEnd && this.dataIndex < this.maxDataIndex) {
      this.loaded += this.renderData(this.container, this.dataIndex);
      this.dataIndex++;
    }
    hideLoadingBars();
  }
}

module.exports = DataScroller;
