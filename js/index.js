// jshint ignore: start
/*global $*/
$(document).ready(() => {
  const $navItems = $(".AppHeader nav .navbar-nav li a");
  $navItems.off("click").on("click", function() {
    $navItems
      .parent()
      .siblings()
      .removeClass("active");
    $(this)
      .parent()
      .addClass("active");
  });
});
