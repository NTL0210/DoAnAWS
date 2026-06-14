export function softDeleteItem(item, metadata = {}) {
  if (!item || item.deletedAt) return item;
  const now = new Date().toISOString();
  return {
    ...item,
    deletedAt: now,
    deletedBy: metadata.deletedBy || null,
    deleteReason: metadata.deleteReason || '',
    updatedAt: now,
  };
}

export function restoreItem(item) {
  if (!item) return item;
  const { deletedAt, deletedBy, deleteReason, ...rest } = item;
  return {
    ...rest,
    updatedAt: new Date().toISOString(),
  };
}

export function permanentlyDeleteItem(items, itemId) {
  return (items || []).filter((item) => item.id !== itemId);
}

export function isDeleted(item) {
  return Boolean(item?.deletedAt);
}
