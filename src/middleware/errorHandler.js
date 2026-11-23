const { Prisma } = require('@prisma/client');

// Prisma codes are translated in one place, including concurrent FK changes.
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  let field = err.field;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    field = undefined;
    switch (err.code) {
      case 'P2002': {
        status = 409;
        const target = err.meta?.target;
        field = Array.isArray(target) && target.includes('authorName') ? 'authorName' : 'name';
        message = field === 'authorName'
          ? 'Энэ зохиогч тухайн сургалтад хичээл оруулсан байна.'
          : 'Ижил нэртэй ангилал байна.';
        break;
      }
      case 'P2003':
        status = req.method === 'DELETE' ? 409 : 400;
        message = status === 409 ? 'Сургалттай ангиллыг устгах боломжгүй.' : 'Холбоотой өгөгдөл олдсонгүй.';
        if (status === 400) field = String(err.meta?.constraint || err.meta?.field_name || '').includes('instructor') ? 'instructorId' : 'categoryId';
        break;
      case 'P2025': status = 404; message = 'Өгөгдөл олдсонгүй.'; break;
      case 'P2020': case 'P2000': status = 400; message = 'Талбарын утга зөвшөөрсөн хязгаараас хэтэрсэн.'; break;
      default: status = 500; break;
    }
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError &&
    req.method === 'DELETE' && /code: "23001"/.test(err.message)) {
    // PostgreSQL 18 emits restrict_violation (23001); Prisma 6 does not
    // classify that SQLSTATE as P2003. Keep this compatibility mapping here.
    status = 409; message = 'Сургалттай ангиллыг устгах боломжгүй.'; field = undefined;
  } else if (err.type === 'entity.parse.failed' || err instanceof URIError) {
    status = 400; message = 'JSON эсвэл URL-ийн бүтэц буруу.'; field = undefined;
  } else if (err.type === 'entity.too.large') {
    status = 400; message = 'Хүсэлтийн body хэт том байна.'; field = undefined;
  } else if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
    status = 400; message = 'Хүсэлтийн encoding дэмжигдээгүй.'; field = undefined;
  }
  if (status < 400 || status > 599) status = 500;
  if (status >= 500) {
    console.error(err);
    message = 'Серверийн алдаа гарлаа.';
    field = undefined;
  }
  res.status(status).json({ message, ...(field ? { field } : {}) });
};
