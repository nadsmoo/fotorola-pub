// Google Photos Picker interop for Blazor WASM
// - Dynamically loads Google Identity Services + gapi picker
// - Requests an OAuth token for the Photos scope
// - Opens the Google-hosted Photos Picker and returns selections

let gsiLoaded = false;
let gapiLoaded = false;

async function ensureScript(src) {
    return new Promise((resolve, reject) => {
        // Avoid duplicate loads
        if ([...document.scripts].some(s => s.src === src)) {
            resolve();
            return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(s);
    });
}

async function ensureGsi() {
    if (gsiLoaded && window.google?.accounts?.oauth2) return;
    await ensureScript("https://accounts.google.com/gsi/client");
    if (!window.google?.accounts?.oauth2) {
        throw new Error("Google Identity Services failed to load.");
    }
    gsiLoaded = true;
}

async function ensureGapiPicker() {
    if (gapiLoaded && window.gapi && window.google?.picker) return;
    await ensureScript("https://apis.google.com/js/api.js");
    await new Promise((resolve, reject) => {
        if (!window.gapi) {
            reject(new Error("gapi failed to load."));
            return;
        }
        window.gapi.load("picker", { callback: resolve, onerror: reject });
    });
    if (!window.google?.picker) {
        throw new Error("Google Picker API failed to load.");
    }
    gapiLoaded = true;
}

function requestAccessToken(clientId, scopes) {
    const scope = Array.isArray(scopes) ? scopes.join(" ") : String(scopes ?? "");
    return new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope,
            // Prompt only if user hasn't consented yet. Change to 'consent' if you always want the prompt.
            prompt: "consent",
            callback: (resp) => {
                if (resp && resp.access_token) {
                    console.log('Successfully obtained access token:', resp.access_token);
                    resolve(resp.access_token);
                } else {
                    console.error('Failed to obtain access token:', resp); // Log the full response for more details
                    reject(new Error("Failed to obtain access token."));
                }
            }
        });
        tokenClient.requestAccessToken();
    });
}

export async function openPicker(options) {
    const { clientId, scopes, multiselect = true } = options ?? {};
    if (!clientId) throw new Error("Google Client ID is required.");

    await ensureGsi();
    await ensureGapiPicker();

    const accessToken = await requestAccessToken(clientId, scopes);
    console.log(accessToken);
    return new Promise((resolve) => {
        //const view = new window.google.picker.View(window.google.picker.ViewId.PHOTOS);

        const builder = new window.google.picker.PickerBuilder()
            .setOAuthToken(accessToken)
            .addView(window.google.picker.ViewId.PHOTOS)           
            .setOrigin(window.location.origin)
            .setCallback((data) => {
                const action = data[window.google.picker.Response.ACTION];
                if (action === window.google.picker.Action.PICKED) {
                    const docs = data[window.google.picker.Response.DOCUMENTS] || [];
                    const items = docs.map(d => ({
                        id: d[window.google.picker.Document.ID] ?? null,
                        name: d[window.google.picker.Document.NAME] ?? null,
                        url: d[window.google.picker.Document.URL] ?? null,
                        mimeType: d[window.google.picker.Document.MIME_TYPE] ?? null,
                        thumbnailUrl: (d[window.google.picker.Document.THUMBNAILS] || [])[0]?.[window.google.picker.Thumbnail.URL] ?? null
                    }));
                    resolve(items);
                } else if (action === window.google.picker.Action.CANCEL) {
                    resolve([]);
                }
            });

        if (multiselect) {
            builder.enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED);
        }

        const picker = builder.build();
        picker.setVisible(true);
    });
}