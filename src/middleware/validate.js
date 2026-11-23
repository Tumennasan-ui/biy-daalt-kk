const HttpError = require('../utils/httpError');
const INT_MAX = 2147483647;
const text = (max, nullable = false) => ({ type: 'text', max, nullable });
const integer = (min, max, nullable = false) => ({ type: 'int', min, max, nullable });
const rules = {
  category: { name: text(200) },
  instructor: { name: text(200), birthYear: integer(1900, () => new Date().getFullYear(), true) },
  course: {
    title: text(200), year: integer(1900, () => new Date().getFullYear() + 1),
    durationMin: integer(1, INT_MAX), description: text(5000, true),
    isPublished: { type: 'boolean' }, categoryId: integer(1, INT_MAX),
    instructorId: integer(1, INT_MAX, true),
  },
  lesson: { title: text(200), rating: integer(1, 5), comment: text(2000, true), authorName: text(200) },
};
const required = {
  category: ['name'], instructor: ['name'],
  course: ['title', 'year', 'durationMin', 'categoryId'], lesson: ['title', 'rating', 'authorName'],
};

module.exports = function validate(model, partial = false) {
  return (req, res, next) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Body нь JSON object байх ёстой.');
    }
    const fields = Object.keys(body);
    if (partial && fields.length === 0) throw new HttpError(400, 'Засах талбараа оруулна уу.');
    for (const field of fields) {
      if (!Object.hasOwn(rules[model], field)) throw new HttpError(400, 'Зөвшөөрөөгүй талбар.', field);
    }
    if (!partial) {
      for (const field of required[model]) {
        if (!Object.hasOwn(body, field)) throw new HttpError(400, 'Заавал оруулах талбар.', field);
      }
    }
    const clean = {};
    for (const field of fields) {
      const rule = rules[model][field];
      const value = body[field];
      if (value === null && rule.nullable) { clean[field] = null; continue; }
      if (rule.type === 'text') {
        if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > rule.max) {
          throw new HttpError(400, `Хоосон биш, ${rule.max} хүртэл тэмдэгттэй текст оруулна уу.`, field);
        }
        clean[field] = value.trim();
      } else if (rule.type === 'int') {
        const max = typeof rule.max === 'function' ? rule.max() : rule.max;
        if (!Number.isInteger(value) || value < rule.min || value > max) {
          throw new HttpError(400, `${rule.min}-${max} хооронд бүхэл тоо оруулна уу.`, field);
        }
        clean[field] = value;
      } else {
        if (typeof value !== 'boolean') throw new HttpError(400, 'true эсвэл false оруулна уу.', field);
        clean[field] = value;
      }
    }
    req.validatedBody = clean;
    next();
  };
};
