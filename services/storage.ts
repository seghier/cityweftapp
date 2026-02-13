
const DB_NAME = 'CityweftStorage';
const STORE_NAME = 'handles';
const KEY_NAME = 'directoryHandle';

export interface LogEntry {
    name: string;
    country: string;
    coordinates: string; // "lat, lon"
    area: string;
    fileLink: string;
    timestamp: string;
    renderPath?: string;
}

// Open DB helper
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const saveDirectoryHandle = async (handle: any): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(handle, KEY_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getDirectoryHandle = async (): Promise<any | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(KEY_NAME);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const verifyPermission = async (handle: any, readWrite: boolean): Promise<boolean> => {
    const options: any = {};
    if (readWrite) {
        options.mode = 'readwrite';
    }
    if ((await handle.queryPermission(options)) === 'granted') {
        return true;
    }
    if ((await handle.requestPermission(options)) === 'granted') {
        return true;
    }
    return false;
};

export const saveFileToDirectory = async (
    handle: any,
    filename: string,
    content: string | Blob | Uint8Array
) => {
    return retryOperation(async () => {
        const fileHandle = await handle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return fileHandle;
    });
};

// Helper for retry logic
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
    try {
        return await operation();
    } catch (err: any) {
        // If it's a specific "state cached" error, likely handle is stale.
        // We retry just in case it's transient lock, but if it fails repeatedly, it's dead.
        if (err.name === 'InvalidStateError' || err.message?.includes('state cached')) {
            if (retries <= 0) {
                // Throw a specific error we can catch in App.tsx to reset handle
                throw new Error("HANDLE_INVALIDATED");
            }
        }

        if (retries > 0) {
            console.warn(`Operation failed, retrying (${retries} left)...`, err);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 1.5); // Backoff
        }
        throw err;
    }
}

export const appendToCSV = async (
    handle: any,
    filename: string,
    entry: LogEntry
) => {
    return retryOperation(async () => {
        let fileHandle: any;
        let currentContent = '';
        const header = "Name,Country,Coordinates,Area,File Link,Timestamp,\"Render Image Path\"\n";

        try {
            fileHandle = await handle.getFileHandle(filename, { create: false });
            const file = await fileHandle.getFile();
            currentContent = await file.text();
        } catch (e) {
            // File doesn't exist, create it
            fileHandle = await handle.getFileHandle(filename, { create: true });
            currentContent = header;
        }

        const line = `"${entry.name}","${entry.country}","${entry.coordinates}","${entry.area}","${entry.fileLink}","${entry.timestamp}","${entry.renderPath || ''}"\n`;

        // If file was empty, prepend header
        if (currentContent === '') {
            currentContent = header;
        }

        // Ensure we start on a new line if needed
        if (currentContent.length > 0 && !currentContent.endsWith('\n')) {
            currentContent += '\n';
        }

        const writable = await fileHandle.createWritable();
        await writable.write(currentContent + line);
        await writable.close();
    });
};

export const updateLogWithRender = async (
    handle: any,
    csvFilename: string,
    fileLinkToMatch: string,
    renderPath: string
) => {
    return retryOperation(async () => {
        const fileHandle = await handle.getFileHandle(csvFilename, { create: false });
        const file = await fileHandle.getFile();
        const content = await file.text();

        const lines = content.split('\n');

        const updatedLines = lines.map((line, index) => {
            if (index === 0) { // Header
                if (!line.includes('Render Image Path')) {
                    const cleanHeader = line.replace(/[\r\n]+$/, '');
                    return cleanHeader + ',"Render Image Path"';
                }
                return line;
            }
            if (!line.trim()) return line; // Empty lines

            // Checking for match
            if (line.includes(`"${fileLinkToMatch}"`)) {
                // Remove potential newline
                let contentRow = line.replace(/[\r\n]+$/, '');

                if (contentRow.startsWith('"') && contentRow.endsWith('"')) {
                    const inner = contentRow.substring(1, contentRow.length - 1);
                    const parts = inner.split('","');

                    if (parts.length === 6) {
                        parts.push(renderPath || '');
                    } else if (parts.length >= 7) {
                        parts[6] = renderPath || '';
                    }

                    return `"${parts.join('","')}"`;
                }

                if (contentRow.endsWith(`,""`)) {
                    return contentRow.substring(0, contentRow.length - 3) + `,"${renderPath}"`;
                }
                return contentRow + `,"${renderPath}"`;
            }
            return line;
        });

        const newContent = updatedLines.join('\n');

        const writable = await fileHandle.createWritable();
        await writable.write(newContent);
        await writable.close();
    });
};

export const loadFileFromDirectory = async (handle: any, filename: string): Promise<string | null> => {
    try {
        const fileHandle = await handle.getFileHandle(filename);
        const file = await fileHandle.getFile();
        return await file.text();
    } catch (e) {
        return null;
    }
};
