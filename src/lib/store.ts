import { Pothole } from '../types';

const STORAGE_KEY = 'forge_potholes';

export function getPotholes(): Pothole[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function setPotholes(list: Pothole[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addPothole(p: Pothole) {
  const list = getPotholes();
  list.unshift(p);
  setPotholes(list);
}

export function updateStatus(id: string, status: Pothole['status']) {
  const list = getPotholes().map(x =>
    x.id === id ? { ...x, status } : x
  );
  setPotholes(list);
}