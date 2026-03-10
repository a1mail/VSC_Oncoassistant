
console.log("Environment Keys:", Object.keys(process.env).sort());
console.log("API_KEY:", process.env.API_KEY ? "Present" : "Missing");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "Present" : "Missing");
console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "Present" : "Missing");
