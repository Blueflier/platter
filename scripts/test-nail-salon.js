require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());
app.use("/api", require("../routes/generate"));

const server = app.listen(3999, async () => {
  try {
    console.log(`Using provider: ${process.env.SITE_GEN_PROVIDER}`);
    console.log("Generating Three.js nail salon site...");
    const res = await fetch("http://localhost:3999/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test-claude-002",
        name: "Jade Blossom Nail Spa",
        description: "An upscale nail salon in the heart of Japantown offering luxury gel manicures, spa pedicures, and nail art. Known for a serene zen-inspired ambiance and meticulous attention to detail.",
        style: "zen, luxury, serene, soft pinks and jade greens",
        phone: "(415) 555-0888",
        address: "1581 Webster St, San Francisco, CA 94115",
        email: "hello@jadeblossomspa.com",
        slug: "jade-blossom-v2",
      }),
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
  server.close();
});
