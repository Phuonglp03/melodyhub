import React, { useState, useEffect } from 'react';
import { User, Save, Upload, Camera, X } from 'lucide-react';
import api from '../../../services/api';

const AdminProfile = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    birthday: '',
    gender: 'unspecified',
    location: '',
    links: ['', ''],
    theme: 'dark',
    language: 'en',
    emailNotifications: true,
    pushNotifications: true
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/profile');
      const user = response.data.data.user;
      setProfile(user);
      setFormData({
        displayName: user.displayName || '',
        bio: user.bio || '',
        birthday: user.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
        gender: user.gender || 'unspecified',
        location: user.location || '',
        links: user.links && user.links.length > 0 ? [...user.links, ''].slice(0, 2) : ['', ''],
        theme: user.theme || 'dark',
        language: user.language || 'en',
        emailNotifications: user.emailNotifications !== undefined ? user.emailNotifications : true,
        pushNotifications: user.pushNotifications !== undefined ? user.pushNotifications : true
      });
      setAvatarPreview(user.avatarUrl || '');
      setCoverPreview(user.coverPhotoUrl || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải thông tin profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLinkChange = (index, value) => {
    const newLinks = [...formData.links];
    newLinks[index] = value;
    setFormData(prev => ({ ...prev, links: newLinks }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh');
      return;
    }

    setUploadingAvatar(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/admin/profile/avatar', formData);
      setAvatarPreview(response.data.data.avatarUrl);
      setSuccess('Cập nhật avatar thành công');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload avatar thất bại');
    } finally {
      setUploadingAvatar(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh');
      return;
    }

    setUploadingCover(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('coverPhoto', file);

      const response = await api.post('/admin/profile/cover-photo', formData);
      setCoverPreview(response.data.data.coverPhotoUrl);
      setSuccess('Cập nhật cover photo thành công');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload cover photo thất bại');
    } finally {
      setUploadingCover(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updates = {
        displayName: formData.displayName,
        bio: formData.bio,
        birthday: formData.birthday || undefined,
        gender: formData.gender,
        location: formData.location,
        links: formData.links.filter(link => link.trim() !== ''),
        theme: formData.theme,
        language: formData.language,
        emailNotifications: formData.emailNotifications,
        pushNotifications: formData.pushNotifications
      };

      const response = await api.put('/admin/profile', updates);
      setProfile(response.data.data.user);
      setSuccess('Cập nhật profile thành công');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Cập nhật profile thất bại');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Admin Profile
          </h1>
          <p className="text-gray-400 mt-2">Quản lý thông tin cá nhân của bạn</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
            {success}
          </div>
        )}

        {/* Cover Photo */}
        <div className="relative mb-6 rounded-xl overflow-hidden">
          <div 
            className="w-full h-64 bg-gradient-to-r from-blue-600 to-purple-600"
            style={{
              backgroundImage: coverPreview ? `url(${coverPreview})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!coverPreview && (
              <div className="w-full h-full flex items-center justify-center bg-gray-800/50">
                <Camera size={48} className="text-gray-500" />
              </div>
            )}
          </div>
          <label className="absolute top-4 right-4 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
              disabled={uploadingCover}
            />
            <div className="px-4 py-2 bg-gray-800/90 hover:bg-gray-700 rounded-lg flex items-center space-x-2 transition">
              {uploadingCover ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Đang upload...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload Cover</span>
                </>
              )}
            </div>
          </label>
        </div>

        {/* Profile Card */}
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-xl p-6 border border-gray-700/50">
          {/* Avatar Section */}
          <div className="flex items-center space-x-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-white" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
                <div className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition">
                  {uploadingAvatar ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Camera size={16} className="text-white" />
                  )}
                </div>
              </label>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{profile?.displayName || 'Admin'}</h2>
              <p className="text-gray-400">@{profile?.username || 'admin'}</p>
              <p className="text-gray-500 text-sm">{profile?.email || ''}</p>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium mb-2">Tên hiển thị</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập tên hiển thị"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium mb-2">Giới thiệu</label>
              <textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Nhập giới thiệu về bạn..."
              />
              <p className="text-xs text-gray-500 mt-1">{formData.bio.length}/500</p>
            </div>

            {/* Birthday & Gender */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Ngày sinh</label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => handleInputChange('birthday', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Giới tính</label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="unspecified">Không xác định</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-2">Địa điểm</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập địa điểm"
              />
            </div>

            {/* Links */}
            <div>
              <label className="block text-sm font-medium mb-2">Liên kết</label>
              {formData.links.map((link, index) => (
                <input
                  key={index}
                  type="url"
                  value={link}
                  onChange={(e) => handleLinkChange(index, e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  placeholder={`Link ${index + 1} (URL)`}
                />
              ))}
            </div>

            {/* Theme & Language */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Theme</label>
                <select
                  value={formData.theme}
                  onChange={(e) => handleInputChange('theme', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Ngôn ngữ</label>
                <select
                  value={formData.language}
                  onChange={(e) => handleInputChange('language', e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                </select>
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-3">
              <label className="block text-sm font-medium mb-2">Thông báo</label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.emailNotifications}
                  onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
                />
                <span>Email notifications</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.pushNotifications}
                  onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 focus:ring-2 focus:ring-blue-500"
                />
                <span>Push notifications</span>
              </label>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;

