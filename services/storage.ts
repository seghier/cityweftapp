
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
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return fileHandle;
};

export const appendToCSV = async (
    handle: any,
    filename: string,
    entry: LogEntry
) => {
    let fileHandle: any;
    let currentContent = '';
    const header = 'Name,Country,Coordinates,Area,File Link,Timestamp\n';

    try {
        fileHandle = await handle.getFileHandle(filename, { create: false });
        const file = await fileHandle.getFile();
        currentContent = await file.text();
    } catch (e) {
        // File doesn't exist, create it
        fileHandle = await handle.getFileHandle(filename, { create: true });
        currentContent = header;
    }

    // Check if header exists in non-empty file
    if (currentContent.length > 0 && !currentContent.startsWith('Name,')) {
        // Should not happen if we manage it, but generic safety
    }

    const line = `"${entry.name}","${entry.country}","${entry.coordinates}","${entry.area}","${entry.fileLink}","${entry.timestamp}"\n`;

    // If file was empty, prepend header
    if (currentContent === '') {
        currentContent = header;
    }

    const writable = await fileHandle.createWritable();
    // We have to write the whole file or append?
    await writable.write(currentContent + line);
    await writable.close();
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
