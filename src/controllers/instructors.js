const db = require('../db');
const HttpError = require('../utils/httpError');
const { id, allow, pagination, paged } = require('../utils/query');

exports.list = async (req, res) => {
  allow(req.query, ['page', 'limit']);
  const p = pagination(req.query);
  const [data, total] = await db.$transaction([
    db.instructor.findMany({ skip: p.skip, take: p.limit, orderBy: { id: 'asc' } }), db.instructor.count(),
  ], { isolationLevel: 'RepeatableRead' });
  res.json(paged(data, total, p));
};
exports.detail = async (req, res) => {
  const row = await db.instructor.findUnique({ where: { id: id(req.params.id) }, include: { _count: { select: { courses: true } } } });
  if (!row) throw new HttpError(404, 'Багш олдсонгүй.');
  res.json(row);
};
exports.create = async (req, res) => res.status(201).json(await db.instructor.create({ data: req.validatedBody }));
exports.update = async (req, res) => res.json(await db.instructor.update({ where: { id: id(req.params.id) }, data: req.validatedBody }));
exports.remove = async (req, res) => {
  await db.instructor.delete({ where: { id: id(req.params.id) } });
  res.status(204).end();
};
