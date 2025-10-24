const memoryCache = new Map(); // Simple in-memory cache
const CACHE_ENABLED = true;    // Flag to enable/disable caching
const CACHE_TTL = 86400000;       // Time to live in milliseconds (30 seconds)
const DEBUG_LOGGING = false;   // Set to false in production

let DATABASE_NAME = "Fotorolr";
let dbConnection = null; // Persistent connection

// Required stores that should exist in the database
const REQUIRED_STORES = ["Mosaic", "MosaicTemplate", "IndexedDbFile", "ExternalPiece", "ImageData"];

// Get existing connection or create new one
async function getDatabase() {
    if (dbConnection) {
        return dbConnection;
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME);

        request.onsuccess = function (event) {
            dbConnection = event.target.result;
            console.log(`Database opened with version ${dbConnection.version}`);
            resolve(dbConnection);
        };

        request.onerror = function (event) {
            console.error("Error opening database:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Close connection when app is shutting down
export function closeDatabase() {
    if (dbConnection) {
        dbConnection.close();
        dbConnection = null;
        console.log("Database connection closed");
    }
}

export function initialize() {
    return new Promise((resolve, reject) => {
        console.log(`Opening database ${DATABASE_NAME} to check structure`);

        // First open database to check existing structure
        const checkRequest = indexedDB.open(DATABASE_NAME);

        checkRequest.onsuccess = function (event) {
            const db = event.target.result;
            const currentVersion = db.version;
            const existingStores = Array.from(db.objectStoreNames);

            console.log(`Database exists with version ${currentVersion}`);
            console.log(`Existing stores: ${existingStores.join(', ')}`);

            // Check if any required stores are missing
            const missingStores = REQUIRED_STORES.filter(
                store => !existingStores.includes(store)
            );

            db.close();

            if (missingStores.length === 0) {
                console.log("All required stores exist, no upgrade needed");
                // Store the connection for future use
                getDatabase().then(() => resolve(true));
                return;
            }

            // We need to upgrade to create missing stores
            console.log(`Missing stores found: ${missingStores.join(', ')}`);
            console.log(`Upgrading database from version ${currentVersion} to ${currentVersion + 1}`);

            // Open with a higher version to trigger upgrade
            const upgradeRequest = indexedDB.open(DATABASE_NAME, currentVersion + 1);

            upgradeRequest.onupgradeneeded = function (event) {
                const db = event.target.result;
                console.log(`Database upgrade running from ${event.oldVersion} to ${event.newVersion}`);

                // Create any missing stores
                for (const storeName of missingStores) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: "id" });
                        console.log(`Created missing store: ${storeName}`);
                    }
                }
            };

            upgradeRequest.onsuccess = function (event) {
                console.log("Database upgrade successful");
                dbConnection = event.target.result;
                resolve(true);
            };

            upgradeRequest.onerror = function (event) {
                console.error("Database upgrade failed:", event.target.error);
                reject(event.target.error);
            };
        };

        checkRequest.onerror = function (event) {
            console.error("Error checking database:", event.target.error);

            // If database doesn't exist yet, create it with initial version
            console.log("Creating new database with all required stores");
            const createRequest = indexedDB.open(DATABASE_NAME, 1);

            createRequest.onupgradeneeded = function (event) {
                const db = event.target.result;

                // Create all required stores in a new database
                for (const storeName of REQUIRED_STORES) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: "id" });
                        console.log(`Created store: ${storeName}`);
                    }
                }
            };

            createRequest.onsuccess = function (event) {
                console.log("New database created successfully");
                dbConnection = event.target.result;
                resolve(true);
            };

            createRequest.onerror = function (event) {
                console.error("Failed to create database:", event.target.error);
                reject(event.target.error);
            };
        };
    });
}

export async function set(collectionName, value) {
    // Check for valid inputs
    if (!value || !collectionName) {
        console.error("Missing value or collection name");
        return Promise.reject("Missing value or collection name");
    }

    // Ensure value.id exists and is properly formatted
    if (!value.id) {
        console.error("Value must have an id property");
        return Promise.reject("Value must have an id property");
    }

    console.log(`Saving to ${collectionName}:`, value);

    try {
        const db = await getDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(collectionName, "readwrite");
            const store = transaction.objectStore(collectionName);

            transaction.oncomplete = function () {
                console.log(`Successfully saved to ${collectionName}`);
                resolve(true);
            };

            transaction.onerror = function (event) {
                console.error(`Error saving to ${collectionName}:`, event.target.error);
                reject(event.target.error);
            };

            const request = store.put(value);

            request.onsuccess = function () {
                console.log(`Put request successful for ${value.id}`);
            };

            request.onerror = function (event) {
                console.error(`Error putting record:`, event.target.error);
            };
        });
    } catch (error) {
        console.error("Failed to access database:", error);
        return Promise.reject(error);
    }
}

export async function getRange(collectionName, skip, take) {
    try {
        const db = await getDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(collectionName, "readonly");
            const store = transaction.objectStore(collectionName);

            let items = [];
            let counter = 0;

            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = function (event) {
                const cursor = event.target.result;

                if (cursor) {
                    if (counter >= skip) {
                        if (items.length < take) {
                            items.push(cursor.value);
                        }

                        if (items.length >= take) {
                            console.log(`Retrieved ${items.length} items from ${collectionName} (skipped ${skip})`);
                            resolve(items);
                            return;
                        }
                    }

                    counter++;
                    cursor.continue();
                } else {
                    console.log(`Retrieved ${items.length} items from ${collectionName} (skipped ${skip})`);
                    resolve(items);
                }
            };

            cursorRequest.onerror = function (event) {
                console.error(`Error in cursor for ${collectionName}:`, event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Failed to access database:", error);
        return Promise.reject(error);
    }
}

export async function count(collectionName) {
    try {
        const db = await getDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(collectionName, "readonly");
            const store = transaction.objectStore(collectionName);

            transaction.onerror = function (event) {
                console.error(`Transaction error in ${collectionName}:`, event.target.error);
                reject(event.target.error);
            };

            const countRequest = store.count();

            countRequest.onsuccess = function () {
                console.log(`Count from ${collectionName}: ${countRequest.result}`);
                resolve(countRequest.result);
            };

            countRequest.onerror = function (event) {
                console.error(`Error counting records in ${collectionName}:`, event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Error accessing database:", error);
        return Promise.resolve(0); // Return 0 as fallback on error
    }
}

export async function get(collectionName, id) {
    // Validate inputs
    if (!collectionName || id === undefined) {
        console.error("Missing collection name or id");
        return Promise.reject("Missing collection name or id");
    }
    
    // Check cache first
    if (CACHE_ENABLED) {
        const cacheKey = `${collectionName}:${id}`;
        const cachedItem = memoryCache.get(cacheKey);
        if (cachedItem && cachedItem.expires > Date.now()) {
            DEBUG_LOGGING && console.log(`Cache hit for ${cacheKey}`);
            return cachedItem.value;
        }
        DEBUG_LOGGING && console.log(`Cache miss for ${cacheKey}`);
    }

    try {
        const db = await getDatabase();
        
        // Use a more streamlined promise pattern
        const result = await new Promise((resolve, reject) => {
            const store = db.transaction(collectionName, "readonly").objectStore(collectionName);
            const request = store.get(id);
            
            // Simplified event handling
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        // Cache the result
        if (CACHE_ENABLED && result) {
            const cacheKey = `${collectionName}:${id}`;
            memoryCache.set(cacheKey, {
                value: result,
                expires: Date.now() + CACHE_TTL
            });
        }
        
        return result;
    } catch (error) {
        console.error(`Error getting ${id} from ${collectionName}:`, error);
        return Promise.reject(error);
    }
}

export async function getAll(collectionName) {
    try {
        const db = await getDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(collectionName, "readonly");
            const collection = transaction.objectStore(collectionName);
            const request = collection.getAll();

            request.onsuccess = function () {
                resolve(request.result);
            };

            request.onerror = function (e) {
                reject(e);
            };
        });
    } catch (error) {
        console.error("Failed to access database:", error);
        return Promise.reject(error);
    }
}

export async function getAllPagedByDate(collectionName, skip, take) {
    try {
        const db = await getDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(collectionName, "readonly");
            const collection = transaction.objectStore(collectionName);

            let items = [];
            let index;
            try {
                index = collection.index("UploadDate");
            } catch {
                index = null;
            }
            const cursorSource = index ? index.openCursor(null, "prev") : collection.openCursor();

            cursorSource.onsuccess = function (event) {
                const cursor = event.target.result;
                if (cursor) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    if (!index) {
                        items.sort((a, b) => new Date(b.UploadDate) - new Date(a.UploadDate));
                    }
                    const paged = items.slice(skip, skip + take);
                    resolve(paged);
                }
            };

            cursorSource.onerror = function (e) {
                reject(e);
            };
        });
    } catch (error) {
        console.error("Failed to access database:", error);
        return Promise.reject(error);
    }
}

export async function deleteRecord(collectionName, id) {
    try {
        const db = await getDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(collectionName, "readwrite");
            const collection = transaction.objectStore(collectionName);
            const request = collection.delete(id);

            request.onsuccess = function () {
                console.log(`Record deleted from ${collectionName}: ${id}`);
                resolve(true);
            };

            request.onerror = function (event) {
                console.error(`Error deleting record:`, event.target.error);
                reject(event.target.error);
            };
        });
    } catch (error) {
        console.error("Failed to access database:", error);
        return Promise.reject(error);
    }
}

// Add a cache clearing function
export function clearCache(collectionName = null) {
    if (!collectionName) {
        memoryCache.clear();
        DEBUG_LOGGING && console.log("Entire cache cleared");
    } else {
        // Clear only entries for the specified collection
        const prefix = `${collectionName}:`;
        for (const key of memoryCache.keys()) {
            if (key.startsWith(prefix)) {
                memoryCache.delete(key);
            }
        }
        DEBUG_LOGGING && console.log(`Cache cleared for ${collectionName}`);
    }
}

// Add a bulk get function for retrieving multiple records at once
export async function getBulk(collectionName, ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        return [];
    }
    
    try {
        const db = await getDatabase();
        const results = [];
        const missingIds = [];
        
        // Check cache first for all IDs
        if (CACHE_ENABLED) {
            for (const id of ids) {
                const cacheKey = `${collectionName}:${id}`;
                const cachedItem = memoryCache.get(cacheKey);
                
                if (cachedItem && cachedItem.expires > Date.now()) {
                    results.push(cachedItem.value);
                } else {
                    missingIds.push(id);
                }
            }
        } else {
            missingIds.push(...ids);
        }
        
        // If all items were in cache, return immediately
        if (missingIds.length === 0) {
            return results;
        }
        
        // Retrieve items not found in cache
        const transaction = db.transaction(collectionName, "readonly");
        const store = transaction.objectStore(collectionName);
        
        // Use Promise.all to run all requests in parallel
        const dbResults = await Promise.all(missingIds.map(id => {
            return new Promise((resolve) => {
                const request = store.get(id);
                request.onsuccess = () => {
                    // Cache the result if found
                    if (CACHE_ENABLED && request.result) {
                        const cacheKey = `${collectionName}:${id}`;
                        memoryCache.set(cacheKey, {
                            value: request.result,
                            expires: Date.now() + CACHE_TTL
                        });
                    }
                    resolve(request.result);
                };
                request.onerror = () => resolve(null);
            });
        }));
        
        // Combine cached results with database results
        return [...results, ...dbResults.filter(item => item !== null)];
    } catch (error) {
        console.error(`Error in getBulk for ${collectionName}:`, error);
        return [];
    }
}
