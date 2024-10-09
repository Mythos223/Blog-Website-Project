$(document).ready(function () {
  // Initialize Bootstrap dropdowns
  $(".dropdown-toggle").dropdown();
  console.log('navar.js loaded');

  // Log user status for debugging
  console.log(
    "User status:",
    !!document.querySelector(".navbar-nav .dropdown")
  );
});


$(document).ready(function () {
  $(".dropdown-toggle").dropdown();

  const userDropdown = document.querySelector(".navbar-nav .dropdown");
  console.log("User dropdown element:", userDropdown);
  console.log("User status:", !!userDropdown);

  if (userDropdown) {
    console.log("User seems to be logged in");
  } else {
    console.log("User seems to be logged out");
  }
});
