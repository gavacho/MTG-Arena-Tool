/*
global
  createDivision
*/

/**
 * Creates a select box
 * This is a "fixed" version of SelectAdd and should replace it.
 **/
exports.createSelect = createSelect;
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
exports.selectAdd = selectAdd;
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
  document.addEventListener("click", () => {
    styledSelect.classList.remove("active");
  });
}

// several utility functions to replace useful jQuery methods
function wrap(element, wrapper) {
  element.parentNode.insertBefore(wrapper, element);
  wrapper.appendChild(element);
  return element;
}
