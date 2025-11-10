export function getRelativePos(container, clientX, clientY) {
  const rect = container.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function getSizes(container, img) {
  const c = container.getBoundingClientRect();
  const i = img.naturalWidth && img.naturalHeight
    ? { w: img.naturalWidth, h: img.naturalHeight }
    : img.getBoundingClientRect();
  return {
    containerWidth: c.width,
    containerHeight: c.height,
    imageWidth: i.w || i.width || 0,
    imageHeight: i.h || i.height || 0
  };
}

export function getRect(container) {
  const r = container.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}
