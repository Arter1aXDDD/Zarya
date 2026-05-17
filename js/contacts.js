document.documentElement.classList.add("has-js");

document.addEventListener("DOMContentLoaded", () => {
    initializeActiveContactNav();
    initializeRouteSlider();
});

function initializeActiveContactNav() {
    const links = document.querySelectorAll(".nav a[data-nav]");
    if (!links.length) {
        return;
    }

    const path = (location.pathname || "").toLowerCase();
    let active = "home";

    if (path.endsWith("company.html")) active = "company";
    else if (path.endsWith("contacts.html")) active = "contacts";
    else if (path.endsWith("catalog.html")) active = "catalog";
    else if (path.endsWith("news.html")) active = "news";

    links.forEach((link) => link.classList.toggle("is-active", link.dataset.nav === active));
}

function initializeRouteSlider() {
    const slider = document.querySelector("[data-route-slider]");
    if (!slider) {
        return;
    }

    const viewport = slider.querySelector(".route-slider-viewport");
    const slides = Array.from(slider.querySelectorAll(".route-slide"));
    const dots = Array.from(slider.querySelectorAll("[data-route-dot]"));
    const prevButton = slider.querySelector("[data-route-prev]");
    const nextButton = slider.querySelector("[data-route-next]");

    if (!viewport || slides.length < 2) {
        return;
    }

    let currentIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));
    if (currentIndex < 0) {
        currentIndex = 0;
    }

    const render = () => {
        slides.forEach((slide, index) => {
            slide.classList.toggle("is-active", index === currentIndex);
        });

        dots.forEach((dot, index) => {
            const isActive = index === currentIndex;
            dot.classList.toggle("is-active", isActive);

            if (isActive) {
                dot.setAttribute("aria-current", "true");
            }
            else {
                dot.removeAttribute("aria-current");
            }
        });
    };

    const goTo = (index) => {
        currentIndex = (index + slides.length) % slides.length;
        render();
    };

    const goPrev = () => {
        goTo(currentIndex - 1);
    };

    const goNext = () => {
        goTo(currentIndex + 1);
    };

    prevButton?.addEventListener("click", goPrev);
    nextButton?.addEventListener("click", goNext);

    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            goTo(index);
        });
    });

    slider.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            goPrev();
        }
        else if (event.key === "ArrowRight") {
            goNext();
        }
    });

    let activePointerId = null;
    let startX = 0;
    let startY = 0;
    const swipeThreshold = 42;

    const resetPointer = () => {
        activePointerId = null;
        slider.classList.remove("is-dragging");
    };

    viewport.addEventListener("dragstart", (event) => {
        event.preventDefault();
    });

    viewport.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        activePointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        slider.classList.add("is-dragging");
        viewport.setPointerCapture?.(event.pointerId);
    });

    viewport.addEventListener("pointerup", (event) => {
        if (activePointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - startX;
        const deltaY = Math.abs(event.clientY - startY);

        viewport.releasePointerCapture?.(event.pointerId);
        resetPointer();

        if (Math.abs(deltaX) < swipeThreshold || deltaY > 120) {
            return;
        }

        if (deltaX < 0) {
            goNext();
        }
        else {
            goPrev();
        }
    });

    viewport.addEventListener("pointercancel", () => {
        resetPointer();
    });

    render();
}
