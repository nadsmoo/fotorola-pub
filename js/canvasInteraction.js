// Canvas interaction module with zoom, pan, touch, and wheel support
export function initCanvasInteraction(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Store original dimensions
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    // Save dimensions as data attributes for reference
    canvas.dataset.originalWidth = originalWidth;
    canvas.dataset.originalHeight = originalHeight;
    console.log(canvas.dataset.originalWidth);
    console.log(canvas.dataset.originalHeight);
    // State variables
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isPanning = false;
    let startX, startY;
    let lastTouchDistance = 0;

    const container = canvas.parentElement;

    // Apply initial transform
    applyTransform();

    // Fit canvas to container initially
    fitToContainer();

    // Helper function to apply transform
    function applyTransform() {
        canvas.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        canvas.style.transformOrigin = '0 0';
    }

    // Reset to fit container
    function fitToContainer() {
        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        const scaleX = containerWidth / originalWidth;
        const scaleY = containerHeight / originalHeight;
        scale = Math.min(scaleX, scaleY) * 0.95; // 95% to add a small margin

        // Center the canvas
        offsetX = (containerWidth - originalWidth * scale) / 2;
        offsetY = (containerHeight - originalHeight * scale) / 2;

        applyTransform();
    }

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
        e.preventDefault();

        // Get mouse position relative to canvas
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - offsetX;
        const mouseY = e.clientY - rect.top - offsetY;

        // Normalize mouseX and mouseY to canvas space
        const normX = mouseX / scale;
        const normY = mouseY / scale;

        // Calculate zoom factor
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Zoom in or out

        // Apply zoom
        scale *= zoomFactor;

        // Limit scale
        scale = Math.min(Math.max(0.1, scale), 10);

        // Adjust offset to zoom into/out of mouse position
        offsetX = e.clientX - rect.left - normX * scale;
        offsetY = e.clientY - rect.top - normY * scale;

        applyTransform();
    });

    // Mouse pan (middle button)
    container.addEventListener('mousedown', (e) => {
        // Middle mouse button (button 1) or left button (button 0)
        if (e.button === 1 || e.button === 0) {
            e.preventDefault();
            isPanning = true;
            startX = e.clientX - offsetX;
            startY = e.clientY - offsetY;
            container.style.cursor = 'grabbing';
        }
    });

    container.addEventListener('mousemove', (e) => {
        if (isPanning) {
            e.preventDefault();
            offsetX = e.clientX - startX;
            offsetY = e.clientY - startY;
            applyTransform();
        }
    });

    container.addEventListener('mouseup', () => {
        isPanning = false;
        container.style.cursor = 'default';
    });

    container.addEventListener('mouseleave', () => {
        isPanning = false;
        container.style.cursor = 'default';
    });

    // Touch events for pinch zoom and pan
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();

            // Get distance between two fingers
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        } else if (e.touches.length === 1) {
            e.preventDefault();
            isPanning = true;
            startX = e.touches[0].clientX - offsetX;
            startY = e.touches[0].clientY - offsetY;
        }
    });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();

            // Calculate new distance
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const newTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );

            // Calculate zoom factor
            const zoomFactor = newTouchDistance / lastTouchDistance;

            // Get center point between fingers
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;

            // Get canvas rectangle
            const rect = canvas.getBoundingClientRect();

            // Get position relative to canvas
            const mouseX = centerX - rect.left - offsetX;
            const mouseY = centerY - rect.top - offsetY;

            // Normalize to canvas space
            const normX = mouseX / scale;
            const normY = mouseY / scale;

            // Apply zoom
            scale *= zoomFactor;

            // Limit scale
            scale = Math.min(Math.max(0.1, scale), 10);

            // Adjust offset to zoom into center of pinch
            offsetX = centerX - rect.left - normX * scale;
            offsetY = centerY - rect.top - normY * scale;

            applyTransform();

            // Update distance
            lastTouchDistance = newTouchDistance;
        } else if (e.touches.length === 1 && isPanning) {
            e.preventDefault();
            offsetX = e.touches[0].clientX - startX;
            offsetY = e.touches[0].clientY - startY;
            applyTransform();
        }
    });

    container.addEventListener('touchend', () => {
        isPanning = false;
    });

    // Export methods
    return {
        zoomIn: () => {
            scale *= 1.2;
            applyTransform();
        },
        zoomOut: () => {
            scale *= 0.8;
            applyTransform();
        },
        reset: fitToContainer,
        getCurrentScale: () => scale,
        applyScale: (newScale) => {
            scale = newScale;
            applyTransform();
        }
    };
}