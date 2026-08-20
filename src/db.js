const DB_NAME = "techsex";
const STORE = "chats";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listChats() {
  const db = await openDb();
  const all = await promisify(
    db.transaction(STORE).objectStore(STORE).getAll(),
  );
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveChat(chat) {
  const db = await openDb();
  await promisify(
    db.transaction(STORE, "readwrite").objectStore(STORE).put(chat),
  );
}

export async function deleteChat(id) {
  const db = await openDb();
  await promisify(
    db.transaction(STORE, "readwrite").objectStore(STORE).delete(id),
  );
}
