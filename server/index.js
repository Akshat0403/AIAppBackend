require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Verify key
if (!process.env.REPLICATE_API_KEY) {
  console.error("❌ Missing REPLICATE_API_KEY in .env");
  process.exit(1);
}

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";

app.post("/generate-image", async (req, res) => {
  try {
    const { base64, prompt } = req.body;

    if (!base64) {
      return res.status(400).json({ error: "Image base64 is required" });
    }

    // Use FLUX or SDXL
    const model = "black-forest-labs/flux-dev";
    // Alternative:
    // const model = "stability-ai/stable-diffusion-xl";

    const response = await axios.post(
      REPLICATE_API_URL,
      {
        version: model,
        input: {
          image: `data:image/png;base64,${base64}`,
          prompt: prompt,
        },
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const prediction = response.data;

    // Poll until completed
    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed") {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const poll = await axios.get(`${REPLICATE_API_URL}/${prediction.id}`, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_KEY}` },
      });

      result = poll.data;
    }

    if (result.status === "failed") {
      return res.status(500).json({ error: "Image generation failed" });
    }

    res.json({
      image: result.output[0], // URL returned from Replicate
    });
  } catch (err) {
    console.error("❌ Error:", err);
    res
      .status(500)
      .json({ error: "Replicate API error", details: err.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${process.env.PORT}`);
});
