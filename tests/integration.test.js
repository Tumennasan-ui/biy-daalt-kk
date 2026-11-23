'use strict';

// These tests intentionally use a real PostgreSQL database. Never point them at
// coursework/demo data: the hooks delete every row from the four domain tables.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required. Create a separate online_learning_test database.');
}
const testUrl = new URL(testDatabaseUrl);
const testDatabase = decodeURIComponent(testUrl.pathname.slice(1));
if (!testDatabase.includes('_test')) {
  throw new Error('Refusing destructive tests: the database name must contain _test.');
}
if (process.env.DATABASE_URL) {
  const normalUrl = new URL(process.env.DATABASE_URL);
  if (normalUrl.host === testUrl.host && normalUrl.pathname === testUrl.pathname) {
    throw new Error('TEST_DATABASE_URL must use a database separate from DATABASE_URL.');
  }
}
process.env.DATABASE_URL = testDatabaseUrl;

const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/db');
const api = request(app);
let fixture;

function checkError(response, status, field) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.equal(typeof response.body.message, 'string');
  assert.ok(response.body.message.length > 0);
  assert.ok(Object.keys(response.body).every((key) => ['message', 'field'].includes(key)));
  if (field) assert.equal(response.body.field, field);
  if ('field' in response.body) assert.equal(typeof response.body.field, 'string');
}

function checkPage(response, expectedTotal, page = 1, limit = 10) {
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.ok(Array.isArray(response.body.data));
  assert.deepEqual(response.body.meta, {
    page, limit, total: expectedTotal, pages: Math.ceil(expectedTotal / limit),
  });
}

async function cleanDatabase() {
  await prisma.lesson.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.instructor.deleteMany();
}

before(async () => { await prisma.$connect(); });
beforeEach(async () => {
  await cleanDatabase();
  const category = await prisma.category.create({ data: { name: 'Programming' } });
  const secondCategory = await prisma.category.create({ data: { name: 'Databases' } });
  const instructor = await prisma.instructor.create({ data: { name: 'Linus Torvalds', birthYear: 1970 } });
  const otherInstructor = await prisma.instructor.create({ data: { name: 'Grace Example', birthYear: 1960 } });
  const first = await prisma.course.create({ data: {
    title: 'Alpha JavaScript', description: 'Learn asynchronous WEB programming',
    year: 2022, durationMin: 90, isPublished: true,
    categoryId: category.id, instructorId: instructor.id,
  } });
  const second = await prisma.course.create({ data: {
    title: 'Beta SQL', description: 'Relational databases and joins',
    year: 2024, durationMin: 120, isPublished: false,
    categoryId: secondCategory.id, instructorId: instructor.id,
  } });
  const third = await prisma.course.create({ data: {
    title: 'Gamma Python', description: null, year: 2023, durationMin: 60,
    isPublished: true, categoryId: category.id, instructorId: null,
  } });
  const unrated = await prisma.course.create({ data: {
    title: 'Delta Unrated', year: 2025, durationMin: 30, isPublished: true,
    categoryId: category.id, instructorId: otherInstructor.id,
  } });
  const lesson = await prisma.lesson.create({ data: {
    title: 'Arrays', rating: 5, authorName: 'Alice', courseId: first.id,
  } });
  const anotherLesson = await prisma.lesson.create({ data: {
    title: 'Functions', rating: 3, authorName: 'Bob', comment: 'Practical examples', courseId: first.id,
  } });
  await prisma.lesson.create({ data: { title: 'SQL joins', rating: 5, authorName: 'Alice', courseId: second.id } });
  await prisma.lesson.create({ data: { title: 'Python basics', rating: 1, authorName: 'Carol', courseId: third.id } });
  fixture = { category, secondCategory, instructor, otherInstructor, first, second, third, unrated, lesson, anotherLesson };
});
after(async () => {
  try { await cleanDatabase(); } finally { await prisma.$disconnect(); }
});

test('health and unmatched routes return JSON without a stack trace', async () => {
  const health = await api.get('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: 'ok' });
  checkError(await api.get('/there-is-no-such-route'), 404);
  checkError(await api.post('/courses/not/a/route').send({}), 404);
});

test('all six paginated lists use the same response envelope and filtered totals', async () => {
  const { category, instructor, first } = fixture;
  const lists = [
    ['/categories', 2], ['/instructors', 2], ['/courses', 4],
    [`/categories/${category.id}/courses`, 3],
    [`/instructors/${instructor.id}/courses`, 2],
    [`/courses/${first.id}/lessons`, 2],
  ];
  for (const [url, total] of lists) {
    checkPage(await api.get(url), total);
    const response = await api.get(url).query({ page: 2, limit: 1 });
    checkPage(response, total, 2, 1);
    assert.equal(response.body.data.length, total >= 2 ? 1 : 0);
    const beyond = await api.get(url).query({ page: 20, limit: 1 });
    checkPage(beyond, total, 20, 1);
    assert.deepEqual(beyond.body.data, []);
  }
});

test('single-resource responses include course relationships and counts', async () => {
  const { category, instructor, first, unrated } = fixture;
  const categoryResult = await api.get(`/categories/${category.id}`);
  assert.equal(categoryResult.status, 200);
  assert.equal(categoryResult.body._count.courses, 3);
  const instructorResult = await api.get(`/instructors/${instructor.id}`);
  assert.equal(instructorResult.status, 200);
  assert.equal(instructorResult.body._count.courses, 2);
  const courseResult = await api.get(`/courses/${first.id}`);
  assert.equal(courseResult.status, 200);
  assert.equal(courseResult.body.category.id, category.id);
  assert.equal(courseResult.body.instructor.id, instructor.id);
  assert.equal(courseResult.body._count.lessons, 2);
  assert.equal(courseResult.body.averageRating, 4);
  const unratedResult = await api.get(`/courses/${unrated.id}`);
  assert.equal(unratedResult.status, 200);
  assert.equal(unratedResult.body.averageRating, null);
  const list = await api.get('/courses');
  assert.ok(list.body.data.every((course) => course.category && '_count' in course && 'instructor' in course));
});

test('category CRUD trims names, detects duplicates and protects linked courses', async () => {
  const created = await api.post('/categories').send({ name: '  Mathematics  ' });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Mathematics');
  const id = created.body.id;
  checkError(await api.post('/categories').send({ name: 'Mathematics' }), 409);
  const patched = await api.patch(`/categories/${id}`).send({ name: 'Applied mathematics' });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.name, 'Applied mathematics');
  checkError(await api.patch(`/categories/${id}`).send({ name: fixture.category.name }), 409);
  checkError(await api.delete(`/categories/${fixture.category.id}`), 409);
  assert.equal((await prisma.course.findMany()).length, 4);
  const deleted = await api.delete(`/categories/${id}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, '');
  checkError(await api.get(`/categories/${id}`), 404);
  checkError(await api.patch(`/categories/${id}`).send({ name: 'Gone' }), 404);
  checkError(await api.delete(`/categories/${id}`), 404);
});

test('instructor CRUD supports nullable birthYear and SetNull without deleting courses', async () => {
  const created = await api.post('/instructors').send({ name: '  New Instructor  ', birthYear: 1985 });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'New Instructor');
  const patched = await api.patch(`/instructors/${created.body.id}`).send({ birthYear: null });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.birthYear, null);
  assert.equal(patched.body.name, 'New Instructor');
  assert.equal((await api.delete(`/instructors/${created.body.id}`)).status, 204);
  checkError(await api.get(`/instructors/${created.body.id}`), 404);
  checkError(await api.patch(`/instructors/${created.body.id}`).send({ name: 'Gone' }), 404);
  checkError(await api.delete(`/instructors/${created.body.id}`), 404);
  assert.equal((await api.delete(`/instructors/${fixture.instructor.id}`)).status, 204);
  const courses = await prisma.course.findMany({ where: { id: { in: [fixture.first.id, fixture.second.id] } } });
  assert.equal(courses.length, 2);
  assert.ok(courses.every((course) => course.instructorId === null));
  assert.equal(await prisma.lesson.count(), 4);
});

test('course CRUD validates references, preserves omitted fields and cascades lessons', async () => {
  const data = { title: '  New Course  ', year: 2024, durationMin: 45, categoryId: fixture.category.id };
  const created = await api.post('/courses').send(data);
  assert.equal(created.status, 201);
  assert.equal(created.body.title, 'New Course');
  assert.equal(created.body.isPublished, true);
  assert.equal(created.body.instructorId, null);
  const patched = await api.patch(`/courses/${created.body.id}`).send({ description: ' Updated ' });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.description, 'Updated');
  assert.equal(patched.body.title, 'New Course');
  assert.equal(patched.body.year, 2024);
  const cleared = await api.patch(`/courses/${created.body.id}`).send({ description: null, instructorId: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.description, null);
  for (const body of [{ ...data, categoryId: 2147483647 }, { ...data, instructorId: 2147483647 }]) {
    checkError(await api.post('/courses').send(body), 400);
  }
  for (const body of [{ categoryId: 2147483647 }, { instructorId: 2147483647 }]) {
    checkError(await api.patch(`/courses/${created.body.id}`).send(body), 400);
  }
  const deleted = await api.delete(`/courses/${fixture.first.id}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, '');
  assert.equal(await prisma.lesson.count({ where: { courseId: fixture.first.id } }), 0);
  assert.equal(await prisma.lesson.count(), 2);
  checkError(await api.get(`/courses/${fixture.first.id}`), 404);
  checkError(await api.patch(`/courses/${fixture.first.id}`).send({ title: 'Gone' }), 404);
  checkError(await api.delete(`/courses/${fixture.first.id}`), 404);
});

test('lesson CRUD enforces compound uniqueness and permits partial nullable updates', async () => {
  const url = `/courses/${fixture.first.id}/lessons`;
  const data = { title: '  Promises  ', rating: 4, authorName: '  Dara  ', comment: '  Useful  ' };
  const created = await api.post(url).send(data);
  assert.equal(created.status, 201);
  assert.equal(created.body.title, 'Promises');
  assert.equal(created.body.authorName, 'Dara');
  assert.equal(created.body.comment, 'Useful');
  assert.equal(created.body.courseId, fixture.first.id);
  checkError(await api.post(url).send(data), 409);
  assert.equal((await api.post(`/courses/${fixture.second.id}/lessons`).send(data)).status, 201);
  const patched = await api.patch(`/lessons/${created.body.id}`).send({ rating: 2, comment: null });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.title, 'Promises');
  assert.equal(patched.body.rating, 2);
  assert.equal(patched.body.comment, null);
  checkError(await api.patch(`/lessons/${created.body.id}`).send({ authorName: 'Alice' }), 409);
  const deleted = await api.delete(`/lessons/${created.body.id}`);
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, '');
  checkError(await api.patch(`/lessons/${created.body.id}`).send({ rating: 3 }), 404);
  checkError(await api.delete(`/lessons/${created.body.id}`), 404);
});

test('course filters combine, search ignores case and totals reflect filters', async () => {
  const cases = [
    [{ q: 'javascript' }, ['Alpha JavaScript']],
    [{ q: 'web' }, ['Alpha JavaScript']],
    [{ q: 'DOES NOT EXIST' }, []],
    [{ categoryId: fixture.category.id }, ['Alpha JavaScript', 'Delta Unrated', 'Gamma Python']],
    [{ instructorId: fixture.instructor.id }, ['Alpha JavaScript', 'Beta SQL']],
    [{ hasInstructor: false }, ['Gamma Python']],
    [{ hasInstructor: true }, ['Alpha JavaScript', 'Beta SQL', 'Delta Unrated']],
    [{ minYear: 2023, maxYear: 2024 }, ['Beta SQL', 'Gamma Python']],
    [{ isPublished: false }, ['Beta SQL']],
    [{ isPublished: true, categoryId: fixture.category.id, hasInstructor: false, q: 'python', minYear: 2022, maxYear: 2024 }, ['Gamma Python']],
    [{ instructorId: fixture.instructor.id, hasInstructor: false }, []],
    [{ categoryId: 2147483647 }, []],
    [{ minRating: 4 }, ['Alpha JavaScript', 'Beta SQL']],
    [{ minRating: 4.5 }, ['Beta SQL']],
    [{ minRating: 5 }, ['Beta SQL']],
  ];
  for (const [query, titles] of cases) {
    const response = await api.get('/courses').query({ ...query, sort: 'title', order: 'asc' });
    checkPage(response, titles.length);
    assert.deepEqual(response.body.data.map((course) => course.title), titles);
  }
  const filteredPage = await api.get('/courses').query({ isPublished: true, sort: 'title', order: 'asc', page: 2, limit: 1 });
  checkPage(filteredPage, 3, 2, 1);
  assert.equal(filteredPage.body.data[0].title, 'Delta Unrated');
  const parentConflict = await api.get(`/categories/${fixture.category.id}/courses`).query({ categoryId: fixture.secondCategory.id });
  checkPage(parentConflict, 0);
  const instructorConflict = await api.get(`/instructors/${fixture.instructor.id}/courses`).query({ instructorId: fixture.otherInstructor.id });
  checkPage(instructorConflict, 0);
});

test('course and lesson sorting supports the documented whitelists', async () => {
  const cases = [
    ['title', 'asc', ['Alpha JavaScript', 'Beta SQL', 'Delta Unrated', 'Gamma Python']],
    ['year', 'desc', ['Delta Unrated', 'Beta SQL', 'Gamma Python', 'Alpha JavaScript']],
    ['durationMin', 'asc', ['Delta Unrated', 'Gamma Python', 'Alpha JavaScript', 'Beta SQL']],
  ];
  for (const [sort, order, titles] of cases) {
    const result = await api.get('/courses').query({ sort, order });
    checkPage(result, 4);
    assert.deepEqual(result.body.data.map((course) => course.title), titles);
  }
  checkPage(await api.get('/courses').query({ sort: 'createdAt', order: 'desc' }), 4);
  const ascending = await api.get(`/courses/${fixture.first.id}/lessons`).query({ sort: 'rating', order: 'asc' });
  checkPage(ascending, 2);
  assert.deepEqual(ascending.body.data.map((lesson) => lesson.rating), [3, 5]);
  const descending = await api.get(`/courses/${fixture.first.id}/lessons`).query({ sort: 'rating', order: 'desc' });
  assert.deepEqual(descending.body.data.map((lesson) => lesson.rating), [5, 3]);
  checkPage(await api.get(`/courses/${fixture.first.id}/lessons`).query({ sort: 'createdAt', order: 'asc' }), 2);
});

test('every id-bearing route rejects malformed ids and returns 404 for absent records', async () => {
  const idCases = [
    ['get', '/categories/ID'], ['patch', '/categories/ID', { name: 'Valid' }], ['delete', '/categories/ID'],
    ['get', '/instructors/ID'], ['patch', '/instructors/ID', { name: 'Valid' }], ['delete', '/instructors/ID'],
    ['get', '/courses/ID'], ['patch', '/courses/ID', { title: 'Valid' }], ['delete', '/courses/ID'],
    ['get', '/categories/ID/courses'], ['get', '/instructors/ID/courses'], ['get', '/courses/ID/lessons'],
    ['post', '/courses/ID/lessons', { title: 'Valid', rating: 3, authorName: 'Nobody' }],
    ['patch', '/lessons/ID', { rating: 3 }], ['delete', '/lessons/ID'],
  ];
  for (const [method, url, body] of idCases) {
    for (const [id, status] of [['abc', 400], ['2147483647', 404]]) {
      let action = api[method](url.replace('ID', id));
      if (body) action = action.send(body);
      checkError(await action, status);
    }
  }
  for (const id of ['0', '-1', '1.5', '1e3', '2147483648', 'NaN', 'Infinity']) {
    checkError(await api.get(`/courses/${id}`), 400);
  }
});

test('POST and PATCH reject unknown fields, invalid shapes and empty changes', async () => {
  const endpoints = [
    ['post', '/categories', { name: 'Valid category' }],
    ['patch', `/categories/${fixture.category.id}`, { name: 'Valid category' }],
    ['post', '/instructors', { name: 'Valid instructor' }],
    ['patch', `/instructors/${fixture.instructor.id}`, { name: 'Valid instructor' }],
    ['post', '/courses', { title: 'Valid course', year: 2024, durationMin: 30, categoryId: fixture.category.id }],
    ['patch', `/courses/${fixture.first.id}`, { title: 'Valid course' }],
    ['post', `/courses/${fixture.first.id}/lessons`, { title: 'Valid lesson', rating: 4, authorName: 'Different' }],
    ['patch', `/lessons/${fixture.lesson.id}`, { title: 'Valid lesson' }],
  ];
  for (const [method, url, valid] of endpoints) {
    for (const field of ['id', 'createdAt', 'unexpected']) {
      checkError(await api[method](url).send({ ...valid, [field]: 5 }), 400);
    }
    for (const body of [[], ['bad'], {}, null]) {
      let action = api[method](url);
      action = body === null ? action.set('Content-Type', 'application/json').send('null') : action.send(body);
      checkError(await action, 400);
    }
  }
});

test('text, numeric and boolean body validations are strict and field-specific', async () => {
  const courseBase = { title: 'Course', year: 2024, durationMin: 30, categoryId: fixture.category.id };
  const lessonBase = { title: 'Lesson', rating: 3, authorName: 'New author' };
  const yearAfterNext = new Date().getFullYear() + 2;
  const bodyCases = [
    ['/categories', { name: '   ' }, 'name'],
    ['/categories', { name: 123 }, 'name'],
    ['/categories', { name: null }, 'name'],
    ['/categories', { name: 'a'.repeat(201) }, 'name'],
    ['/instructors', { name: 'A', birthYear: 1899 }, 'birthYear'],
    ['/instructors', { name: 'A', birthYear: new Date().getFullYear() + 1 }, 'birthYear'],
    ['/instructors', { name: 'A', birthYear: '1980' }, 'birthYear'],
    ['/courses', { ...courseBase, title: '\t\n' }, 'title'],
    ['/courses', { ...courseBase, description: '   ' }, 'description'],
    ['/courses', { ...courseBase, description: {} }, 'description'],
    ['/courses', { ...courseBase, year: 1899 }, 'year'],
    ['/courses', { ...courseBase, year: yearAfterNext }, 'year'],
    ['/courses', { ...courseBase, year: 2024.5 }, 'year'],
    ['/courses', { ...courseBase, year: '2024' }, 'year'],
    ['/courses', { ...courseBase, durationMin: 0 }, 'durationMin'],
    ['/courses', { ...courseBase, durationMin: -1 }, 'durationMin'],
    ['/courses', { ...courseBase, durationMin: 1.5 }, 'durationMin'],
    ['/courses', { ...courseBase, categoryId: null }, 'categoryId'],
    ['/courses', { ...courseBase, categoryId: '1' }, 'categoryId'],
    ['/courses', { ...courseBase, instructorId: -1 }, 'instructorId'],
    ['/courses', { ...courseBase, isPublished: 'true' }, 'isPublished'],
    ['/courses', { ...courseBase, isPublished: 1 }, 'isPublished'],
    [`/courses/${fixture.first.id}/lessons`, { ...lessonBase, rating: 0 }, 'rating'],
    [`/courses/${fixture.first.id}/lessons`, { ...lessonBase, rating: 6 }, 'rating'],
    [`/courses/${fixture.first.id}/lessons`, { ...lessonBase, rating: 2.5 }, 'rating'],
    [`/courses/${fixture.first.id}/lessons`, { ...lessonBase, rating: '3' }, 'rating'],
    [`/courses/${fixture.first.id}/lessons`, { ...lessonBase, authorName: '  ' }, 'authorName'],
    [`/courses/${fixture.first.id}/lessons`, { ...lessonBase, comment: ' ' }, 'comment'],
    [`/courses/${fixture.first.id}/lessons`, { ...lessonBase, title: null }, 'title'],
  ];
  for (const [url, body, field] of bodyCases) {
    checkError(await api.post(url).send(body), 400, field);
  }
  const nextYear = await api.post('/courses').send({ ...courseBase, year: new Date().getFullYear() + 1 });
  assert.equal(nextYear.status, 201);
  checkError(await api.patch(`/lessons/${fixture.lesson.id}`).send({ rating: 7 }), 400, 'rating');
  checkError(await api.patch(`/courses/${fixture.first.id}`).send({ isPublished: 'false' }), 400, 'isPublished');
});

test('pagination rejects invalid, repeated, unknown and overflowing query inputs', async () => {
  const listUrls = [
    '/categories', '/instructors', '/courses',
    `/categories/${fixture.category.id}/courses`,
    `/instructors/${fixture.instructor.id}/courses`, `/courses/${fixture.first.id}/lessons`,
  ];
  const invalidQueries = [
    'page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=', 'page=1e2',
    'limit=0', 'limit=51', 'limit=100', 'limit=-2', 'limit=abc', 'limit=1.5',
    'page=1&page=2', 'limit=1&limit=2', 'page[x]=1', 'limit[]=1',
    'page=2147483647&limit=50', 'unknown=value',
  ];
  for (const url of listUrls) {
    for (const query of invalidQueries) checkError(await api.get(`${url}?${query}`), 400);
  }
  checkPage(await api.get('/courses?limit=50'), 4, 1, 50);
});

test('course and lesson filters reject every undocumented or malformed value', async () => {
  const invalid = [
    'q=', 'q=%20%20', 'q=a&q=b', 'q[x]=a',
    'categoryId=abc', 'categoryId=0', 'categoryId=1.5', 'categoryId=2147483648',
    'instructorId=abc', 'instructorId=-1',
    'hasInstructor=1', 'hasInstructor=False', 'hasInstructor=',
    'isPublished=yes', 'isPublished=True', 'isPublished=1',
    'minYear=1899', `maxYear=${new Date().getFullYear() + 2}`, 'minYear=2020&maxYear=2000',
    'minYear=2020.5', 'maxYear=abc', 'sort=password', 'sort=rating',
    'order=ascending', 'order=ASC', 'sort=title&sort=year',
    'minRating=0', 'minRating=5.1', 'minRating=abc', 'minRating=NaN',
  ];
  for (const query of invalid) checkError(await api.get(`/courses?${query}`), 400);
  for (const query of ['sort=title', 'sort=password', 'order=up', 'rating=3', 'q=Arrays']) {
    checkError(await api.get(`/courses/${fixture.first.id}/lessons?${query}`), 400);
  }
  for (const url of ['/categories', '/instructors']) {
    checkError(await api.get(`${url}?sort=name`), 400);
  }
});

test('malformed JSON, primitive JSON and oversized requests return errors while server stays healthy', async () => {
  for (const raw of ['{', '{"name":}', '"primitive"', '42', 'true', 'null']) {
    checkError(await api.post('/categories').set('Content-Type', 'application/json').send(raw), 400);
  }
  const oversized = await api.post('/categories').send({ name: 'a'.repeat(200000) });
  assert.ok([400, 413].includes(oversized.status));
  assert.equal(typeof oversized.body.message, 'string');
  const healthy = await api.get('/health');
  assert.equal(healthy.status, 200);
  assert.deepEqual(healthy.body, { status: 'ok' });
});

test('course substring search treats percent, underscore and backslash as literal characters', async () => {
  const categoryId = fixture.category.id;
  await prisma.course.createMany({ data: [
    { title: 'Percent 100% Ready', description: 'Literal signs', year: 2024, durationMin: 30, categoryId },
    { title: 'Under_score Search', description: 'Literal identifiers', year: 2024, durationMin: 30, categoryId },
    { title: 'Windows Path', description: 'Assets live at C:\\lessons', year: 2024, durationMin: 30, categoryId },
    { title: 'Ordinary Percent Word', description: 'A plain course without wildcard symbols', year: 2024, durationMin: 30, categoryId },
  ] });
  const cases = [
    ['%', ['Percent 100% Ready']],
    ['_', ['Under_score Search']],
    ['\\', ['Windows Path']],
    ['100%', ['Percent 100% Ready']],
    ['UNDER_SCORE', ['Under_score Search']],
    ['C:\\lesson', ['Windows Path']],
    ['aSSETs', ['Windows Path']],
    ['PERCENT', ['Ordinary Percent Word', 'Percent 100% Ready']],
    ['_%', []],
    ['\\%', []],
  ];
  for (const [q, titles] of cases) {
    const response = await api.get('/courses').query({ q, sort: 'title', order: 'asc' });
    checkPage(response, titles.length);
    assert.deepEqual(response.body.data.map((course) => course.title), titles, `literal substring: ${q}`);
  }
});
