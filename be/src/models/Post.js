import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Loại bài đăng
    postType: {
      type: String,
      enum: ["status_update", "shared_post"],
      default: "status_update",
      required: true,
    },

    // Nội dung văn bản
    textContent: { type: String },

    // 🔹 Phần preview khi dán link
    linkPreview: {
      url: { type: String },
      title: { type: String },
      description: { type: String },
      image: { type: String },
      siteName: { type: String },
    },

    // 🔹 Phần media upload từ máy (ảnh / video / audio)
    media: [
      {
        url: { type: String, required: true },
        type: {
          type: String,
          enum: ["image", "video", "audio"],
          required: true,
        },
      },
    ],

    // 🔹 Danh sách lick đính kèm từ thư viện cá nhân
    attachedLicks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lick',
      },
    ],

    // Bài chia sẻ lại (nếu có)
    originalPostId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },

    // Trạng thái kiểm duyệt
    moderationStatus: {
      type: String,
      enum: ["approved", "banned"],
      default: "approved",
      required: true,
    },
  },
  { timestamps: true }
);

postSchema.index({ userId: 1 });
postSchema.index({ createdAt: -1 });

const Post = mongoose.model("Post", postSchema);
export default Post;
