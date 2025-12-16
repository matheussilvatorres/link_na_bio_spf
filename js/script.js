document.addEventListener('DOMContentLoaded', () => {

    const sliderTrack = document.getElementById('js-slider-track');
    const btnPrev = document.getElementById('js-btn-prev');
    const btnNext = document.getElementById('js-btn-next');

    const slides = document.querySelectorAll('.gwf-bio__carrossel-slide');

    let currentIndex = 0;
    const totalSlides = slides.length;

    function updateSliderPosition() {
        sliderTrack.style.transition = "transform 0.3s ease";
        sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    btnNext.addEventListener('click', () => {
        currentIndex = currentIndex < totalSlides - 1 ? currentIndex + 1 : 0;
        updateSliderPosition();
    });

    btnPrev.addEventListener('click', () => {
        currentIndex = currentIndex > 0 ? currentIndex - 1 : totalSlides - 1;
        updateSliderPosition();
    });

    // Mobile
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    sliderTrack.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        sliderTrack.style.transition = "none"; 
    });

    sliderTrack.addEventListener("touchmove", (e) => {
        if (!isDragging) return;

        currentX = e.touches[0].clientX;
        const diff = currentX - startX;

        sliderTrack.style.transform = `translateX(calc(-${currentIndex * 100}% + ${diff}px))`;
    });

    sliderTrack.addEventListener("touchend", () => {
        isDragging = false;

        const diff = currentX - startX;

        // Sensibilidade do swipe (mínimo necessário para trocar)
        const swipeThreshold = 50;

        if (diff > swipeThreshold) {
            // swipe para direita (voltar)
            currentIndex = currentIndex > 0 ? currentIndex - 1 : totalSlides - 1;
        } else if (diff < -swipeThreshold) {
            // swipe para esquerda (avançar)
            currentIndex = currentIndex < totalSlides - 1 ? currentIndex + 1 : 0;
        }

        updateSliderPosition();
    });

});
