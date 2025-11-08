import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Avatar, Button, Input, message, Badge, Spin, Empty } from 'antd';
import { 
  MessageOutlined, 
  CheckOutlined, 
  CloseOutlined,
  SendOutlined,
  UserOutlined
} from '@ant-design/icons';
import useDMConversations from '../../../hooks/useDMConversations';
import useDMConversationMessages from '../../../hooks/useDMConversationMessages';
import { initSocket } from '../../../services/user/socketService';
import './Chat.css';

const { TextArea } = Input;

const ChatPage = () => {
  const currentUser = useSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id || currentUser?._id;
  
  const { conversations, loading, accept, decline, ensureWith } = useDMConversations();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'pending'
  const [peerInput, setPeerInput] = useState('');
  const [requesterOverride, setRequesterOverride] = useState({}); // conversationId -> true if I just created/requested
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Init socket on mount
  useEffect(() => {
    if (currentUserId) {
      initSocket(currentUserId);
    }
  }, [currentUserId]);

  // Get selected conversation
  const selectedConv = conversations.find((c) => c._id === selectedConvId);
  
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

  // Filter conversations
  const filteredConvs = conversations.filter((c) => {
    if (filter === 'active') return c.status === 'active';
    if (filter === 'pending') return c.status === 'pending';
    return true;
  });

  // Messages hook for selected conversation
  const { 
    messages, 
    loading: messagesLoading, 
    send, 
    typing, 
    peerTyping 
  } = useDMConversationMessages(selectedConvId);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const overrideIsRequester = selectedConvId && requesterOverride[selectedConvId];
  const isRequester = overrideIsRequester || (selectedConv?.requestedBy && String(selectedConv.requestedBy) === String(currentUserId));

  // Handle send message
  const handleSend = () => {
    if (!inputText.trim() || !selectedConvId) return;
    const canSend = selectedConv?.status === 'active' || (selectedConv?.status === 'pending' && isRequester);
    if (!canSend) return message.warning('Chỉ người gửi yêu cầu mới có thể nhắn khi đang chờ chấp nhận');
    send(inputText);
    setInputText('');
    typing.stop();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle typing
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    const canType = selectedConvId && (selectedConv?.status === 'active' || (selectedConv?.status === 'pending' && isRequester));
    if (canType) {
      typing.start();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        typing.stop();
      }, 2000);
    }
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

  // Get unread count
  const getUnreadCount = (conv) => {
    if (!conv?.unreadCounts || !currentUserId) return 0;
    const uid = String(currentUserId);
    return Number(conv.unreadCounts.get?.(uid) || conv.unreadCounts[uid] || 0);
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h4><MessageOutlined /> Tin nhắn</h4>
            {/* Tạo cuộc trò chuyện nhanh bằng userId */}
            <Input.Search
              placeholder="Nhập userId để bắt đầu chat"
              allowClear
              value={peerInput}
              onChange={(e) => setPeerInput(e.target.value)}
              enterButton="Bắt đầu"
              onSearch={async (val) => {
                const peerId = (val || '').trim();
                if (!peerId) return;
                try {
                  const conv = await ensureWith(peerId);
                  if (conv && conv._id) {
                    setSelectedConvId(conv._id);
                    // Mark that I am the requester for this pending conversation
                    if (conv.status === 'pending') {
                      setRequesterOverride((prev) => ({ ...prev, [conv._id]: true }));
                    }
                    if (conv.status === 'pending') {
                      message.info('Đã gửi yêu cầu tin nhắn');
                    } else {
                      message.success('Đã mở cuộc trò chuyện');
                    }
                  }
                } catch (e) {
                  message.error(e.message || 'Không thể tạo cuộc trò chuyện');
                }
              }}
              style={{ marginBottom: 12 }}
            />
            <div className="chat-filters">
              <Button 
                size="small" 
                type={filter === 'all' ? 'primary' : 'default'}
                onClick={() => setFilter('all')}
              >
                Tất cả
              </Button>
              <Button 
                size="small" 
                type={filter === 'active' ? 'primary' : 'default'}
                onClick={() => setFilter('active')}
              >
                Đã chấp nhận
              </Button>
              <Button 
                size="small" 
                type={filter === 'pending' ? 'primary' : 'default'}
                onClick={() => setFilter('pending')}
              >
                Yêu cầu
              </Button>
            </div>
          </div>

          <div className="chat-conversations-list">
            {loading ? (
              <div className="chat-loading"><Spin /></div>
            ) : filteredConvs.length === 0 ? (
              <Empty description="Chưa có cuộc trò chuyện" />
            ) : (
              filteredConvs.map((conv) => {
                const peer = getPeer(conv);
                const unread = getUnreadCount(conv);
                const isSelected = conv._id === selectedConvId;
                const peerName = peer?.displayName || peer?.username || 'Người dùng';
                const peerAvatar = peer?.avatarUrl;

                return (
                  <div
                    key={conv._id}
                    className={`chat-conv-item ${isSelected ? 'selected' : ''} ${conv.status === 'pending' ? 'pending' : ''}`}
                    onClick={() => setSelectedConvId(conv._id)}
                  >
                    <Badge count={unread} offset={[-5, 5]}>
                      <Avatar 
                        src={peerAvatar} 
                        icon={<UserOutlined />}
                        size={50}
                      />
                    </Badge>
                    <div className="chat-conv-info">
                      <div className="chat-conv-name">{peerName}</div>
                      <div className="chat-conv-preview">
                        {conv.status === 'pending' ? (
                          <span className="pending-badge">Yêu cầu tin nhắn</span>
                        ) : (
                          <span>{conv.lastMessage || 'Chưa có tin nhắn'}</span>
                        )}
                      </div>
                      {conv.lastMessageAt && (
                        <div className="chat-conv-time">{formatTime(conv.lastMessageAt)}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Box */}
        <div className="chat-box">
          {!selectedConvId ? (
            <div className="chat-empty">
              <MessageOutlined style={{ fontSize: 64, color: '#ccc' }} />
              <p>Chọn một cuộc trò chuyện để bắt đầu</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                {(() => {
                  const peer = getPeer(selectedConv);
                  return (
                    <>
                      <Avatar 
                        src={peer?.avatarUrl} 
                        icon={<UserOutlined />}
                        size={40}
                      />
                      <div className="chat-header-info">
                        <div className="chat-header-name">
                          {peer?.displayName || peer?.username || 'Người dùng'}
                        </div>
                        {peerTyping && (
                          <div className="chat-typing-indicator">Đang gõ...</div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Pending banner for receiver */}
              {(selectedConv?.status === 'pending' && !isRequester) && (
                <div style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e8e8e8',
                  background: '#fff7e6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Yêu cầu tin nhắn</div>
                    <div style={{ color: '#8c8c8c', fontSize: 13 }}>Bạn có muốn chấp nhận yêu cầu này không?</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={async () => {
                        try {
                          await accept(selectedConvId);
                          message.success('Đã chấp nhận');
                        } catch (e) {
                          message.error(e.message || 'Lỗi');
                        }
                      }}
                    >
                      Chấp nhận
                    </Button>
                    <Button
                      danger
                      icon={<CloseOutlined />}
                      onClick={async () => {
                        try {
                          await decline(selectedConvId);
                          message.success('Đã từ chối');
                          setSelectedConvId(null);
                        } catch (e) {
                          message.error(e.message || 'Lỗi');
                        }
                      }}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="chat-messages">
                {messagesLoading && messages.length === 0 ? (
                  <div className="chat-loading"><Spin /></div>
                ) : messages.length === 0 ? (
                  <Empty description="Chưa có tin nhắn" />
                ) : (
                  messages.map((msg) => {
                    const isMe = String(msg.senderId?._id || msg.senderId) === String(currentUserId);
                    return (
                      <div
                        key={msg._id}
                        className={`chat-message ${isMe ? 'me' : 'peer'}`}
                      >
                        {!isMe && (
                          <Avatar 
                            src={msg.senderId?.avatarUrl} 
                            icon={<UserOutlined />}
                            size={32}
                          />
                        )}
                        <div className="chat-message-content">
                          <div className="chat-message-text">{msg.text}</div>
                          <div className="chat-message-time">
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="chat-input">
                <TextArea
                  value={inputText}
                  onChange={handleInputChange}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Nhập tin nhắn..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  rows={1}
                  disabled={selectedConv?.status === 'pending' && !isRequester}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={!inputText.trim() || (selectedConv?.status === 'pending' && !isRequester)}
                >
                  Gửi
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;

