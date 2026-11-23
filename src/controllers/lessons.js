const db = require('../db');
const HttpError = require('../utils/httpError');
const { id, allow, pagination, paged, sorting } = require('../utils/query');

exports.list = async (req, res) => {
  const courseId = id(req.params.id);
  allow(req.query, ['page', 'limit', 'sort', 'order']);
  const p = pagination(req.query);
  const orderBy = sorting(req.query, ['rating', 'createdAt']);
  const result = await db.$transaction(async tx => {
    if (!await tx.course.findUnique({ where: { id: courseId }, select: { id: true } })) throw new HttpError(404, 'Сургалт олдсонгүй.');
    const data = await tx.lesson.findMany({ where: { courseId }, skip: p.skip, take: p.limit, orderBy });
    const total = await tx.lesson.count({ where: { courseId } });
    return paged(data, total, p);
  }, { isolationLevel: 'RepeatableRead' });
  res.json(result);
};
exports.create = async (req, res) => {
  const courseId = id(req.params.id);
  if (!await db.course.findUnique({ where: { id: courseId }, select: { id: true } })) throw new HttpError(404, 'Сургалт олдсонгүй.');
  res.status(201).json(await db.lesson.create({ data: { ...req.validatedBody, courseId } }));
};
exports.update = async (req, res) => res.json(await db.lesson.update({ where: { id: id(req.params.id) }, data: req.validatedBody }));
exports.remove = async (req, res) => {
  await db.lesson.delete({ where: { id: id(req.params.id) } });
  res.status(204).end();
};
