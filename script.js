window.addEventListener("load", () => {

    const splash = document.getElementById("splash-screen");
    const site = document.getElementById("website-content");

    setTimeout(() => {

        splash.classList.add("hide");
        site.classList.add("show");

        setTimeout(() => {
            splash.remove();
        },1000);

    },2500);

});
