require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());
app.use("/api", require("../routes/generate"));

const server = app.listen(3999, async () => {
  try {
    const res = await fetch("http://localhost:3999/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test-002",
        name: "Masa's Taqueria",
        description: "Beloved Mission District taqueria famous for their al pastor and house-made horchata. Cash only, always a line.",
        style: "vibrant and warm",
        phone: "(415) 555-0219",
        address: "2987 24th St, San Francisco, CA 94110",
        email: "masataqueria@gmail.com",
        slug: "masas-taqueria",
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
