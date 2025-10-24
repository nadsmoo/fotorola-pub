let lunrIndex = null;
let externalPieces = [];

// Import Lunr if using ES modules
// import * as lunr from 'lunr';

export function buildIndex(externalPieces) {
    // Check if lunr is available
    if (typeof lunr === 'undefined') {
        console.error("Lunr library is not loaded!");
        return false;
    }
    
    try {
        lunrIndex = lunr(function () {
            this.ref('id');
            this.field('shortId');
            this.field('tags');
            this.field('filename');
            this.field('imageSignature');
            this.field('uploadDate');
        });
        //externalPieces = [];
        return true;
    } catch (error) {
        console.error("Failed to build index:", error);
        return false;
    }
}

export function addToIndex(piece) {
    if (!lunrIndex) {
        buildIndex();
    }
    try {
        lunrIndex.add(piece);
        externalPieces.push(piece);
    } catch (error) {
        console.error("Failed to add to index:", error, piece);
        // Consider returning an error status that can be handled by Blazor
    }
}

export function addBatchToIndex(pieces) {
    externalPieces.push(pieces);
    buildIndex(externalPieces);
}

export function search(query) {
    if (!lunrIndex) return [];
    const results = lunrIndex.search(query);
    return results.map(r => externalPieces.find(p => p.id === r.ref));
}

export function getById(id) {
    return externalPieces.find(p => p.id === id) || null;
}

export function getPage(skip, take) {
    return externalPieces.slice(skip, skip + take);
}

export function count() {
    return externalPieces.length;
}
