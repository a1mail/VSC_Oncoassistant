
console.log("Checking environment variables...");
console.log("API_KEY present:", !!process.env.API_KEY);
if (process.env.API_KEY) {
    console.log("API_KEY length:", process.env.API_KEY.length);
    console.log("API_KEY prefix:", process.env.API_KEY.substring(0, 4));
}
console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY) {
    console.log("GEMINI_API_KEY length:", process.env.GEMINI_API_KEY.length);
}
