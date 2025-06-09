import { defineConfig } from "drizzle-kit";

// Check if DATABASE_URL exists and provide helpful error message
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  console.error("📋 To fix this in Replit:");
  console.error("1. Go to the 'Secrets' tab in your Replit sidebar");
  console.error("2. Add a new secret with key: DATABASE_URL");
  console.error("3. Set the value to your PostgreSQL connection string");
  console.error("4. Or ensure the PostgreSQL service is running in the 'Database' tab");
  console.error("\n💡 Example DATABASE_URL format:");
  console.error("postgresql://username:password@host:port/database");
  throw new Error("DATABASE_URL environment variable is required. Please check your Replit secrets or database service.");
}

// Validate the DATABASE_URL format
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error("❌ Invalid DATABASE_URL format!");
  console.error("Expected format: postgresql://username:password@host:port/database");
  console.error("Current value:", databaseUrl);
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection string");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});