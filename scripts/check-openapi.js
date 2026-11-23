const parser = require('@apidevtools/swagger-parser');
const path = require('node:path');
(async () => {
  const spec = await parser.validate(path.join(__dirname, '..', 'openapi.yaml'));
  const count = Object.values(spec.paths).reduce((n, item) => n + Object.keys(item).filter(k => ['get', 'post', 'patch', 'delete'].includes(k)).length, 0);
  if (count !== 21) throw new Error(`Expected 21 domain operations, received ${count}`);
  console.log(`OpenAPI valid: ${count} domain operations, ${spec.tags.length} tags.`);
})().catch(err => { console.error(err.message); process.exitCode = 1; });
