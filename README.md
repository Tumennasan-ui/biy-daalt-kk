# Онлайн сургалтын backend API

BED411 Backend хөгжүүлэлт хичээлийн бие даалт. Оюутны кодын сүүлийн цифр **1** тул **Онлайн сургалт** сэдвийг сонгов.

| Мэдээлэл | Утга |
| --- | --- |
| Оюутны нэр | **[Өөрийн нэр]** |
| Оюутны код | **[Бүтэн код, сүүлийн цифр 1]** |
| Сэдэв | Онлайн сургалт |
| Технологи | Node.js 22, Express 5, Prisma 6.19, PostgreSQL |

Нэр, бүтэн кодыг илгээхээсээ өмнө өөрийн мэдээллээр солино. Багшид GitHub repository-ийн холбоосоо илгээнэ. Энэ хавтас нь локал Git repository; GitHub дээр нийтлэх алхмыг доор оруулсан.

## 1. Төслийн зорилго

Сургалтын ангилал, багш, курс, хичээлийг REST API-аар удирдана. Домэйнд хамаарах 21 endpoint, `/health`, Swagger UI, PostgreSQL migration, давтан ажиллах seed болон Postman collection багтсан.

Удирдамжийн Кино жишээг дараах байдлаар хөрвүүлсэн:

| Удирдамж | Онлайн сургалт | Холбоос |
| --- | --- | --- |
| Genre (A) | Category | Нэг ангилалд олон курс |
| Director (D) | Instructor | Нэг багш олон курстэй; багшгүй курс байж болно |
| Movie (B) | Course | Ангилал ба багш руу хоёр foreign key |
| Review (C) | Lesson | Нэг курст олон хичээл |
| isShowing | isPublished | Курс нийтлэгдсэн эсэх |
| genreId, directorId | categoryId, instructorId | Холбоотой загварын ID |

`Lesson`-д хичээлийн `title`-ийг нэмсэн. Удирдамжийн `rating`, `comment`, `authorName` талбар болон давхцлыг database-аар хориглох шаардлагыг хадгалсан: **нэг зохиогч нэг курст нэг хичээл оруулна**. Үүнийг `@@unique([courseId, authorName])` баталгаажуулна. Энэ нь бие даалтын дүрэм; бодит сургалтын системд нэг зохиогч олон хичээлтэй байж болох тул бизнесийн шаардлага өөр бол unique дүрмийг өөрчилнө.

## 2. Асаах

### Шаардлагатай зүйл

- Node.js 22 LTS ба npm.
- PostgreSQL 18, эсвэл Docker Desktop / Docker Compose.
- Git.

### A. Docker-оор PostgreSQL асаах

Төслийн хавтас дотроос:

```powershell
Copy-Item .env.example .env
docker compose up -d
npm ci
npm run prisma:generate
npm run db:deploy
npm run seed
npm start
```

macOS / Linux дээр эхний мөр нь:

```sh
cp .env.example .env
```

Үлдсэн npm болон Docker команд ижил. PostgreSQL-ийн healthcheck healthy болсны дараа migration-аа ажиллуулна. Шалгах команд:

```sh
docker compose ps
```

`DATABASE_URL`-ийн жишээ:

```dotenv
DATABASE_URL="postgresql://learning:learning_local@localhost:5432/online_learning?schema=public"
PORT=3000
```

`learning_local` нь зөвхөн локал хөгжүүлэлтийн жишээ нууц үг. Өөр орчинд URL болон нууц үгээ `.env` дотроо тохируулна. PostgreSQL-ийн 5432 порт ашиглагдаж байвал `.env` дотор `PG_PORT=5433` гэж нэмж, `DATABASE_URL`-ийн портыг мөн 5433 болгоно.

### B. Компьютерт PostgreSQL суусан бол

Docker шаардлагагүй. PostgreSQL хэрэглэгчээрээ pgAdmin Query Tool эсвэл psql-д дараах SQL-ийг нэг удаа ажиллуулж болно:

```sql
CREATE ROLE learning WITH LOGIN PASSWORD 'learning_local';
CREATE DATABASE online_learning OWNER learning;
```

Role эсвэл database аль хэдийн байвал дахин үүсгэхгүй. Дараа нь `.env.example`-ийг `.env` болгож хуулан URL-аа тохируулаад `npm ci`-гээс эхлэн дээрх npm командуудыг ажиллуулна. Сервер асаах хэрэглэгч database-ийн эзэмшигч буюу migration хийх эрхтэй байна.

### Нээх хаягууд

- Health: <http://localhost:3000/health>
- Swagger UI: <http://localhost:3000/docs>
- Курсууд: <http://localhost:3000/courses>

`/health` нь `{ "status": "ok" }` буцаана. `PORT`-оо өөрчилсөн бол URL-ийн портыг мөн солино.

## 3. Өгөгдлийн загвар

| Model | Талбарууд |
| --- | --- |
| Category | id, name (unique), createdAt |
| Instructor | id, name, birthYear?, createdAt |
| Course | id, title, year, durationMin, description?, isPublished, categoryId, instructorId?, createdAt |
| Lesson | id, title, rating, comment?, authorName, courseId, createdAt |

`id` болон `createdAt`-ийг сервер/database үүсгэнэ. `Course` нь Int, String, Boolean, DateTime төрлүүдийг бүгдийг агуулна. `instructorId`, `description`, `birthYear`, `comment` нь nullable.

### Устгах гурван дүрэм

1. **Category → Course: Restrict.** Курстэй ангиллыг устгавал курсуудын утга алдагдана. Тиймээс эхлээд курсуудыг өөр ангилалд шилжүүлэх эсвэл устгах ёстой. Database foreign key устгалтыг хориглож, API 409 буцаана.
2. **Instructor → Course: SetNull.** Багш системээс хасагдсан ч курс өөрөө хэрэгтэй хэвээр. Багшийг устгахад курсууд үлдэж, `instructorId` нь `null` болно. Иймээс энэ foreign key заавал nullable байна.
3. **Course → Lesson: Cascade.** Хичээл нь тодорхой курсын хэсэг тул курсгүй хичээл үлдээхгүй. Курсыг устгахад түүний бүх хичээлийг database нэг холбоосын дүрмээр хамт устгана.

Эдгээрийг зөвхөн JavaScript кодоор дуурайлгаагүй. `schema.prisma` болон migration SQL дэх foreign key constraint database-ийн түвшинд мөрдүүлнэ.

## 4. Endpoint-ууд

| # | Method | Хаяг | Хариуны код |
| --- | --- | --- | --- |
| 1 | GET | /categories | 200, 400 |
| 2 | GET | /categories/:id | 200, 400, 404 |
| 3 | POST | /categories | 201, 400, 409 |
| 4 | PATCH | /categories/:id | 200, 400, 404, 409 |
| 5 | DELETE | /categories/:id | 204, 400, 404, 409 |
| 6 | GET | /instructors | 200, 400 |
| 7 | GET | /instructors/:id | 200, 400, 404 |
| 8 | POST | /instructors | 201, 400 |
| 9 | PATCH | /instructors/:id | 200, 400, 404 |
| 10 | DELETE | /instructors/:id | 204, 400, 404 |
| 11 | GET | /courses | 200, 400 |
| 12 | GET | /courses/:id | 200, 400, 404 |
| 13 | POST | /courses | 201, 400 |
| 14 | PATCH | /courses/:id | 200, 400, 404 |
| 15 | DELETE | /courses/:id | 204, 400, 404 |
| 16 | GET | /categories/:id/courses | 200, 400, 404 |
| 17 | GET | /instructors/:id/courses | 200, 400, 404 |
| 18 | GET | /courses/:id/lessons | 200, 400, 404 |
| 19 | POST | /courses/:id/lessons | 201, 400, 404, 409 |
| 20 | PATCH | /lessons/:id | 200, 400, 404, 409 |
| 21 | DELETE | /lessons/:id | 204, 400, 404 |

URL-ийн ID эерэг бүхэл тоо биш бол DELETE зэрэг бүх үйлдэл 400 өгнө. Хичээлийн зохиогчийн нэрийг PATCH-аар солих үед өөр хичээлтэй unique давхцал үүсвэл мөн 409 өгнө. Эдгээр нь удирдамжийн нийтлэг дүрмийг бүрэн хэрэгжүүлсэн нэмэлт тохиолдол юм.

Ангилал, багшийн detail нь `_count.courses`-тай. Курсын detail нь `category`, `instructor`, `_count.lessons`, нэмэлт `averageRating`-тай. Хичээлгүй бол `averageRating` нь `null`.

### Үүсгэх жишээнүүд

```json
{ "name": "Веб хөгжүүлэлт" }
```

```json
{ "name": "Б. Дөлгөөн", "birthYear": 1994 }
```

```json
{
  "title": "REST API практик",
  "year": 2026,
  "durationMin": 480,
  "description": "Express ба PostgreSQL ашигласан дадлага",
  "isPublished": true,
  "categoryId": 1,
  "instructorId": 1
}
```

Дээрх ID-уудыг `GET /categories`, `GET /instructors`-оос авсан бодит ID-аар солино. `POST /courses/:id/lessons`-ийн body:

```json
{
  "title": "HTTP хүсэлт ба хариу",
  "rating": 5,
  "comment": "HTTP method болон status code-ийн дадлага",
  "authorName": "Б. Дөлгөөн"
}
```

`courseId`-ийг URL-ээс авдаг учраас body-д дахин өгөхгүй.

## 5. Query ба хуудаслалт

`GET /courses` дээр дараах параметрүүдийг хамтад нь хэрэглэж болно. Ангилал болон багшийн nested course жагсаалт мөн эдгээрийг дэмжинэ.

| Query | Дүрэм / жишээ |
| --- | --- |
| q | title эсвэл description доторх хайлт; үсгийн том/жижгийг ялгахгүй |
| categoryId | Эерэг бүхэл тоо |
| instructorId | Эерэг бүхэл тоо |
| hasInstructor | `true` эсвэл `false`; false бол багшгүй курсууд |
| minYear | 1900-аас ирэх он хүртэлх бүхэл тоо |
| maxYear | Дээрх хязгаар; minYear > maxYear бол 400 |
| isPublished | Зөвхөн `true`, `false` |
| sort | `title`, `year`, `durationMin`, `createdAt` |
| order | `asc` эсвэл `desc`; анхдагч `desc` |
| page | 1-ээс эхэлсэн бүхэл тоо; анхдагч 1 |
| limit | 1-50; анхдагч 10 |
| minRating | Нэмэлт: хичээлүүдийн дундаж үнэлгээний доод хязгаар, 1-5 |

Жишээ:

```text
/courses?q=python&minYear=2023&maxYear=2026&isPublished=true&sort=year&order=desc&page=1&limit=5
/courses?hasInstructor=false
/courses?minRating=4
/courses/1/lessons?sort=rating&order=desc&page=1&limit=10
```

`GET /categories`, `GET /instructors` нь `page`, `limit` хэрэглэнэ. Хичээлийн жагсаалт нь `page`, `limit`, `sort` (`rating` эсвэл `createdAt`), `order` хэрэглэнэ. Үл таних query, давхар ижил query болон буруу утгыг чимээгүй алгасахгүй, 400 буцаана.

Бүх хуудаслалттай хариу нэг хэлбэртэй:

```json
{
  "data": [],
  "meta": { "page": 1, "limit": 10, "total": 0, "pages": 0 }
}
```

`total` бол шүүлтүүрийн **дараах** нийт тоо. `pages = Math.ceil(total / limit)`. Нийт хуудаснаас хэтэрсэн зөв page өгвөл хоосон `data` буцаж, `total` хэвээр байна.

## 6. Validation ба алдаа

- POST нь заавал талбаруудаа шаарддаг; PATCH нь зөвхөн ирсэн талбаруудыг засна.
- Текстийг trim хийж, хоосон эсвэл дан зайтай утгыг 400 болгоно.
- `name`, `title`, `authorName` дээд тал нь 200; `description` 5000; `comment` 2000 тэмдэгт.
- `rating` 1-5 бүхэл тоо; `year` 1900-аас ирэх он хүртэл; `durationMin` эерэг бүхэл тоо.
- `birthYear` 1900-аас одоогийн он хүртэл байна.
- Boolean body талбар нь JSON `true`/`false` байна; `"true"` гэсэн string зөвшөөрөхгүй.
- `id`, `createdAt` зэрэг бичих эрхгүй эсвэл model-д байхгүй body талбарыг 400 болгоно.
- Байхгүй `categoryId`/`instructorId`-тай курс үүсгэх эсвэл засахад 400.
- Байхгүй URL-ийн record 404; unique болон Category Restrict зөрчил 409.
- JSON body нь объект байна. Эвдэрсэн JSON, массив болон буруу төрлүүдэд алдааны JSON хариу ирнэ.

Алдааны хэлбэр:

```json
{ "message": "...", "field": "rating" }
```

Талбартай холбоогүй алдаанд `field` байхгүй. Клиентэд Prisma-ийн дотоод алдаа болон stack trace буцаахгүй. Prisma кодыг HTTP status болгон хувиргах логик зөвхөн `errorHandler` middleware-д байна.

## 7. Seed

```sh
npm run seed
npm run seed
```

Шинэ database-д хоёр удаа ажиллуулсан ч 5 ангилал, 6 багш, 25 курс, 60 хичээл байна. Яг 3 курс багшгүй. Курсын он 2021-2026, нэр ба хичээлийн гарчиг нь сургалтын бодит агуулгатай. Seed нь transaction дотор ажиллана.

Seed нь ангиллын unique нэр, багшийн нэр, курсын нэр+ангиллаар өөрийн бичлэгээ олж дахин ашиглана. Хичээлийг `courseId_authorName` compound unique-аар upsert хийнэ. Бүх хүснэгтийг цэвэрлэхгүй, хэрэглэгчийн нэмсэн өөр бичлэгүүдийг устгахгүй. Иймд өмнө нь нэмэлт өгөгдөлтэй database-ийн нийт тоо seed-ийн тооноос их байж болно. Хоёр seed процессыг зэрэг ажиллуулахгүй.

## 8. Шалгах

### Swagger

`/docs` дээр Category, Instructor, Course, Lesson гэсэн дөрвөн бүлэг байна. `Try it out`-аар body болон query-гаа оруулан хүсэлт явуулна. `openapi.yaml`-д schema, requestBody, амжилтын болон алдааны response-ууд бий. `page`, `limit`-ийг components.parameters-аас `$ref`-ээр ашиглана.

### Postman

1. `postman_collection.json`-ийг Postman-д import хийнэ.
2. Collection variable `baseUrl`-ийг `http://localhost:3000` болгоно.
3. Collection Runner-оор бүх хүсэлтийг дарааллаар ажиллуулна.
4. Collection өөрийн demo бичлэгүүдийг үүсгэж, ID-уудыг response-оос хадгалдаг. 400, 404, 409 болон устгалтын дүрмүүдийг шалгах хүсэлтүүд багтсан.

### Автомат integration test

Үндсэн database-ийн өгөгдөлд хүрэхгүйн тулд **тусдаа test database** үүсгэнэ:

```sql
CREATE DATABASE online_learning_test OWNER learning;
```

`.env` дотор:

```dotenv
TEST_DATABASE_URL="postgresql://learning:learning_local@localhost:5432/online_learning_test?schema=public"
```

Test database-д migration-аа нэг удаа хэрэглэнэ. PowerShell дээр доорх URL-ийг өөрийн `TEST_DATABASE_URL`-ийн утгатай тааруулна:

```powershell
$env:DATABASE_URL = 'postgresql://learning:learning_local@localhost:5432/online_learning_test?schema=public'
npm run db:deploy
Remove-Item Env:DATABASE_URL
npm test
```

macOS / Linux:

```sh
DATABASE_URL='postgresql://learning:learning_local@localhost:5432/online_learning_test?schema=public' npm run db:deploy
npm test
```

`npm test` нь `.env` дэх `TEST_DATABASE_URL`-ийг ашиглана. Test нь test database-ийн domain хүснэгтүүдийг цэвэрлэдэг тул үндсэн database руу заахгүй. Database-ийн нэрэнд `_test` байх, `DATABASE_URL`-аас тусдаа database байх хамгаалалттай.

Хамгийн түрүүнд гараар шалгах жишээнүүд:

```text
GET /courses/abc                       -> 400
GET /courses/2147483647                -> 404
GET /courses?limit=100                 -> 400
GET /courses?sort=password             -> 400
GET /courses?page=0                    -> 400
GET /courses?minYear=2020&maxYear=2000  -> 400
PATCH /lessons/:id  {"rating":7}       -> 400
PATCH /courses/:id  {"id":5}           -> 400
GET /abc                              -> 404 JSON
```

## 9. Бүтэц ба кодын урсгал

```text
online-learning-api/
  prisma/
    schema.prisma
    migrations/
    seed.js
  src/
    app.js
    db.js
    routes/
    controllers/
    middleware/
    utils/
  tests/
  docs/DEFENSE_MN.md
  openapi.yaml
  postman_collection.json
  docker-compose.yml
  .env.example
  .gitignore
  package.json
  package-lock.json
```

Хүсэлт: `logger -> JSON parser -> route -> validation -> controller -> Prisma -> PostgreSQL`. Алдаа гарвал төвлөрсөн `errorHandler` руу орно. Таарах route байхгүй бол `notFound` 404 өгнө. Route нь замыг controller-той холбодог; runtime database query-г controller дотор хийнэ. `db.js` нь Prisma client-ийн нэг instance-ийг экспортолно. Seed ба test нь тусдаа зориулалтын database скрипт юм.

Logger нь method, URL, status, зарцуулсан хугацааг ms-ээр хэвлэнэ. Өгөгдлийн сангийн алдаа, validation алдаа, эвдэрсэн JSON зэрэг нь хариуг нэг хэлбэрээр буцаадаг.

## 10. Git ба GitHub-д илгээх

Энэ төслийн Git түүхийг дараах байдлаар үзнэ:

```sh
git log --oneline
git rev-list --count HEAD
git status --short
```

Илгээхээс өмнө нэр, кодоо солиод өөрчлөлтөө commit хийнэ. `.env`, `node_modules`, локал database болон test-ийн нууц тохиргоог commit хийхгүй. `.env.example` ба lockfile нь repository-д байна.

GitHub дээр хоосон repository үүсгээд:

```sh
git remote add origin https://github.com/YOUR_USERNAME/online-learning-api.git
git push -u origin main
```

`YOUR_USERNAME`-ийг өөрийн GitHub нэрээр солино. Remote өмнө нь байгаа бол `git remote -v`-ээр шалгана. Private repository бол багшийг collaborator-оор нэмнэ. GitHub-д push хийсний дараа шинэ хавтсанд clone хийгээд 2-р хэсгийн алхмаар дахин асааж шалгана.

## 11. Мэдэж байгаа хязгаарлалт

- Энэ нь бие даалтын API; хэрэглэгчийн бүртгэл, нэвтрэлт, эрхийн удирдлага, төлбөр, видео файл хадгалах үйлдэл агуулаагүй.
- `authorName` нь хэрэглэгчийн хүснэгттэй холбоогүй текст тул нэрийг өөрөөр бичвэл өөр зохиогч гэж үзнэ. Category нэр ба зохиогчийн unique нь database-ийн string харьцуулалтаар шийдэгдэнэ.
- `Lesson.rating` болон нэг зохиогч-нэг курс дүрэм нь удирдамжийн C загварын шаардлагыг хадгалсан сонголт; сургалтын платформын ердийн домэйнд дахин загварчлах боломжтой.
- Bonus `minRating` нь хичээлүүдийн rating-ийн дунджийг ашигладаг; хичээлгүй курс ийм шүүлтүүрт орохгүй.
- Маш том өгөгдөлд дундаж үнэлгээний шүүлтүүр болон хайлтыг тусгай индекс/тайлангийн шийдлээр оновчлох шаардлагатай.

## 12. Хамгаалалт ба эх сурвалж

12 минутын demo, код тайлбарлах асуултууд, жижиг өөрчлөлтийн дасгалыг [Монгол хамгаалалтын заавар](docs/DEFENSE_MN.md)-аас үзнэ. Хамгаалалтаас өмнө өөрөө ажиллуулж, мөр бүрийн зорилгыг тайлбарлаж сурах хэрэгтэй.

- [Express алдаа боловсруулах заавар](https://expressjs.com/en/guide/error-handling.html)
- [Prisma referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions)
- [Prisma compound unique](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-composite-ids-and-constraints)
- [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [OpenAPI 3.0 specification](https://spec.openapis.org/oas/v3.0.3.html)
