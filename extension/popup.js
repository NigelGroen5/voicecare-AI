document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("testBtn");
  
    button.addEventListener("click", () => {
      console.log("Button clicked!");
      alert("popup.js is running 🚀");
    });
  });  