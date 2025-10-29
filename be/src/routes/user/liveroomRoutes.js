import { Router } from 'express';
import middlewareController from '../../middleware/auth.js';
import {
    createLiveStream,
    getLiveStreamById,
    goLive,
    endLiveStream,
    updateLiveStreamDetails,
    updatePrivacy
  } from '../../controllers/user/liveroomController.js';

const router = Router();
const { verifyToken } = middlewareController;

//api/livestreams/
// Create live room 
router.post('/', verifyToken, createLiveStream);

//Update stream title and description
router.patch('/:id/details', verifyToken, updateLiveStreamDetails);

//  Go live (status'preview' -> 'live')
router.patch( '/:id/go-live',verifyToken, goLive);

// Lấy thông tin chi tiết 1 phòng (Viewer)
router.get('/:id',verifyToken, getLiveStreamById);

// End live (status'live' -> 'ended')
router.patch( '/:id/end', verifyToken,endLiveStream);

// Update privacy type (Public -> Follow Only)
router.patch('/:id/privacy', verifyToken, updatePrivacy);



export default router;