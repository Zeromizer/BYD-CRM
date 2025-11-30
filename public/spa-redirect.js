/**
 * Single Page Apps for GitHub Pages
 * This script checks if a redirect is present in the query string,
 * converts it back to the correct URL and adds it to the browser's history.
 *
 * This handles the 404.html redirect workaround for GitHub Pages SPA routing.
 */
(function(l) {
  if (l.search[1] === '/') {
    var decoded = l.search.slice(1).split('&').map(function(s) {
      return s.replace(/~and~/g, '&');
    }).join('?');
    window.history.replaceState(null, null,
      l.pathname.slice(0, -1) + decoded + l.hash
    );
  }
}(window.location));
