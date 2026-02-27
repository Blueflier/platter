require("dotenv").config();

async function test() {
  const prompt = `Generate a complete, single-file HTML landing page for a local business called Golden Gate Auto Repair. They are family-owned since 1998, specializing in European imports with honest pricing. The style should be bold and trustworthy. Their phone is (415) 555-0387 and address is 750 Bay Shore Blvd, San Francisco, CA 94124. Make it modern, mobile-responsive, with a hero section, contact info with click-to-call, matching color palette, and a footer. Use only embedded CSS, no external dependencies. Return ONLY the raw HTML code with no markdown formatting or explanation.`;

  const res = await fetch(process.env.PIONEER_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-Key": process.env.PIONEER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: process.env.PIONEER_MODEL_ID,
      task: "generate",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  });

  console.log("Status:", res.status);
  if (res.status !== 200) {
    console.log(await res.text());
    return;
  }
  const data = await res.json();
  const c = data.completion || "";
  console.log("Length:", c.length);
  console.log("First 300:", c.slice(0, 300));
  console.log("---");
  console.log("Last 100:", c.slice(-100));
}

test().catch(e => console.error(e));
