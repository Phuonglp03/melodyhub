import React, { useEffect, useState } from "react";
import {
  Card,
  Avatar,
  Button,
  Typography,
  Space,
  Input,
  Spin,
  Empty,
  message,
  Modal,
  Upload,
  Select,
  List,
} from "antd";
import { LikeOutlined, MessageOutlined } from "@ant-design/icons";
import { listPostsByUser, createPost, getPostById } from "../../../services/user/post";
import {
  likePost,
  unlikePost,
  createPostComment,
  getPostStats,
  getAllPostComments,
  getPostLikes,
} from "../../../services/user/post";
import { getProfileById, followUser, unfollowUser } from "../../../services/user/profile";
import { onPostCommentNew, offPostCommentNew, joinRoom } from "../../../services/user/socketService";
import { getMyLicks } from "../../../services/user/lickService";
import PostLickEmbed from "../../../components/PostLickEmbed";
import { useNavigate, useParams } from "react-router-dom";

const { Text } = Typography;

const WavePlaceholder = () => (
  <div
    style={{
      height: 120,
      background: "#1a1a1a",
      borderRadius: 8,
      position: "relative",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "100%",
        display: "flex",
        alignItems: "end",
        gap: 2,
        padding: "8px 12px",
      }}
    >
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${Math.random() * 80 + 20}px`,
            background: "#ff7a45",
            borderRadius: 1.5,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          width: 12,
          height: 12,
          background: "#ff7a45",
          borderRadius: "50%",
        }}
      />
    </div>
  </div>
);

const formatTime = (isoString) => {
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return "";
  }
};

const sortCommentsDesc = (comments) => {
  if (!Array.isArray(comments)) return [];
  return [...comments].sort((a, b) => {
    const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
};

const limitToNewest3 = (comments) => {
  if (!Array.isArray(comments)) return [];
  const sorted = sortCommentsDesc(comments);
  return sorted.slice(0, 3);
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
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
};

const deriveThumbnail = (urlString) => {
  const ytId = getYoutubeId(urlString);
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  return "";
};

const parseSharedLickId = (urlString) => {
  if (!urlString) return null;
  try {
    const base =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : "https://melodyhub.app";
    const normalised = urlString.startsWith("http")
      ? new URL(urlString)
      : new URL(urlString, base);
    const segments = normalised.pathname.split("/").filter(Boolean);
    if (segments.length >= 2 && segments[0] === "licks") {
      return segments[1];
    }
    return null;
  } catch {
    return null;
  }
};

const UserFeed = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = React.useRef(null);
  const [previewCache, setPreviewCache] = useState({});
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [likingPostId, setLikingPostId] = useState(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [postIdToLiked, setPostIdToLiked] = useState({});
  const [postIdToStats, setPostIdToStats] = useState({});
  const [postIdToComments, setPostIdToComments] = useState({});
  const [modalPost, setModalPost] = useState(null);
  const [likesModalOpen, setLikesModalOpen] = useState(false);
  const [likesPostId, setLikesPostId] = useState(null);
  const [likesList, setLikesList] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [userIdToFollowing, setUserIdToFollowing] = useState({});
  const [userIdToFollowLoading, setUserIdToFollowLoading] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [files, setFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [maxChars] = useState(300);
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);
  const [selectedLickIds, setSelectedLickIds] = useState([]);
  const [currentUserId] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return undefined;
      const obj = JSON.parse(raw);
      const u = obj?.user || obj;
      return u?.id || u?.userId || u?._id;
    } catch {
      return undefined;
    }
  });
  const isOwnProfile = !!currentUserId && userId && (currentUserId.toString() === userId.toString());

  const fetchProfile = async (id) => {
    try {
      const res = await getProfileById(id);
      setProfile(res?.data?.user || null);
      if (typeof res?.data?.isFollowing === "boolean") {
        setIsFollowing(res.data.isFollowing);
      }
    } catch (e) {
      console.warn("Load profile failed:", e);
    }
  };

  const toggleFollow = async () => {
    if (!userId || !profile) return;
    try {
      setFollowLoading(true);
      if (isFollowing) {
        await unfollowUser(userId);
        setIsFollowing(false);
        setProfile((prev) => prev ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 1) - 1) } : prev);
        message.success("Đã bỏ theo dõi");
      } else {
        await followUser(userId);
        setIsFollowing(true);
        setProfile((prev) => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev);
        message.success("Đã theo dõi");
      }
    } catch (e) {
      const msg = e?.message || "";
      if (!isFollowing && msg.toLowerCase().includes("already following")) {
        setIsFollowing(true);
        setProfile((prev) => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev);
        message.success("Đã theo dõi");
      } else {
        message.error(msg || (isFollowing ? "Bỏ theo dõi thất bại" : "Theo dõi thất bại"));
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      setLikingPostId(postId);
      const isLiked = !!postIdToLiked[postId];
      if (isLiked) {
        await unlikePost(postId);
        setPostIdToLiked((prev) => ({ ...prev, [postId]: false }));
        setPostIdToStats((prev) => {
          const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
          const nextLikes = Math.max((cur.likesCount || 0) - 1, 0);
          return { ...prev, [postId]: { ...cur, likesCount: nextLikes } };
        });
        message.success("Đã bỏ thích");
      } else {
        await likePost(postId);
        setPostIdToLiked((prev) => ({ ...prev, [postId]: true }));
        setPostIdToStats((prev) => {
          const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
          return { ...prev, [postId]: { ...cur, likesCount: (cur.likesCount || 0) + 1 } };
        });
        message.success("Đã thích bài viết");
      }
      getPostStats(postId).then((res) => {
        const stats = res?.data || {};
        setPostIdToStats((prev) => ({ ...prev, [postId]: stats }));
      }).catch(() => {});
    } catch (e) {
      message.error(e.message || "Không thể thích bài viết");
    } finally {
      setLikingPostId(null);
    }
  };

  const openComment = async (postId) => {
    setCommentPostId(postId);
    setCommentText("");
    const p = items.find((it) => it._id === postId) || null;
    setModalPost(p);
    setCommentOpen(true);
    try {
      const all = await getAllPostComments(postId);
      setPostIdToComments((prev) => ({ ...prev, [postId]: Array.isArray(all) ? sortCommentsDesc(all) : [] }));
    } catch (e) {
      console.warn("Failed to fetch all comments for modal:", e);
    }
  };

  const toggleFollowUser = async (uid) => {
    if (!uid) return;
    try {
      setUserIdToFollowLoading((prev) => ({ ...prev, [uid]: true }));
      const isFollowing = !!userIdToFollowing[uid];
      if (isFollowing) {
        await unfollowUser(uid);
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: false }));
        message.success("Đã bỏ theo dõi");
      } else {
        await followUser(uid);
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: true }));
        message.success("Đã theo dõi");
      }
    } catch (e) {
      const msg = e?.message || "";
      if (!userIdToFollowing[uid] && msg.toLowerCase().includes("already following")) {
        setUserIdToFollowing((prev) => ({ ...prev, [uid]: true }));
        message.success("Đã theo dõi");
      } else {
        message.error(msg || "Thao tác thất bại");
      }
    } finally {
      setUserIdToFollowLoading((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const openLikesModal = async (postId) => {
    setLikesPostId(postId);
    setLikesModalOpen(true);
    setLikesList([]);
    try {
      setLikesLoading(true);
      const res = await getPostLikes(postId, { page: 1, limit: 100 });
      const users = res?.data?.users || [];
      setLikesList(users);
      
      // Fetch following status for all users in the list
      try {
        const uniqueUserIds = Array.from(new Set(users.map((u) => u.id).filter(Boolean)));
        const results = await Promise.all(uniqueUserIds.map(async (uid) => {
          try {
            const r = await getProfileById(uid);
            return { uid, isFollowing: !!r?.data?.isFollowing };
          } catch {
            return { uid, isFollowing: false };
          }
        }));
        const map = {};
        results.forEach(({ uid, isFollowing }) => { map[uid] = isFollowing; });
        setUserIdToFollowing((prev) => ({ ...prev, ...map }));
      } catch {}
    } catch (e) {
      message.error("Không thể tải danh sách người đã thích");
      console.error("Failed to fetch likes:", e);
    } finally {
      setLikesLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) {
      message.warning("Vui lòng nhập bình luận");
      return;
    }
    try {
      setCommentSubmitting(true);
      await createPostComment(commentPostId, { comment: commentText.trim() });
      message.success("Đã gửi bình luận");
      setCommentOpen(false);
      setCommentText("");
      const all = await getAllPostComments(commentPostId);
      setPostIdToComments((prev) => ({ ...prev, [commentPostId]: all }));
      const statsRes = await getPostStats(commentPostId);
      setPostIdToStats((prev) => ({ ...prev, [commentPostId]: statsRes?.data || prev[commentPostId] }));
    } catch (e) {
      message.error(e.message || "Không thể gửi bình luận");
    } finally {
      setCommentSubmitting(false);
    }
  };

  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;
    try {
      items.forEach((it) => it?._id && joinRoom(`post:${it._id}`));
    } catch (e) {
      // ignore join errors
    }
  }, [items]);

  useEffect(() => {
    const handler = (payload) => {
      if (!payload?.postId || !payload?.comment) return;
      const postId = payload.postId;
      const comment = payload.comment;
      if (!comment.createdAt) {
        comment.createdAt = new Date().toISOString();
      }
      setPostIdToStats((prev) => {
        const cur = prev[postId] || { likesCount: 0, commentsCount: 0 };
        return { ...prev, [postId]: { ...cur, commentsCount: (cur.commentsCount || 0) + 1 } };
      });
      setPostIdToComments((prev) => {
        const cur = Array.isArray(prev[postId]) ? prev[postId] : [];
        return { ...prev, [postId]: limitToNewest3([comment, ...cur]) };
      });
    };
    onPostCommentNew(handler);
    return () => {
      offPostCommentNew(handler);
    };
  }, []);

  useEffect(() => {
    if (!commentOpen || !commentPostId) return;
    const handler = (payload) => {
      if (!payload || payload.postId !== commentPostId) return;
      const newComment = payload.comment;
      if (!newComment.createdAt) {
        newComment.createdAt = new Date().toISOString();
      }
      setPostIdToComments((prev) => {
        const cur = prev[commentPostId] || [];
        return { ...prev, [commentPostId]: sortCommentsDesc([newComment, ...cur]) };
      });
      setPostIdToStats((prev) => {
        const cur = prev[commentPostId] || { likesCount: 0, commentsCount: 0 };
        return { ...prev, [commentPostId]: { ...cur, commentsCount: (cur.commentsCount || 0) + 1 } };
      });
    };
    onPostCommentNew(handler);
    return () => {
      offPostCommentNew(handler);
    };
  }, [commentOpen, commentPostId]);

  const fetchProviderOEmbed = async (url) => {
    const tryFetch = async (endpoint) => {
      const res = await fetch(`${endpoint}${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error("oEmbed failed");
      return res.json();
    };
    const endpoints = [
      "https://noembed.com/embed?url=",
      "https://soundcloud.com/oembed?format=json&url=",
      "https://vimeo.com/api/oembed.json?url=",
      "https://open.spotify.com/oembed?url=",
    ];
    for (const ep of endpoints) {
      try {
        const data = await tryFetch(ep);
        return {
          title: data.title || url,
          thumbnailUrl: data.thumbnail_url || deriveThumbnail(url),
          provider: data.provider_name || "",
          author: data.author_name || "",
          type: data.type || "link",
        };
      } catch (_) {
        // continue
      }
    }
    return null;
  };

  const fetchOgTags = async (url) => {
    try {
      const proxied = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
      const res = await fetch(proxied);
      if (!res.ok) return null;
      const text = await res.text();
      const ogImageMatch = text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      return {
        title: (titleMatch && titleMatch[1]) || url,
        thumbnailUrl: (ogImageMatch && ogImageMatch[1]) || deriveThumbnail(url),
        provider: "",
        author: "",
        type: "link",
      };
    } catch {
      return null;
    }
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

  const fetchActiveLicks = async () => {
    try {
      setLoadingLicks(true);
      const res = await getMyLicks({ status: "active", limit: 100 });
      if (res?.success && Array.isArray(res.data)) {
        const formattedLicks = res.data.map((lick) => ({
          value: lick.lick_id || lick._id,
          label: lick.title || "Untitled Lick",
          ...lick
        }));
        setAvailableLicks(formattedLicks);
      } else {
        setAvailableLicks([]);
      }
    } catch (e) {
      console.error("Error fetching active licks:", e);
      setAvailableLicks([]);
    } finally {
      setLoadingLicks(false);
    }
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
    if (currentUserId) {
      fetchActiveLicks();
    }
  };

  const handleModalClose = () => {
    if (!posting) {
      setIsModalOpen(false);
      setSelectedLickIds([]);
    }
  };

  const handleCreatePost = async () => {
    if (!newText.trim()) {
      message.warning("Vui lòng nhập nội dung");
      return;
    }
    try {
      setPosting(true);
      let newPost = null;
      if (files.length > 0) {
        const form = new FormData();
        form.append("postType", "status_update");
        form.append("textContent", newText.trim());
        if (linkPreview) {
          form.append("linkPreview", JSON.stringify(linkPreview));
        }
        if (selectedLickIds.length > 0) {
          form.append("attachedLickIds", JSON.stringify(selectedLickIds));
        }
        files.forEach((f) => {
          if (f.originFileObj) form.append("media", f.originFileObj);
        });
        const response = await createPost(form);
        newPost = response?.data || response;
      } else {
        const payload = { postType: "status_update", textContent: newText.trim(), linkPreview };
        if (selectedLickIds.length > 0) {
          payload.attachedLickIds = selectedLickIds;
        }
        const response = await createPost(payload);
        newPost = response?.data || response;
      }
      
      if (newPost && newPost._id) {
        setItems((prev) => {
          const exists = prev.some((p) => p._id === newPost._id);
          if (exists) return prev;
          return [newPost, ...prev];
        });
        
        setPostIdToStats((prev) => ({
          ...prev,
          [newPost._id]: { likesCount: 0, commentsCount: 0 }
        }));
        setPostIdToLiked((prev) => ({ ...prev, [newPost._id]: false }));
        setPostIdToComments((prev) => ({ ...prev, [newPost._id]: [] }));
        
        try {
          joinRoom(`post:${newPost._id}`);
        } catch {
          // Ignore socket errors
        }
      }
      
      setNewText("");
      setFiles([]);
      setSelectedLickIds([]);
      setIsModalOpen(false);
      message.success("Đăng bài thành công");
    } catch (e) {
      message.error(e.message || "Đăng bài thất bại");
    } finally {
      setPosting(false);
    }
  };

  const fetchData = async (id, p = page) => {
    setLoading(true);
    setError("");
    try {
      const res = await listPostsByUser(id, { page: p, limit });
      const posts = res?.data?.posts || [];
      const total = res?.data?.pagination?.totalPosts || 0;
      if (p === 1) setItems(posts);
      else setItems((prev) => [...prev, ...posts]);
      const totalPages = Math.ceil(total / limit) || 1;
      setHasMore(p < totalPages);

      const likedMap = {};
      posts.forEach((post) => {
        if (post._id && post.isLiked !== undefined) {
          likedMap[post._id] = !!post.isLiked;
        }
      });
      setPostIdToLiked((prev) => ({ ...prev, ...likedMap }));
    } catch (e) {
      setError(e.message || "Lỗi tải bài viết");
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
      for (const p of items) {
        getPostStats(p._id).then((res) => {
          setPostIdToStats((prev) => ({ ...prev, [p._id]: res?.data || prev[p._id] }));
        }).catch(() => {});
        getAllPostComments(p._id).then((list) => {
          const limited = limitToNewest3(Array.isArray(list) ? list : []);
          setPostIdToComments((prev) => ({ ...prev, [p._id]: limited }));
        }).catch(() => {});
      }
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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          const next = page + 1;
          setPage(next);
          if (userId) fetchData(userId, next);
        }
      },
      { rootMargin: "200px" }
    );
    const el = loaderRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [loading, hasMore, page, userId]);

  return (
    <>
      <div
        style={{
          maxWidth: 1680,
          margin: "0 auto",
          padding: "24px 24px",
          background: "#0a0a0a",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            height: 180,
            background: "#131313",
            borderRadius: 8,
            marginBottom: 16,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px minmax(0, 1.2fr) 360px",
            gap: 24,
          }}
        >
          <div>
            <Card
              style={{
                background: "#0f0f10",
                borderColor: "#1f1f1f",
                marginBottom: 12,
                padding: 0,
              }}
            >
              <div
                style={{
                  height: 180,
                  borderRadius: "8px 8px 0 0",
                  backgroundImage: profile?.avatarUrl
                    ? `url(${profile.avatarUrl})`
                    : undefined,
                  backgroundColor: "#131313",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "12px 16px 20px 16px",
                }}
              >
                <div
                  style={{ marginTop: 12, textAlign: "center", width: "100%" }}
                >
                  <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>
                    {profile?.displayName || profile?.username || "User"}
                  </div>
                  <div style={{ color: "#9ca3af", marginTop: 4 }}>
                    @{profile?.username || ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  {isOwnProfile ? (
                    <Button
                      onClick={() => navigate("/profile")}
                      style={{
                        background: "#fff",
                        color: "#111",
                        borderColor: "#fff",
                        padding: "0 20px",
                        height: 40,
                        borderRadius: 999,
                      }}
                    >
                      Xem hồ sơ
                    </Button>
                  ) : (
                    <Button
                      onClick={toggleFollow}
                      loading={followLoading}
                      style={{
                        background: isFollowing ? "#111" : "#fff",
                        color: isFollowing ? "#fff" : "#111",
                        borderColor: isFollowing ? "#303030" : "#fff",
                        padding: "0 20px",
                        height: 40,
                        borderRadius: 999,
                      }}
                    >
                      {isFollowing ? "Đang theo dõi" : "Theo dõi"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
            <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                    {profile?.followersCount ?? 0}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                    Followers
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
                    {profile?.followingCount ?? 0}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                    Following
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div>
            {/* Post composer - only show if own profile */}
            {isOwnProfile && (
              <div style={{ 
                marginBottom: 20, 
                background: "#0f0f10", 
                border: "1px solid #1f1f1f",
                borderRadius: 8,
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                gap: 16
              }} onClick={handleModalOpen}>
                <Avatar size={40} src={profile?.avatarUrl} style={{ backgroundColor: "#722ed1" }}>
                  {(profile?.displayName || profile?.username || "U")[0]}
                </Avatar>
                <Input.TextArea 
                  placeholder="Có gì mới ?" 
                  autoSize={{ minRows: 2, maxRows: 8 }}
                  style={{ 
                    flex: 1,
                    background: "#fff",
                    border: "none",
                    borderRadius: 10,
                    minHeight: 56,
                    fontSize: 16
                  }}
                  readOnly
                />
                <Button type="primary" size="large" style={{ borderRadius: 999, background: "#1890ff", padding: "0 22px", height: 44 }} onClick={(e) => { e.stopPropagation(); handleModalOpen(); }}>Post</Button>
              </div>
            )}

            <Modal
              open={isModalOpen}
              title={<span style={{ color: "#fff", fontWeight: 600 }}>Tạo bài đăng</span>}
              onCancel={handleModalClose}
              footer={
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
                  <Button 
                    shape="round"
                    onClick={handleModalClose}
                    style={{ height: 44, borderRadius: 22, padding: 0, width: 108, background: "#1f1f1f", color: "#e5e7eb", borderColor: "#303030" }}
                  >Hủy</Button>
                  <Button 
                    type="primary" 
                    shape="round"
                    loading={posting} 
                    onClick={handleCreatePost}
                    style={{ height: 44, borderRadius: 22, padding: 0, width: 108, background: "#7c3aed", borderColor: "#7c3aed" }}
                  >Đăng</Button>
                </div>
              }
              styles={{ 
                content: { background: "#0f0f10" },
                header: { background: "#0f0f10", borderBottom: "1px solid #1f1f1f" }
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Input.TextArea
                  placeholder="Chia sẻ điều gì đó..."
                  autoSize={{ minRows: 3, maxRows: 8 }}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  maxLength={maxChars}
                  showCount
                />
                <div>
                  <Text style={{ color: "#e5e7eb", marginBottom: 8, display: "block" }}>Đính kèm lick (chỉ licks active của bạn)</Text>
                  <Select
                    mode="multiple"
                    placeholder="Chọn lick để đính kèm..."
                    value={selectedLickIds}
                    onChange={setSelectedLickIds}
                    loading={loadingLicks}
                    style={{ width: "100%" }}
                    options={availableLicks}
                    notFoundContent={loadingLicks ? <Spin size="small" /> : <Empty description="Không có lick active nào" />}
                    filterOption={(input, option) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    popupClassName="dark-select-dropdown"
                  />
                </div>
                <Upload.Dragger
                  multiple
                  fileList={files}
                  accept="audio/*,video/*"
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setFiles(fileList)}
                  listType="text"
                  style={{ padding: 8, borderColor: "#303030", background: "#0f0f10", color: "#e5e7eb", minHeight: 150 }}
                  itemRender={(originNode, file, fileList, actions) => (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", color: "#e5e7eb", padding: "6px 8px", borderBottom: "1px dashed #303030" }}>
                      <span style={{ color: "#e5e7eb", fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 12 }}>{file.name}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Button danger size="small" onClick={actions.remove}>Xóa</Button>
                      </div>
                    </div>
                  )}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <p style={{ margin: 0, color: "#e5e7eb" }}>Kéo thả hoặc bấm để chọn file (audio/video)</p>
                    <Text style={{ color: "#bfbfbf" }}>Hỗ trợ tối đa 10 file, 100MB mỗi file</Text>
                  </div>
                </Upload.Dragger>
                {extractFirstUrl(newText) && (
                  <div style={{ border: "1px solid #303030", borderRadius: 8, padding: 12, background: "#111", color: "#e5e7eb" }}>
                    {linkLoading ? (
                      <Text style={{ color: "#bfbfbf" }}>Đang tải preview…</Text>
                    ) : (
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {linkPreview?.thumbnailUrl ? (
                          <img src={linkPreview.thumbnailUrl} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                        ) : (
                          <div style={{ width: 64, height: 64, borderRadius: 6, background: "#1f1f1f" }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkPreview?.title || extractFirstUrl(newText)}</div>
                          <div style={{ color: "#9ca3af", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{extractFirstUrl(newText)}</div>
                        </div>
                        <Button size="small" onClick={() => setLinkPreview(null)}>Ẩn</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Modal>

            {loading && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <Spin />
              </div>
            )}
            {!loading && error && (
              <Card
                style={{
                  marginBottom: 20,
                  background: "#0f0f10",
                  borderColor: "#1f1f1f",
                }}
              >
                <Text style={{ color: "#fff" }}>{error}</Text>
              </Card>
            )}
            {!loading && !error && items.length === 0 && (
              <Empty
                description={
                  <span style={{ color: "#9ca3af" }}>Chưa có bài đăng</span>
                }
              />
            )}

            {!loading &&
              !error &&
              items.map((post) => {
                const firstUrl = extractFirstUrl(post?.textContent || "");
                const sharedLickId = parseSharedLickId(firstUrl);
                const previewUrl = sharedLickId
                  ? null
                  : post?.linkPreview?.url || firstUrl;
                const previewData =
                  post?.linkPreview ||
                  (previewUrl ? previewCache[previewUrl] : null);
                return (
                  <Card
                    key={post._id}
                    style={{
                      marginBottom: 20,
                      background: "#0f0f10",
                      borderColor: "#1f1f1f",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12,
                      }}
                    >
                      <Space align="start" size={14}>
                        <Avatar size={40} src={post?.userId?.avatarUrl} style={{ background: "#2db7f5" }}>
                          {
                            (post?.userId?.displayName ||
                              post?.userId?.username ||
                              "U")[0]
                          }
                        </Avatar>
                        <div>
                          <Space style={{ marginBottom: 4 }}>
                            <Text
                              strong
                              style={{ color: "#fff", fontSize: 16 }}
                            >
                              {post?.userId?.displayName ||
                                post?.userId?.username ||
                                "Người dùng"}
                            </Text>
                            <Text
                              type="secondary"
                              style={{ color: "#9ca3af", fontSize: 13 }}
                            >
                              {formatTime(post?.createdAt)}
                            </Text>
                          </Space>
                        </div>
                      </Space>
                    </div>
                    {post?.textContent && (
                      <div
                        style={{
                          marginBottom: 10,
                          color: "#fff",
                          fontSize: 15,
                          lineHeight: 1.6,
                        }}
                      >
                        {post.textContent}
                      </div>
                    )}
                    {sharedLickId && (
                      <div style={{ marginBottom: 12 }}>
                        <PostLickEmbed lickId={sharedLickId} url={firstUrl} />
                      </div>
                    )}
                    {post?.attachedLicks && Array.isArray(post.attachedLicks) && post.attachedLicks.length > 0 && (
                      <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                        {post.attachedLicks.map((lick) => {
                          const lickId = lick?._id || lick?.lick_id || lick;
                          if (!lickId) return null;
                          return (
                            <div key={lickId} style={{ marginBottom: 8 }}>
                              <PostLickEmbed lickId={lickId} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {post?.media?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <WavePlaceholder />
                      </div>
                    )}
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <div
                          style={{
                            border: "1px solid #303030",
                            borderRadius: 8,
                            padding: 12,
                            background: "#111",
                            color: "#e5e7eb",
                            marginTop: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            {(() => {
                              const imgSrc =
                                (previewData && previewData.thumbnailUrl) ||
                                deriveThumbnail(previewUrl);
                              return imgSrc ? (
                                <img
                                  src={imgSrc}
                                  alt="preview"
                                  style={{
                                    width: 64,
                                    height: 64,
                                    objectFit: "cover",
                                    borderRadius: 6,
                                  }}
                                />
                              ) : null;
                            })() || (
                              <div
                                style={{
                                  width: 64,
                                  height: 64,
                                  borderRadius: 6,
                                  background: "#1f1f1f",
                                }}
                              />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: "#fff",
                                  marginBottom: 4,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {previewData?.title || previewUrl}
                              </div>
                              <div
                                style={{
                                  color: "#9ca3af",
                                  fontSize: 12,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {previewUrl}
                              </div>
                            </div>
                          </div>
                        </div>
                      </a>
                    )}
                    <Space style={{ marginTop: 14, display: "flex", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Button
                          icon={<LikeOutlined />}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: postIdToLiked[post._id] ? "#1890ff" : "#fff",
                          }}
                          loading={likingPostId === post._id}
                          onClick={() => handleLike(post._id)}
                        >
                          Thích
                        </Button>
                        {Number(postIdToStats[post._id]?.likesCount ?? 0) > 0 && (
                          <span
                            onClick={() => openLikesModal(post._id)}
                            style={{
                              color: "#1890ff",
                              cursor: "pointer",
                              fontSize: 14,
                              fontWeight: 500,
                              userSelect: "none"
                            }}
                          >
                            {postIdToStats[post._id].likesCount} lượt thích
                          </span>
                        )}
                      </div>
                      <Button
                        icon={<MessageOutlined />}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#fff",
                        }}
                        onClick={() => openComment(post._id)}
                      >
                        Bình luận {Number(postIdToStats[post._id]?.commentsCount ?? 0) > 0 ? `(${postIdToStats[post._id].commentsCount})` : ""}
                      </Button>
                    </Space>

                    {/* Danh sách bình luận - chỉ hiển thị 3 comment gần nhất */}
                    {postIdToComments[post._id] && postIdToComments[post._id].length > 0 && (
                      <div style={{ marginTop: 12, background: "#0f0f10", borderTop: "1px solid #1f1f1f", paddingTop: 8 }}>
                        {limitToNewest3(postIdToComments[post._id]).map((c) => (
                          <div key={c._id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <Avatar size={28} style={{ background: "#555" }}>{c?.userId?.displayName?.[0] || c?.userId?.username?.[0] || "U"}</Avatar>
                            <div style={{ background: "#151515", border: "1px solid #232323", borderRadius: 10, padding: "6px 10px", color: "#e5e7eb" }}>
                              <div style={{ fontWeight: 600 }}>{c?.userId?.displayName || c?.userId?.username || "Người dùng"}</div>
                              <div>{c.comment}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}

            <div ref={loaderRef} style={{ height: 1 }} />
          </div>

          <div>
            <Card style={{ background: "#0f0f10", borderColor: "#1f1f1f" }}>
              <div style={{ color: "#fff", fontWeight: 700, marginBottom: 12 }}>
                Find Me On
              </div>
              <Space>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    background: "#111",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#3b82f6",
                  }}
                >
                  🌐
                </div>
                <a href="#" style={{ color: "#fff" }}>
                  Website
                </a>
              </Space>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        title={<span style={{ color: "#fff", fontWeight: 700 }}>Người đã thích</span>}
        open={likesModalOpen}
        onCancel={() => {
          setLikesModalOpen(false);
          setLikesPostId(null);
          setLikesList([]);
        }}
        footer={null}
        width={500}
        styles={{
          header: { background: "#0f0f10", borderBottom: "1px solid #1f1f1f" },
          content: { background: "#0f0f10", borderRadius: 12 },
          body: { background: "#0f0f10", maxHeight: "60vh", overflowY: "auto" }
        }}
      >
        {likesLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Spin />
          </div>
        ) : likesList.length === 0 ? (
          <Empty description={<span style={{ color: "#9ca3af" }}>Chưa có ai thích bài viết này</span>} />
        ) : (
          <List
            dataSource={likesList}
            renderItem={(user) => {
              const isCurrentUser = currentUserId && user.id && user.id.toString() === currentUserId.toString();
              return (
                <List.Item
                  style={{ padding: "12px 0", borderBottom: "1px solid #1f1f1f" }}
                  actions={
                    isCurrentUser ? null : [
                      <Button
                        key="follow"
                        size="small"
                        type={userIdToFollowing[user.id] ? "default" : "primary"}
                        loading={!!userIdToFollowLoading[user.id]}
                        onClick={() => toggleFollowUser(user.id)}
                        style={{
                          background: userIdToFollowing[user.id] ? "#111" : "#7c3aed",
                          borderColor: userIdToFollowing[user.id] ? "#444" : "#7c3aed",
                          color: "#fff",
                        }}
                      >
                        {userIdToFollowing[user.id] ? "Đang theo dõi" : "Follow"}
                      </Button>
                    ]
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={40}
                        src={user.avatarUrl}
                        style={{ background: "#2db7f5", cursor: "pointer" }}
                        onClick={() => navigate(`/users/${user.id}/newfeeds`)}
                      >
                        {user.displayName?.[0] || user.username?.[0] || "U"}
                      </Avatar>
                    }
                    title={
                      <span
                        style={{ color: "#fff", cursor: "pointer" }}
                        onClick={() => navigate(`/users/${user.id}/newfeeds`)}
                      >
                        {user.displayName || user.username || "Người dùng"}
                      </span>
                    }
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Modal>

      <Modal
        title={<span style={{ color: "#fff", fontWeight: 700 }}>Bình luận bài viết</span>}
        open={commentOpen}
        onCancel={() => setCommentOpen(false)}
        footer={null}
        width={860}
        styles={{
          header: { background: "#0f0f10", borderBottom: "1px solid #1f1f1f" },
          content: { background: "#0f0f10", borderRadius: 12 },
          body: { background: "#0f0f10" }
        }}
      >
        {modalPost && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <Avatar size={40} style={{ background: "#2db7f5" }}>
                {modalPost?.userId?.displayName?.[0] || modalPost?.userId?.username?.[0] || "U"}
              </Avatar>
              <div>
                <div style={{ color: "#fff", fontWeight: 600 }}>
                  {modalPost?.userId?.displayName || modalPost?.userId?.username || "Người dùng"}
                </div>
                <Text type="secondary" style={{ color: "#9ca3af", fontSize: 12 }}>{formatTime(modalPost?.createdAt)}</Text>
              </div>
            </div>
            {modalPost?.textContent && (
              <div style={{ marginBottom: 8, color: "#e5e7eb" }}>{modalPost.textContent}</div>
            )}
            {(() => {
              const url = extractFirstUrl(modalPost?.textContent);
              const sharedLickId = parseSharedLickId(url);
              return sharedLickId ? (
                <div style={{ marginBottom: 12 }}>
                  <PostLickEmbed lickId={sharedLickId} url={url} />
                </div>
              ) : null;
            })()}
            {modalPost?.media?.length > 0 && (
              <div style={{ marginBottom: 8 }}><WavePlaceholder /></div>
            )}
            {modalPost?.linkPreview && (
              <a href={modalPost.linkPreview?.url || "#"} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <div style={{ border: "1px solid #303030", borderRadius: 8, padding: 12, background: "#111", color: "#e5e7eb", marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    {(modalPost.linkPreview?.thumbnailUrl || (previewCache[modalPost.linkPreview?.url]?.thumbnailUrl)) ? (
                      <img src={(modalPost.linkPreview?.thumbnailUrl || previewCache[modalPost.linkPreview?.url]?.thumbnailUrl)} alt="preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 64, height: 64, borderRadius: 6, background: "#1f1f1f" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: "#fff", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modalPost.linkPreview?.title || previewCache[modalPost.linkPreview?.url]?.title || modalPost.linkPreview?.url}</div>
                      <div style={{ color: "#9ca3af", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modalPost.linkPreview?.url}</div>
                    </div>
                  </div>
                </div>
              </a>
            )}

            <div style={{ marginTop: 8, color: "#9ca3af" }}>
              {Number(postIdToStats[commentPostId]?.likesCount ?? 0)} lượt thích · {Number(postIdToStats[commentPostId]?.commentsCount ?? 0)} bình luận
            </div>

            <div style={{ marginTop: 12, maxHeight: 360, overflowY: "auto" }}>
              {(postIdToComments[commentPostId] || []).map((c) => (
                <div key={c._id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Avatar size={28} style={{ background: "#555" }}>{c?.userId?.displayName?.[0] || c?.userId?.username?.[0] || "U"}</Avatar>
                  <div style={{ background: "#151515", border: "1px solid #232323", borderRadius: 10, padding: "6px 10px", color: "#e5e7eb" }}>
                    <div style={{ fontWeight: 600 }}>{c?.userId?.displayName || c?.userId?.username || "Người dùng"}</div>
                    <div>{c.comment}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
              <Input
                placeholder="Nhập bình luận của bạn..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                style={{ background: "#0f0f10", color: "#e5e7eb", borderColor: "#303030", height: 44, borderRadius: 22, flex: 1 }}
              />
              <Button type="primary" loading={commentSubmitting} onClick={submitComment} style={{ background: "#7c3aed", borderColor: "#7c3aed", borderRadius: 22, padding: "0 20px", height: 44 }}>Gửi</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default UserFeed;
