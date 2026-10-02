const express = require('express');
const Comment = require('../services/comment');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../utils/http');
const { z, idParam } = require('../utils/schemas');
const { clean } = require('../utils/text');

const router = express.Router();

router.patch('/:id', requireAuth, validate({ params: idParam, body: z.object({ content: z.string().trim().min(1).max(2000) }) }),
  asyncHandler(async (req, res) => {
    const c = await Comment.findById(req.params.id);
    if (!c || c.status !== 'visible') throw new HttpError(404, 'Comment not found');
    if (c.userId !== req.user.id) throw new HttpError(403, 'You can only edit your own comments');
    const content = clean(req.body.content);
    if (!content) throw new HttpError(400, 'Comment is empty after sanitising');
    res.json({ data: await Comment.updateContent(c.id, content) });
  }));

router.delete('/:id', requireAuth, validate({ params: idParam }), asyncHandler(async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) throw new HttpError(404, 'Comment not found');
  const admin = req.user.role === 'admin';
  if (c.userId !== req.user.id && !admin) throw new HttpError(403, 'You can only delete your own comments');
  if (admin && c.userId !== req.user.id) await Comment.hardDelete(c.id);
  else await Comment.ownerDelete(c.id);
  res.json({ data: { id: c.id, deleted: true } });
}));

module.exports = router;
