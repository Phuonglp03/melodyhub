import React, { useState } from 'react';
import { Layout, Input, Button, Space, Typography, Modal, Avatar, Tooltip } from 'antd'; 
import { FireOutlined, BellOutlined, MessageOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom'; 
import { livestreamService } from '../services/user/livestreamService';
const { Header } = Layout;
const { Text } = Typography;

const AppHeader = () => {
  const navigate = useNavigate();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
      <Header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '0 64px', background: '#0b0b0c', borderBottom: '1px solid #1f1f1f', height: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 32, maxWidth: 1680, margin: '0 auto' }}>
          <Text style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>MelodyHub</Text>
          <Space size={28} style={{ color: '#d1d5db' }}>
            <Text style={{ color: '#d1d5db', fontSize: 16 }}>Join Live</Text>
            <Text
              style={{ color: '#d1d5db', fontSize: 16, cursor: 'pointer' }}
              onClick={() => navigate('/library/my-licks')}
            >
              Library
            </Text>
          </Space>
          <div style={{ flex: 1 }} />
          <Input
            placeholder="Tìm kiếm"
            allowClear
            prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
            style={{ maxWidth: 600, background: '#111213', borderColor: '#1f1f1f', color: '#e5e7eb', borderRadius: 999, height: 40 }}
          />
          <Space size={24}>
            <BellOutlined style={{ color: '#e5e7eb', fontSize: 20 }} />
            <MessageOutlined style={{ color: '#e5e7eb', fontSize: 20 }} />
            {(() => {
              let avatarUrl; let displayName; let uid;
              try {
                const raw = localStorage.getItem('user');
                if (raw) {
                  const obj = JSON.parse(raw);
                  const u = obj?.user || obj; // support both nested and flat shapes
                  avatarUrl = u?.avatarUrl || u?.avatar_url;
                  displayName = u?.displayName || u?.username || 'Profile';
                  uid = u?.id || u?.userId || u?._id;
                }
              } catch {}
              return (
                <Tooltip title="Hồ sơ của tôi">
                  {avatarUrl ? (
                    <Avatar src={avatarUrl} size={28} style={{ cursor: 'pointer' }} onClick={() => navigate(uid ? `/users/${uid}/newfeeds` : '/profile')} />
                  ) : (
                    <UserOutlined style={{ color: '#e5e7eb', fontSize: 20, cursor: 'pointer' }} onClick={() => navigate(uid ? `/users/${uid}/newfeeds` : '/profile')} />
                  )}
                </Tooltip>
              );
            })()}

            <Button
              style={{ color: '#fff', background: '#ef4444', borderColor: '#ef4444', borderRadius: 999, height: 40, padding: '0 20px', fontSize: 14 }}
              icon={<FireOutlined />}
              onClick={handleLiveStreamClick}
            >
              LiveStream
            </Button>

            <Button style={{ color: '#fff', background: '#ef4444', borderColor: '#ef4444', borderRadius: 999, height: 40, padding: '0 20px', fontSize: 14 }}>Creat project</Button>
          </Space>
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

    </>
  );
};

export default AppHeader;