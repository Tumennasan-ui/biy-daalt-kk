const HttpError = require('./httpError');
const INT_MAX = 2147483647;
function id(value, field = 'id') {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > INT_MAX) {
    throw new HttpError(400, 'Эерэг бүхэл тоо оруулна уу.', field);
  }
  return Number(value);
}
function allow(query, fields) {
  for (const [key, value] of Object.entries(query)) {
    if (!fields.includes(key)) throw new HttpError(400, 'Танигдаагүй query параметр.', key);
    if (typeof value !== 'string') throw new HttpError(400, 'Параметрийг нэг удаа текстээр оруулна уу.', key);
  }
}
function pagination(query) {
  const page = query.page === undefined ? 1 : id(query.page, 'page');
  const limit = query.limit === undefined ? 10 : id(query.limit, 'limit');
  if (limit > 50) throw new HttpError(400, 'limit нь 1-50 хооронд байна.', 'limit');
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip) || skip > INT_MAX) throw new HttpError(400, 'Хуудасны дугаар хэт их байна.', 'page');
  return { page, limit, skip };
}
function paged(data, total, paging) {
  return { data, meta: { page: paging.page, limit: paging.limit, total, pages: Math.ceil(total / paging.limit) } };
}
function boolean(value, field) {
  if (value !== 'true' && value !== 'false') throw new HttpError(400, 'true эсвэл false утгатай байна.', field);
  return value === 'true';
}
function sorting(query, fields) {
  const sort = query.sort ?? 'createdAt';
  const order = query.order ?? 'desc';
  if (!fields.includes(sort)) throw new HttpError(400, 'Эрэмбэлэх талбар буруу.', 'sort');
  if (!['asc', 'desc'].includes(order)) throw new HttpError(400, 'asc эсвэл desc оруулна уу.', 'order');
  return [{ [sort]: order }, { id: order }];
}
function courseQuery(query) {
  allow(query, ['q', 'categoryId', 'instructorId', 'hasInstructor', 'minYear', 'maxYear', 'isPublished', 'sort', 'order', 'page', 'limit', 'minRating']);
  const paging = pagination(query);
  const orderBy = sorting(query, ['title', 'year', 'durationMin', 'createdAt']);
  const where = {};
  if (query.q !== undefined) {
    if (!query.q.trim() || query.q.length > 500) throw new HttpError(400, 'Хайлтын текст хоосон эсвэл хэт урт байна.', 'q');
    // Prisma contains uses SQL LIKE: escape metacharacters for literal text search.
    const needle = query.q.trim().replace(/[\\%_]/g, '\\$&');
    where.OR = ['title', 'description'].map(field => ({ [field]: { contains: needle, mode: 'insensitive' } }));
  }
  if (query.categoryId !== undefined) where.categoryId = id(query.categoryId, 'categoryId');
  if (query.instructorId !== undefined) where.instructorId = id(query.instructorId, 'instructorId');
  if (query.hasInstructor !== undefined) {
    const present = boolean(query.hasInstructor, 'hasInstructor');
    where.AND = [{ instructorId: present ? { not: null } : null }];
  }
  if (query.isPublished !== undefined) where.isPublished = boolean(query.isPublished, 'isPublished');
  const years = {};
  for (const [field, op] of [['minYear', 'gte'], ['maxYear', 'lte']]) {
    if (query[field] !== undefined) {
      const year = id(query[field], field);
      if (year < 1900 || year > new Date().getFullYear() + 1) throw new HttpError(400, 'Он зөвшөөрсөн хязгаарт байх ёстой.', field);
      years[op] = year;
    }
  }
  if (years.gte !== undefined && years.lte !== undefined && years.gte > years.lte) throw new HttpError(400, 'minYear нь maxYear-ээс их байж болохгүй.', 'minYear');
  if (Object.keys(years).length) where.year = years;
  let minRating;
  if (query.minRating !== undefined) {
    if (!/^(?:[1-4](?:\.\d+)?|5(?:\.0+)?)$/.test(query.minRating)) throw new HttpError(400, 'minRating нь 1-5 хооронд тоо байна.', 'minRating');
    minRating = Number(query.minRating);
  }
  return { paging, orderBy, where, minRating };
}
module.exports = { id, allow, pagination, paged, sorting, courseQuery };
