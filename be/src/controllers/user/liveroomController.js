import { v4 as uuidv4 } from 'uuid';
import LiveRoom from '../../models/LiveRoom.js';
import { getSocketIo } from '../../config/socket.js';

export const createLiveStream = async (req, res) => {
  const { title, description } = req.body;
  // const hostId = req.user.id;
  const tempHostId = "68f4c1e698eb9dde067d4856"; 
  const hostId = tempHostId; 


  try {
    const streamKey = uuidv4();

    const newRoom = new LiveRoom({
      hostId,
      title: title || null,
      description: description || null,
      streamKey,
      status: 'waiting',
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



export const goLive = async (req, res) => {
  const hostId = "68f4c1e698eb9dde067d4856"; 
  
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
  const hostId = "68f4c1e698eb9dde067d4856"; 
  
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
  const hostId = "68f4c1e698eb9dde067d4856"; 
  const { id } = req.params;
  const { title, description } = req.body;

  try {
    const room = await LiveRoom.findOne({ _id: id, hostId: hostId });

    if (!room) {
      return res.status(404).json({ message: 'Không tìm thấy phòng live hoặc bạn không có quyền.' });
    }
    
    if (room.status !== 'live' && room.status !== 'preview') {
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