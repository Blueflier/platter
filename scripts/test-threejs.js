require("dotenv").config();
const express = require("express");
const app = express();
app.use(express.json());
app.use("/api", require("../routes/generate"));

const server = app.listen(3999, async () => {
  try {
    console.log("Generating Three.js site via DeepSeek...");
    const res = await fetch("http://localhost:3999/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test-3js-001",
        name: "Noir Barbershop",
        description: "A modern barbershop in SoMa with a dark, industrial aesthetic. Premium cuts, hot towel shaves, and beard sculpting. Walk-ins welcome, but the best barbers book out weeks ahead.",
        style: "dark, industrial, premium",
        phone: "(415) 555-0911",
        address: "88 Colin P Kelly Jr St, San Francisco, CA 94107",
        email: "book@noirbarbershop.com",
        slug: "noir-barbershop",
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
