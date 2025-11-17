import api from "./api";

export const getChords = async () => {
  const response = await api.get("/chords");
  return response.data?.data || [];
};
