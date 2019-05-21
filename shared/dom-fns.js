// Mostly an alias to document.querySelectorAll but
// allows second argument to specify an alternative parent
// Also returns an array.
// Usage:
// queryElements(".classname").forEach(el => do_something(el))
// queryElements("#elementId")
// queryElements("#elementId", otherElement)
exports.queryElements = queryElements;
function queryElements(selectors, parentNode = document) {
  return [...parentNode.querySelectorAll(selectors)];
}

exports.queryElementsByClass = queryElementsByClass;
function queryElementsByClass(selectors, parentNode = document) {
  return [...parentNode.getElementsByClassName(selectors)];
}

exports.createDivision = createDivision;
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
