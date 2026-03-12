/* Banner Slider (fade + dots) */
(function(){
  function initSlider(slider){
    const slides = Array.from(slider.querySelectorAll('.banner-slides .banner-slide'));
    const dots = Array.from(slider.querySelectorAll('.banner-dots .banner-dot'));
    if(slides.length <= 1) return;

    let index = 0;
    const interval = parseInt(slider.getAttribute('data-interval') || '2000', 10);
    const autoplay = (slider.getAttribute('data-autoplay') || 'true') !== 'false';
    let timer = null;

    function setActive(i){
      index = (i + slides.length) % slides.length;
      slides.forEach((s, idx) => s.classList.toggle('active', idx === index));
      dots.forEach((d, idx) => d.classList.toggle('active', idx === index));
    }

    function next(){ setActive(index + 1); }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        stop();
        setActive(i);
        if(autoplay) start();
      });
    });

    function start(){
      if(timer) return;
      timer = setInterval(next, interval);
    }

    function stop(){
      if(!timer) return;
      clearInterval(timer);
      timer = null;
    }

    // Pause on hover/focus for desktop usability
    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', () => { if(autoplay) start(); });
    slider.addEventListener('focusin', stop);
    slider.addEventListener('focusout', () => { if(autoplay) start(); });

    setActive(0);
    if(autoplay) start();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.banner-slider').forEach(initSlider);
  });
})();
