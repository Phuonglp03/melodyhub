import React, { useState, useEffect } from 'react';
import { Layout, Input, Button, Space, Typography, Modal, Avatar, Tooltip, Popover, Badge, Spin, Empty } from 'antd';
import { FireOutlined, BellOutlined, MessageOutlined, SearchOutlined, UserOutlined, EditOutlined, MoreOutlined, ExpandOutlined } from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { livestreamService } from '../services/user/livestreamService';
import useDMConversations from '../hooks/useDMConversations';
import FloatingChatWindow from './FloatingChatWindow';
import './header.css';
const { Header } = Layout;
const { Text } = Typography;

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [chatPopoverVisible, setChatPopoverVisible] = useState(false);
  const [chatFilter, setChatFilter] = useState('all'); // 'all', 'unread', 'groups'
  const [chatSearchText, setChatSearchText] = useState('');
  const [activeChatWindows, setActiveChatWindows] = useState([]); // Array of { conversation, isMinimized, id, position }
  
  const { conversations, loading, refresh } = useDMConversations();
  
  // Update active chat windows conversations when conversations list updates
  useEffect(() => {
    setActiveChatWindows(prev => prev.map(window => {
      const updatedConv = conversations.find(c => c._id === window.conversation._id);
      if (updatedConv) {
        return { ...window, conversation: updatedConv };
      }
      return window;
    }));
  }, [conversations]);
  
  // Calculate position for new window
  const getNewWindowPosition = (isMinimized = false, windowsArray = null, targetIndex = null) => {
    const windowWidth = 340;
    const windowHeight = 520;
    const spacing = 10;
    const rightOffset = 20;
    const bottomOffset = 20; // Start from bottom
    const avatarSize = 56; // Size of minimized avatar
    const avatarSpacing = 12; // Spacing between minimized avatars
    
    // Use provided array or fallback to activeChatWindows
    const windows = windowsArray || activeChatWindows;
    
    if (isMinimized) {
      // For minimized: stack vertically from bottom right
      const minimizedWindows = windows.filter(w => w.isMinimized);
      const stackIndex = targetIndex !== null ? targetIndex : minimizedWindows.length;
      const right = rightOffset;
      const bottom = bottomOffset + (stackIndex * (avatarSize + avatarSpacing));
      return { right, bottom };
    } else {
      // For open windows: stack horizontally
      const openWindows = windows.filter(w => !w.isMinimized);
      const stackIndex = targetIndex !== null ? targetIndex : openWindows.length;
      const right = rightOffset + (stackIndex * (windowWidth + spacing));
      const bottom = 20;
      return { right, bottom };
    }
  };
  
  // Open new chat window
  const openChatWindow = (conversation) => {
    // Check if window already exists
    const existingWindow = activeChatWindows.find(w => w.conversation._id === conversation._id);
    if (existingWindow) {
      // If exists and minimized, maximize it
      if (existingWindow.isMinimized) {
        setActiveChatWindows(prev => prev.map(w => 
          w.id === existingWindow.id 
            ? { ...w, isMinimized: false }
            : w
        ));
      }
      return;
    }
    
    // Create new window
    const position = getNewWindowPosition();
    const newWindow = {
      id: `chat-${conversation._id}-${Date.now()}`,
      conversation,
      isMinimized: false,
      position
    };
    
    setActiveChatWindows(prev => [...prev, newWindow]);
  };
  
  // Close chat window and recalculate positions
  const closeChatWindow = (windowId) => {
    setActiveChatWindows(prev => {
      const remaining = prev.filter(w => w.id !== windowId);
      // Recalculate positions for all remaining windows
      return remaining.map((window) => {
        const minimizedWindows = remaining.filter(w => w.isMinimized);
        const openWindows = remaining.filter(w => !w.isMinimized);
        
        if (window.isMinimized) {
          const minimizedIndex = minimizedWindows.findIndex(w => w.id === window.id);
          const newPosition = getNewWindowPosition(true, remaining, minimizedIndex);
          return { ...window, position: newPosition };
        } else {
          const openIndex = openWindows.findIndex(w => w.id === window.id);
          const newPosition = getNewWindowPosition(false, remaining, openIndex);
          return { ...window, position: newPosition };
        }
      });
    });
  };
  
  // Minimize chat window and recalculate all positions
  const minimizeChatWindow = (windowId) => {
    setActiveChatWindows(prev => {
      const updated = prev.map(w => {
        if (w.id === windowId) {
          return { ...w, isMinimized: true };
        }
        return w;
      });
      // Recalculate positions for all windows
      return updated.map((window) => {
        const minimizedWindows = updated.filter(w => w.isMinimized);
        const openWindows = updated.filter(w => !w.isMinimized);
        
        if (window.isMinimized) {
          const minimizedIndex = minimizedWindows.findIndex(w => w.id === window.id);
          const newPosition = getNewWindowPosition(true, updated, minimizedIndex);
          return { ...window, position: newPosition };
        } else {
          const openIndex = openWindows.findIndex(w => w.id === window.id);
          const newPosition = getNewWindowPosition(false, updated, openIndex);
          return { ...window, position: newPosition };
        }
      });
    });
  };
  
  // Maximize chat window and recalculate all positions
  const maximizeChatWindow = (windowId) => {
    setActiveChatWindows(prev => {
      const updated = prev.map(w => {
        if (w.id === windowId) {
          return { ...w, isMinimized: false };
        }
        return w;
      });
      // Recalculate positions for all windows
      return updated.map((window) => {
        const minimizedWindows = updated.filter(w => w.isMinimized);
        const openWindows = updated.filter(w => !w.isMinimized);
        
        if (window.isMinimized) {
          const minimizedIndex = minimizedWindows.findIndex(w => w.id === window.id);
          const newPosition = getNewWindowPosition(true, updated, minimizedIndex);
          return { ...window, position: newPosition };
        } else {
          const openIndex = openWindows.findIndex(w => w.id === window.id);
          const newPosition = getNewWindowPosition(false, updated, openIndex);
          return { ...window, position: newPosition };
        }
      });
    });
  };
  
  // Get current user ID
  const getCurrentUserId = () => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const obj = JSON.parse(raw);
        const u = obj?.user || obj;
        return u?.id || u?.userId || u?._id;
      }
    } catch {}
    return null;
  };
  
  const currentUserId = getCurrentUserId();
  
  // Get peer info from conversation
  const getPeer = (conv) => {
    if (!conv?.participants || !currentUserId) return null;
    const peer = conv.participants.find((p) => {
      const pid = typeof p === 'object' ? (p._id || p.id) : p;
      const cid = typeof currentUserId === 'object' ? (currentUserId._id || currentUserId.id) : currentUserId;
      return String(pid) !== String(cid);
    });
    return peer;
  };
  
  // Get unread count
  const getUnreadCount = (conv) => {
    if (!conv?.unreadCounts || !currentUserId) return 0;
    const uid = String(currentUserId);
    return Number(conv.unreadCounts.get?.(uid) || conv.unreadCounts[uid] || 0);
  };
  
  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  };
  
  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    // Search filter
    if (chatSearchText) {
      const peer = getPeer(conv);
      const peerName = peer?.displayName || peer?.username || '';
      if (!peerName.toLowerCase().includes(chatSearchText.toLowerCase())) {
        return false;
      }
    }
    
    // Status filter
    if (chatFilter === 'unread') {
      return getUnreadCount(conv) > 0;
    }
    if (chatFilter === 'groups') {
      // For now, we'll treat all as individual chats. Can be extended later
      return false;
    }
    return true;
  });
  
  // Get total unread count
  const totalUnreadCount = conversations.reduce((sum, conv) => sum + getUnreadCount(conv), 0);

  const handleLiveStreamClick = () => {
    setIsModalVisible(true);
  };

  const handleConfirm = async () => {
    if (isCreating) return;
    setIsCreating(true);

    try {
      const { room } = await livestreamService.createLiveStream();
      setIsModalVisible(false);
      navigate(`/livestream/setup/${room._id}`);

    } catch (err) {
      console.error("Lỗi khi tạo phòng:", err);
      Modal.error({
        title: 'Lỗi',
        content: 'Không thể tạo phòng, vui lòng thử lại.',
      });
    } finally {
      setIsCreating(false);
    }
  };


  const handleCancel = () => {
    if (isCreating) return;
    setIsModalVisible(false);
  };
  return (
    <>
      <Header className="app-header">
        <div className="app-header__content">
          <Text
            className="app-header__logo"
            onClick={() => navigate('/')}
          >
            MelodyHub
          </Text>
          <div className="app-header__nav">
          <Text className="app-header__nav-item" onClick={() => navigate('/live')}>Join Live</Text>          
            <Text
              className="app-header__nav-item app-header__nav-link"
              onClick={() => navigate('/library/my-licks')}
            >
              Library
            </Text>
          </div>
          <div className="app-header__spacer" />
          <Input
            className="app-header__search"
            placeholder="Tìm kiếm"
            allowClear
            prefix={<SearchOutlined />}
          />
          <div className="app-header__actions">
            <BellOutlined className="app-header__icon" />
            {!isChatPage && (
            <Popover
              content={
                <div style={{ width: 400, maxHeight: 600, background: '#1a1a1a', color: '#fff' }}>
                  {/* Header */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid #2a2a2a'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ 
                        width: 40, 
                        height: 40, 
                        borderRadius: '50%', 
                        background: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}>
                        <MessageOutlined style={{ fontSize: 20 }} />
                      </div>
                      <Text style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>Đoạn chat</Text>
                    </div>
                    <Space>
                      <MoreOutlined style={{ color: '#9ca3af', fontSize: 16, cursor: 'pointer' }} />
                      <ExpandOutlined style={{ color: '#9ca3af', fontSize: 16, cursor: 'pointer' }} />
                      <EditOutlined 
                        style={{ color: '#9ca3af', fontSize: 16, cursor: 'pointer' }} 
                        onClick={() => {
                          setChatPopoverVisible(false);
                          navigate('/chat');
                        }}
                      />
                    </Space>
                  </div>
                  
                  {/* Search Bar */}
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2a2a' }}>
                    <Input
                      placeholder="Tìm kiếm trên Messenger"
                      prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
                      value={chatSearchText}
                      onChange={(e) => setChatSearchText(e.target.value)}
                      style={{
                        background: '#111213',
                        borderColor: '#2a2a2a',
                        color: '#e5e7eb',
                        borderRadius: 8
                      }}
                    />
                  </div>
                  
                  {/* Filter Tabs */}
                  <div style={{ 
                    display: 'flex', 
                    gap: 8, 
                    padding: '12px 16px',
                    borderBottom: '1px solid #2a2a2a'
                  }}>
                    <Button
                      type={chatFilter === 'all' ? 'primary' : 'text'}
                      size="small"
                      onClick={() => setChatFilter('all')}
                      style={{
                        color: chatFilter === 'all' ? '#fff' : '#9ca3af',
                        background: chatFilter === 'all' ? '#3b82f6' : 'transparent',
                        border: 'none'
                      }}
                    >
                      Tất cả
                    </Button>
                    <Button
                      type={chatFilter === 'unread' ? 'primary' : 'text'}
                      size="small"
                      onClick={() => setChatFilter('unread')}
                      style={{
                        color: chatFilter === 'unread' ? '#fff' : '#9ca3af',
                        background: chatFilter === 'unread' ? '#3b82f6' : 'transparent',
                        border: 'none'
                      }}
                    >
                      Chưa đọc
                    </Button>
                    <Button
                      type={chatFilter === 'groups' ? 'primary' : 'text'}
                      size="small"
                      onClick={() => setChatFilter('groups')}
                      style={{
                        color: chatFilter === 'groups' ? '#fff' : '#9ca3af',
                        background: chatFilter === 'groups' ? '#3b82f6' : 'transparent',
                        border: 'none'
                      }}
                    >
                      Nhóm
                    </Button>
                  </div>
                  
                  {/* Conversations List */}
                  <div style={{ 
                    maxHeight: 400, 
                    overflowY: 'auto',
                    background: '#1a1a1a'
                  }}>
                    {loading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <Spin size="large" />
                      </div>
                    ) : filteredConversations.length === 0 ? (
                      <Empty 
                        description="Chưa có cuộc trò chuyện" 
                        style={{ color: '#9ca3af', padding: '40px' }}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ) : (
                      filteredConversations.map((conv) => {
                        const peer = getPeer(conv);
                        const unread = getUnreadCount(conv);
                        const peerName = peer?.displayName || peer?.username || 'Người dùng';
                        const peerAvatar = peer?.avatarUrl;
                        const lastMessage = conv.lastMessage || 'Chưa có tin nhắn';
                        const lastMessageTime = formatTime(conv.lastMessageAt);
                        
                        return (
                          <div
                            key={conv._id}
                            onClick={() => {
                              setChatPopoverVisible(false);
                              // Open floating chat window instead of navigating
                              openChatWindow(conv);
                            }}
                            style={{
                              display: 'flex',
                              gap: 12,
                              padding: '12px 16px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #2a2a2a',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#252525'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <Badge count={unread > 0 ? unread : 0} offset={[-5, 5]}>
                              <Avatar 
                                src={peerAvatar} 
                                icon={<UserOutlined />}
                                size={50}
                              />
                            </Badge>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4
                              }}>
                                <Text style={{ 
                                  color: '#fff', 
                                  fontWeight: 600, 
                                  fontSize: 14,
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {peerName}
                                </Text>
                                {lastMessageTime && (
                                  <Text style={{ 
                                    color: '#9ca3af', 
                                    fontSize: 12,
                                    marginLeft: 8,
                                    flexShrink: 0
                                  }}>
                                    {lastMessageTime}
                                  </Text>
                                )}
                              </div>
                              <div style={{ 
                                color: '#9ca3af', 
                                fontSize: 13,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}>
                                {conv.status === 'pending' && (
                                  <span style={{ color: '#fa8c16', fontWeight: 500 }}>
                                    Yêu cầu tin nhắn
                                  </span>
                                )}
                                {conv.status === 'active' && (
                                  <span>{lastMessage}</span>
                                )}
                              </div>
                            </div>
                            {unread > 0 && (
                              <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#3b82f6',
                                flexShrink: 0,
                                marginTop: 6
                              }} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Footer */}
                  <div style={{ 
                    padding: '12px 16px',
                    borderTop: '1px solid #2a2a2a',
                    textAlign: 'center'
                  }}>
                    <Text 
                      style={{ 
                        color: '#3b82f6', 
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                      onClick={() => {
                        setChatPopoverVisible(false);
                        navigate('/chat');
                      }}
                    >
                      Xem tất cả trong Messenger
                    </Text>
                  </div>
                </div>
              }
              title={null}
              trigger="click"
              open={chatPopoverVisible}
              onOpenChange={setChatPopoverVisible}
              placement="bottomRight"
              overlayStyle={{ paddingTop: 0 }}
              overlayInnerStyle={{ padding: 0, background: '#1a1a1a' }}
              zIndex={1000}
            >
              <Badge count={totalUnreadCount} offset={[-5, 5]}>
                <MessageOutlined className="app-header__icon" />
              </Badge>
            </Popover>
            )}
            {(() => {
              let avatarUrl; let uid;
              try {
                const raw = localStorage.getItem('user');
                if (raw) {
                  const obj = JSON.parse(raw);
                  const u = obj?.user || obj; // support both nested and flat shapes
                  avatarUrl = u?.avatarUrl || u?.avatar_url;
                  uid = u?.id || u?.userId || u?._id;
                }
              } catch {}
              return (
                <Tooltip title="Hồ sơ của tôi">
                  {avatarUrl ? (
                    <Avatar
                      src={avatarUrl}
                      size={28}
                      className="app-header__avatar"
                      onClick={() => navigate(uid ? `/users/${uid}/newfeeds` : '/profile')}
                    />
                  ) : (
                    <UserOutlined
                      className="app-header__icon"
                      onClick={() => navigate(uid ? `/users/${uid}/newfeeds` : '/profile')}
                    />
                  )}
                </Tooltip>
              );
            })()}

            <Button
              className="app-header__cta"
              icon={<FireOutlined />}
              onClick={handleLiveStreamClick}
            >
              LiveStream
            </Button>

            <Button className="app-header__cta">Creat project</Button>
          </div>
        </div>
      </Header>

      <Modal
        title="Bắt đầu phát trực tiếp?"
        visible={isModalVisible}
        onOk={handleConfirm}
        onCancel={handleCancel}
        closable={!isCreating}
        maskClosable={!isCreating}
        confirmLoading={isCreating}
        okText={isCreating ? "Đang tạo..." : "Có"}
        cancelText="Không"
      >
        <p>Bạn có chắc chắn muốn bắt đầu một buổi phát trực tiếp mới?</p>
      </Modal>

      {/* Floating Chat Windows */}
      {!isChatPage && activeChatWindows.map((window) => (
        <FloatingChatWindow
          key={window.id}
          conversation={window.conversation}
          currentUserId={currentUserId}
          isMinimized={window.isMinimized}
          position={window.position}
          onClose={() => closeChatWindow(window.id)}
          onMinimize={() => minimizeChatWindow(window.id)}
          onMaximize={() => maximizeChatWindow(window.id)}
        />
      ))}

    </>
  );
};

export default AppHeader;