require("dotenv").config();

const { default: axios } = require("axios");
const express = require("express");
const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

const state = "1234567890";

const LINKEDIN_URL_MAP = {
  OAUTH_URL: "https://www.linkedin.com/oauth/v2/authorization",
  ACCESS_TOKEN_URL: "https://www.linkedin.com/oauth/v2/accessToken",
  PROFILE_URL: "https://api.linkedin.com/v2/userinfo",
  USER_GENERATED_CONTENT_URL: "https://api.linkedin.com/v2/ugcPosts",
};

// Login with LinkedIn
app.get("/login", (req, res) => {
  const linkedinOauthUrl = `${LINKEDIN_URL_MAP.OAUTH_URL}?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_REDIRECT_URI}&state=${state}&scope=w_member_social%20profile%20email%20openid`;
  console.log(linkedinOauthUrl);
  res.redirect(linkedinOauthUrl);
});

// LinkedIn callback
app.get("/linkedin/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log(code, state);
    const response = await axios.post(
      LINKEDIN_URL_MAP.ACCESS_TOKEN_URL,
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    res.send(response.data);
  } catch (error) {
    console.log(error.response.data);
    res.status(500).send(error.response.data);
  }
});

// LinkedIn profile
app.get("/linkedin/profile", async (req, res) => {
  try {
    const { access_token } = req.query;
    const response = await axios.get(LINKEDIN_URL_MAP.PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    res.send(response.data);
  } catch (error) {
    console.log(error.response.data);
    res.status(500).send(error.response.data);
  }
});

// Create a post
app.post("/linkedin/post", async (req, res) => {
  try {
    const { access_token, author_id } = req.body;
    console.log(access_token, author_id);
    const response = await axios.post(
      LINKEDIN_URL_MAP.USER_GENERATED_CONTENT_URL,
      {
        author: `urn:li:person:${author_id}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            // <-- This union-type key is required
            shareCommentary: {
              text: "This post was created by the LinkedIn API", // Must be an object with a `text` field
            },
            shareMediaCategory: "NONE",
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC", // <-- This union-type key is required
        },
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    res.send(response.data);
  } catch (error) {
    console.log(error.response.data);
    res.status(500).send(error.response.data);
  }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
