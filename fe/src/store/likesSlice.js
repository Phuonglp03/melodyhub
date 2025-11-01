import { createSlice } from "@reduxjs/toolkit";

const likesSlice = createSlice({
  name: "likes",
  initialState: {
    byId: {}, // { [lickId]: { liked: boolean, count: number } }
  },
  reducers: {
    setLikeState: (state, action) => {
      const { id, liked = false, count = 0 } = action.payload;
      state.byId[id] = { liked, count };
    },
    toggleLikeLocal: (state, action) => {
      const { id } = action.payload;
      const item = state.byId[id] || { liked: false, count: 0 };
      const nextLiked = !item.liked;
      const nextCount = item.count + (nextLiked ? 1 : -1);
      state.byId[id] = { liked: nextLiked, count: Math.max(0, nextCount) };
    },
  },
});

export const { setLikeState, toggleLikeLocal } = likesSlice.actions;
export default likesSlice.reducer;
