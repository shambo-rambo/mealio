import type { ListKind } from '../types'

export interface ListKindDef {
  id: ListKind
  label: string
  icon: string
  description: string
  placeholder: string
  emptyHint: string
}

/** What kinds of list you can make. Shopping is the full-featured one; the rest are plain checklists. */
export const LIST_KINDS: ListKindDef[] = [
  { id: 'shopping', label: 'Shopping', icon: 'shopping_basket', description: 'Aisles, shops and recipe ingredients', placeholder: 'e.g. Weekly shop', emptyHint: 'Add something to buy' },
  { id: 'general', label: 'Blank list', icon: 'format_list_bulleted', description: 'Anything you like, uncategorised', placeholder: 'e.g. Ideas', emptyHint: 'Add your first item' },
  { id: 'todo', label: 'To-do', icon: 'task_alt', description: 'Jobs and reminders to tick off', placeholder: 'e.g. Weekend jobs', emptyHint: 'Add a job to do' },
  { id: 'packing', label: 'Packing', icon: 'luggage', description: 'Trips, camps and sleepovers', placeholder: 'e.g. Beach weekend', emptyHint: 'Add something to pack' },
  { id: 'gifts', label: 'Gift ideas', icon: 'redeem', description: 'Who gets what, and when', placeholder: 'e.g. Christmas', emptyHint: 'Add a gift idea' },
]

export const LIST_KIND_BY_ID = Object.fromEntries(LIST_KINDS.map((k) => [k.id, k])) as Record<ListKind, ListKindDef>

export function kindOf(kind: ListKind | undefined) {
  return LIST_KIND_BY_ID[kind ?? 'shopping'] ?? LIST_KIND_BY_ID.shopping
}
