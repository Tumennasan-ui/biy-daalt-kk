const db = require('../db');
const HttpError = require('../utils/httpError');
const { id, courseQuery, paged } = require('../utils/query');
const include = { category: true, instructor: true, _count: { select: { lessons: true } } };

async function references(data) {
  if (data.categoryId !== undefined && !await db.category.findUnique({ where: { id: data.categoryId }, select: { id: true } })) {
    throw new HttpError(400, 'Ангилал олдсонгүй.', 'categoryId');
  }
  if (data.instructorId !== undefined && data.instructorId !== null && !await db.instructor.findUnique({ where: { id: data.instructorId }, select: { id: true } })) {
    throw new HttpError(400, 'Багш олдсонгүй.', 'instructorId');
  }
}

async function listing(req, res, parent) {
  const { where, paging: p, orderBy, minRating } = courseQuery(req.query);
  // Read both page and total from one database snapshot. Average filter is
  // calculated in PostgreSQL by GROUP BY before pagination, never on one page.
  const result = await db.$transaction(async tx => {
    if (parent) {
      const parentId = id(req.params.id);
      const table = parent === 'categoryId' ? tx.category : tx.instructor;
      if (!await table.findUnique({ where: { id: parentId }, select: { id: true } })) throw new HttpError(404, 'Эцэг өгөгдөл олдсонгүй.');
      where.AND = [...(where.AND || []), { [parent]: parentId }];
    }
    if (minRating !== undefined) {
      const groups = await tx.lesson.groupBy({ by: ['courseId'], _avg: { rating: true }, having: { rating: { _avg: { gte: minRating } } } });
      where.id = { in: groups.map(group => group.courseId) };
    }
    const data = await tx.course.findMany({ where, orderBy, skip: p.skip, take: p.limit, include });
    const total = await tx.course.count({ where });
    return paged(data, total, p);
  }, { isolationLevel: 'RepeatableRead' });
  res.json(result);
}
exports.list = (req, res) => listing(req, res);
exports.byCategory = (req, res) => listing(req, res, 'categoryId');
exports.byInstructor = (req, res) => listing(req, res, 'instructorId');
exports.detail = async (req, res) => {
  const courseId = id(req.params.id);
  const [row, aggregate] = await db.$transaction([
    db.course.findUnique({ where: { id: courseId }, include }),
    db.lesson.aggregate({ where: { courseId }, _avg: { rating: true } }),
  ], { isolationLevel: 'RepeatableRead' });
  if (!row) throw new HttpError(404, 'Сургалт олдсонгүй.');
  res.json({ ...row, averageRating: aggregate._avg.rating });
};
exports.create = async (req, res) => {
  await references(req.validatedBody);
  res.status(201).json(await db.course.create({ data: req.validatedBody, include }));
};
exports.update = async (req, res) => {
  const courseId = id(req.params.id);
  if (!await db.course.findUnique({ where: { id: courseId }, select: { id: true } })) throw new HttpError(404, 'Сургалт олдсонгүй.');
  await references(req.validatedBody);
  res.json(await db.course.update({ where: { id: courseId }, data: req.validatedBody, include }));
};
exports.remove = async (req, res) => {
  await db.course.delete({ where: { id: id(req.params.id) } });
  res.status(204).end();
};
