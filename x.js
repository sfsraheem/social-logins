require("dotenv").config();

const axios = require("axios");
const express = require("express");
const qs = require("qs");

const app = express();
const port = process.env.PORT || 3333;

const base64Credentials = Buffer.from(
  `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
).toString("base64");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const state = "1234567890";

const X_URL_MAP = {
  OAUTH_URL: "https://x.com/i/oauth2/authorize",
  ACCESS_TOKEN_URL: "https://api.x.com/2/oauth2/token",
  CREATE_TWEET_URL: "https://api.x.com/2/tweets",
};

app.get("/login", (req, res) => {
  const xOauthUrl = `${X_URL_MAP.OAUTH_URL}?response_type=code&client_id=${process.env.X_CLIENT_ID}&redirect_uri=${process.env.X_REDIRECT_URI}&state=${state}&code_challenge=challenge&code_challenge_method=plain&scope=tweet.read%20tweet.write%20users.read%20offline.access`;
  console.log(xOauthUrl);
  res.redirect(xOauthUrl);
});

app.get("/x/callback", async (req, res) => {
  const { code, state: callbackState } = req.query;
  console.log(code, callbackState);
  if (callbackState !== state) {
    return res.status(400).send("Invalid state");
  }
  try {
    const data = qs.stringify({
      code,
      grant_type: "authorization_code",
      redirect_uri: process.env.X_REDIRECT_URI,
      code_verifier: "challenge",
    });
    const response = await axios.post(X_URL_MAP.ACCESS_TOKEN_URL, data, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${base64Credentials}`,
      },
    });
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    console.log(error.response.data);
    res.status(500).json(error.response.data);
  }
});

app.post("/x/tweet", async (req, res) => {
  try {
    const response = await axios.post(
      X_URL_MAP.CREATE_TWEET_URL,
      {
        text: "This tweet was created by the X API",
      },
      {
        headers: {
          Authorization: `Bearer ${req.query.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(response.data);
    res.json(response.data);
  } catch (error) {
    console.log(error.response.data);
    res.status(500).json(error.response.data);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
