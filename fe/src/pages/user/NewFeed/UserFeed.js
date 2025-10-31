import React, { useEffect, useState } from 'react';
import { Card, Avatar, Button, Typography, Space, Input, Spin, Empty, message } from 'antd';
import { LikeOutlined, MessageOutlined } from '@ant-design/icons';
import { listPostsByUser } from '../../../services/user/post';
import { getProfileById } from '../../../services/user/profile';
import { useNavigate, useParams } from 'react-router-dom';

const { Text } = Typography;

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
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', display: 'flex', alignItems: 'end', gap: 2, padding: '8px 12px' }}>
      {Array.from({ length: 50 }).map((_, i) => (
        <div key={i} style={{ width: 3, height: `${Math.random() * 80 + 20}px`, background: '#ff7a45', borderRadius: 1.5 }} />
      ))}
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 12, height: 12, background: '#ff7a45', borderRadius: '50%' }} />
    </div>
  </div>
);

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return '';
  }
};

const extractFirstUrl = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  return match ? match[0] : null;
};

const getYoutubeId = (urlString) => {
  try {
    const u = new URL(urlString);
    if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '');
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    return null;
  } catch { return null; }
};

const deriveThumbnail = (urlString) => {
  const ytId = getYoutubeId(urlString);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  return '';
};

const UserFeed = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const [previewCache, setPreviewCache] = useState({});

  const fetchProfile = async (id) => {
    try {
      const res = await getProfileById(id);
      setProfile(res?.data?.user || null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Load profile failed:', e);
    }
  };

  const fetchData = async (id, p = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await listPostsByUser(id, { page: p, limit });
      const posts = res?.data?.posts || [];
      const total = res?.data?.pagination?.totalPosts || 0;
      if (p === 1) setItems(posts); else setItems((prev) => [...prev, ...posts]);
      const totalPages = Math.ceil(total / limit) || 1;
      setHasMore(p < totalPages);
    } catch (e) {
      setError(e.message || 'Lỗi tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    setItems([]);
    setPage(1);
    fetchProfile(userId);
    fetchData(userId, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const enrich = async () => {
      const urls = items
        .map((p) => p?.linkPreview?.url || extractFirstUrl(p?.textContent || ''))
        .filter((u) => u && !previewCache[u]);
      for (const url of urls) {
        // eslint-disable-next-line no-await-in-loop
        const data = { title: url, thumbnailUrl: deriveThumbnail(url) };
        setPreviewCache((prev) => ({ ...prev, [url]: data }));
      }
    };
    if (items && items.length) enrich();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        const next = page + 1;
        setPage(next);
        if (userId) fetchData(userId, next);
      }
    }, { rootMargin: '200px' });
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [loading, hasMore, page, userId]);

  return (
    <div style={{ maxWidth: 1680, margin: '0 auto', padding: '24px 24px', background: '#0a0a0a', minHeight: '100vh' }}>
      <div style={{ height: 180, background: '#131313', borderRadius: 8, marginBottom: 16 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1.2fr) 360px', gap: 24 }}>
        <div>
          <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f', marginBottom: 12, padding: 0 }}>
            <div
              style={{
                height: 180,
                borderRadius: '8px 8px 0 0',
                backgroundImage: profile?.avatarUrl ? `url(${profile.avatarUrl})` : undefined,
                backgroundColor: '#131313',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 16px 20px 16px' }}>
              <div style={{ marginTop: 12, textAlign: 'center', width: '100%' }}>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>
                  {profile?.displayName || profile?.username || 'User'}
                </div>
                <div style={{ color: '#9ca3af', marginTop: 4 }}>@{profile?.username || ''}</div>
              </div>
              <Button onClick={() => navigate('/profile')} style={{ marginTop: 16, background: '#fff', color: '#111', borderColor: '#fff', padding: '0 20px', height: 40, borderRadius: 999 }}>View My Profile</Button>
            </div>
          </Card>
          <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{profile?.followersCount ?? 0}</div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Followers</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{profile?.followingCount ?? 0}</div>
                <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Following</div>
              </div>
            </div>
          </Card>
        </div>

        <div>
          {/* Composer is hidden on other users' feed */}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}
          {!loading && error && (
            <Card style={{ marginBottom: 20, background: '#0f0f10', borderColor: '#1f1f1f' }}>
              <Text style={{ color: '#fff' }}>{error}</Text>
            </Card>
          )}
          {!loading && !error && items.length === 0 && (
            <Empty description={<span style={{ color: '#9ca3af' }}>Chưa có bài đăng</span>} />)
          }

          {!loading && !error && items.map((post) => {
            const firstUrl = extractFirstUrl(post?.textContent || '');
            const previewUrl = post?.linkPreview?.url || firstUrl;
            const previewData = post?.linkPreview || (previewUrl ? previewCache[previewUrl] : null);
            return (
            <Card key={post._id} style={{ marginBottom: 20, background: '#0f0f10', borderColor: '#1f1f1f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <Space align="start" size={14}>
                  <Avatar size={40} style={{ background: '#2db7f5' }}>
                    {(post?.userId?.displayName || post?.userId?.username || 'U')[0]}
                  </Avatar>
                  <div>
                    <Space style={{ marginBottom: 4 }}>
                      <Text strong style={{ color: '#fff', fontSize: 16 }}>
                        {post?.userId?.displayName || post?.userId?.username || 'Người dùng'}
                      </Text>
                      <Text type="secondary" style={{ color: '#9ca3af', fontSize: 13 }}>
                        {formatTime(post?.createdAt)}
                      </Text>
                    </Space>
                  </div>
                </Space>
              </div>
              {post?.textContent && (
                <div style={{ marginBottom: 10, color: '#fff', fontSize: 15, lineHeight: 1.6 }}>
                  {post.textContent}
                </div>
              )}
              {post?.media?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <WavePlaceholder />
                </div>
              )}
              {previewUrl && (
                <a href={previewUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid #303030', borderRadius: 8, padding: 12, background: '#111', color: '#e5e7eb', marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {(() => {
                        const imgSrc = (previewData && previewData.thumbnailUrl) || deriveThumbnail(previewUrl);
                        return imgSrc ? (
                          <img src={imgSrc} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                        ) : null;
                      })() || (
                        <div style={{ width: 64, height: 64, borderRadius: 6, background: '#1f1f1f' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {previewData?.title || previewUrl}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewUrl}</div>
                      </div>
                    </div>
                  </div>
                </a>
              )}
              <Space style={{ marginTop: 14 }}>
                <Button icon={<LikeOutlined />} style={{ background: 'transparent', border: 'none', color: '#fff' }}>
                  Thích
                </Button>
                <Button icon={<MessageOutlined />} style={{ background: 'transparent', border: 'none', color: '#fff' }}>
                  Bình luận
                </Button>
              </Space>
            </Card>
          );})}

          <div ref={loaderRef} style={{ height: 1 }} />
        </div>

        <div>
          <Card style={{ background: '#0f0f10', borderColor: '#1f1f1f' }}>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 12 }}>Find Me On</div>
            <Space>
              <div style={{ width: 36, height: 36, borderRadius: 999, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>🌐</div>
              <a href="#" style={{ color: '#fff' }}>Website</a>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UserFeed;



