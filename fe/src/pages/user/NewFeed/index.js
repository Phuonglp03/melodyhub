import React, { useEffect, useMemo, useState } from 'react';
import { Card, Avatar, Button, Typography, Space, Input, List, Divider, Tag, Spin, Empty, message, Modal, Upload } from 'antd';
import { LikeOutlined, MessageOutlined, PlusOutlined, HeartOutlined, CrownOutlined, UserOutlined } from '@ant-design/icons';
import { listPosts, createPost } from '../../../services/user/post';

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

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return '';
  }
};

const NewsFeed = () => {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
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
  const [previewCache, setPreviewCache] = useState({}); // url -> {title, thumbnailUrl}

  const extractFirstUrl = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const match = text.match(urlRegex);
    return match ? match[0] : null;
  };

  const getYoutubeId = (urlString) => {
    try {
      const u = new URL(urlString);
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '');
      }
      if (u.hostname.includes('youtube.com')) {
        return u.searchParams.get('v');
      }
      return null;
    } catch {
      return null;
    }
  };

  const deriveThumbnail = (urlString) => {
    const ytId = getYoutubeId(urlString);
    if (ytId) {
      return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    }
    return '';
  };

  const fetchProviderOEmbed = async (url) => {
    const tryFetch = async (endpoint) => {
      const res = await fetch(`${endpoint}${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('oEmbed failed');
      return res.json();
    };
    // Ordered list of oEmbed providers to try
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
      } catch (_) {
        // continue
      }
    }
    return null;
  };

  const fetchOgTags = async (url) => {
    try {
      const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`;
      const res = await fetch(proxied);
      if (!res.ok) return null;
      const text = await res.text();
      const ogImageMatch = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      return {
        title: (titleMatch && titleMatch[1]) || url,
        thumbnailUrl: (ogImageMatch && ogImageMatch[1]) || deriveThumbnail(url),
        provider: '',
        author: '',
        type: 'link',
      };
    } catch {
      return null;
    }
  };

  const resolvePreview = async (url) => {
    // cache first
    if (previewCache[url]) return previewCache[url];
    const fromOembed = await fetchProviderOEmbed(url);
    const data = fromOembed || (await fetchOgTags(url)) || { title: url, thumbnailUrl: deriveThumbnail(url) };
    setPreviewCache((prev) => ({ ...prev, [url]: data }));
    return data;
  };

  useEffect(() => {
    const url = extractFirstUrl(newText);
    if (!url) {
      setLinkPreview(null);
      return;
    }
    let aborted = false;
    setLinkLoading(true);
    resolvePreview(url)
      .then((data) => { if (!aborted) setLinkPreview({ url, ...data }); })
      .finally(() => { if (!aborted) setLinkLoading(false); });
    return () => { aborted = true; };
  }, [newText]);

  const fetchData = async (p = page, l = limit) => {
    setLoading(true);
    setError('');
    try {
      const res = await listPosts({ page: p, limit: l });
      const posts = res?.data?.posts || [];
      const totalPosts = res?.data?.pagination?.totalPosts || 0;
      if (p === 1) {
        setItems(posts);
      } else {
        setItems((prev) => [...prev, ...posts]);
      }
      setTotal(totalPosts);
      const totalPages = Math.ceil(totalPosts / l);
      setHasMore(p < totalPages);
    } catch (e) {
      setError(e.message || 'Lỗi tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enrich loaded posts with preview thumbnails if missing
  useEffect(() => {
    const enrich = async () => {
      const urls = items
        .map((p) => p?.linkPreview?.url)
        .filter((u) => u && !previewCache[u]);
      for (const url of urls) {
        await resolvePreview(url);
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
        fetchData(next, limit);
      }
    }, { rootMargin: '200px' });
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [loading, hasMore, page, limit]);

  const handleCreatePost = async () => {
    if (!newText.trim()) {
      message.warning('Vui lòng nhập nội dung');
      return;
    }
    try {
      setPosting(true);
      // eslint-disable-next-line no-console
      console.log('[UI] Click Đăng, preparing payload...');
      // Không chặn khi thiếu userId ở UI; service sẽ tự chèn từ localStorage
      // và BE sẽ trả lỗi rõ ràng nếu thiếu
      if (files.length > 0) {
        const form = new FormData();
        form.append('postType', 'status_update');
        form.append('textContent', newText.trim());
        if (linkPreview) {
          form.append('linkPreview', JSON.stringify(linkPreview));
        }
        files.forEach((f) => {
          if (f.originFileObj) form.append('media', f.originFileObj);
        });
        // eslint-disable-next-line no-console
        console.log('[UI] Sending multipart createPost...', { fileCount: files.length });
        await createPost(form);
      } else {
        // eslint-disable-next-line no-console
        console.log('[UI] Sending JSON createPost...');
        await createPost({ postType: 'status_update', textContent: newText.trim(), linkPreview });
      }
      setNewText('');
      setFiles([]);
      setIsModalOpen(false);
      message.success('Đăng bài thành công');
      fetchData(1, limit);
      setPage(1);
    } catch (e) {
      message.error(e.message || 'Đăng bài thất bại');
    } finally {
      setPosting(false);
    }
  };

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
          }} onClick={() => setIsModalOpen(true)}>
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
              readOnly
            />
            <Button type="primary" size="large" style={{ borderRadius: 999, background: '#1890ff', padding: '0 22px', height: 44 }} onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}>Post</Button>
          </div>

          <Modal
            open={isModalOpen}
            title={<span style={{ color: '#fff', fontWeight: 600 }}>Tạo bài đăng</span>}
            onCancel={() => { if (!posting) { setIsModalOpen(false); } }}
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => { if (!posting) setIsModalOpen(false); }}>Hủy</Button>
                <Button type="primary" loading={posting} onClick={handleCreatePost}>Đăng</Button>
              </div>
            }
            styles={{ 
              content: { background: '#0f0f10' },
              header: { background: '#0f0f10', borderBottom: '1px solid #1f1f1f' }
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input.TextArea
                placeholder="Chia sẻ điều gì đó..."
                autoSize={{ minRows: 3, maxRows: 8 }}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                maxLength={maxChars}
                showCount
              />
              <Upload.Dragger
                multiple
                fileList={files}
                accept="audio/*,video/*"
                beforeUpload={() => false}
                onChange={({ fileList }) => setFiles(fileList)}
                listType="text"
                style={{ padding: 8, borderColor: '#303030', background: '#0f0f10', color: '#e5e7eb', minHeight: 150 }}
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
            <Empty description={<span style={{ color: '#9ca3af' }}>Chưa có bài đăng</span>} />
          )}
          {!loading && !error && items.map((post) => (
            <Card key={post._id} style={{ marginBottom: 20, background: '#0f0f10', borderColor: '#1f1f1f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <Space align="start" size={14}>
                  <Avatar size={40} style={{ background: '#2db7f5' }}>
                    {post?.userId?.displayName?.[0] || post?.userId?.username?.[0] || 'U'}
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
                <Button size="middle" style={{ background: '#333', borderColor: '#333', color: '#fff' }}>
                  Follow
                </Button>
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
              {post?.linkPreview && (
                <a href={post.linkPreview?.url || '#'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{ border: '1px solid #303030', borderRadius: 8, padding: 12, background: '#111', color: '#e5e7eb', marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {(post.linkPreview?.thumbnailUrl || (previewCache[post.linkPreview?.url]?.thumbnailUrl)) ? (
                        <img src={(post.linkPreview?.thumbnailUrl || previewCache[post.linkPreview?.url]?.thumbnailUrl)} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 64, height: 64, borderRadius: 6, background: '#1f1f1f' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.linkPreview?.title || previewCache[post.linkPreview?.url]?.title || post.linkPreview?.url}</div>
                        <div style={{ color: '#9ca3af', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.linkPreview?.url}</div>
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
          ))}

          <div ref={loaderRef} style={{ height: 1 }} />
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              <Spin />
            </div>
          )}
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