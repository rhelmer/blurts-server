import { Router } from 'express'

import { asyncMiddleware } from '../../../middleware/util.js'
import { requireSessionUser } from '../../../middleware/auth.js'
import { methodNotAllowed } from '../../../middleware/error.js'
import { putBreachResolution, getBreaches } from '../../../controllers/breaches.js'
import { addEmail, resendEmail, removeEmail, verifyEmail } from '../../../controllers/settings.js'

const router = Router()
// breaches
router.put('/breaches', requireSessionUser, asyncMiddleware(putBreachResolution))
router.get('/breaches', requireSessionUser, asyncMiddleware(getBreaches))
router.post('/email', requireSessionUser, asyncMiddleware(addEmail))
router.post('/resend-email', requireSessionUser, asyncMiddleware(resendEmail))
router.post('/remove-email', requireSessionUser, asyncMiddleware(removeEmail))
router.get('/verify-email', asyncMiddleware(verifyEmail))
router.use(methodNotAllowed)
export default router
