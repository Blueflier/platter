// --- SHARED — both devs can read, avoid simultaneous writes ---
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Per-file mutex: serializes all read-modify-write cycles per filename
const locks = {};
function withLock(filename, fn) {
  if (!locks[filename]) locks[filename] = Promise.resolve();
  const result = locks[filename].then(fn);
  locks[filename] = result.catch(() => {}); // keep chain alive on errors
  return result;
}

async function readData(filename) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeData(filename, data) {
  return withLock(filename, () =>
    fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2))
  );
}

// Atomic read → mutate → write (holds lock across the full cycle)
async function appendData(filename, item) {
  return withLock(filename, async () => {
    const list = await readData(filename);
    list.push(item);
    await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(list, null, 2));
    return list;
  });
}

// Atomic read → find → mutate → write
async function updateData(filename, predicate, mutate) {
  return withLock(filename, async () => {
    const list = await readData(filename);
    const item = list.find(predicate);
    if (item) {
      mutate(item);
      await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(list, null, 2));
    }
    return item;
  });
}

module.exports = { readData, writeData, appendData, updateData };
