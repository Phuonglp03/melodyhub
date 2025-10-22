import React from 'react';
import { Card, Avatar, Button, Typography, Space, Input, List, Divider, Tag } from 'antd';
import { LikeOutlined, MessageOutlined, PlusOutlined, HeartOutlined, CrownOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const MOCK_USERS = [
  { id: 1, name: 'Evan', followers: '3.49 nghìn', color: '#f56a00' },
  { id: 2, name: 'JRED', followers: '196 nghìn', color: '#7265e6' },
  { id: 3, name: 'Vóc to Orpheus', followers: '106', color: '#ffbf00' },
];

const MOCK_FEEDS = Array.from({ length: 5 }).map((_, i) => ({
  id: i + 1,
  user: { name: 'TK KAVOD', color: '#2db7f5' },
  time: '19 tháng 10',
  content:
    'NHẠC DRILL HAY NHẤT TRÊN CHỈ CÓ THỂ THÍCH VÀ BÌNH LUẬN ĐỂ ĐƯỢC KHUYẾN MÃI MIỄN PHÍ LÊN ĐẾN 20.000 NGƯỜI! THE GREATEST IS BACK RUNNNN it up 🔥',
  tags: ['MCV', 'GalaxyPlay', 'Bietthudenlong', 'GLXBTDL'],
}));

const WavePlaceholder = () => (
  <div
    style={{
      height: 120,
      background: '#1a1a1a',
      borderRadius: 8,
      position: 'relative',
      overflow: 'hidden',
    }}
  >
    <div style={{ 
      position: 'absolute', 
      bottom: 0, 
      left: 0, 
      right: 0, 
      height: '100%',
      display: 'flex',
      alignItems: 'end',
      gap: 2,
      padding: '8px 12px'
    }}>
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${Math.random() * 80 + 20}px`,
            background: '#ff7a45',
            borderRadius: 1.5,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 12,
          height: 12,
          background: '#ff7a45',
          borderRadius: '50%',
        }}
      />
    </div>
  </div>
);

const Suggestion = ({ user }) => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '6px 0', width: '100%' }}>
    <Space size={12}>
      <Avatar size={36} style={{ background: user.color }}>{user.name[0]}</Avatar>
      <div>
        <Text strong style={{ color: '#fff' }}>{user.name}</Text>
        <div style={{ fontSize: 12, color: '#f3f5f7ff' }}>{user.followers} người theo dõi</div>
      </div>
    </Space>
    <Button shape="circle" size="large" type="primary" icon={<PlusOutlined />} style={{ marginLeft: 'auto' }} />
  </div>
);

const LeaderboardItem = ({ name, icon, iconColor = '#111' }) => (
  <Space>
    <div style={{ 
      width: 36, 
      height: 36, 
      background: iconColor, 
      borderRadius: 8, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 'bold',
      color: '#fff'
    }}>
      {icon}
    </div>
    <div>
      <Text strong style={{ color: '#fff' }}>{name}</Text>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>Tên người tạo</div>
    </div>
  </Space>
);

const NewsFeed = () => {
  return (
    <div style={{ 
      maxWidth: 1680, 
      margin: '0 auto', 
      padding: '24px 24px',
      background: '#0a0a0a',
      minHeight: '100vh'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 460px', gap: 32 }}>
        <div>
          <div style={{ 
            marginBottom: 20, 
            background: '#0f0f10', 
            border: '1px solid #1f1f1f',
            borderRadius: 8,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            <Avatar size={40} style={{ backgroundColor: '#722ed1' }}>T</Avatar>
            <Input.TextArea 
              placeholder="Có gì mới ?" 
              autoSize={{ minRows: 2, maxRows: 8 }}
              style={{ 
                flex: 1,
                background: '#fff',
                border: 'none',
                borderRadius: 10,
                minHeight: 56,
                fontSize: 16
              }}
            />
            <Button type="primary" size="large" style={{ borderRadius: 999, background: '#1890ff', padding: '0 22px', height: 44 }}>Post</Button>
          </div>

          {MOCK_FEEDS.map((post) => (
            <Card key={post.id} style={{ marginBottom: 20, background: '#0f0f10', borderColor: '#1f1f1f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <Space align="start" size={14}>
                  <Avatar size={40} style={{ background: post.user.color }}>{post.user.name[0]}</Avatar>
                  <div>
                    <Space style={{ marginBottom: 4 }}>
                      <Text strong style={{ color: '#fff', fontSize: 16 }}>{post.user.name}</Text>
                      <Text type="secondary" style={{ color: '#9ca3af', fontSize: 13 }}>{post.time}</Text>
                    </Space>
                  </div>
                </Space>
                <Button size="middle" style={{ background: '#333', borderColor: '#333', color: '#fff' }}>
                  Follow
                </Button>
              </div>
              <div style={{ marginBottom: 10, color: '#fff', fontSize: 15, lineHeight: 1.6 }}>{post.content}</div>
              <Space wrap style={{ marginBottom: 14 }}>
                {post.tags.map((t) => (
                  <Tag key={t} color="purple" style={{ background: '#722ed1', border: 'none', color: '#fff' }}>#{t}</Tag>
                ))}
              </Space>
              <WavePlaceholder />
              <Space style={{ marginTop: 14 }}>
                <Button icon={<LikeOutlined />} style={{ background: 'transparent', border: 'none', color: '#fff' }}>
                  Thích
                </Button>
                <Button icon={<MessageOutlined />} style={{ background: 'transparent', border: 'none', color: '#fff' }}>
                  Bình luận
                </Button>
              </Space>
            </Card>
          ))}
        </div>

        <div>
          <Card style={{ marginBottom: 16, background: '#0f0f10', borderColor: '#1f1f1f' }} title={<Text style={{ color: '#fff', fontWeight: 700 }}>Gợi ý theo dõi</Text>}>
            <List
              itemLayout="horizontal"
              dataSource={MOCK_USERS}
              renderItem={(item) => (
                <List.Item style={{ padding: '8px 0' }}>
                  <Suggestion user={item} />
                </List.Item>
              )}
            />
          </Card>

          <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            <Title level={4} style={{ color: '#fff', marginBottom: 12, textAlign: 'center' }}>LeaderBoard</Title>
            <Divider style={{ margin: '8px 0', borderColor: '#1f1f1f' }} />
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <LeaderboardItem name="Tên lick" icon="XVEN" iconColor="#ef4444" />
              <LeaderboardItem name="Tên lick" icon="UNITED" iconColor="#3b82f6" />
              <LeaderboardItem name="Tên lick" icon={<UserOutlined />} iconColor="#6b7280" />
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NewsFeed;