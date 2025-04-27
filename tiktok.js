require("dotenv").config();

const axios = require("axios");
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const state = "1234567890";

const upload = multer({ dest: "uploads/" });

const TIKTOK_URL_MAP = {
  OAUTH_URL: "https://www.tiktok.com/v2/auth/authorize",
  ACCESS_TOKEN_URL: "https://open.tiktokapis.com/v2/oauth/token/",
  PROFILE_URL: "https://www.tiktok.com/v2/user/info",
  INIT_UPLOAD_URL: "https://open.tiktokapis.com/v2/post/publish/video/init/",
};

app.get("/login", (req, res) => {
  const tiktokOauthUrl = `${TIKTOK_URL_MAP.OAUTH_URL}?response_type=code&client_key=${process.env.TIKTOK_CLIENT_ID}&redirect_uri=${process.env.TIKTOK_REDIRECT_URI}&state=${state}&scope=user.info.basic,video.publish,video.upload,user.info.profile,user.info.stats,video.list`;
  res.redirect(tiktokOauthUrl);
});

app.get("/tiktok/callback", async (req, res) => {
  const { code, state: callbackState } = req.query;
  if (callbackState !== state) {
    return res.status(400).send("Invalid state");
  }
  try {
    const response = await axios.post(
      TIKTOK_URL_MAP.ACCESS_TOKEN_URL,
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_ID,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json(error.response.data);
  }
});

// --- helper ---
function makeChunks(size, chunkSize, count) {
  const chunks = [];
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    // last chunk gets everything that is left, remainder included
    const end = i === count - 1 ? size - 1 : start + chunkSize - 1;
    chunks.push({ start, end });
  }
  return chunks;
}

// Upload Route
app.post("/upload", upload.single("video"), async (req, res) => {
  const accessToken = req.query.access_token;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });
  const fileSize = file.size;
  const filePath = file.path;
  const chunkSize = fileSize > 10_000_000 ? 10_000_000 : fileSize;
  const totalChunkCount = Math.floor(fileSize / chunkSize) || 1;
  console.log({
    source: "FILE_UPLOAD",
    video_size: fileSize,
    chunk_size: chunkSize,
    total_chunk_count: totalChunkCount,
  });
  try {
    // 1. Initialize the upload with TikTok
    const initResponse = await axios.post(
      TIKTOK_URL_MAP.INIT_UPLOAD_URL,
      {
        source_info: {
          source: "FILE_UPLOAD",
          video_size: fileSize,
          chunk_size: chunkSize,
          total_chunk_count: totalChunkCount,
        },
        post_info: {
          title: "Uploaded from API",
          privacy_level: "SELF_ONLY",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
      }
    );
    console.log(initResponse.data);
    const { upload_id, upload_url } = initResponse.data.data;

    // 2. Upload the video in chunks
    const chunks = makeChunks(fileSize, chunkSize, totalChunkCount);
    const uploadUrl = upload_url;

    for (let i = 0; i < chunks.length; i++) {
      const { start, end } = chunks[i];
      const chunkStream = fs.createReadStream(file.path, {
        start,
        end,
      });

      const uploadResponse = await axios.put(uploadUrl, chunkStream, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": end - start + 1,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      console.log(
        `Chunk ${i + 1}/${chunks.length} uploaded successfully, status: ${
          uploadResponse.status
        }`
      );

      // TikTok returns 206 for partial and 201 for the last chunk
      if (uploadResponse.status !== 206 && uploadResponse.status !== 201) {
        throw new Error(
          `Failed to upload chunk ${i + 1}: ${uploadResponse.status}`
        );
      }
    }

    // 3. Respond with success
    res.json({ message: "Upload complete", upload_id });
  } catch (error) {
    console.log("error", error?.message);
    res.status(500).json(error.response?.data || { message: error.message });
  } finally {
    fs.unlinkSync(filePath); // cleanup uploaded file
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
