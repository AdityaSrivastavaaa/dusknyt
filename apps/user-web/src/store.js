import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const emptyDraft = { offer: null, guests: [], note: '' };
export const useStore = create(persist((set) => ({
  city: null, setCity: (city) => set({ city }),
  filters: {}, setFilters: (filters) => set({ filters }),
  draft: emptyDraft,
  setDraft: (d) => set((s) => ({ draft: { ...s.draft, ...d } })),
  clearDraft: () => set({ draft: emptyDraft }),
}), { name: 'dn_store', partialize: (s) => ({ city: s.city }) }));
