// src/pages/liveroom_live/index.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactPlayer from 'react-player'; // Thư viện HLS player
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
  disconnectSocket 
} from '../../../services/user/socketService';
import { Select } from 'antd';

const getUserIdFromStorage = () => {
  const userString = localStorage.getItem('user'); //
  if (userString) {
    try {
      const user = JSON.parse(userString);
      return user._id || user.id || null;
    } catch (e) {
      return null;
    }
  }
  return null;
};

const LiveStreamLive = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  
  const [liveTitle, setLiveTitle] = useState("");
  const [privacy, setPrivacy] = useState('public'); 
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // Stats
  const [viewCount, setViewCount] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const [duration, setDuration] = useState(0);
  
  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        const roomData = await livestreamService.getLiveStreamById(roomId);
        const currentUserId = getUserIdFromStorage();
        const hostId = roomData.hostId?._id;
        if (hostId !== currentUserId) {
          setError("Bạn không có quyền truy cập vào trang này.");
          setLoading(false);
          return; 
        }
        if (roomData.status === 'preview' || roomData.status === 'waiting') {
          navigate(`/livestream/setup/${roomId}`); return;
        }
        if (roomData.status === 'ended') {
          alert('Stream đã kết thúc.');
          navigate('/'); return;
        }

        setRoom(roomData);
        setLiveTitle(roomData.title);
        
        const hlsUrl = roomData.playbackUrls?.hls;
        console.log('[LiveStream] Playback URL:', hlsUrl);
        console.log('[LiveStream] Room status:', roomData.status);
        
        if (hlsUrl) {
          setPlaybackUrl(hlsUrl);
        } else {
          console.error('[LiveStream] No HLS URL available');
        }
        
        setPrivacy(roomData.privacyType);
        setLoading(false);
        joinRoom(roomId); 
        
      } catch (err) {
        setError('Không tìm thấy phòng live hoặc stream đã kết thúc.');
        setLoading(false);
      }
    };

    fetchRoom();

    // Lắng nghe các sự kiện socket
    onNewMessage((message) => {
      setMessages(prev => [...prev, message]);
    });
    
    onStreamEnded(() => {
      alert("Livestream đã kết thúc.");
      navigate('/'); 
    });
    
    onStreamDetailsUpdated((details) => {
      setLiveTitle(details.title);
    });

    onStreamPrivacyUpdated((data) => {
      console.log('[Socket] Cập nhật privacy:', data.privacyType);
      setPrivacy(data.privacyType);
    });

    return () => {
      offSocketEvents();
      disconnectSocket();
    };
  }, [roomId, navigate]);

  // Auto start when playback URL is available
  useEffect(() => {
    if (playbackUrl) {
      console.log('[LiveStream] Playback URL set, starting counters...');
      setIsReady(true);
    }
  }, [playbackUrl]);

  // Duration counter
  useEffect(() => {
    if (!playbackUrl) return;
    
    const interval = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [playbackUrl]);

  // Simulate viewer count (replace with real data from socket)
  useEffect(() => {
    if (!playbackUrl) return;
    
    const interval = setInterval(() => {
      const randomChange = Math.floor(Math.random() * 5) - 2;
      setViewCount(prev => {
        const newCount = Math.max(0, prev + randomChange);
        setPeakViewers(p => Math.max(p, newCount));
        return newCount;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isReady]);

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(roomId, chatInput.trim());
      setChatInput("");
    }
  };
  
  const handlePrivacyChange = async (newPrivacy) => {
    setIsUpdatingPrivacy(true);
    try {
      await livestreamService.updatePrivacy(roomId, newPrivacy);
      setPrivacy(newPrivacy);
    } catch (err) {
      console.error('Lỗi đổi privacy:', err);
      setPrivacy(room.privacyType); // Rollback
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };
  
  const handleEndStream = async () => {
    if (window.confirm("Bạn có chắc muốn kết thúc livestream?")) {
      try {
        await livestreamService.endLiveStream(roomId);
        // onStreamEnded sẽ tự động được kích hoạt và chuyển hướng
      } catch (err) {
        alert("Lỗi khi kết thúc stream.");
      }
    }
  };

  if (loading) return <div style={{ color: 'white' }}>Đang tải stream...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!room) return null;

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#18191a', 
      color: 'white',
      padding: '0'
    }}>
      {/* Main Content */}
      <div style={{ 
        display: 'flex', 
        gap: '0',
        minHeight: '100vh'
      }}>
        {/* Left Panel - Video */}
        <div style={{ 
          flex: 1,
          background: '#18191a',
          padding: '20px',
          overflowY: 'auto'
        }}>
          {/* Video Player */}
          <div style={{ 
            position: 'relative',
            background: 'black',
            borderRadius: '8px',
            overflow: 'hidden',
            marginBottom: '20px'
          }}>
            {playbackUrl ? (
              <>
                <ReactPlayer
                  key={playbackUrl}
                  url={playbackUrl}
                  playing={true}
                  onReady={() => {
                    console.log('[ReactPlayer] Video ready to play');
                    setIsReady(true);
                  }}
                  onError={(e) => {
                    console.error('[ReactPlayer] Error:', e);
                  }}
                  onBuffer={() => console.log('[ReactPlayer] Buffering...')}
                  controls={true}
                  width="100%"
                  height="600px"
                  muted={false}
                  config={{
                    file: {
                      forceHLS: true,
                      hlsOptions: {
                        debug: true,
                        enableWorker: true,
                        lowLatencyMode: true,
                        maxBufferLength: 30,
                        maxMaxBufferLength: 600,
                        liveSyncDuration: 3,
                      }
                    }
                  }}
                />
                {/* Live Badge */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  background: '#ff0000',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: '4px',
                  fontWeight: '600',
                  fontSize: '14px',
                  zIndex: 10
                }}>
                  Trực Tiếp
                </div>
              </>
            ) : (
              <div style={{ 
                height: '600px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#b0b3b8',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  border: '4px solid #3a3b3c',
                  borderTop: '4px solid #0084ff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <div>Đang tải video livestream...</div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
          </div>

          {/* Video Dropdown */}
          <div style={{ marginBottom: '20px' }}>
            <Select
              defaultValue="video"
              style={{ width: '200px' }}
              size="large"
            >
              <Select.Option value="video">Video</Select.Option>
            </Select>
          </div>

          {/* Stats and Details Row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            {/* Thống kê */}
            <div style={{ 
              flex: 1,
              background: '#242526',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0',
                fontSize: '17px',
                fontWeight: '600'
              }}>Thống tin chi tiết</h3>
              
              <div style={{ 
                display: 'flex',
                gap: '24px',
                justifyContent: 'space-around'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#b0b3b8', marginBottom: '8px' }}>👁️</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>{viewCount}</div>
                  <div style={{ fontSize: '12px', color: '#b0b3b8' }}>Người xem</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#b0b3b8', marginBottom: '8px' }}>👍</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>0</div>
                  <div style={{ fontSize: '12px', color: '#b0b3b8' }}>Lượt tím</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#b0b3b8', marginBottom: '8px' }}>🎯</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>0</div>
                  <div style={{ fontSize: '12px', color: '#b0b3b8' }}>Chia sẻ</div>
                </div>
              </div>
            </div>

            {/* Chi tiết bài viết */}
            <div style={{
              flex: 1,
              background: '#242526',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0',
                fontSize: '17px',
                fontWeight: '600'
              }}>Chi tiết bài viết</h3>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                  fontSize: '15px',
                  color: '#e4e6eb',
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  {liveTitle || 'Tiêu đề chưa có'}
                </div>
                {room.description && (
                  <div style={{ 
                    fontSize: '13px',
                    color: '#b0b3b8'
                  }}>
                    {room.description}
                  </div>
                )}
              </div>

              <div>
                <label style={{ 
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#e4e6eb',
                  marginBottom: '8px'
                }}>Quyền riêng tư</label>
                <Select
                  value={privacy}
                  onChange={handlePrivacyChange}
                  loading={isUpdatingPrivacy}
                  disabled={isUpdatingPrivacy}
                  style={{ width: '100%' }}
                  size="large"
                >
                  <Select.Option value="public">Công khai</Select.Option>
                  <Select.Option value="follow_only">Chỉ người theo dõi</Select.Option>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          width: '360px',
          background: '#18191a',
          display: 'flex',
          flexDirection: 'column',
          height: '80vh',
          position: 'sticky',
          top: 0,
          padding: '12px',
          gap: '12px'
        }}>
          {/* Chat Section */}
          <div style={{
            background: '#242526',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden'
          }}>
            <div style={{ 
              padding: '16px 20px',
              borderBottom: '1px solid #3a3b3c'
            }}>
              <h3 style={{ 
                margin: 0,
                fontSize: '17px',
                fontWeight: '600'
              }}>Bình luận</h3>
            </div>

            <div style={{ 
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {messages.length === 0 ? (
                <div style={{ 
                  textAlign: 'center',
                  color: '#b0b3b8',
                  padding: '40px 20px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                  <div style={{ fontSize: '15px' }}>Chưa có bình luận nào từ người xem</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>Bắt đầu cuộc trò chuyện</div>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={msg._id || index} style={{ 
                    marginBottom: '16px',
                    display: 'flex',
                    gap: '10px'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#3a3b3c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#e4e6eb',
                        marginBottom: '4px'
                      }}>
                        {msg.userId?.displayName || 'Melodyhub'}
                      </div>
                      <div style={{ 
                        fontSize: '13px',
                        color: '#b0b3b8'
                      }}>
                        {msg.message}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#65676b',
                        marginTop: '4px',
                        display: 'flex',
                        gap: '12px'
                      }}>
                        <span style={{ cursor: 'pointer' }}>Hày quá</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ 
              padding: '16px',
              borderTop: '1px solid #3a3b3c'
            }}>
              <form onSubmit={handleSendChat} style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Viết bình luận..."
                  style={{ 
                    width: '100%',
                    padding: '10px 48px 10px 12px',
                    background: '#3a3b3c',
                    color: '#e4e6eb',
                    border: '1px solid #4a4b4c',
                    borderRadius: '20px',
                    fontSize: '15px',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '4px 8px'
                  }}
                >
                  😊
                </button>
              </form>
            </div>
          </div>

          {/* End Stream Section */}
          <div style={{
            background: '#242526',
            borderRadius: '8px',
            padding: '12px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
              color: '#b0b3b8'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#3a3b3c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>⏱️</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#e4e6eb' }}>{formatDuration(duration)}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: '#ff0000'
                }}></div>
                <span style={{ fontSize: '13px' }}>Đang ghi hình</span>
              </div>
            </div>
            <button 
              onClick={handleEndStream}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: '#ff4444',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Kết thúc video trực tiếp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamLive;