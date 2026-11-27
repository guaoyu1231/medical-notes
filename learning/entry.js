const libraryRoutes = new Set(["note", "node", "catalog", "updates", "search", "about"]);
function openLibraryLink() {
  const route = location.hash.slice(1).split("/")[0];
  if (!libraryRoutes.has(route)) return false;
  location.replace(new URL("library.html" + location.hash, document.baseURI));
  return true;
}
if (!openLibraryLink()) {
  window.addEventListener("hashchange", openLibraryLink);
  await import("./app.js");
}
