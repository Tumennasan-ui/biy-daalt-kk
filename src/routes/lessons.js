const router = require('express').Router();
const c = require('../controllers/lessons');
const validate = require('../middleware/validate');
router.patch('/:id', validate('lesson', true), c.update);
router.delete('/:id', c.remove);
module.exports = router;
