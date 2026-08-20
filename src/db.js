/** IndexedDB persistence for tracks. Everything stays in this browser. */
const DB = "techsex-tracks";
const STORE = "tracks";

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, action) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const putTrack = track => run("readwrite", store => store.put(track));
export const deleteTrack = id => run("readwrite", store => store.delete(id));
export const listTracks = () => run("readonly", store => store.getAll());
