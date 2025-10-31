import React, { useEffect, useState } from 'react';
import { Card, Avatar, Button, Typography, Space, Input, Spin, Empty, message, Modal, Upload, List, Divider } from 'antd';
import { LikeOutlined, MessageOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import { listMyPosts, createPost } from '../../../services/user/post';
import { getMyProfile } from '../../../services/user/profile';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

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
    <div style={{ width: 36, height: 36, background: iconColor, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold', color: '#fff' }}>
      {icon}
    </div>
    <div>
      <Text strong style={{ color: '#fff' }}>{name}</Text>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>Tên người tạo</div>
    </div>
  </Space>
);

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return '';
  }
};

const PersonalFeed = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [maxChars] = useState(300);
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [previewCache, setPreviewCache] = useState({});

  const fetchProfile = async () => {
    try {
      const res = await getMyProfile();
      setProfile(res?.data?.user || null);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Load profile failed:', e);
    }
  };

  const fetchData = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await listMyPosts({ page: p, limit });
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
    fetchProfile();
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Làm giàu preview cho các bài đã tải nếu chỉ có URL trong text
  useEffect(() => {
    const enrich = async () => {
      const urls = items
        .map((p) => p?.linkPreview?.url || extractFirstUrl(p?.textContent || ''))
        .filter((u) => u && !previewCache[u]);
      for (const url of urls) {
        // eslint-disable-next-line no-await-in-loop
        await resolvePreview(url);
      }
    };
    if (items && items.length) enrich();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // -------------- Link preview helpers (same như trang NewFeed chính) --------------
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

  const fetchProviderOEmbed = async (url) => {
    const tryFetch = async (endpoint) => {
      const res = await fetch(`${endpoint}${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('oEmbed failed');
      return res.json();
    };
    const endpoints = [
      'https://noembed.com/embed?url=',
      'https://soundcloud.com/oembed?format=json&url=',
      'https://vimeo.com/api/oembed.json?url=',
      'https://open.spotify.com/oembed?url=',
    ];
    for (const ep of endpoints) {
      try {
        const data = await tryFetch(ep);
        return {
          title: data.title || url,
          thumbnailUrl: data.thumbnail_url || deriveThumbnail(url),
          provider: data.provider_name || '',
          author: data.author_name || '',
          type: data.type || 'link',
        };
      } catch (_) {}
    }
    return null;
  };

  const fetchOgTags = async (url) => {
    try {
      const proxied = `https://r.jina.ai/http/${url.replace(/^https?:\/\//, '')}`;
      const res = await fetch(proxied);
      if (!res.ok) return null;
      const text = await res.text();
      const ogImageMatch = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      return { title: (titleMatch && titleMatch[1]) || url, thumbnailUrl: (ogImageMatch && ogImageMatch[1]) || deriveThumbnail(url), provider: '', author: '', type: 'link' };
    } catch { return null; }
  };

  const resolvePreview = async (url) => {
    if (previewCache[url]) return previewCache[url];
    const fromOembed = await fetchProviderOEmbed(url);
    const data = fromOembed || (await fetchOgTags(url)) || { title: url, thumbnailUrl: deriveThumbnail(url) };
    setPreviewCache((prev) => ({ ...prev, [url]: data }));
    return data;
  };

  useEffect(() => {
    const url = extractFirstUrl(newText);
    if (!url) { setLinkPreview(null); return; }
    let aborted = false;
    setLinkLoading(true);
    resolvePreview(url).then((data) => { if (!aborted) setLinkPreview({ url, ...data }); }).finally(() => { if (!aborted) setLinkLoading(false); });
    return () => { aborted = true; };
  }, [newText]);

  const handleCreatePost = async () => {
    if (!newText.trim()) { message.warning('Vui lòng nhập nội dung'); return; }
    try {
      setPosting(true);
      if (files.length > 0) {
        const form = new FormData();
        form.append('postType', 'status_update');
        form.append('textContent', newText.trim());
        if (linkPreview) form.append('linkPreview', JSON.stringify(linkPreview));
        files.forEach((f) => { if (f.originFileObj) form.append('media', f.originFileObj); });
        await createPost(form);
      } else {
        await createPost({ postType: 'status_update', textContent: newText.trim(), linkPreview });
      }
      setNewText('');
      setFiles([]);
      setIsModalOpen(false);
      message.success('Đăng bài thành công');
      fetchData(1);
      setPage(1);
    } catch (e) {
      message.error(e.message || 'Đăng bài thất bại');
    } finally { setPosting(false); }
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && hasMore) {
        const next = page + 1;
        setPage(next);
        fetchData(next);
      }
    }, { rootMargin: '200px' });
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [loading, hasMore, page]);

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
                  {profile?.displayName || profile?.username || 'trần quý'}
                </div>
                <div style={{ color: '#9ca3af', marginTop: 4 }}>@{profile?.username || '2003tranquy123'}</div>
              </div>
              <Button onClick={() => navigate('/profile')} style={{ marginTop: 16, background: '#fff', color: '#111', borderColor: '#fff', padding: '0 20px', height: 40, borderRadius: 999 }}>View Profile</Button>
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
          <div style={{ marginBottom: 20, background: '#0f0f10', border: '1px solid #1f1f1f', borderRadius: 8, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }} onClick={() => setIsModalOpen(true)}>
            <Avatar size={40} style={{ backgroundColor: '#722ed1' }}>{(profile?.displayName || 'U')[0]}</Avatar>
            <Input.TextArea placeholder="Có gì mới ?" autoSize={{ minRows: 2, maxRows: 8 }} style={{ flex: 1, background: '#fff', border: 'none', borderRadius: 10, minHeight: 56, fontSize: 16 }} readOnly />
            <Button type="primary" size="large" style={{ borderRadius: 999, background: '#1890ff', padding: '0 22px', height: 44 }} onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}>Post</Button>
          </div>

          <Modal
            open={isModalOpen}
            title={<span style={{ color: '#fff', fontWeight: 600 }}>Tạo bài đăng</span>}
            onCancel={() => { if (!posting) { setIsModalOpen(false); } }}
            footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button onClick={() => { if (!posting) setIsModalOpen(false); }}>Hủy</Button><Button type="primary" loading={posting} onClick={handleCreatePost}>Đăng</Button></div>}
            styles={{ content: { background: '#0f0f10' }, header: { background: '#0f0f10', borderBottom: '1px solid #1f1f1f' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input.TextArea placeholder="Chia sẻ điều gì đó..." autoSize={{ minRows: 3, maxRows: 8 }} value={newText} onChange={(e) => setNewText(e.target.value)} maxLength={maxChars} showCount />
              <Upload.Dragger multiple fileList={files} accept="audio/*,video/*" beforeUpload={() => false} onChange={({ fileList }) => setFiles(fileList)} listType="text" style={{ padding: 8, borderColor: '#303030', background: '#0f0f10', color: '#e5e7eb', minHeight: 150 }}
                itemRender={(originNode, file, fileList, actions) => (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#e5e7eb', padding: '6px 8px', borderBottom: '1px dashed #303030' }}>
                    <span style={{ color: '#e5e7eb', fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>{file.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button danger size="small" onClick={actions.remove}>Xóa</Button>
                    </div>
                  </div>
                )}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, color: '#e5e7eb' }}>Kéo thả hoặc bấm để chọn file (audio/video)</p>
                  <Text style={{ color: '#bfbfbf' }}>Hỗ trợ tối đa 10 file, 100MB mỗi file</Text>
                </div>
              </Upload.Dragger>
              {extractFirstUrl(newText) && (
                <div style={{ border: '1px solid #303030', borderRadius: 8, padding: 12, background: '#111', color: '#e5e7eb' }}>
                  {linkLoading ? (
                    <Text style={{ color: '#bfbfbf' }}>Đang tải preview…</Text>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {linkPreview?.thumbnailUrl ? (
                        <img src={linkPreview.thumbnailUrl} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: 6, background: '#1f1f1f' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{linkPreview?.title || extractFirstUrl(newText)}</div>
                        <div style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extractFirstUrl(newText)}</div>
                      </div>
                      <Button size="small" onClick={() => setLinkPreview(null)}>Ẩn</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>

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

export default PersonalFeed;


