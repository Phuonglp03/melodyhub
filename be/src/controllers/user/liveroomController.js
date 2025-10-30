import { v4 as uuidv4 } from 'uuid';
import LiveRoom from '../../models/LiveRoom.js';
import UserFollow from '../../models/UserFollow.js';
import { getSocketIo } from '../../config/socket.js';

export const createLiveStream = async (req, res) => {
  const { title, description, privacyType } = req.body;
  const hostId = req.userId;


  try {
    const streamKey = uuidv4();

    const newRoom = new LiveRoom({
      hostId,
      title: title || null,
      description: description || null,
      streamKey,
      status: 'waiting',
      privacyType: privacyType || 'public',
    });

    await newRoom.save();
    
    const result = await LiveRoom.findById(newRoom._id).populate('hostId', 'displayName avatarUrl');

    res.status(201).json({
      message: 'Tạo phòng live thành công. Hãy dùng stream key để bắt đầu.',
      room: result
    });

  } catch (err) {
    console.error('Lỗi khi tạo live stream:', err);
    res.status(500).json({ message: 'Lỗi server khi tạo phòng.' });
  }
};

export const getLiveStreamById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.query.userId;
    const stream = await LiveRoom.findById(id)
      .populate('hostId', 'displayName username avatarUrl');

    if (!stream || stream.status === 'ended') {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc phòng đã kết thúc.' });
    }
    
    const hostId = stream.hostId._id.toString();
    const isHost = currentUserId && currentUserId === hostId;
    if (!isHost) {
      if (stream.privacyType === 'follow_only') {
        if (!currentUserId) {
          return res.status(401).json({ message: 'Vui lòng đăng nhập để xem stream này.' });
        }

        const isFollowing = await UserFollow.findOne({ 
          followerId: currentUserId, 
          followingId: hostId 
        });
        
        if (!isFollowing) {
          return res.status(403).json({ message: 'Stream này chỉ dành cho người theo dõi.' });
        }

      }
      if (!['live', 'ended'].includes(stream.status)) {
        return res.status(404).json({ message: 'Livestream không hoạt động hoặc đã kết thúc.' });
      }
    }

    const playbackBaseUrl = process.env.MEDIA_SERVER_HTTP_URL || 'http://localhost:8000';

    res.status(200).json({
      ...stream.toObject(),
      playbackUrls: {
        hls: `${playbackBaseUrl}/live/${stream.streamKey}/index.m3u8`,
        flv: `${playbackBaseUrl}/live/${stream.streamKey}.flv`
      }
    });

  } catch (err) {
    console.error('Lỗi khi lấy stream by id:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const updatePrivacy = async (req, res) => {
  const hostId = req.userId;
  const { id } = req.params;
  const { privacyType } = req.body; 

  if (!['public', 'follow_only'].includes(privacyType)) {
    return res.status(400).json({ message: 'Trạng thái riêng tư không hợp lệ.' });
  }

  try {
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng hoặc bạn không có quyền.' });
    }

    if (!['waiting', 'preview', 'live'].includes(room.status)) {
      return res.status(400).json({ message: 'Chỉ có thể đổi trạng thái khi đang chuẩn bị hoặc đang live.' });
    }

    room.privacyType = privacyType;
    await room.save();
    const io = getSocketIo();
    io.to(room._id.toString()).emit('stream-privacy-updated', { privacyType: room.privacyType });

    res.status(200).json({ message: 'Cập nhật quyền riêng tư thành công.', privacyType: room.privacyType });

  } catch (err) {
    console.error('Lỗi khi cập nhật privacy:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const goLive = async (req, res) => {
  const hostId = req.userId; 
  try {
    const { id } = req.params;
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc bạn không có quyền.' });
    }

    if (room.status !== 'preview') {
      return res.status(400).json({ message: 'Stream chưa sẵn sàng (chưa ở trạng thái preview).' });
    }

    if (!room.title || room.title.trim() === '') {
      return res.status(400).json({ message: 'Tiêu đề là bắt buộc để phát trực tiếp.' });
    }
    room.status = 'live';
    room.startedAt = new Date(); 
    await room.save();
    
    const result = await LiveRoom.findById(room._id).populate('hostId', 'displayName avatarUrl');
    // Thông báo cho TOÀN BỘ SERVER biết stream này BẮT ĐẦU
    const io = getSocketIo();
    io.emit('stream-started', result); 
    io.to(room._id.toString()).emit('stream-status-live', { startedAt: room.startedAt });
    res.status(200).json({ message: 'Phát trực tiếp thành công!', room: result });

  } catch (err) {
    console.error('Lỗi khi go-live:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};


export const endLiveStream = async (req, res) => {
  const hostId = req.userId;
  
  try {
    const { id } = req.params;
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc bạn không có quyền.' });
    }
    
    if (room.status === 'ended') {
       return res.status(400).json({ message: 'Stream đã kết thúc.' });
    }
    
    const wasLive = room.status === 'live';


    room.status = 'ended';
    room.endedAt = new Date();
    await room.save();


    const io = getSocketIo();

    if (wasLive) {
        io.emit('stream-ended', { roomId: room._id, title: room.title });
    }
    io.to(room._id.toString()).emit('stream-status-ended'); 
    res.status(200).json({ message: 'Đã kết thúc livestream.', room });
    


  } catch (err) {
    console.error('Lỗi khi end-live:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};

export const updateLiveStreamDetails = async (req, res) => {
  const hostId = req.userId;
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc bạn không có quyền.' });
    }
    
    if (room.status !== 'live' && room.status !== 'preview' && room.status !== 'waiting') {
      return res.status(400).json({ message: 'Chỉ có thể cập nhật khi đang ở chế độ xem trước hoặc đang live.' });
    }
    
    if (title) room.title = title;
    if (description !== undefined) room.description = description;
    
    await room.save();
    
    const updatedDetails = {
      roomId: room._id,
      title: room.title,
      description: room.description
    };

    const io = getSocketIo();
    io.to(room._id.toString()).emit('stream-details-updated', updatedDetails);
    
    // io.emit('stream-details-updated-global', updatedDetails);

    res.status(200).json({ message: 'Cập nhật thành công', details: updatedDetails });

  } catch (err) {
    console.error('Lỗi khi cập nhật chi tiết stream:', err);
    res.status(500).json({ message: 'Lỗi server.' });
  }
};