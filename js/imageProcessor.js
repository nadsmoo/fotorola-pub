// imageProcessor.js

// Export an object with all the functions directly
export const imageProcessor = {
    // Global default quality for WebP thumbnails
    _webpQuality: 0.75,

    // Load image from array buffer
    getUrlFromImageByteArray: async function (imageData) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([imageData]);
            const url = URL.createObjectURL(blob);
            const img = new Image();

            img.onload = () => {
                resolve({
                    width: img.width,
                    height: img.height,
                    url: url
                });
            };

            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = url;
        });
    },
    resizeWithoutBorder: async function (imageUrl, width, height) {
        return new Promise(async (resolve, reject) => {
            try {
                const img = new Image();
                img.onload = async () => {
                    const thumbAspectRatio = width / height;
                    const imageAspectRatio = img.width / img.height;

                    let shrunkenImageUrl;
                    let shrunkenImageData;

                    if (thumbAspectRatio > imageAspectRatio) {
                        // Image is taller relative to target - fit by width
                        const newHeight = Math.floor((width / img.width) * img.height);
                        shrunkenImageData = await this.constrainProportions(imageUrl, width, newHeight);
                    } else {
                        // Image is wider relative to target - fit by height
                        const newWidth = Math.floor((height / img.height) * img.width);
                        shrunkenImageData = await this.constrainProportions(imageUrl, newWidth, height);
                    }

                    // Convert byte array back to URL for cropping (as WebP)
                    const blob = new Blob([shrunkenImageData], { type: 'image/webp' });
                    shrunkenImageUrl = URL.createObjectURL(blob);

                    // Now crop to exact dimensions (center anchor)
                    const croppedData = await this.crop(shrunkenImageUrl, width, height, 'center');

                    // Clean up temporary URL
                    URL.revokeObjectURL(shrunkenImageUrl);

                    resolve(croppedData);
                };
                img.onerror = () => reject(new Error("Failed to load image"));
                img.src = imageUrl;
            } catch (error) {
                reject(error);
            }
        });
    },
    constrainProportions: async function (imageUrl, width, height) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const sourceWidth = img.width;
                const sourceHeight = img.height;

                const thumbAspectRatio = width / height;
                const aspectRatio = sourceWidth / sourceHeight;

                let newWidth, newHeight;

                if (aspectRatio > thumbAspectRatio) {
                    // Image is wider than the target aspect ratio
                    newWidth = width;
                    newHeight = Math.ceil(width / aspectRatio);
                } else {
                    // Image is taller than the target aspect ratio
                    newWidth = Math.floor(aspectRatio * height);
                    newHeight = height;
                }

                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                canvas.toBlob(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(new Uint8Array(reader.result));
                    };
                    reader.onerror = () => reject(new Error("Failed to read resized image"));
                    reader.readAsArrayBuffer(blob);
                }, 'image/webp', this._webpQuality);
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = imageUrl;
        });
    },
    crop: async function (imageUrl, width, height, anchorPosition) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const sourceWidth = img.width;
                const sourceHeight = img.height;
                let destX = 0;
                let destY = 0;

                const nPercentW = width / sourceWidth;
                const nPercentH = height / sourceHeight;
                let nPercent;

                if (nPercentH < nPercentW) {
                    nPercent = nPercentW;
                    switch (anchorPosition.toLowerCase()) {
                        case 'top':
                            destY = 0;
                            break;
                        case 'bottom':
                            destY = Math.floor(height - (sourceHeight * nPercent));
                            break;
                        default: // 'center'
                            destY = Math.floor((height - (sourceHeight * nPercent)) / 2);
                            break;
                    }
                } else {
                    nPercent = nPercentH;
                    switch (anchorPosition.toLowerCase()) {
                        case 'left':
                            destX = 0;
                            break;
                        case 'right':
                            destX = Math.floor(width - (sourceWidth * nPercent));
                            break;
                        default: // 'center'
                            destX = Math.floor((width - (sourceWidth * nPercent)) / 2);
                            break;
                    }
                }

                const destWidth = Math.floor(sourceWidth * nPercent);
                const destHeight = Math.floor(sourceHeight * nPercent);

                // Create canvas with target dimensions
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                // Fill with transparent background
                ctx.clearRect(0, 0, width, height);

                // Draw the scaled image at the calculated position
                ctx.drawImage(img, destX, destY, destWidth, destHeight);

                canvas.toBlob(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(new Uint8Array(reader.result));
                    };
                    reader.onerror = () => reject(new Error("Failed to read cropped image"));
                    reader.readAsArrayBuffer(blob);
                }, 'image/webp', this._webpQuality);
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = imageUrl;
        });
    },
    getArrayFromImageUrl: async function (imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);

                canvas.toBlob(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(new Uint8Array(reader.result));
                    };
                    reader.onerror = () => reject(new Error("Failed to read image as byte array"));
                    reader.readAsArrayBuffer(blob);
                }, 'image/webp', this._webpQuality);
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = imageUrl;
        });
    },
    // Resize image and return as byte array
    resizeImage: async function (imageUrl, width, height) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP blob
                canvas.toBlob(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        // Return as ArrayBuffer
                        resolve(new Uint8Array(reader.result));
                    };
                    reader.readAsArrayBuffer(blob);
                }, 'image/webp', this._webpQuality);
            };
            img.src = imageUrl;
        });
    },
    // Generate multiple thumbnails and return as array of byte arrays
    generateThumbnails: async function (imageUrl, sizes) {
        const thumbnails = {};

        for (const size of sizes) {
            const data = await this.resizeImage(imageUrl, size.width, size.height);
            thumbnails[size.name] = data; // WebP bytes
        }

        return thumbnails;
    },
    // Calculate image signature (average color per region)
    generateImageSignature: async function (imageUrl, regionsX, regionsY) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);

                const regionWidth = Math.floor(img.width / regionsX);
                const regionHeight = Math.floor(img.height / regionsY);
                const signature = [];

                for (let y = 0; y < regionsY; y++) {
                    for (let x = 0; x < regionsX; x++) {
                        const data = ctx.getImageData(
                            x * regionWidth,
                            y * regionHeight,
                            regionWidth,
                            regionHeight
                        ).data;

                        // Average color in region
                        let r = 0, g = 0, b = 0;
                        for (let i = 0; i < data.length; i += 4) {
                            r += data[i];
                            g += data[i + 1];
                            b += data[i + 2];
                        }

                        const pixelCount = data.length / 4;
                        signature.push({
                            r: Math.floor(r / pixelCount),
                            g: Math.floor(g / pixelCount),
                            b: Math.floor(b / pixelCount)
                        });
                    }
                }

                resolve(signature);
            };
            img.src = imageUrl;
        });
    },
    loadPixelData: async function (imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(img, 0, 0);

                // Get RGBA pixel data
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const rgbaData = imageData.data;

                // Extract only RGB values (skip alpha)
                const rgbData = new Uint8Array((rgbaData.length / 4) * 3);
                let rgbIndex = 0;

                for (let i = 0; i < rgbaData.length; i += 4) {
                    rgbData[rgbIndex++] = rgbaData[i];     // Red
                    rgbData[rgbIndex++] = rgbaData[i + 1]; // Green
                    rgbData[rgbIndex++] = rgbaData[i + 2]; // Blue
                    // Skip rgbaData[i + 3] (Alpha)
                }

                resolve({
                    width: img.width,
                    height: img.height,
                    pixelData: rgbData // Uint8Array with only RGB values (3 bytes per pixel)
                });
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = imageUrl;
        });
    },
    createImageUrlFromRgbMetadata: async function (rgbData, width, height) {
        return new Promise((resolve, reject) => {
            try {
                // Create canvas with specified dimensions
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                // Create ImageData object
                const imageData = ctx.createImageData(width, height);
                const data = imageData.data;

                // Convert RGB to RGBA (add alpha channel)
                let rgbIndex = 0;
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = rgbData[rgbIndex++];     // Red
                    data[i + 1] = rgbData[rgbIndex++]; // Green
                    data[i + 2] = rgbData[rgbIndex++]; // Blue
                    data[i + 3] = 255;                 // Alpha (fully opaque)
                }

                // Put the image data on the canvas
                ctx.putImageData(imageData, 0, 0);

                // Convert canvas to blob and create URL (WebP)
                canvas.toBlob(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    } else {
                        reject(new Error("Failed to create blob from canvas"));
                    }
                }, 'image/webp', this._webpQuality);

            } catch (error) {
                reject(error);
            }
        });
    },
    createCanvas: function (width, height, id) {
        // Remove existing canvas with same ID if it exists
        const existingCanvas = document.getElementById(id);
        if (existingCanvas) {
            existingCanvas.remove();
        }

        // Create new canvas
        const canvas = document.createElement('canvas');
        canvas.id = id;
        canvas.width = width;
        canvas.height = height;

        // Apply basic styling
        canvas.style.display = 'block';

        // Add to document body but hide it
        canvas.style.position = 'absolute';
        canvas.style.left = '-9999px';
        document.body.appendChild(canvas);

        // Initialize context with optimizations
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, width, height);
        // Add console logging for debugging
        console.log(`Canvas created with ID: ${id}, width: ${width}, height: ${height}`);
        console.log(`Canvas exists in DOM: ${document.getElementById(id) !== null}`);

    },
    getImageUrlFromCanvas: async function (canvas) {
        return new Promise((resolve, reject) => {
            try {
                // If canvas is a string, get the canvas element by ID
                if (typeof canvas === 'string') {
                    const canvasElement = document.getElementById(canvas);
                    if (!canvasElement) {
                        reject(new Error(`Canvas with ID ${canvas} not found`));
                        return;
                    }
                    canvas = canvasElement;
                }
                // Convert to data URL (WebP)
                const dataUrl = canvas.toDataURL('image/webp', this._webpQuality);
                resolve(dataUrl);

            } catch (error) {
                reject(error);
            }
        });
    },
    placeImageOnCanvas: async function (canvas, imageUrl, x, y, width = null, height = null, opacity = null, contrastPercent = null) {
        // Handle both string ID and canvas element
        let canvasElement;
        if (typeof canvas === 'string') {
            canvasElement = document.getElementById(canvas);
            if (!canvasElement) {
                console.error(`Canvas with ID ${canvas} not found`);
                return Promise.reject(new Error(`Canvas with ID ${canvas} not found`));
            }
        } else {
            canvasElement = canvas;
        }

        const ctx = canvasElement.getContext('2d');

        // Return a promise that resolves when the image is loaded
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                const w = (width ?? img.width);
                const h = (height ?? img.height);
                ctx.save();
                if (opacity != null) ctx.globalAlpha = opacity;
                if (contrastPercent != null) ctx.filter = `contrast(${contrastPercent}%)`;
                ctx.drawImage(img, x, y, w, h);
                ctx.restore();
                console.log(`Image placed at x:${x}, y:${y}, size:${w}x${h}, opacity:${opacity ?? 1}, contrast:${contrastPercent ?? 100}`);
                resolve();
            };

            img.onerror = () => {
                console.error(`Failed to load image: ${imageUrl}`);
                reject(new Error(`Failed to load image: ${imageUrl}`));
            };

            // Accept full URLs (data:, blob:, http) or raw base64 without prefix
            if (typeof imageUrl === 'string' && (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:') || imageUrl.startsWith('http'))) {
                img.src = imageUrl;
            } else {
                img.src = `data:image/webp;base64,${imageUrl}`;
            }
        });
    },
    cleanup: function (url) {
        URL.revokeObjectURL(url);
    }
}

