/**
 * IDIMS IndexedDB — local-first data layer
 * Stores work orders, appointments, clients, properties, parts, schedule
 * so the app works fully offline after first load with signal.
 */

const DB_NAME = 'idims-offline';
const DB_VERSION = 4;

const STORES = {
  workOrders: 'workOrders',
  appointments: 'appointments',
  clients: 'clients',
  properties: 'properties',
  parts: 'parts',
  schedule: 'schedule',
  meta: 'meta',
  pendingMutations: 'pendingMutations',
  notes: 'notes',
  standaloneDiagnostics: 'standaloneDiagnostics',
};

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Work orders — keyed by id
      if (!db.objectStoreNames.contains(STORES.workOrders)) {
        const store = db.createObjectStore(STORES.workOrders, { keyPath: 'id' });
        store.createIndex('client_id', 'client_id', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('scheduled_start', 'scheduled_start', { unique: false });
      }

      // Appointments — keyed by id
      if (!db.objectStoreNames.contains(STORES.appointments)) {
        const store = db.createObjectStore(STORES.appointments, { keyPath: 'id' });
        store.createIndex('work_order_id', 'work_order_id', { unique: false });
        store.createIndex('scheduled_start', 'scheduled_start', { unique: false });
      }

      // Clients — keyed by id
      if (!db.objectStoreNames.contains(STORES.clients)) {
        const store = db.createObjectStore(STORES.clients, { keyPath: 'id' });
        store.createIndex('phone', 'phone', { unique: false });
      }

      // Properties — keyed by id
      if (!db.objectStoreNames.contains(STORES.properties)) {
        const store = db.createObjectStore(STORES.properties, { keyPath: 'id' });
        store.createIndex('client_id', 'client_id', { unique: false });
      }

      // Parts — keyed by id
      if (!db.objectStoreNames.contains(STORES.parts)) {
        const store = db.createObjectStore(STORES.parts, { keyPath: 'id' });
        store.createIndex('work_order_id', 'work_order_id', { unique: false });
      }

      // Schedule — keyed by a composite date+id string
      if (!db.objectStoreNames.contains(STORES.schedule)) {
        const store = db.createObjectStore(STORES.schedule, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }

      // Meta — key/value store for sync timestamps
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }

      // Offline write queue
      if (!db.objectStoreNames.contains(STORES.pendingMutations)) {
        const store = db.createObjectStore(STORES.pendingMutations, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Work order notes (cached + pending offline creates)
      if (!db.objectStoreNames.contains(STORES.notes)) {
        const store = db.createObjectStore(STORES.notes, { keyPath: 'id' });
        store.createIndex('work_order_id', 'work_order_id', { unique: false });
      }

      // Solomon standalone diagnostics (cached + pending offline saves)
      if (!db.objectStoreNames.contains(STORES.standaloneDiagnostics)) {
        const store = db.createObjectStore(STORES.standaloneDiagnostics, { keyPath: 'id' });
        store.createIndex('outcome_id', 'outcome_id', { unique: false });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      _db.onversionchange = () => {
        _db?.close();
        _db = null;
      };
      resolve(_db);
    };

    request.onerror = (event) => {
      console.error('[IndexedDB] Open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

// ── Generic helpers ───────────────────────────────────────────────────────

function txPut(storeName, items) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const arr = Array.isArray(items) ? items : [items];
      arr.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

function txGetAll(storeName) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function txGet(storeName, key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function txGetByIndex(storeName, indexName, value) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

function txDelete(storeName, key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────

// Work Orders
export const WorkOrderStore = {
  putAll: (items) => txPut(STORES.workOrders, items),
  put: (item) => txPut(STORES.workOrders, item),
  getAll: () => txGetAll(STORES.workOrders),
  get: (id) => txGet(STORES.workOrders, id),
  getByClient: (clientId) => txGetByIndex(STORES.workOrders, 'client_id', clientId),
};

// Appointments
export const AppointmentStore = {
  putAll: (items) => txPut(STORES.appointments, items),
  put: (item) => txPut(STORES.appointments, item),
  getAll: () => txGetAll(STORES.appointments),
  get: (id) => txGet(STORES.appointments, id),
  getByWorkOrder: (workOrderId) => txGetByIndex(STORES.appointments, 'work_order_id', workOrderId),
};

// Clients
export const ClientStore = {
  putAll: (items) => txPut(STORES.clients, items),
  put: (item) => txPut(STORES.clients, item),
  getAll: () => txGetAll(STORES.clients),
  get: (id) => txGet(STORES.clients, id),
};

// Properties
export const PropertyStore = {
  putAll: (items) => txPut(STORES.properties, items),
  put: (item) => txPut(STORES.properties, item),
  getAll: () => txGetAll(STORES.properties),
  get: (id) => txGet(STORES.properties, id),
  getByClient: (clientId) => txGetByIndex(STORES.properties, 'client_id', clientId),
};

// Parts
export const PartStore = {
  putAll: (items) => txPut(STORES.parts, items),
  put: (item) => txPut(STORES.parts, item),
  getAll: () => txGetAll(STORES.parts),
  get: (id) => txGet(STORES.parts, id),
  getByWorkOrder: (workOrderId) => txGetByIndex(STORES.parts, 'work_order_id', workOrderId),
};

// Schedule
export const ScheduleStore = {
  putAll: (items) => txPut(STORES.schedule, items),
  put: (item) => txPut(STORES.schedule, item),
  getAll: () => txGetAll(STORES.schedule),
  getByDate: (date) => txGetByIndex(STORES.schedule, 'date', date),
};

// Meta — sync timestamps
export const MetaStore = {
  set: (key, value) => txPut(STORES.meta, { key, value, updatedAt: Date.now() }),
  get: (key) => txGet(STORES.meta, key).then((r) => r?.value ?? null),
};

// Pending offline mutations (FIFO outbox)
export const PendingMutationStore = {
  add: (item) => txPut(STORES.pendingMutations, item),
  remove: (id) => txDelete(STORES.pendingMutations, id),
  getAll: () =>
    txGetAll(STORES.pendingMutations).then((items) =>
      items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    ),
  count: () => txGetAll(STORES.pendingMutations).then((items) => items.length),
};

// Work order notes
export const NotesStore = {
  put: (item) => txPut(STORES.notes, item),
  putAll: (items) => txPut(STORES.notes, items),
  getAll: () => txGetAll(STORES.notes),
  get: (id) => txGet(STORES.notes, id),
  getByWorkOrder: (workOrderId) =>
    txGetByIndex(STORES.notes, 'work_order_id', workOrderId),
  remove: (id) => txDelete(STORES.notes, id),
};

// Solomon standalone diagnostics
export const StandaloneDiagnosticStore = {
  put: (item) => txPut(STORES.standaloneDiagnostics, item),
  putAll: (items) => txPut(STORES.standaloneDiagnostics, items),
  getAll: () => txGetAll(STORES.standaloneDiagnostics),
  get: (id) => txGet(STORES.standaloneDiagnostics, id),
  remove: (id) => txDelete(STORES.standaloneDiagnostics, id),
  getPending: () =>
    txGetAll(STORES.standaloneDiagnostics).then((items) =>
      items.filter((item) => item.pendingSync)
    ),
};
