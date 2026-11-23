# Ажиллуулж шалгасан үр дүн

Огноо: 2026-11-23. Орчин: Windows, Node.js 22.20.0, PostgreSQL 18.1.

| Шалгалт | Үр дүн |
| --- | --- |
| Prisma schema validate / client generate | Амжилттай |
| Шинэ PostgreSQL database-д migration deploy | Амжилттай |
| Seed-ийг дараалан хоёр удаа ажиллуулах | 5 Category, 6 Instructor, 25 Course, 60 Lesson хэвээр |
| Багшгүй сургалт | Яг 3 |
| `npm test` | 16 бүлэг тест, 375 HTTP хүсэлт, 0 алдаа |
| Postman collection-ийн бодит серверийн туршилт | 100 хүсэлт, 184 assertion, 0 алдаа |
| `npm run check:openapi` | OpenAPI хүчинтэй; 21 domain endpoint, 4 tag |
| Шинэ суулгалтын `/health`, `/docs` | Хоёулаа HTTP 200 |
| Шинэ суулгалтын `/openapi.json` | 21 domain operation |
| `npm audit` | 0 vulnerability |
| Git-д `.env`, `node_modules` орсон эсэх | Ороогүй; `.env.example`, lockfile орсон |

Тестүүд нь CRUD-ийн амжилт, 400/404/409, database-ийн compound unique, Restrict/SetNull/Cascade, бүх шүүлтүүрийн нийлбэр, шүүлтийн дараах total, хуудаслалт, эрэмбэлэлт, rating-ийн бодит дундаж, эвдэрсэн JSON болон сервер үргэлжлэн ажиллаж байгааг шалгана. `%`, `_`, `\`-ийг текст хайлтад literal тэмдэгтээр хайх тусдаа regression тест бий.

Шинэ хавтасны туршилтад Git HEAD-ийн tracked файлуудыг `git archive`-аас задалж, өмнөх `node_modules`-ийг ашиглалгүй `npm ci`, client generate, migration, seed хоёр удаа, integration test, OpenAPI шалгалтыг дахин ажиллуулсан. Тусдаа цоо шинэ үндсэн болон test database ашигласан. Docker Desktop энэ орчинд байхгүй тул Docker Compose-ийг ажиллуулсан гэж тооцоогүй; PostgreSQL 18.1-ийг шууд асааж шалгасан.

Postman хүсэлтүүдийг Newman-аар ажиллуулсан. Newman нь эцсийн төслийн dependency биш; цуглуулгыг Postman Desktop-ийн Runner-д import хийж давтан ажиллуулна. Swagger UI-ийн HTML болон specification-ийг HTTP-ээр шалгасан; UI-ийн бүх товчлуурыг гараар дарсан гэж тооцоогүй.

Энэ нь локал төслийн техникийн шалгалт. GitHub repository нийтлээгүй. README дэх оюутны нэр, бүтэн кодыг бөглөх, кодоо ойлгож хамгаалах, GitHub холбоосоо багшид илгээх алхам үлдэнэ.
