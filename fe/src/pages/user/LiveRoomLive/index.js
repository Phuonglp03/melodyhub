// src/pages/liveroom_live/index.js
// src/pages/liveroom_live/index.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
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
  onUserBanned,
  onMessageRemoved
} from '../../../services/user/socketService';
import { Select, Dropdown, Button } from 'antd';
import { MoreOutlined, SendOutlined, SmileOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import EmojiPicker from 'emoji-picker-react';

const LiveStreamLive = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState(null);

  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const [liveTitle, setLiveTitle] = useState("");
  const [privacy, setPrivacy] = useState('public');
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);

  // Stats
  const [peakViewers, setPeakViewers] = useState(0);
  const [duration, setDuration] = useState(0);

  // Video.js refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    initSocket();

    const fetchRoom = async () => {
      try {
        const roomData = await livestreamService.getLiveStreamById(roomId);
        const currentUserId = user?.user?.id;
        const hostId = roomData.hostId?._id;
        const history = await livestreamService.getChatHistory(roomId);
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
        setMessages(history.slice(-20));
      } catch (err) {
        setError('Không tìm thấy phòng live hoặc stream đã kết thúc.');
        setLoading(false);
      }
    };

    fetchRoom();

    // Lắng nghe các sự kiện socket
    onNewMessage((message) => {
      setMessages(prev => {
        const newMessages = [...prev, message].slice(-20);
        return newMessages;
      });
    });

    onStreamEnded(() => {
      alert("Livestream đã kết thúc.");
      navigate('/');
    });

    onStreamDetailsUpdated((details) => {
      setLiveTitle(details.title);
    });
    
    onMessageRemoved((data) => {
      setMessages(prev => prev.map(msg =>
        msg._id === data.messageId ? { ...msg, message: 'Tin nhắn này đã bị gỡ', deleted: true } : msg
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
      // Cleanup Video.js player
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [roomId, navigate]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize Video.js player when playback URL is available
  useEffect(() => {
    // Cleanup function
    const cleanup = () => {
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (e) {
          console.error('[Video.js] Dispose error:', e);
        }
        playerRef.current = null;
      }
    };

    if (playbackUrl && videoRef.current && !playerRef.current) {
      // Đợi một chút để DOM sẵn sàng
      setTimeout(() => {
        if (!videoRef.current) return;

        try {
          const player = videojs(videoRef.current, {
            autoplay: true,
            muted: true,
            controls: true,
            fluid: false,
            fill: true,
            liveui: true,
            liveTracker: {
              trackingThreshold: 20,
              liveTolerance: 15
            },
            controlBar: {
              progressControl: false,
              currentTimeDisplay: false,
              timeDivider: false,
              durationDisplay: false,
              remainingTimeDisplay: false,
              seekToLive: true
            },
            html5: {
              vhs: {
                enableLowInitialPlaylist: true,
                smoothQualityChange: true,
                overrideNative: true,
                bandwidth: 4194304,
                limitRenditionByPlayerDimensions: false
              },
              nativeAudioTracks: false,
              nativeVideoTracks: false
            }
          });

          player.src({
            src: playbackUrl,
            type: 'application/x-mpegURL'
          });

          playerRef.current = player;

          player.on('error', (e) => {
            const error = player.error();
            console.error('[Video.js] Error:', error);
            console.error('[Video.js] Error details:', {
              code: error?.code,
              message: error?.message,
              type: error?.type
            });
          });

          player.on('loadedmetadata', () => {
            console.log('[Video.js] Metadata loaded');
          });

          player.on('loadeddata', () => {
            console.log('[Video.js] Data loaded');
          });

          player.on('canplay', () => {
            console.log('[Video.js] Can play');
            player.play().catch(e => {
              console.error('[Video.js] Play error:', e);
            });
          });

          player.on('playing', () => {
            console.log('[Video.js] Playing');
          });

          player.on('waiting', () => {
            console.log('[Video.js] Waiting/Buffering');
          });

          // Log player ready
          player.ready(() => {
            console.log('[Video.js] Player ready');
            console.log('[Video.js] Current source:', player.currentSrc());
          });

        } catch (error) {
          console.error('[Video.js] Initialization error:', error);
        }
      }, 100);
    }

    return cleanup;
  }, [playbackUrl]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(roomId, chatInput.trim());
      setChatInput("");
      setShowPicker(false); // Đóng emoji picker sau khi gửi
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

  const onEmojiClick = (emojiObject) => {
    setChatInput(prevInput => prevInput + emojiObject.emoji);
  };

  const handleBan = async (userId, messageId) => {
    try {
      await livestreamService.banUser(roomId, userId, { messageId });
      setMessages(prev => prev.map(msg =>
        msg._id === messageId ? { ...msg, message: 'Tin nhắn này đã bị gỡ', deleted: true } : msg
      ));
    } catch (err) {
      console.error('Lỗi ban:', err);
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
            marginBottom: '20px',
            width: '100%',
            aspectRatio: '16/9'
          }}>
            {playbackUrl ? (
              <>
                <div data-vjs-player style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative'
                }}>
                  <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered vjs-16-9"
                    playsInline
                    preload="auto"
                  />
                </div>
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
                  zIndex: 1000,
                  pointerEvents: 'none'
                }}>
                  Trực Tiếp
                </div>
              </>
            ) : (
              <div style={{
                height: '100%',
                minHeight: '400px',
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
              }}>Thông tin chi tiết</h3>

              <div style={{
                display: 'flex',
                gap: '24px',
                justifyContent: 'space-around'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#b0b3b8', marginBottom: '8px' }}>👁️</div>
                  <div style={{ fontSize: '24px', fontWeight: '600', marginBottom: '4px' }}>0</div>
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

        {/* Right Panel - Chat */}
        <div style={{
          width: '360px',
          background: '#18191a',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
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

            <div className="chat-messages" ref={chatRef} style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              minHeight: '300px'
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
                    gap: '10px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#3a3b3c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      fontSize: '16px'
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
                        {msg.deleted ? 'Tin nhắn này đã bị gỡ' : msg.message}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#65676b',
                        marginTop: '4px',
                        display: 'flex',
                        gap: '12px'
                      }}>
                        <span style={{ cursor: 'pointer' }}></span>
                      </div>
                    </div>
                    {room.hostId._id === user && msg.userId._id !== user && !msg.deleted && (
                      <Dropdown
                        menu={{
                          items: [
                            { key: 'ban', label: 'Ban vĩnh viễn' },
                          ],
                          onClick: ({ key }) => {
                            if (key === 'ban') {
                              handleBan(msg.userId._id, msg._id);
                            }
                          }
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button type="text" icon={<MoreOutlined />} style={{ padding: 0 }} />
                      </Dropdown>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{
              padding: '16px',
              borderTop: '1px solid #3a3b3c',
              position: 'relative'
            }}>
              {showPicker && (
                <div style={{ 
                  position: 'absolute', 
                  bottom: '70px', 
                  left: '16px',
                  right: '16px',
                  zIndex: 1000
                }}>
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    searchDisabled={true}
                    previewConfig={{ showPreview: false }}
                    height={350}
                    width="100%"
                    skinTonesDisabled
                  />
                </div>
              )}
              <form onSubmit={handleSendChat} style={{ 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <button
                  type="button" 
                  onClick={() => setShowPicker(!showPicker)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '8px',
                    color: '#b0b3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <SmileOutlined />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Viết bình luận..."
                  style={{
                    flex: 1,
                    padding: '10px 40px 10px 12px',
                    background: '#3a3b3c',
                    color: '#e4e6eb',
                    border: '1px solid #4a4b4c',
                    borderRadius: '20px',
                    fontSize: '15px',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    padding: '8px',
                    color: '#0084ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <SendOutlined />
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
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#e4e6eb' }}>00:00:00</div>
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