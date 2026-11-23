require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const categoryNames = ['Программчлал', 'Өгөгдлийн шинжлэх ухаан', 'Дизайн', 'Бизнес', 'Англи хэл'];
const instructorData = [
  { name: 'Б. Тэмүүлэн', birthYear: 1989 },
  { name: 'Н. Энхжин', birthYear: 1992 },
  { name: 'Д. Мөнх-Оргил', birthYear: 1987 },
  { name: 'С. Номин', birthYear: 1994 },
  { name: 'А. Билгүүн', birthYear: 1990 },
  { name: 'О. Саруул', birthYear: 1991 },
];

// title, year, minutes, category index, instructor index (null = unassigned), lesson titles
const courseData = [
  ['JavaScript суурь', 2024, 720, 0, 0, ['Хувьсагч ба өгөгдлийн төрөл', 'Функц ба массив', 'DOM ашигласан жижиг төсөл']],
  ['Node.js ба Express API', 2026, 900, 0, 0, ['HTTP хүсэлт ба хариу', 'Express router ба middleware', 'Алдаа боловсруулах API']],
  ['Python эхлэн суралцагчдад', 2023, 660, 0, 1, ['Python синтакс ба нөхцөл', 'Давталт ба цуглуулга', 'Файл боловсруулах дадлага']],
  ['PostgreSQL өгөгдлийн сан', 2025, 780, 0, 2, ['Хүснэгт ба SQL SELECT', 'Холбоос ба JOIN', 'Transaction ба constraint']],
  ['Git ба багийн ажиллагаа', 2024, 360, 0, 4, ['Commit ба өөрчлөлтийн түүх', 'Branch ба merge', 'Pull request-ийн дадлага']],
  ['Excel-ээр өгөгдөл шинжлэх', 2022, 480, 1, 1, ['Өгөгдөл цэвэрлэх', 'Pivot хүснэгт', 'Тайлангийн график']],
  ['Python Pandas практик', 2025, 600, 1, 1, ['DataFrame үүсгэх', 'Шүүлт ба бүлэглэлт', 'CSV өгөгдлийн шинжилгээ']],
  ['Магадлал ба статистик', 2023, 840, 1, 2, ['Магадлалын үндсэн дүрэм', 'Тархалт ба дундаж', 'Таамаглал шалгах']],
  ['Өгөгдөл дүрслэх үндэс', 2024, 420, 1, 3, ['Графикийн төрлөө сонгох', 'Өнгө ба тайлбар', 'Өгөгдлөөр түүх ярих']],
  ['Машин сургалтын удиртгал', 2026, 960, 1, 2, ['Сургалтын ба шалгалтын өгөгдөл', 'Шугаман регресс', 'Загварын үнэлгээ']],
  ['Figma интерфейс дизайн', 2025, 540, 2, 3, ['Frame ба auto layout', 'Интерактив prototype']],
  ['UX судалгааны арга', 2024, 480, 2, 3, ['Хэрэглэгчтэй ярилцах', 'Usability тест төлөвлөх']],
  ['Вебийн өнгө ба типографик', 2022, 300, 2, 5, ['Өнгөний зохицол', 'Уншихад хялбар үсгийн сонголт']],
  ['Дизайн систем бүтээх', 2026, 600, 2, 3, ['Token ба component', 'Component-ийн баримтжуулалт']],
  ['Adobe Illustrator суурь', 2021, 420, 2, 5, ['Вектор дүрс ба зам', 'Лого зурах дадлага']],
  ['Төслийн менежментийн үндэс', 2023, 540, 3, 4, ['Төслийн хүрээг тодорхойлох', 'Хугацаа ба эрсдэлийн төлөвлөгөө']],
  ['Дижитал маркетинг', 2025, 600, 3, 4, ['Зорилтот хэрэглэгчийн судалгаа', 'Кампанит ажлын хэмжүүр']],
  ['Санхүүгийн тайлан унших', 2024, 480, 3, 2, ['Балансын бүтэц', 'Орлого ба мөнгөн урсгал']],
  ['Гарааны бизнес төлөвлөх', 2026, 420, 3, 4, ['Үнэ цэнийн санал', 'Бизнес загварын зураглал']],
  ['Ажил хэрэгч харилцаа', 2022, 300, 3, 5, ['Албан бичгийн найруулга', 'Үр дүнтэй уулзалт']],
  ['Англи хэл A1', 2023, 720, 4, 5, ['Өөрийгөө танилцуулах', 'Өдөр тутмын яриа']],
  ['Англи хэл A2', 2024, 780, 4, 5, ['Өнгөрсөн цагийн хэрэглээ', 'Аяллын үеийн харилцаа']],
  ['IELTS Writing Task 1', 2025, 480, 4, null, ['График тайлбарлах бүтэц', 'Харьцуулсан өгүүлбэр бичих']],
  ['Англи хэлний дуудлага', 2021, 360, 4, null, ['Эгшиг ба гийгүүлэгч авиа', 'Өргөлт ба аялга']],
  ['Ажлын ярилцлагын англи хэл', 2026, 420, 4, null, ['Туршлагаа тайлбарлах', 'Түгээмэл асуултад хариулах']],
];

async function main() {
  // One transaction keeps a failed seed from leaving a partially filled database.
  // Match stable seed names instead of assuming that database IDs start at 1.
  const result = await prisma.$transaction(async (tx) => {
    const categories = [];
    for (const name of categoryNames) {
      categories.push(await tx.category.upsert({ where: { name }, update: {}, create: { name } }));
    }

    const instructors = [];
    for (const data of instructorData) {
      const existing = await tx.instructor.findFirst({ where: { name: data.name }, orderBy: { id: 'asc' } });
      instructors.push(existing
        ? await tx.instructor.update({ where: { id: existing.id }, data })
        : await tx.instructor.create({ data }));
    }

    let seededLessons = 0;
    for (const [index, row] of courseData.entries()) {
      const [title, year, durationMin, categoryIndex, instructorIndex, lessonTitles] = row;
      const data = {
        title, year, durationMin,
        description: `${title} сэдвийг тайлбар, жишээ, бие даах дадлагаар сурах онлайн сургалт.`,
        isPublished: index % 5 !== 4,
        categoryId: categories[categoryIndex].id,
        instructorId: instructorIndex === null ? null : instructors[instructorIndex].id,
      };
      const existing = await tx.course.findFirst({
        where: { title, categoryId: data.categoryId }, orderBy: { id: 'asc' },
      });
      const course = existing
        ? await tx.course.update({ where: { id: existing.id }, data })
        : await tx.course.create({ data });

      for (const [lessonIndex, lessonTitle] of lessonTitles.entries()) {
        // Each contributor can submit one lesson to a given course.
        const authorName = instructorData[(index + lessonIndex) % instructorData.length].name;
        const lessonData = {
          title: lessonTitle,
          rating: 3 + ((index + lessonIndex) % 3),
          comment: `${lessonTitle}: жишээг дагаж хийгээд бататгах дасгалыг гүйцэтгэнэ.`,
          authorName,
          courseId: course.id,
        };
        await tx.lesson.upsert({
          where: { courseId_authorName: { courseId: course.id, authorName } },
          update: lessonData,
          create: lessonData,
        });
        seededLessons += 1;
      }
    }
    return { categories: categories.length, instructors: instructors.length, courses: courseData.length, lessons: seededLessons };
  }, { timeout: 30000 });

  console.log('Seed completed:', result);
  console.log('Fresh database: 5 categories, 6 instructors, 25 courses (3 unassigned), 60 lessons.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
