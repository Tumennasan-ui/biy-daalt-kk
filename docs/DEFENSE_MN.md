# Хамгаалалтад бэлтгэх заавар

Энэ материал нь кодоо ойлгож, өөрөө ажиллуулж тайлбарлахад зориулагдсан. Шууд цээжлэхийн оронд жишээ бүрийг Swagger дээр туршиж, database-д юу өөрчлөгдсөнийг шалгаарай.

## 1. Хамгаалалтаас өмнө

1. README дэх нэр, бүтэн кодоо бөглөнө. Кодын сүүлийн цифр 1 гэдгийг хэлнэ.
2. `npm ci`, `npm run prisma:generate`, `npm run db:deploy`, `npm run seed`, `npm start` командуудаар асааж чаддаг болно.
3. `/docs`, `/health`, `/courses`-ийг нээж шалгана.
4. Seed-ийг хоёр удаа ажиллуулж, шинэ database-д 5 ангилал, 6 багш, 25 курс, 60 хичээл хэвээр байгааг батална.
5. Postman collection-ийг бүхэлд нь ажиллуулж, алдаатай тохиолдлын хариуг уншина.
6. `git log --oneline`, `git status`-ийг үзнэ. `.env` болон `node_modules` tracking-д ороогүй байна.

Эхэлж хэлэх тайлбар:

> Миний сэдэв бол онлайн сургалт. Category нь сургалтын ангилал, Instructor нь багш, Course нь курс, Lesson нь курсын хичээл. Course хоёр foreign key-тэй. Ангиллыг устгахыг Restrict-ээр хориглодог, багшийг устгахад SetNull ажилладаг, курсыг устгахад хичээлүүд Cascade-аар хамт устдаг.

## 2. Эхний 4 минутын demo

Swagger `/docs`-ийг урьдчилан нээсэн байна. Demo бичлэгийн ID-уудыг үүсгэх бүрт response-оос тэмдэглэнэ; seed ID-г таахгүй.

### 0:00-0:40 - Category ба Instructor

`POST /categories`:

```json
{ "name": "Хамгаалалтын веб сургалт" }
```

Category ID-г `categoryId` гэж тэмдэглэнэ. Ижил нэрээр дахин POST хийхэд 409 байдгийг богино харуулж болно.

`POST /instructors`:

```json
{ "name": "Б. Дөлгөөн", "birthYear": 1994 }
```

Instructor ID-г `instructorId` гэж тэмдэглэнэ.

### 0:40-1:20 - Course ба Lesson

`POST /courses` дээр доорх 1 гэсэн хоёр ID-г сая үүсгэсэн бодит ID-аар солино:

```json
{
  "title": "REST API хамгаалалтын курс",
  "year": 2026,
  "durationMin": 480,
  "description": "HTTP ба Express-ийн практик сургалт",
  "isPublished": true,
  "categoryId": 1,
  "instructorId": 1
}
```

Course ID-г тэмдэглээд `POST /courses/{courseId}/lessons`:

```json
{
  "title": "HTTP method ба status code",
  "rating": 5,
  "comment": "CRUD хүсэлтийн жишээтэй хичээл",
  "authorName": "Б. Дөлгөөн"
}
```

Нэг курст ижил `authorName`-аар дахин хичээл нэмбэл database-ийн compound unique-ээс 409 ирнэ. `rating: 7` бол database хүрэхээс өмнө validation 400 болгоно.

### 1:20-2:00 - Шүүлтүүр ба meta

`GET /courses` дээр хэд хэдэн параметрийг хамт өгнө:

```text
q=REST
minYear=2023
maxYear=2026
isPublished=true
sort=durationMin
order=asc
page=1
limit=5
```

Тайлбар:

> Эдгээр шүүлтүүрийг Prisma where-д нэгтгэнэ. Хайлт title эсвэл description дотор, том жижиг үсэг ялгахгүй ажиллана. `total` нь бүх курсын тоо биш, шүүлтүүрт таарсан нийт тоо. `pages` нь total-ийг limit-д хуваагаад дээш бүхэлчилсэн утга.

Дараа нь `limit=100`, эсвэл `minYear=2026&maxYear=2020` өгч 400 харуулна. `GET /courses/{courseId}`-оос `category`, `instructor`, `_count.lessons`, `averageRating`-ийг заана.

### 2:00-4:00 - Устгалтын гурван дүрэм

1. `DELETE /categories/{categoryId}` → **409**. Дотор нь demo курс байгаа тул database устгахгүй.
2. `DELETE /instructors/{instructorId}` → **204**. Дараа нь `GET /courses/{courseId}` → **200**, `instructorId: null`, `instructor: null`. Курс үлдсэн.
3. `DELETE /courses/{courseId}` → **204**. Дараа нь өмнөх Lesson ID-аар `PATCH /lessons/{lessonId}` хүсэлт `{ "rating": 4 }` явуулахад **404**. Хичээл курстэйгээ хамт устсан.
4. `DELETE /categories/{categoryId}` → **204**. Одоо хоосон учраас устна.

204 response body байхгүй байдгийг хэлнэ. Дараагийн demo-д өмнөх нэрийг дахин ашиглах бол өмнөх ангилал устсаныг шалгана.

## 3. Дараагийн 5 минут: код тайлбарлах

### Request-ийн урсгал

```text
HTTP request
  -> logger
  -> JSON parser
  -> route
  -> body/query validation
  -> controller
  -> Prisma Client
  -> PostgreSQL
  -> JSON response
```

Алдаа үүсвэл `errorHandler` руу дамжина. Route таараагүй тохиолдолд `notFound` 404 өгдөг.

### Файлуудын үүрэг

| Файл / хавтас | Тайлбарлах зүйл |
| --- | --- |
| prisma/schema.prisma | Дөрвөн model, nullable foreign key, unique, onDelete |
| prisma/migrations | Prisma schema-г PostgreSQL constraint/table болгосон SQL |
| prisma/seed.js | Transaction, upsert, давтан ажиллахад давхцахгүй seed |
| src/db.js | PrismaClient-ийн нэг instance |
| src/app.js | Middleware-ийн дараалал, Swagger, route, error handler |
| src/server.js | Port дээр сонсох, shutdown хийх серверийн эхлэл |
| src/routes | URL болон HTTP method-ийг controller-той холбох |
| src/controllers | HTTP үйлдэл, database query, response |
| src/middleware/validate.js | Model тус бүрийн body дүрэм, POST/PATCH ялгаа |
| src/middleware/errorHandler.js | Prisma-ийн кодыг HTTP status болгож нэг хэлбэрээр хариулах |
| src/middleware/logger.js | Method, URL, status, хугацааг хэвлэх |
| src/utils/query.js | ID, bool query, pagination, sort, course filter шалгах |
| openapi.yaml | 21 endpoint-ийн Swagger баримт |
| postman_collection.json | Амжилт болон алдааны хүсэлтүүд |

### Түгээмэл асуулт ба хариулт

**Яагаад Prisma-г route дотор дуудаагүй вэ?**

Route нь хаяг ямар controller ажиллуулахыг л шийддэг. Database үйлдлийг controller-д байрлуулбал URL зохион байгуулалт ба бизнесийн үйлдлийг тусад нь ойлгож, засахад хялбар.

**Foreign key гэж юу вэ?**

Course-ийн `categoryId` нь Category-ийн `id`-г заана. Database тэр ангилал байх ёстойг шалгадаг. `instructorId` нь nullable учраас курс багшгүй байж болно. Үүнийг string нэрээр бус ID-аар холбоно.

**Яагаад `@@unique([courseId, authorName])` хэрэгтэй вэ?**

Зөвхөн controller-д өмнө нь байна уу гэж шалгавал хоёр хүсэлт зэрэг ирэх үед хоёулаа хоосон гэж харах боломжтой. Database unique constraint нь зэрэг ирсэн ч давхардлыг хориглоно. Prisma P2002 алдааг errorHandler 409 болгодог.

**Яагаад Lesson-д rating ба authorName байгаа вэ?**

Удирдамжийн C загварын rating, authorName, compound unique шаардлагыг онлайн сургалтын Lesson загварт хадгалсан. Хичээлийн нэрийг ойлгомжтой байлгахын тулд title нэмсэн. Нэг зохиогч нэг курст нэг хичээл гэсэн хязгаар нь энэ бие даалтын сонголт; бодит LMS-д бизнесийн шаардлагаар өөрчилнө.

**Restrict, SetNull, Cascade ялгаа юу вэ?**

Restrict нь холбоотой record байгаа үед устгахыг хориглоно. SetNull нь child-ийг үлдээгээд foreign key-г null болгоно. Cascade нь child record-уудыг хамт устгана. SetNull ашиглах талбар заавал nullable байна.

**400, 404, 409-ийн ялгаа юу вэ?**

400 бол request-ийн утга буруу; жишээ нь `rating: 7`, тоо биш ID, байхгүй categoryId. 404 бол URL-д заасан record эсвэл route олдоогүй. 409 бол request дангаараа зөв ч одоогийн database төлөвтэй зөрчилтэй; жишээ нь давхардсан ангилал, курстэй ангиллыг устгах.

**PATCH нь POST-оос юугаараа өөр вэ?**

POST шинэ record тул required талбаруудыг шаардана. PATCH зөвхөн body-д ирсэн талбаруудыг шалгаад засдаг. Дутуу явуулсан талбарыг undefined/null болгож дарж бичихгүй. Хоосон PATCH body-г 400 болгоно. Nullable талбарт илт `null` өгвөл утгыг цэвэрлэж болно.

**Яагаад `id`, `createdAt` body-д зөвшөөрдөггүй вэ?**

Тэдгээр нь сервер/database-ийн хариуцах талбар. Client дур мэдэн үндсэн түлхүүр болон үүссэн огноог өөрчлөх ёсгүй. Validation allowlist-д байхгүй талбар бүр 400 болно.

**Query дэх `false` яагаад тусгай шалгалттай вэ?**

URL query нь string ирдэг. JavaScript-ийн `Boolean('false')` нь true болдог тул шууд хөрвүүлж болохгүй. Зөвхөн `'true'` эсвэл `'false'` гэдгийг шалгаад харгалзах boolean болгоно.

**Pagination хэрхэн ажилладаг вэ?**

`skip = (page - 1) * limit`, `take = limit`. Ижил where нөхцөлөөр database-ийн нийт count-ийг авна. `pages = Math.ceil(total / limit)`. Limit 1-50, page 1-ээс багагүй байна. Sort талбарууд allowlist-тэй, ижил утгатай record-уудыг ID-аар давхар эрэмбэлж тогтвортой хуудаслана.

**Хайлт SQL injection-д яаж хандаж байна вэ?**

Хайлтын утгыг SQL string-т залгахгүй, Prisma-ийн `contains` зэрэг query параметрт өгдөг. Эрэмбэлэх талбарыг зөвшөөрсөн нэрсээс сонгуулдаг. Энэ нь validation-аа алгасах шалтгаан биш.

**Prisma алдаа хаана HTTP status болдог вэ?**

`errorHandler.js` дотор. P2002 → 409, P2003 → foreign key-ийн нөхцөлөөс 400/409, P2025 → 404. Controller дотор Prisma error code-ийг тус тусад нь шалгадаггүй. Гэнэтийн алдаанд 500 ба ерөнхий message өгнө.

**Ямар ч body server-ийг унагаахгүй гэдгийг яаж хангах вэ?**

JSON parser эвдэрсэн JSON-ийг алдаа болгож errorHandler руу дамжуулна. Validation массив, null, буруу төрөл, үл таних талбарыг шалгадаг. Async controller-ийн reject болсон promise Express 5-аар error handler руу орно. Server response өгсөөр байгааг алдааны хүсэлтийн дараах `/health`-ээр шалгана.

**Seed яагаад давтан ажилладаг вэ?**

Category-г unique нэрээр upsert хийнэ. Instructor ба Course-ийн seed бичлэгийг тогтвортой нэрээр олж дахин ашиглана. Lesson-г compound unique-аар upsert хийнэ. Хүснэгтүүдийг deleteMany хийж цэвэрлэдэггүй тул бусад өгөгдлийг устгахгүй. Нэг transaction дотор тул дундаас нь алдаа гарвал хэсэгчлэн хадгалахгүй.

**Average rating болон minRating юу боддог вэ?**

Тухайн курсын Lesson.rating-уудын арифметик дундаж. Detail нь averageRating өгдөг. MinRating шүүлтүүр нь дундаж нь босгоос багагүй course-уудыг үлдээнэ. Хичээлгүй курс averageRating null тул minRating шүүлтүүрт орохгүй.

## 4. Сүүлийн 3 минут: шинэ query нэмэх дасгал

Жишээ даалгавар: `GET /courses?minDuration=300` нь 300 минутаас урт эсвэл тэнцүү курсыг харуулдаг болго.

### 1. Зөвшөөрөгдөх query-д нэмэх

`src/utils/query.js` дэх `courseQuery` функцийн `allow(...)` жагсаалтад `'minDuration'` нэмнэ. Үүнийг нэмэхгүй бол шинэ параметр шууд 400 болно.

### 2. Parse, validation, where

`where` үүсгэсний дараа:

```js
if (query.minDuration !== undefined) {
  where.durationMin = { gte: id(query.minDuration, 'minDuration') };
}
```

`id(...)` нь эерэг бүхэл тоо ба Int хязгаарыг шалгадаг тул `abc`, `0`, сөрөг тоо 400 болно. Prisma-ийн `gte` нь greater than or equal буюу их буюу тэнцүү гэсэн утгатай.

### 3. Шалгах

```text
GET /courses?minDuration=300                -> 200, бүгд durationMin >= 300
GET /courses?minDuration=300&q=python        -> 200, хоёуланг хангана
GET /courses?minDuration=abc                -> 400, field=minDuration
GET /courses?minDuration=0                  -> 400
```

`total` мөн энэ where-ээр тоологдож байгааг шалгана. Дараа нь Swagger parameter болон Postman хүсэлтийг нэмж, өөрчлөлтөө commit хийнэ. Дээрх нь **дасгалын жишээ**; minDuration одоогийн API-ийн хэрэгжсэн query биш.

## 5. Өөрөө хариулж чаддаг байх богино жагсаалт

- Дөрвөн model ба гурван холбоосыг цаасан дээр зурах.
- Course-ийн хоёр foreign key аль нь required, аль нь optional болохыг хэлэх.
- Гурван устгалтын дүрмийг database түвшинд тайлбарлах.
- Compound unique-г авч хаявал юу болохыг тайлбарлах.
- Body validation ба query validation-ийн төрлийн ялгааг тайлбарлах.
- POST ба PATCH required талбарын ялгааг хэлэх.
- Async алдаа errorHandler-д яаж хүрдгийг тайлбарлах.
- Where, orderBy, skip, take, count-ийн үүргийг хэлэх.
- Seed-ийг хоёр удаа ажиллуулахад яагаад давхцахгүйг хэлэх.
- Шинэ parameter нэмэхэд query helper, Swagger, Postman/test-ийн аль хэсгийг засахаа олох.

Кодын хэсгийг тайлбарлаж чадахгүй байвал тэр хэсгийг өөрөө жижиг жишээгээр дахин ажиллуулж ойлгоно. Бэлтгэсэн кодтой байх нь хамгаалалтын тайлбарыг орлохгүй.
