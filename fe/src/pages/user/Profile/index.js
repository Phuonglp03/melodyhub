import React, { useEffect } from 'react';
import { Card, Form, Input, Button, Typography, message, Avatar, Layout, Space, Select, Upload } from 'antd';
import { ArrowLeftOutlined, UserOutlined, KeyOutlined } from '@ant-design/icons';
import { InfoCircleOutlined, SmileOutlined } from '@ant-design/icons';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../../../services/user/profile';

const { Title, Text } = Typography;

const ProfilePage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [aboutCount, setAboutCount] = React.useState(0);
  const [profile, setProfile] = React.useState(null);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);

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
        avatarUrl: u.avatarUrl,
        location: u.location,
        gender: u.gender,
      });
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
      const payload = {
        displayName: values.displayName,
        bio: values.bio,
        location: values.location,
        gender: values.gender,
      };
      // Chỉ gửi avatarUrl nếu là string hợp lệ và không rỗng
      if (typeof values.avatarUrl === 'string' && values.avatarUrl.trim() !== '') {
        payload.avatarUrl = values.avatarUrl.trim();
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
            </Card>
          </Space>
        </Layout.Sider>
        <Layout.Content>
          <Title level={2} style={{ color: '#fff', marginBottom: 16 }}>Profile Settings</Title>
          <Card loading={loading} style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Avatar shape="square" size={160} src={form.getFieldValue('avatarUrl')} style={{ background: '#4b5563', borderRadius: 28 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input placeholder="https://www.facebook.com/quy.trantrong.9862" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
            <Input placeholder="Tran Trong Quy( K17 HL )" style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }} />
          </div>

          <Form.Item label={<Text style={{ color: '#e5e7eb', fontWeight: 700 }}>Avatar</Text>}> 
            <Upload
              showUploadList={false}
              accept="image/*"
              beforeUpload={() => {
                // Prevent default upload
                return false;
              }}
              onChange={async (info) => {
                console.log('[Profile] Upload onChange triggered - full info:', JSON.stringify(info, null, 2));
                const { file, fileList } = info;
                
                console.log('[Profile] File object details:', {
                  hasFile: !!file,
                  fileName: file?.name,
                  fileSize: file?.size,
                  fileType: file?.type,
                  fileStatus: file?.status,
                  hasOriginFileObj: !!file?.originFileObj,
                  fileKeys: file ? Object.keys(file) : [],
                  fileListLength: fileList?.length
                });
                
                // Bỏ qua nếu đã xử lý xong hoặc đang upload
                if (file?.status === 'done' || file?.status === 'uploading') {
                  console.log('[Profile] File already processed, skipping');
                  return;
                }
                
                // Lấy file object thực sự (có thể là file hoặc file.originFileObj)
                const fileToUpload = file?.originFileObj || file;
                
                if (!fileToUpload) {
                  console.warn('[Profile] ⚠️ No file object found in onChange');
                  return;
                }
                
                // Chỉ upload nếu đây là file mới (không có status hoặc status là 'ready')
                if (file?.status && file.status !== 'ready' && file.status !== undefined) {
                  console.log('[Profile] File has unexpected status, skipping:', file.status);
                  return;
                }
                
                console.log('[Profile] ✅ New file selected, starting upload...', {
                  name: fileToUpload.name,
                  size: fileToUpload.size,
                  type: fileToUpload.type,
                  isOriginFileObj: !!file?.originFileObj
                });
                
                try {
                  setUploadingAvatar(true);
                  console.log('[Profile] Calling uploadMyAvatar with:', fileToUpload);
                  const res = await uploadMyAvatar(fileToUpload);
                  console.log('[Profile] ✅ uploadMyAvatar response:', res);
                  
                  const url = res?.data?.avatarUrl || res?.data?.user?.avatarUrl;
                  if (url) {
                    form.setFieldsValue({ avatarUrl: url });
                    message.success('Cập nhật ảnh đại diện thành công');
                    console.log('[Profile] ✅ Avatar URL set to:', url);
                    // Update file status để không trigger lại
                    if (file) file.status = 'done';
                  } else {
                    console.warn('[Profile] ⚠️ No avatarUrl in response:', res);
                    if (file) file.status = 'error';
                  }
                } catch (e) {
                  console.error('[Profile] ❌ Upload error:', e);
                  message.error(e.message || 'Tải ảnh thất bại');
                  if (file) file.status = 'error';
                } finally {
                  setUploadingAvatar(false);
                }
              }}
            >
              <Button 
                loading={uploadingAvatar} 
                style={{ background: '#111', borderColor: '#303030', color: '#e5e7eb' }}
              >
                Upload avatar
              </Button>
            </Upload>
          </Form.Item>
          <Form.Item name="avatarUrl" hidden>
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