/**
 * Shared paginate helper for soft-deletable collections.
 */
export async function paginateModel(model, {
  filter = {},
  page = 1,
  limit = 20,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  allowedSort = ['createdAt', 'updatedAt', 'name'],
  search,
  searchFields = ['name'],
} = {}) {
  const query = { ...filter, deletedAt: null };

  if (search?.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(term, 'i');
    query.$or = searchFields.map((field) => ({ [field]: regex }));
  }

  const sortField = allowedSort.includes(sortBy) ? sortBy : allowedSort[0];
  const sort = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    model.find(query).sort(sort).skip(skip).limit(limit).exec(),
    model.countDocuments(query).exec(),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export default { paginateModel };
