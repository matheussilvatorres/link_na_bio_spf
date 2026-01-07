document.addEventListener('DOMContentLoaded', () => {
    const sliderTrack = document.getElementById('js-slider-track');
    const btnPrev = document.getElementById('js-btn-prev');
    const btnNext = document.getElementById('js-btn-next');
    const slides = document.querySelectorAll('.gwf-bio__carrossel-slide');

    let currentIndex = 0;
    const totalSlides = slides.length;
    const intervalTime = 4000; // Tempo em milissegundos (4 segundos)
    let autoSlideInterval;

    function updateSliderPosition() {
        sliderTrack.style.transition = "transform 0.3s ease";
        sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    function nextSlide() {
        currentIndex = (currentIndex + 1) % totalSlides;
        updateSliderPosition();
    }

    function prevSlide() {
        currentIndex = (currentIndex - 1 + totalSlides) % totalSlides;
        updateSliderPosition();
    }

    // Iniciar o carrossel automático
    function startAutoSlide() {
        stopAutoSlide(); // Limpa qualquer intervalo existente antes de iniciar
        autoSlideInterval = setInterval(nextSlide, intervalTime);
    }

    // Parar o carrossel automático
    function stopAutoSlide() {
        clearInterval(autoSlideInterval);
    }

    // Eventos de clique
    btnNext.addEventListener('click', () => {
        nextSlide();
        startAutoSlide(); // Reinicia o timer ao interagir
    });

    btnPrev.addEventListener('click', () => {
        prevSlide();
        startAutoSlide(); // Reinicia o timer ao interagir
    });

    // Mobile / Touch
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    sliderTrack.addEventListener("touchstart", (e) => {
        stopAutoSlide(); // Pausa o automático enquanto o usuário toca
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
        const swipeThreshold = 50;

        if (diff > swipeThreshold) {
            prevSlide();
        } else if (diff < -swipeThreshold) {
            nextSlide();
        } else {
            updateSliderPosition();
        }

        startAutoSlide(); // Retoma o automático após soltar
    });

    // Inicia o carrossel assim que a página carrega
    startAutoSlide();
});