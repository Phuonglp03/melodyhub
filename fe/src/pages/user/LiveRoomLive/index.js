// src/pages/liveroom_live/index.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videojs from 'video.js';
import '../../../../node_modules/video.js/dist/video-js.css';
import { livestreamService } from '../../../services/user/livestreamService';
import {
  initSocket,
  joinRoom,
  sendMessage,
  onNewMessage,
  onStreamDetailsUpdated,
  onStreamPrivacyUpdated,
  onStreamEnded,
  offSocketEvents,
  disconnectSocket,
  onMessageRemoved,
  onViewerCountUpdate,
  onChatError
} from '../../../services/user/socketService';
import { Dropdown, Button, Modal, Input, Form, Badge, Avatar, message } from 'antd';
import { 
  MoreOutlined, 
  SendOutlined, 
  SmileOutlined, 
  UserOutlined, 
  ClockCircleOutlined, 
  SettingOutlined, 
  LockOutlined, 
  GlobalOutlined,
  PoweroffOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import EmojiPicker from 'emoji-picker-react';
import LiveVideo from '../../../components/LiveVideo';

const { TextArea } = Input;

const LiveStreamLive = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // State
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Edit State
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm] = Form.useForm();

  // Viewer/Ban State
  const [isViewersModalVisible, setIsViewersModalVisible] = useState(false);
  const [isBannedModalVisible, setIsBannedModalVisible] = useState(false);
  const [currentViewers, setCurrentViewers] = useState(0);
  const [viewersList, setViewersList] = useState([]);
  
  const [bannedUsers, setBannedUsers] = useState([]);

  // Stats
  const [duration, setDuration] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatEndRef = useRef(null);

  // --- EFFECT: INIT & SOCKET ---
  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        const roomData = await livestreamService.getLiveStreamById(roomId);
        const currentUserId = user?.user?.id || user?.user?._id;
        const hostId = roomData.hostId?._id;
        const history = await livestreamService.getChatHistory(roomId);

        if (hostId !== currentUserId) {
          setError("Bạn không có quyền truy cập trang này.");
          setLoading(false);
          return;
        }
        if (roomData.status === 'preview' || roomData.status === 'waiting') {
          navigate(`/livestream/setup/${roomId}`); return;
        }
        if (roomData.status === 'ended') {
          navigate('/'); return;
        }

        setRoom(roomData);
        // Pre-fill form (Chỉ Title và Description)
        editForm.setFieldsValue({
          title: roomData.title,
          description: roomData.description
        });

        const hlsUrl = roomData.playbackUrls?.hls;
        if (hlsUrl) setPlaybackUrl(hlsUrl);

        setLoading(false);
        joinRoom(roomId);
        setMessages(history.slice(-50));
        
        setBannedUsers(roomData.bannedUsers || []);
        
      } catch (err) {
        setError('Lỗi tải phòng livestream.');
        setLoading(false);
      }
    };

    fetchRoom();

    // Listeners
    onNewMessage((message) => {
      setMessages(prev => [...prev, message].slice(-100)); 
    });

    onStreamEnded(() => {
      Modal.info({
        title: 'Kết thúc',
        content: 'Livestream đã kết thúc.',
        onOk: () => navigate('/')
      });
    });

    onStreamDetailsUpdated((details) => {
      setRoom(prev => ({ ...prev, title: details.title, description: details.description }));
    });
    
    onMessageRemoved((data) => {
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId ? { ...msg, message: 'Tin nhắn đã bị gỡ', deleted: true } : msg
      ));
    });

    onStreamPrivacyUpdated((data) => {
      setRoom(prev => ({ ...prev, privacyType: data.privacyType }));
    });

    onViewerCountUpdate((data) => {
      if (data.roomId === roomId) {
        setCurrentViewers(data.currentViewers || 0);
      }
    });

    onChatError((errorMsg) => {
      message.error(errorMsg);
    });

    return () => {
      offSocketEvents();
      disconnectSocket();
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [roomId, navigate, user, editForm]);

  // --- EFFECT: AUTO SCROLL CHAT ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- EFFECT: DURATION TIMER ---
  useEffect(() => {
    if (!room || !room.startedAt) return;
    const interval = setInterval(() => {
      const start = new Date(room.startedAt);
      const now = new Date();
      setDuration(Math.floor((now - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [room]);

  // --- EFFECT: VIDEO PLAYER ---
  useEffect(() => {
    if (playbackUrl && videoRef.current && !playerRef.current) {
      const player = videojs(videoRef.current, {
        autoplay: true,
        muted: true, 
        controls: true,
        fluid: true,
        liveui: true,
        html5: {
          vhs: {
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
            overrideNative: true,
            liveSyncDurationCount: 3,
          }
        }
      });
      player.src({ src: playbackUrl, type: 'application/x-mpegURL' });
      playerRef.current = player;
    }
  }, [playbackUrl]);

  // --- HANDLERS ---

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(roomId, chatInput.trim());
      setChatInput("");
      setShowEmojiPicker(false);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setChatInput(prev => prev + emojiObject.emoji);
  };

  const handleEndStream = () => {
    Modal.confirm({
      title: 'Kết thúc Livestream?',
      content: 'Hành động này sẽ dừng phát sóng ngay lập tức.',
      okText: 'Kết thúc ngay',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await livestreamService.endLiveStream(roomId);
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // ✅ Cập nhật: Chỉ update Title và Description
  const handleUpdateInfo = async (values) => {
    setIsSubmitting(true);
    try {
      await livestreamService.updateLiveStreamDetails(roomId, { 
        title: values.title, 
        description: values.description 
      });
      
      message.success("Đã cập nhật thông tin");
      setIsEditModalVisible(false);
    } catch (err) {
      message.error("Lỗi cập nhật");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBanAction = async (userTarget, messageId, type) => {
    const userId = userTarget._id || userTarget.id;
    try {
      if (type === 'delete') {
        await livestreamService.banUser(roomId, userId, { messageId });
        setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, deleted: true } : msg));
      } else {
        await livestreamService.banUser(roomId, userId, { messageId: null });
      }
      
      message.success(`Đã chặn ${userTarget.displayName}`);

      setBannedUsers(prev => {
        if (prev.find(u => u._id === userId)) return prev;
        return [...prev, userTarget]; 
      });

    } catch (err) {
      console.error(err);
      message.error("Không thể chặn người dùng này");
    }
  };

  const fetchViewers = async () => {
    try {
      const res = await livestreamService.getRoomViewers(roomId);
      setViewersList(res.viewers || []);
      setIsViewersModalVisible(true);
    } catch (e) { console.error(e); }
  };

  const handleUnban = async (userId) => {
    try {
      await livestreamService.unbanUser(roomId, userId);
      setBannedUsers(prev => prev.filter(u => u._id !== userId));
      message.success("Đã bỏ chặn");
    } catch (e) { 
      console.error(e);
      message.error("Lỗi khi bỏ chặn");
    }
  };

  const formatTime = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2,'0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2,'0');
    const sec = (s % 60).toString().padStart(2,'0');
    return `${h}:${m}:${sec}`;
  };

  if (loading) return <div style={{height:'100vh', background:'#000', color:'#fff', display:'flex', justifyContent:'center', alignItems:'center'}}>Loading Studio...</div>;
  if (error) return <div style={{height:'100vh', background:'#000', color:'red', display:'flex', justifyContent:'center', alignItems:'center'}}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0e0e10', color: '#efeff1' }}>
      
      {/* --- TOP HEADER BAR --- */}
      <header style={{
        height: '60px',
        background: '#18181b',
        borderBottom: '1px solid #2f2f35',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ fontWeight: '700', fontSize: '18px', color: '#fff' }}>STREAM MANAGER</div>
          <Badge status="processing" color="red" text={<span style={{color:'#ff4d4d', fontWeight:'600'}}>LIVE</span>} />
          <div style={{ background:'#2f2f35', padding:'4px 12px', borderRadius:'4px', display:'flex', alignItems:'center', gap:'8px', fontSize:'14px' }}>
            <ClockCircleOutlined /> {formatTime(duration)}
          </div>
        </div>

        <Button 
          type="primary" 
          danger 
          icon={<PoweroffOutlined />} 
          onClick={handleEndStream}
          style={{ fontWeight: '600' }}
        >
          KẾT THÚC STREAM
        </Button>
      </header>

      {/* --- MAIN CONTENT --- */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT: VIDEO & STATS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '20px' }}>
          
          {/* Video Player */}
          <div style={{ width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            {playbackUrl ? (
              <div data-vjs-player style={{ width: '100%', height: '100%' }}>
                <video ref={videoRef} className="video-js vjs-big-play-centered vjs-16-9" playsInline />
                {playerRef.current && <LiveVideo player={playerRef.current} />}
              </div>
            ) : (
              <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'#666' }}>Connecting...</div>
            )}
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div 
              onClick={fetchViewers}
              style={{ background: '#1f1f23', padding: '16px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #2f2f35', transition: '0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#bf94ff'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2f2f35'}
            >
              <div style={{ color: '#adadb8', fontSize: '13px', marginBottom: '4px' }}>Người xem trực tiếp</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#bf94ff' }}>{currentViewers}</div>
            </div>
            
            <div style={{ background: '#1f1f23', padding: '16px', borderRadius: '8px', border: '1px solid #2f2f35' }}>
              <div style={{ color: '#adadb8', fontSize: '13px', marginBottom: '4px' }}>Quyền riêng tư</div>
              <div style={{ fontSize: '16px', fontWeight: '600', display:'flex', alignItems:'center', gap:'8px' }}>
                {room.privacyType === 'public' ? <GlobalOutlined /> : <LockOutlined />}
                {room.privacyType === 'public' ? 'Công khai' : 'Người theo dõi'}
              </div>
            </div>

            <div 
              onClick={() => setIsBannedModalVisible(true)}
              style={{ background: '#1f1f23', padding: '16px', borderRadius: '8px', cursor: 'pointer', border: '1px solid #2f2f35', transition: '0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ff4d4d'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2f2f35'}
            >
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <div style={{ color: '#adadb8', fontSize: '13px', marginBottom: '4px' }}>Đã chặn</div>
                <StopOutlined style={{color:'#ff4d4d'}}/>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ff4d4d' }}>{bannedUsers.length}</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop:'4px' }}>Nhấn để quản lý</div>
            </div>
          </div>

          {/* Stream Info */}
          <div style={{ background: '#1f1f23', padding: '20px', borderRadius: '8px', border: '1px solid #2f2f35' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#fff' }}>{room.title || "Chưa có tiêu đề"}</h2>
                <p style={{ color: '#adadb8', whiteSpace: 'pre-wrap' }}>{room.description || "Chưa có mô tả"}</p>
              </div>
              <Button icon={<SettingOutlined />} onClick={() => setIsEditModalVisible(true)}>Chỉnh sửa</Button>
            </div>
          </div>
        </div>

        {/* RIGHT: CHAT */}
        <div style={{ width: '340px', background: '#18181b', borderLeft: '1px solid #2f2f35', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #2f2f35', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase', color: '#adadb8', textAlign:'center' }}>
            Trò chuyện
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 15px' }}>
            {messages.map((msg, index) => (
              <div key={msg._id || index} style={{ marginBottom: '8px', display: 'flex', gap: '8px', opacity: msg.deleted ? 0.5 : 1 }}>
                <Avatar size={24} src={msg.userId?.avatarUrl} icon={<UserOutlined />} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                    <span style={{ fontWeight: '700', color: msg.userId?._id === room.hostId._id ? '#e91916' : '#adadb8', marginRight: '6px' }}>
                      {msg.userId?.displayName || 'User'}
                    </span>
                    <span style={{ color: '#efeff1', wordWrap: 'break-word' }}>
                      {msg.deleted ? <i>Tin nhắn đã bị xóa</i> : msg.message}
                    </span>
                  </div>
                </div>
                
                {/* Mod Actions */}
                {msg.userId?._id !== user?.user?.id && !msg.deleted && (
                  <Dropdown 
                    menu={{
                      items: [
                        { key: '1', label: 'Xóa tin nhắn & Ban', onClick: () => handleBanAction(msg.userId, msg._id, 'delete') },
                        { key: '2', label: 'Chỉ cấm chat', onClick: () => handleBanAction(msg.userId, msg._id, 'mute') }
                      ]
                    }} 
                    trigger={['click']}
                  >
                    <MoreOutlined style={{ color: '#adadb8', cursor: 'pointer', transform: 'rotate(90deg)' }} />
                  </Dropdown>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div style={{ padding: '15px', borderTop: '1px solid #2f2f35', position: 'relative' }}>
            {showEmojiPicker && (
              <div style={{ position: 'absolute', bottom: '100%', right: '10px', zIndex: 10 }}>
                <EmojiPicker onEmojiClick={onEmojiClick} theme="dark" height={300} />
              </div>
            )}
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Input 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Gửi tin nhắn..."
                  style={{ borderRadius: '20px', background: '#2f2f35', border: 'none', color: '#fff', paddingRight: '30px' }}
                />
                <SmileOutlined 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#adadb8', cursor: 'pointer', fontSize: '16px' }} 
                />
              </div>
              <Button type="primary" shape="circle" icon={<SendOutlined />} htmlType="submit" disabled={!chatInput.trim()} />
            </form>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* Edit Info Modal - Đã xóa trường Privacy */}
      <Modal
        title="Chỉnh sửa thông tin"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateInfo}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
            <Input placeholder="Nhập tiêu đề livestream" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea rows={4} placeholder="Mô tả nội dung..." />
          </Form.Item>
          
          {/* Đã xóa Form.Item PrivacyType */}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button onClick={() => setIsEditModalVisible(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting}>Lưu thay đổi</Button>
          </div>
        </Form>
      </Modal>

      {/* Viewers Modal */}
      <Modal
        title={`Người xem (${viewersList.length})`}
        open={isViewersModalVisible}
        onCancel={() => setIsViewersModalVisible(false)}
        footer={null}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {viewersList.map(v => (
            <div key={v._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Avatar src={v.avatarUrl} icon={<UserOutlined />} />
              <div>
                <div style={{ fontWeight: '600' }}>{v.displayName}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>@{v.username}</div>
              </div>
            </div>
          ))}
          {viewersList.length === 0 && <div style={{textAlign:'center', color:'#999'}}>Chưa có người xem</div>}
        </div>
      </Modal>

      {/* Banned Users Modal */}
      <Modal
        title={`Danh sách chặn (${bannedUsers.length})`}
        open={isBannedModalVisible}
        onCancel={() => setIsBannedModalVisible(false)}
        footer={null}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {bannedUsers.length === 0 ? (
            <div style={{textAlign:'center', color:'#999', padding:'20px'}}>
              Chưa có người dùng nào bị chặn
            </div>
          ) : (
            bannedUsers.map(u => (
              <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar src={u.avatarUrl} icon={<UserOutlined />} />
                  <div>
                    <div style={{ fontWeight: '600' }}>{u.displayName || u.username || 'User'}</div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{u.username ? `@${u.username}` : 'Blocked'}</div>
                  </div>
                </div>
                <Button size="small" type="primary" danger ghost onClick={() => handleUnban(u._id)}>
                  Bỏ chặn
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>

    </div>
  );
};

export default LiveStreamLive;