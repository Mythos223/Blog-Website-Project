import fs from "fs";
import crypto from "crypto";

// Function to generate a random key
const generateKey = (length) => crypto.randomBytes(length).toString("hex");

// Generate keys
const sessionSecret = generateKey(32); // 256-bit key for session
const EncryptionKey = generateKey(32); // 256-bit key for AES-256

// Defined path for .env file
const envFilePath = ".env";

// Prepares content for .enc file
const envContent = `
SESSION_SECRET=${sessionSecret}
SECRET_KEY=${EncryptionKey}
PORT=3000
`;

// Write to .env file
fs.writeFile(envFilePath, envContent.trim(), (err) => {
  if (err) {
    console.error("Error writing to .env file", err);
  } else {
    console.log(".env file created/updated with new secrets");
  }
});
