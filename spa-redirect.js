// GitHub Pages SPA redirect - restores the correct route from 404.html redirect
(function() {
  var redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;

  if (redirect && redirect !== location.href) {
    history.replaceState(null, null, redirect);
  }

  // Handle the query string redirect from 404.html
  var query = window.location.search;
  if (query && query.startsWith('?/')) {
    var decoded = query.slice(2).split('&').map(function(s) {
      return s.replace(/~and~/g, '&');
    }).join('?');

    var hash = window.location.hash;
    var newPath = '/' + decoded + hash;

    // Replace state without reloading
    history.replaceState(null, null,
      window.location.pathname.replace(/\/$/, '') + '/' + decoded + hash
    );
  }
})();
