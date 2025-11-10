(function(){
  const observerMap = new WeakMap();

  function onIntersect(entries, obs){
    for(const entry of entries){
      if(entry.isIntersecting){
        const img = entry.target;
        const src = img.getAttribute('data-src');
        if(src){
          img.src = src;
          img.removeAttribute('data-src');
        }
        obs.unobserve(img);
      }
    }
  }

  let io;
  function ensureObserver(){
    if(!io){
      io = new IntersectionObserver(onIntersect, { root: null, rootMargin: '200px', threshold: 0.01 });
    }
    return io;
  }

  function observe(){
    const io = ensureObserver();
    const imgs = document.querySelectorAll('img.lazy-img[data-src]');
    for(const img of imgs){
      if(!observerMap.has(img)){
        io.observe(img);
        observerMap.set(img, true);
      }
    }
  }

  window.lazyLoad = { observe };
})();
