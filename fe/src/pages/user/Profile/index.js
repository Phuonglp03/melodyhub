import React, { useEffect, useRef } from 'react';
import { Card, Form, Input, Button, Typography, message, Avatar, Layout, Space, Select, Upload } from 'antd';
import { ArrowLeftOutlined, UserOutlined, KeyOutlined, DeleteOutlined } from '@ant-design/icons';
import { InfoCircleOutlined, SmileOutlined } from '@ant-design/icons';
import { getMyProfile, updateMyProfile, uploadMyAvatar, uploadMyCoverPhoto } from '../../../services/user/profile';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const ProfilePage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [aboutCount, setAboutCount] = React.useState(0);
  const [profile, setProfile] = React.useState(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = React.useState(false);
  const [avatarPreview, setAvatarPreview] = React.useState('');
  const [coverPreview, setCoverPreview] = React.useState('');
  const [pendingAvatarFile, setPendingAvatarFile] = React.useState(null);
  const [pendingCoverFile, setPendingCoverFile] = React.useState(null);
  const avatarObjectUrlRef = useRef(null);
  const coverObjectUrlRef = useRef(null);

  const revokeAvatarPreview = () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }
  };

  const revokeCoverPreview = () => {
    if (coverObjectUrlRef.current) {
      URL.revokeObjectURL(coverObjectUrlRef.current);
      coverObjectUrlRef.current = null;
    }
  };

  const setAvatarPreviewValue = (url, { isObjectUrl = false } = {}) => {
    revokeAvatarPreview();
    if (isObjectUrl) {
      avatarObjectUrlRef.current = url;
    }
    setAvatarPreview(url || '');
    form.setFieldsValue({ avatarUrl: url || '' });
  };

  const setCoverPreviewValue = (url, { isObjectUrl = false } = {}) => {
    revokeCoverPreview();
    if (isObjectUrl) {
      coverObjectUrlRef.current = url;
    }
    setCoverPreview(url || '');
    form.setFieldsValue({ coverPhotoUrl: url || '' });
  };

  useEffect(() => {
    return () => {
      revokeAvatarPreview();
      revokeCoverPreview();
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyProfile();
      const u = res?.data?.user || {};
      setProfile(u);
      form.setFieldsValue({
        displayName: u.displayName,
        username: u.username,
        email: u.email,
        bio: u.bio,
        location: u.location,
        gender: u.gender,
        links: u.links && u.links.length > 0 ? u.links : ['', ''],
      });
      setAvatarPreviewValue(u.avatarUrl || '');
      setCoverPreviewValue(u.coverPhotoUrl || '');
      setPendingAvatarFile(null);
      setPendingCoverFile(null);
      setAboutCount((u.bio || '').length);
    } catch (e) {
      message.error(e.message || 'Không tải được hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const payload = {};

      if (values.displayName) {
        payload.displayName = values.displayName.trim();
      }

      if (typeof values.bio === 'string') {
        payload.bio = values.bio.trim();
      }

      if (typeof values.location === 'string') {
        const trimmedLocation = values.location.trim();
        if (trimmedLocation) {
          payload.location = trimmedLocation;
        }
      }

      if (values.gender) {
        payload.gender = values.gender;
      }
      // Avatar và Cover Photo chỉ được upload qua file, không gửi trong JSON payload
      // Xử lý links: filter bỏ các link rỗng và trim
      if (values.links && Array.isArray(values.links)) {
        payload.links = values.links
          .map(link => typeof link === 'string' ? link.trim() : '')
          .filter(link => link !== '');
      }

      if (pendingAvatarFile) {
        setUploadingAvatar(true);
        try {
          await uploadMyAvatar(pendingAvatarFile);
          setPendingAvatarFile(null);
        } finally {
          setUploadingAvatar(false);
        }
      }

      if (pendingCoverFile) {
        setUploadingCoverPhoto(true);
        try {
          await uploadMyCoverPhoto(pendingCoverFile);
          setPendingCoverFile(null);
        } finally {
          setUploadingCoverPhoto(false);
        }
      }

      await updateMyProfile(payload);
      message.success('Cập nhật hồ sơ thành công');
      load();
    } catch (e) {
      message.error(e.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px' }}>
      {/** unified input styles for dark theme */}
      {/** Using inline const to avoid external CSS edits */}
      {(() => {})()}
      <Layout style={{ background: 'transparent' }}>
        <Layout.Sider width={300} style={{ background: 'transparent', paddingRight: 16 }}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Button icon={<ArrowLeftOutlined />} style={{ height: 44 }}>
              Back to Profile
            </Button>
            <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f', padding: 0 }} bodyStyle={{ padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#151515', borderRadius: 8 }}>
                <UserOutlined style={{ fontSize: 20 }} />
                <div style={{ fontWeight: 600, color: '#e5e7eb' }}>Profile</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
                <KeyOutlined style={{ fontSize: 20, color: '#9ca3af' }} />
                <div style={{ color: '#9ca3af' }}>Change Password</div>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, cursor: 'pointer' }}
                onClick={() => navigate('/archived-posts')}
              >
                <DeleteOutlined style={{ fontSize: 20, color: '#9ca3af' }} />
                <div style={{ color: '#9ca3af' }}>Bài viết đã lưu trữ</div>
              </div>
            </Card>
          </Space>
        </Layout.Sider>
        <Layout.Content>
          <Title level={2} style={{ color: '#fff', marginBottom: 16 }}>Profile Settings</Title>
          <Card loading={loading} style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            {/* Cover Photo Section */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 8, overflow: 'hidden', background: '#1f1f1f', marginBottom: 16 }}>
                {coverPreview ? (
                  <img 
                    src={coverPreview} 
                    alt="Cover" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                    No cover photo
                  </div>
                )}
                <Upload
                  showUploadList={false}
                  accept="image/*"
                  beforeUpload={() => {
                    return false;
                  }}
                  onChange={async (info) => {
                    const { file } = info;
                    const fileToUpload = file?.originFileObj || file;

                    if (!fileToUpload) {
                      return;
                    }

                    if (file) {
                      file.status = 'done';
                    }

                    const previewUrl = URL.createObjectURL(fileToUpload);
                    setCoverPreviewValue(previewUrl, { isObjectUrl: true });
                    setPendingCoverFile(fileToUpload);
                    message.info('Ảnh bìa mới sẽ được lưu sau khi bấm Save changes');
                  }}
                >
                  <Button 
                    loading={uploadingCoverPhoto && saving}
                    type="primary"
                    style={{ 
                      position: 'absolute', 
                      bottom: 16, 
                      right: 16,
                      background: 'rgba(0, 0, 0, 0.6)',
                      borderColor: '#fff',
                      color: '#fff'
                    }}
                  >
                    {coverPreview ? 'Đổi ảnh bìa' : 'Thêm ảnh bìa'}
                  </Button>
                </Upload>
                {pendingCoverFile && (
                  <div style={{ marginTop: 8, color: '#d1d5db' }}>
                    Ảnh bìa chờ lưu: <strong>{pendingCoverFile.name}</strong>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Avatar shape="square" size={160} src={avatarPreview} style={{ background: '#4b5563', borderRadius: 28 }}>
                  {((form.getFieldValue('displayName') || form.getFieldValue('username') || 'T')[0] || 'T')}
                </Avatar>
              </div>

        <Form form={form} layout="vertical" onFinish={onFinish} style={{ width: '100%' }}>
          {/** common input style for consistency */}
          {(() => {})()}
          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Name</Text>} name="displayName" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}> 
            <Input placeholder="Tran Trong Quy( K17 HL )" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item>

          <Form.Item label={<span style={{ color: '#e5e7eb', fontWeight: 700 }}>Username <InfoCircleOutlined style={{ color: '#9ca3af' }} /></span>} name="username">
            <Input disabled style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Location</Text>} name="location">
            <Input placeholder="Search City" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Gender</Text>} name="gender">
            <Select
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
                { value: 'unspecified', label: 'Unspecified' },
              ]}
              style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
            />
          </Form.Item>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Email</Text>} name="email">
            <Input disabled placeholder="Search City" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </Form.Item>

          <div style={{ color: '#e5e7eb', fontWeight: 700, marginBottom: 8 }}>About</div>
          <div style={{ position: 'relative' }}>
            <Form.Item name="bio" style={{ marginBottom: 0 }}>
              <Input.TextArea rows={6} maxLength={250} onChange={(e) => setAboutCount(e.target.value.length)} placeholder="Describe yourself in a few words ..." style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
            </Form.Item>
            <div style={{ position: 'absolute', right: 8, top: -24, color: '#9ca3af' }}>{aboutCount}/250</div>
            <SmileOutlined style={{ position: 'absolute', right: 12, bottom: 10, color: '#9ca3af' }} />
          </div>

          <Title level={4} style={{ color: '#fff', marginTop: 16 }}>Links</Title>
          <Form.List name="links">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Form.Item key={field.key} name={[field.name]} style={{ marginBottom: 12 }}>
                    <Input 
                      placeholder={index === 0 ? "https://www.facebook.com/quy.trantrong.9862" : "https://www.example.com"} 
                      style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} 
                    />
                  </Form.Item>
                ))}
                {fields.length < 2 && (
                  <Button 
                    type="dashed" 
                    onClick={() => add()} 
                    style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb', marginBottom: 12 }}
                  >
                    + Add Link
                  </Button>
                )}
              </>
            )}
          </Form.List>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Avatar</Text>}> 
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={() => {
                // Prevent default upload
                return false;
              }}
              onChange={async (info) => {
                const { file } = info;
                const fileToUpload = file?.originFileObj || file;

                if (!fileToUpload) {
                  return;
                }

                if (file) {
                  file.status = 'done';
                }

                const previewUrl = URL.createObjectURL(fileToUpload);
                setAvatarPreviewValue(previewUrl, { isObjectUrl: true });
                setPendingAvatarFile(fileToUpload);
                message.info('Ảnh đại diện mới sẽ được lưu sau khi bấm Save changes');
              }}
            >
              <Button 
                loading={uploadingAvatar && saving} 
                style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
              >
                Upload avatar
              </Button>
            </Upload>
            {pendingAvatarFile && (
              <div style={{ marginTop: 8, color: '#9ca3af' }}>
                Ảnh chờ lưu: <strong>{pendingAvatarFile.name}</strong>
              </div>
            )}
          </Form.Item>
          <Form.Item name="avatarUrl" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="coverPhotoUrl" hidden>
            <Input />
          </Form.Item>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" htmlType="submit" loading={saving}>Save changes</Button>
            <Button onClick={load}>Reset</Button>
          </div>
        </Form>
        </div>
      </Card>
        </Layout.Content>
      </Layout>
    </div>
  );
};

export default ProfilePage;

const Info = ({ label, value }) => (
  <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: 12 }}>
    <div style={{ color: '#9ca3af', fontSize: 12 }}>{label}</div>
    <div style={{ color: '#fff', fontWeight: 600, marginTop: 2, wordBreak: 'break-word' }}>{value ?? '-'}</div>
  </div>
);