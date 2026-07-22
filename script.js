window.addEventListener("load", function () {

    const splash = document.getElementById("splash-screen");
    const content = document.getElementById("website-content");

    setTimeout(function () {

        splash.style.display = "none";
        content.style.opacity = "1";

    }, 2500);

});
