document.addEventListener("DOMContentLoaded", (event) => {
  const popup = document.getElementById("welcomePopup");
  const closeBtn = document.querySelector(".popup-close");

  if (popup) {
    // Show popup if there's a welcome message
    if (document.querySelector(".popup-body h2")) {
      popup.style.display = "flex";
    }

    // Close popup when clicking the close button
    closeBtn.addEventListener("click", () => {
      popup.style.display = "none";
    });

    // Close popup when clicking outside the content area
    window.addEventListener("click", (event) => {
      if (event.target === popup) {
        popup.style.display = "none";
      }
    });
  }
});
