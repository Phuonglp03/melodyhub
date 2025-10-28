import { Router } from 'express';
// import { authMiddleware, hostMiddleware } from '../middleware/auth.middleware.js';
import {
    createLiveStream,

    goLive,
    endLiveStream,
    updateLiveStreamDetails
  } from '../../controllers/user/liveroomController.js';

const router = Router();



// Create live room 
router.post('/',  createLiveStream);

//Update stream title and description
router.patch('/:id/details',  updateLiveStreamDetails);

//  Go live (status'preview' -> 'live')
router.patch( '/:id/go-live',goLive);

// End live (status'live' -> 'ended')
router.patch( '/:id/end',endLiveStream);

export default router;